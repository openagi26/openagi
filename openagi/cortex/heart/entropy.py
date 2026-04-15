"""
心绪引擎 (HeartEngine) — OpenAGI 的情绪核心
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
复用自 openagi_m2/heart/entropy.py，适配OpenAGI架构。

维护系统的双轴情绪状态：
  · entropy (熵值) 0.0=禅定 → 1.0=崩溃
  · valence (效价) 0.0=消极 → 1.0=积极

所有模块通过 HeartEngine 单例上报事件，
系统根据当前心境调整：调度频率 / LLM温度 / 工具选择 / 记忆优先级 / 语音语调。
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable

logger = logging.getLogger("openagi.heart")

# ─── 事件权重注册表 ─────────────────────────────────────────────────────────

ENTROPY_EVENTS: dict[str, float] = {
    # LLM相关
    "llm_call_success": -0.02,
    "llm_call_failed": +0.07,
    "llm_rate_limited": +0.12,
    # 任务相关
    "task_success": -0.05,
    "task_failed": +0.08,
    "task_blocked": +0.06,
    # 记忆相关
    "memory_distill_complete": -0.03,
    "memory_overflow": +0.05,
    # 治理相关
    "audit_passed": -0.02,
    "audit_blocked": +0.04,
    "permission_escalated": +0.03,
    # 巡检相关
    "commander_check_ok": -0.01,
    "commander_found_issue": +0.06,
    # 系统相关
    "system_idle_rest": -0.04,
    "system_crash_recovered": +0.10,
    "system_healthy": -0.03,
    # 用户相关
    "user_praise": -0.05,
    "user_complaint": +0.06,
    "user_idle_long": +0.02,
}

# 熵级别阈值
CALM_THRESHOLD = 0.20
FOCUSED_THRESHOLD = 0.55
ANXIOUS_THRESHOLD = 0.80


# ─── 数据结构 ───────────────────────────────────────────────────────────────

@dataclass
class HeartbeatEvent:
    """一次心跳事件的完整记录。"""

    event_type: str
    source: str
    delta: float
    entropy_before: float
    entropy_after: float
    valence_after: float
    note: str
    ts: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class HeartStatus:
    """对外暴露的心境摘要，供LLM prompt和UI使用。"""

    entropy: float
    valence: float
    level: str
    emoji: str
    description: str
    advice: str


# ─── 主引擎 ─────────────────────────────────────────────────────────────────

class HeartEngine:
    """
    OpenAGI 的情绪核心。

    设计为应用级单例，所有子系统持有同一引用。
    线程安全：通过 asyncio.Lock 保护写操作。

    双轴驱动范围：
    - 调度频率（calm=300s, focused=180s, anxious=120s, crisis=60s）
    - LLM温度（calm→高创造性, crisis→低保守性）
    - 工具选择（crisis时禁用非必要工具）
    - 记忆优先级（anxious时优先检索解决方案）
    - 语音语调（calm→温柔, crisis→急促）
    - 表情动画（calm→微笑, crisis→紧张）
    """

    def __init__(
        self,
        initial_entropy: float = 0.40,
        initial_valence: float = 0.60,
        history_limit: int = 200,
    ):
        self._entropy = max(0.0, min(1.0, initial_entropy))
        self._valence = max(0.0, min(1.0, initial_valence))
        self._history: list[HeartbeatEvent] = []
        self._history_limit = history_limit
        self._lock = asyncio.Lock()
        self._callbacks: list[Callable[[HeartbeatEvent], None]] = []
        self._started_at = time.time()

        logger.info(f"HeartEngine 初始化 — entropy={self._entropy:.2f} valence={self._valence:.2f}")

    # ── 属性读取 ────────────────────────────────────────────────────────────

    @property
    def entropy(self) -> float:
        return round(self._entropy, 4)

    @property
    def valence(self) -> float:
        return round(self._valence, 4)

    @property
    def level(self) -> str:
        """语义化熵级别：calm / focused / anxious / crisis。"""
        if self._entropy <= CALM_THRESHOLD:
            return "calm"
        if self._entropy <= FOCUSED_THRESHOLD:
            return "focused"
        if self._entropy <= ANXIOUS_THRESHOLD:
            return "anxious"
        return "crisis"

    # ── 事件上报 ────────────────────────────────────────────────────────────

    def update_entropy(self, stress_factor: float, source: str = "system", note: str = "") -> float:
        """
        直接施加熵变。
        stress_factor > 0 → 熵增（压力）
        stress_factor < 0 → 熵减（放松）
        """
        before = self._entropy
        self._entropy = max(0.0, min(1.0, self._entropy + stress_factor))
        self._valence = max(0.0, min(1.0, self._valence - stress_factor * 0.5))

        event = HeartbeatEvent(
            event_type="raw_delta",
            source=source,
            delta=stress_factor,
            entropy_before=before,
            entropy_after=self._entropy,
            valence_after=self._valence,
            note=note,
        )
        self._append_history(event)
        self._notify(event)
        return self._entropy

    def push_event(self, event_type: str, source: str = "system", note: str = "") -> float:
        """通过预定义事件类型上报，自动查权重表。"""
        delta = ENTROPY_EVENTS.get(event_type, 0.0)
        if delta == 0.0 and event_type not in ENTROPY_EVENTS:
            logger.warning(f"未知事件类型: '{event_type}'，熵值不变。")
        return self.update_entropy(delta, source=source, note=f"[{event_type}] {note}")

    async def async_push_event(self, event_type: str, source: str = "system", note: str = "") -> float:
        """异步版事件上报（线程安全）。"""
        async with self._lock:
            return self.push_event(event_type, source, note)

    # ── 状态查询 ────────────────────────────────────────────────────────────

    def get_status_text(self) -> str:
        """返回简短状态字符串。"""
        mapping = {
            "calm": "🧘 深度冷静",
            "focused": "💓 运行平稳",
            "anxious": "😰 轻度焦虑",
            "crisis": "⚠️ 极度焦虑",
        }
        return mapping.get(self.level, "💓 运行平稳")

    def get_full_status(self) -> HeartStatus:
        """返回完整心境摘要，供LLM构建prompt和UI展示使用。"""
        advice_map = {
            "calm": "系统平静，可以探索新任务或优化现有逻辑。",
            "focused": "保持当前节奏，专注执行核心任务。",
            "anxious": "资源受压，请优先处理错误和紧急任务，暂停探索性工作。",
            "crisis": "危机模式：仅执行最优先的生存任务，最小化Token消耗。",
        }
        emoji_map = {"calm": "🧘", "focused": "💓", "anxious": "😰", "crisis": "🆘"}
        desc_map = {
            "calm": f"系统熵值极低 ({self._entropy:.2f})，处于深度冷静状态。",
            "focused": f"系统运行平稳，熵值 {self._entropy:.2f}，效价 {self._valence:.2f}。",
            "anxious": f"熵值偏高 ({self._entropy:.2f})，系统感到压力，需要关注。",
            "crisis": f"熵值危险 ({self._entropy:.2f})！系统进入危机模式。",
        }
        lvl = self.level
        return HeartStatus(
            entropy=self.entropy,
            valence=self.valence,
            level=lvl,
            emoji=emoji_map[lvl],
            description=desc_map[lvl],
            advice=advice_map[lvl],
        )

    def get_heartbeat_interval(self) -> int:
        """根据熵级别返回心跳间隔（秒）。"""
        intervals = {"calm": 300, "focused": 180, "anxious": 120, "crisis": 60}
        return intervals.get(self.level, 180)

    def get_recommended_temperature(self) -> float:
        """根据熵级别返回推荐LLM温度。"""
        temps = {"calm": 0.8, "focused": 0.7, "anxious": 0.5, "crisis": 0.3}
        return temps.get(self.level, 0.7)

    def recent_events(self, n: int = 10) -> list[HeartbeatEvent]:
        """获取最近n条事件。"""
        return self._history[-n:]

    def uptime_seconds(self) -> float:
        """系统运行时长（秒）。"""
        return round(time.time() - self._started_at, 1)

    # ── 回调注册 ────────────────────────────────────────────────────────────

    def register_callback(self, fn: Callable[[HeartbeatEvent], None]) -> None:
        """注册熵变回调，每次entropy更新后触发。"""
        self._callbacks.append(fn)

    # ── 内部工具 ────────────────────────────────────────────────────────────

    def _append_history(self, event: HeartbeatEvent) -> None:
        self._history.append(event)
        if len(self._history) > self._history_limit:
            self._history = self._history[-self._history_limit :]

    def _notify(self, event: HeartbeatEvent) -> None:
        for cb in self._callbacks:
            try:
                cb(event)
            except Exception as e:
                logger.error(f"回调异常: {e}")

    def __repr__(self) -> str:
        return f"<HeartEngine entropy={self.entropy:.3f} valence={self.valence:.3f} level={self.level} uptime={self.uptime_seconds()}s>"
