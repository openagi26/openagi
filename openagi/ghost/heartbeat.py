"""
心跳调度器 (Heartbeat Scheduler) — OpenAGI Layer 4 永生层
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
复用 openagi_m2/ghost/scheduler.py 设计，适配新架构。

功能：
  · 熵驱动自适应心跳（calm=300s, crisis=60s）
  · 定期状态持久化
  · 触发知识蒸馏
  · 健康检查
  · 崩溃恢复
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

logger = logging.getLogger("openagi.ghost")


@dataclass
class HeartbeatConfig:
    """心跳配置。"""

    intervals: dict[str, int] = field(default_factory=lambda: {
        "calm": 300,
        "focused": 180,
        "anxious": 120,
        "crisis": 60,
    })
    state_dir: str = "~/.openagi/data/state"
    auto_save: bool = True
    save_interval: int = 300  # 秒
    crash_recovery: bool = True
    max_crash_retries: int = 5
    retry_interval: int = 5  # 秒


@dataclass
class SystemState:
    """系统状态快照（用于持久化和恢复）。"""

    entropy: float = 0.40
    valence: float = 0.60
    level: str = "focused"
    uptime_seconds: float = 0
    total_heartbeats: int = 0
    last_heartbeat: str = ""
    active_sessions: int = 0
    memory_stats: dict = field(default_factory=dict)
    saved_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class HeartbeatScheduler:
    """
    心跳调度器。

    根据心绪引擎的熵级别自适应调整心跳频率。
    负责定期保存状态、触发蒸馏、健康检查。
    """

    def __init__(self, config: HeartbeatConfig | None = None):
        self._config = config or HeartbeatConfig()
        self._running = False
        self._heartbeat_count = 0
        self._started_at = time.time()
        self._callbacks: list[Callable] = []
        self._current_interval = 180  # 默认focused
        self._task: asyncio.Task | None = None
        self._state_path = Path(self._config.state_dir).expanduser()
        self._state_path.mkdir(parents=True, exist_ok=True)

    # ── 启动/停止 ──────────────────────────────────────────────────────────

    async def start(self) -> None:
        """启动心跳循环。"""
        if self._running:
            return
        self._running = True
        self._started_at = time.time()

        # 尝试恢复上次状态
        if self._config.crash_recovery:
            recovered = self._load_state()
            if recovered:
                logger.info(f"从上次状态恢复：heartbeats={recovered.total_heartbeats}")

        self._task = asyncio.create_task(self._heartbeat_loop())
        logger.info(f"心跳调度器启动，间隔={self._current_interval}s")

    async def stop(self) -> None:
        """停止心跳循环，保存最终状态。"""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._save_state()
        logger.info(f"心跳调度器停止，共{self._heartbeat_count}次心跳")

    # ── 心跳循环 ────────────────────────────────────────────────────────────

    async def _heartbeat_loop(self) -> None:
        """主心跳循环。"""
        while self._running:
            try:
                await self._execute_heartbeat()
                await asyncio.sleep(self._current_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"心跳异常: {e}")
                await asyncio.sleep(5)  # 短暂等待后重试

    async def _execute_heartbeat(self) -> None:
        """执行一次心跳。"""
        self._heartbeat_count += 1
        now = datetime.now(timezone.utc).isoformat()

        logger.debug(f"心跳 #{self._heartbeat_count} @ {now}")

        # 执行所有注册的回调
        for callback in self._callbacks:
            try:
                result = callback()
                if asyncio.iscoroutine(result):
                    await result
            except Exception as e:
                logger.error(f"心跳回调异常: {e}")

        # 定期保存状态
        if self._config.auto_save and self._heartbeat_count % 5 == 0:
            self._save_state()

    # ── 频率调整 ────────────────────────────────────────────────────────────

    def update_interval(self, entropy_level: str) -> int:
        """根据熵级别更新心跳间隔。返回新间隔。"""
        new_interval = self._config.intervals.get(entropy_level, 180)
        if new_interval != self._current_interval:
            logger.info(f"心跳间隔调整: {self._current_interval}s → {new_interval}s ({entropy_level})")
            self._current_interval = new_interval
        return self._current_interval

    # ── 回调注册 ────────────────────────────────────────────────────────────

    def register_callback(self, fn: Callable) -> None:
        """注册心跳回调（健康检查/蒸馏触发/状态同步等）。"""
        self._callbacks.append(fn)

    # ── 状态持久化 ──────────────────────────────────────────────────────────

    def _save_state(self) -> None:
        """保存系统状态到磁盘。"""
        state = SystemState(
            total_heartbeats=self._heartbeat_count,
            last_heartbeat=datetime.now(timezone.utc).isoformat(),
            uptime_seconds=time.time() - self._started_at,
        )
        state_file = self._state_path / "heartbeat_state.json"
        try:
            state_file.write_text(
                json.dumps({
                    "entropy": state.entropy,
                    "valence": state.valence,
                    "level": state.level,
                    "uptime_seconds": state.uptime_seconds,
                    "total_heartbeats": state.total_heartbeats,
                    "last_heartbeat": state.last_heartbeat,
                    "saved_at": state.saved_at,
                }, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except Exception as e:
            logger.error(f"保存状态失败: {e}")

    def _load_state(self) -> SystemState | None:
        """从磁盘恢复状态。"""
        state_file = self._state_path / "heartbeat_state.json"
        if not state_file.exists():
            return None
        try:
            data = json.loads(state_file.read_text(encoding="utf-8"))
            return SystemState(**{k: v for k, v in data.items() if k in SystemState.__dataclass_fields__})
        except Exception as e:
            logger.error(f"恢复状态失败: {e}")
            return None

    # ── 状态查询 ────────────────────────────────────────────────────────────

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def heartbeat_count(self) -> int:
        return self._heartbeat_count

    @property
    def current_interval(self) -> int:
        return self._current_interval

    def get_uptime(self) -> float:
        """运行时长（秒）。"""
        return round(time.time() - self._started_at, 1)

    def get_stats(self) -> dict:
        """获取调度器统计。"""
        return {
            "running": self._running,
            "heartbeat_count": self._heartbeat_count,
            "current_interval": self._current_interval,
            "uptime_seconds": self.get_uptime(),
            "callbacks_count": len(self._callbacks),
            "auto_save": self._config.auto_save,
            "crash_recovery": self._config.crash_recovery,
        }
