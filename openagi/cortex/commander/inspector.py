"""
巡检AI (Commander/Inspector) — 自主调度的AI指挥官
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
坐在"用户位置"上，代替用户发出指令。
指令仍经多核治理流程审查。

功能：
  · 定时触发（1分钟~1年自定义）
  · 事件触发（7种事件+智能等待）
  · 信息收集→总结→规划→指令生成
  · 草稿模式/自动执行模式
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import StrEnum
from typing import Callable

logger = logging.getLogger("openagi.commander")


class SendMode(StrEnum):
    DRAFT = "draft"  # 填入发送框等用户确认
    AUTO = "auto"  # 直接发送执行


class EventType(StrEnum):
    TASK_COMPLETED = "task:completed"
    TASK_FAILED = "task:failed"
    TASK_BLOCKED = "task:blocked"
    ENTROPY_CRISIS = "entropy:crisis"
    MEMORY_DISTILL = "memory:distill"
    SCHEDULE_TIMER = "schedule:timer"
    USER_IDLE = "user:idle"


@dataclass
class InspectionResult:
    """巡检结果。"""

    summary: str  # 近期进展摘要
    issues: list[str] = field(default_factory=list)  # 识别的阻塞项/风险
    next_action: str = ""  # 规划的下一步
    command: str = ""  # 生成的最佳指令
    triggered_by: str = ""  # 触发来源
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class CommanderConfig:
    """巡检AI配置。"""

    enabled: bool = True
    model: str = "claude-haiku-4-5-20251001"
    temperature: float = 0.5
    persona_id: str = "preset-generalist"

    # 定时触发
    interval_seconds: int = 600  # 默认10分钟

    # 事件触发开关
    events: dict[str, bool] = field(default_factory=lambda: {
        EventType.TASK_COMPLETED: True,
        EventType.TASK_FAILED: True,
        EventType.TASK_BLOCKED: False,
        EventType.ENTROPY_CRISIS: True,
        EventType.MEMORY_DISTILL: False,
        EventType.USER_IDLE: False,
    })

    # 智能等待
    smart_wait: bool = True  # 有任务执行中时延迟巡检

    # 发送模式
    send_mode: SendMode = SendMode.DRAFT
    auto_max_permission: str = "L1"  # 自动模式最高权限

    # 巡检内容
    check_items: list[str] = field(default_factory=lambda: [
        "project_progress",
        "blockers_risks",
        "pending_tasks",
        "next_action",
        "system_health",
    ])


class Commander:
    """
    巡检AI指挥官。

    定期或按事件检查系统状态，总结进展，规划下一步，生成指令。
    """

    def __init__(self, config: CommanderConfig | None = None, llm_client=None):
        self._config = config or CommanderConfig()
        self._llm_client = llm_client  # LLMRouter，可选
        self._running = False
        self._inspection_count = 0
        self._last_inspection: InspectionResult | None = None
        self._task_in_progress = False  # 是否有任务正在执行
        self._pending_events: list[EventType] = []
        self._timer_task: asyncio.Task | None = None
        self._info_collectors: list[Callable] = []
        self._command_handler: Callable | None = None  # 指令发送回调

    # ── 启动/停止 ──────────────────────────────────────────────────────────

    async def start(self) -> None:
        """启动巡检AI。"""
        if not self._config.enabled or self._running:
            return
        self._running = True
        self._timer_task = asyncio.create_task(self._timer_loop())
        logger.info(f"巡检AI启动，间隔={self._config.interval_seconds}s，模式={self._config.send_mode}")

    async def stop(self) -> None:
        """停止巡检AI。"""
        self._running = False
        if self._timer_task:
            self._timer_task.cancel()
            try:
                await self._timer_task
            except asyncio.CancelledError:
                pass
        logger.info(f"巡检AI停止，共执行{self._inspection_count}次巡检")

    # ── 定时循环 ────────────────────────────────────────────────────────────

    async def _timer_loop(self) -> None:
        """定时巡检循环。"""
        while self._running:
            try:
                await asyncio.sleep(self._config.interval_seconds)
                if not self._running:
                    break

                # 智能等待：有任务执行中时跳过
                if self._config.smart_wait and self._task_in_progress:
                    logger.debug("有任务执行中，延迟巡检")
                    continue

                await self.inspect(triggered_by=EventType.SCHEDULE_TIMER)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"定时巡检异常: {e}")

    # ── 事件触发 ────────────────────────────────────────────────────────────

    async def on_event(self, event: EventType | str) -> None:
        """接收事件，判断是否触发巡检。"""
        event_str = str(event)
        if not self._config.events.get(event_str, False):
            return

        # 危机事件：无论如何立即触发
        if event == EventType.ENTROPY_CRISIS:
            await self.inspect(triggered_by=event_str)
            return

        # 智能等待
        if self._config.smart_wait and self._task_in_progress:
            self._pending_events.append(event)
            logger.debug(f"事件 {event} 加入待处理队列（等待任务完成）")
            return

        await self.inspect(triggered_by=event_str)

    def set_task_in_progress(self, in_progress: bool) -> None:
        """设置当前是否有任务在执行。"""
        was_in_progress = self._task_in_progress
        self._task_in_progress = in_progress

        # 任务完成后，处理待处理的事件
        if was_in_progress and not in_progress and self._pending_events:
            events = self._pending_events
            self._pending_events = []
            # 合并为一次巡检
            asyncio.create_task(self.inspect(
                triggered_by=f"pending_events({len(events)})"
            ))

    # ── 核心巡检逻辑 ────────────────────────────────────────────────────────

    async def inspect(self, triggered_by: str = "manual") -> InspectionResult:
        """
        执行一次巡检。

        Step 1: 信息收集（调用所有注册的收集器）
        Step 2: 总结+规划（LLM生成摘要和指令）
        Step 3: 发送指令（草稿或自动）
        """
        self._inspection_count += 1
        logger.info(f"巡检 #{self._inspection_count}，触发源: {triggered_by}")

        # Step 1: 信息收集
        collected_info = {}
        for collector in self._info_collectors:
            try:
                result = collector()
                if asyncio.iscoroutine(result):
                    result = await result
                if isinstance(result, dict):
                    collected_info.update(result)
            except Exception as e:
                logger.error(f"信息收集异常: {e}")

        # Step 2: 总结+规划
        # 先用规则生成基础摘要和问题列表
        issues: list[str] = []
        if "heart_status" in collected_info:
            heart = collected_info["heart_status"]
            if heart.get("level") in ("anxious", "crisis"):
                issues.append(f"系统熵值偏高: {heart.get('entropy', '?')}")

        if "memory_stats" in collected_info:
            mem = collected_info["memory_stats"]
            working = mem.get("working", {})
            if working.get("total_items", 0) > 50:
                issues.append("热记忆条目过多，建议清理或蒸馏")

        summary = f"巡检完成。收集到{len(collected_info)}项信息。"
        command = ""

        # 如果有LLM客户端，调用LLM生成更智能的摘要和指令
        if self._llm_client is not None:
            try:
                info_text = "\n".join(
                    f"- {k}: {v}" for k, v in collected_info.items()
                ) or "（无收集到的信息）"
                issues_text = "\n".join(f"- {i}" for i in issues) or "（无）"
                prompt = (
                    f"你是系统巡检AI。以下是当前系统状态：\n{info_text}\n\n"
                    f"已识别风险：\n{issues_text}\n\n"
                    f"请用1-2句话总结系统当前状态，并给出下一步最优指令（如无需操作，指令留空）。"
                    f"回复格式：\n摘要：<摘要内容>\n指令：<指令内容或空>"
                )
                llm_result = await self._llm_client.call(
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.5,
                    max_tokens=200,
                )
                llm_text = llm_result.get("content", "")
                if llm_text:
                    for line in llm_text.splitlines():
                        if line.startswith("摘要："):
                            summary = line[3:].strip()
                        elif line.startswith("指令："):
                            command = line[3:].strip()
            except Exception as e:
                logger.warning(f"LLM生成摘要失败，降级为规则摘要: {e}")

        result = InspectionResult(
            summary=summary,
            issues=issues,
            next_action="继续当前任务",
            command=command,
            triggered_by=triggered_by,
        )

        self._last_inspection = result

        # Step 3: 发送指令
        if self._command_handler and result.command:
            if self._config.send_mode == SendMode.AUTO:
                try:
                    await self._command_handler(result.command, auto=True)
                except Exception as e:
                    logger.error(f"自动执行指令失败: {e}")
            else:
                # 草稿模式：通知UI填入发送框
                try:
                    await self._command_handler(result.command, auto=False)
                except Exception as e:
                    logger.error(f"草稿指令发送失败: {e}")

        return result

    # ── 注册 ────────────────────────────────────────────────────────────────

    def register_info_collector(self, fn: Callable) -> None:
        """注册信息收集器（心绪/记忆/任务等子系统提供）。"""
        self._info_collectors.append(fn)

    def set_command_handler(self, fn: Callable) -> None:
        """设置指令发送回调。"""
        self._command_handler = fn

    # ── 状态查询 ────────────────────────────────────────────────────────────

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def inspection_count(self) -> int:
        return self._inspection_count

    @property
    def last_inspection(self) -> InspectionResult | None:
        return self._last_inspection

    def get_stats(self) -> dict:
        return {
            "enabled": self._config.enabled,
            "running": self._running,
            "inspection_count": self._inspection_count,
            "interval_seconds": self._config.interval_seconds,
            "send_mode": self._config.send_mode,
            "smart_wait": self._config.smart_wait,
            "task_in_progress": self._task_in_progress,
            "pending_events": len(self._pending_events),
        }

    def recover_from_crash(self, reason: str) -> None:
        """
        崩溃恢复：记录崩溃原因，重置内部状态，触发心跳事件。

        Args:
            reason: 崩溃原因描述
        """
        logger.error(f"崩溃恢复触发，原因: {reason}")

        # 重置内部状态
        self._task_in_progress = False
        self._pending_events = []

        logger.info(
            f"巡检AI状态已重置 — inspection_count={self._inspection_count}，running={self._running}"
        )

        # 触发心跳事件
        self._dispatch_heartbeat_event("crash_recovered", reason=reason)

    def _dispatch_heartbeat_event(self, event_name: str, reason: str = "") -> None:
        """内部：向已注册的信息收集器广播心跳事件（用于崩溃恢复通知）。"""
        logger.info(f"心跳事件: {event_name}，备注: {reason}")
