"""
tools/hooks/manager.py — Hook（钩子）管理器
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
功能：
  · 定义四类 Hook（钩子）点：文件/Git/Agent/API
  · 注册/注销 Hook 处理器
  · 顺序执行或并行执行 Hook
  · 记录 Hook 执行日志
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable

logger = logging.getLogger("openagi.tools.hooks")


# ─── Hook 点定义 ──────────────────────────────────────────────────────────────

class HookPoint(str, Enum):
    """
    系统内置 Hook（钩子）点，覆盖四大类事件：
    - 文件操作（file_*）
    - Git 操作（git_*）
    - Agent 生命周期（agent_*）
    - API 调用（api_*）
    """
    # 文件操作
    BEFORE_FILE_WRITE  = "before_file_write"
    AFTER_FILE_WRITE   = "after_file_write"
    BEFORE_FILE_READ   = "before_file_read"
    AFTER_FILE_READ    = "after_file_read"
    ON_FILE_DELETE     = "on_file_delete"

    # Git 操作
    BEFORE_GIT_COMMIT  = "before_git_commit"
    AFTER_GIT_COMMIT   = "after_git_commit"
    BEFORE_GIT_PUSH    = "before_git_push"
    AFTER_GIT_PUSH     = "after_git_push"
    ON_GIT_CONFLICT    = "on_git_conflict"

    # Agent 生命周期
    BEFORE_AGENT_CALL  = "before_agent_call"
    AFTER_AGENT_CALL   = "after_agent_call"
    ON_AGENT_ERROR     = "on_agent_error"
    ON_AGENT_TIMEOUT   = "on_agent_timeout"

    # API/工具调用
    BEFORE_TOOL_CALL   = "before_tool_call"
    AFTER_TOOL_CALL    = "after_tool_call"
    ON_ERROR           = "on_error"
    ON_RATE_LIMIT      = "on_rate_limit"


class ExecutionMode(str, Enum):
    """Hook 执行模式。"""
    SEQUENTIAL = "sequential"   # 顺序执行（前一个完成才运行下一个）
    PARALLEL   = "parallel"     # 并行执行（所有 Hook 同时运行）


# ─── 数据结构 ─────────────────────────────────────────────────────────────────

@dataclass
class HookHandler:
    """单个 Hook（钩子）处理器的描述符。"""
    name:        str                   # Handler 标识名
    point:       HookPoint             # 绑定的 Hook 点
    handler:     Callable              # 实际处理函数（同步或异步）
    priority:    int   = 50            # 优先级（0=最高，100=最低），顺序模式下按升序执行
    enabled:     bool  = True
    description: str   = ""

    def __post_init__(self):
        if not (0 <= self.priority <= 100):
            raise ValueError(f"priority 必须在 0-100 之间，当前值: {self.priority}")


@dataclass
class HookExecutionLog:
    """单次 Hook 执行记录。"""
    point:        str
    handler_name: str
    success:      bool
    duration_ms:  float
    error:        str | None = None
    context_keys: list[str]  = field(default_factory=list)
    timestamp:    float      = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "point":        self.point,
            "handler":      self.handler_name,
            "success":      self.success,
            "duration_ms":  round(self.duration_ms, 2),
            "error":        self.error,
            "context_keys": self.context_keys,
            "timestamp":    self.timestamp,
        }


@dataclass
class HookResult:
    """整批 Hook 执行的汇总结果。"""
    point:         str
    mode:          str
    total:         int
    succeeded:     int
    failed:        int
    aborted:       bool = False     # 顺序模式下某个 Hook 中断链时为 True
    logs:          list[HookExecutionLog] = field(default_factory=list)
    total_ms:      float = 0.0

    @property
    def all_passed(self) -> bool:
        return self.failed == 0 and not self.aborted


# ─── Hook 管理器 ──────────────────────────────────────────────────────────────

class HookManager:
    """
    Hook（钩子）管理器。

    核心职责：
      1. 注册/注销 Hook 处理器
      2. 触发 Hook 点，按顺序或并行执行所有绑定的处理器
      3. 记录执行日志，供审计和调试使用
    """

    def __init__(self, max_log_size: int = 1000):
        # hook_point → 处理器列表
        self._handlers: dict[str, list[HookHandler]] = {}
        self._logs:     list[HookExecutionLog]        = []
        self._max_log_size = max_log_size

    # ── 注册/注销 ──────────────────────────────────────────────────────────────

    def register(
        self,
        point:       HookPoint | str,
        handler:     Callable,
        name:        str  | None = None,
        priority:    int         = 50,
        description: str         = "",
    ) -> HookHandler:
        """
        注册一个 Hook 处理器。

        参数：
          point       — 绑定的 Hook 点（HookPoint 枚举或字符串）
          handler     — 处理函数（同步或 async（异步））
          name        — 唯一标识名（默认用函数名）
          priority    — 执行优先级 0-100（数字越小越先执行）
          description — 说明
        """
        point_str = point.value if isinstance(point, HookPoint) else str(point)
        name      = name or handler.__name__

        hook = HookHandler(
            name=name, point=HookPoint(point_str),
            handler=handler, priority=priority,
            description=description,
        )

        if point_str not in self._handlers:
            self._handlers[point_str] = []

        # 避免重复注册同名 Handler
        self._handlers[point_str] = [h for h in self._handlers[point_str] if h.name != name]
        self._handlers[point_str].append(hook)

        # 按优先级排序
        self._handlers[point_str].sort(key=lambda h: h.priority)

        logger.debug(f"[Hook] 注册: {name} → {point_str} (priority={priority})")
        return hook

    def unregister(self, point: HookPoint | str, name: str) -> bool:
        """注销指定 Hook 点上的某个处理器。返回是否成功找到并删除。"""
        point_str = point.value if isinstance(point, HookPoint) else str(point)
        handlers  = self._handlers.get(point_str, [])
        before    = len(handlers)
        self._handlers[point_str] = [h for h in handlers if h.name != name]
        removed = len(self._handlers[point_str]) < before
        if removed:
            logger.debug(f"[Hook] 注销: {name} from {point_str}")
        return removed

    def unregister_all(self, point: HookPoint | str) -> int:
        """清除某个 Hook 点上的全部处理器。返回被清除的数量。"""
        point_str = point.value if isinstance(point, HookPoint) else str(point)
        count     = len(self._handlers.get(point_str, []))
        self._handlers[point_str] = []
        return count

    def enable(self, point: HookPoint | str, name: str) -> bool:
        """启用某个处理器。"""
        return self._set_enabled(point, name, True)

    def disable(self, point: HookPoint | str, name: str) -> bool:
        """禁用某个处理器（不删除，跳过执行）。"""
        return self._set_enabled(point, name, False)

    def _set_enabled(self, point: HookPoint | str, name: str, enabled: bool) -> bool:
        point_str = point.value if isinstance(point, HookPoint) else str(point)
        for h in self._handlers.get(point_str, []):
            if h.name == name:
                h.enabled = enabled
                return True
        return False

    # ── 触发执行 ──────────────────────────────────────────────────────────────

    async def trigger(
        self,
        point:   HookPoint | str,
        context: dict[str, Any] | None = None,
        mode:    ExecutionMode | str   = ExecutionMode.SEQUENTIAL,
    ) -> HookResult:
        """
        触发某个 Hook 点，执行所有已注册的处理器。

        参数：
          point   — Hook 点
          context — 传递给所有处理器的上下文字典（共享，可在处理器中修改）
          mode    — 执行模式（sequential=顺序，parallel=并行）

        返回：HookResult 汇总结果
        """
        point_str = point.value if isinstance(point, HookPoint) else str(point)
        mode_str  = mode.value if isinstance(mode, ExecutionMode) else str(mode)
        ctx       = context if context is not None else {}

        handlers = [h for h in self._handlers.get(point_str, []) if h.enabled]

        result = HookResult(
            point=point_str,
            mode=mode_str,
            total=len(handlers),
            succeeded=0,
            failed=0,
        )

        if not handlers:
            return result

        start = time.monotonic()

        if mode_str == ExecutionMode.PARALLEL.value:
            await self._run_parallel(handlers, ctx, result)
        else:
            await self._run_sequential(handlers, ctx, result)

        result.total_ms = (time.monotonic() - start) * 1000
        logger.debug(
            f"[Hook] {point_str} 执行完成: "
            f"{result.succeeded}/{result.total} 成功, 耗时 {result.total_ms:.1f}ms"
        )
        return result

    async def _run_sequential(
        self,
        handlers: list[HookHandler],
        ctx:      dict,
        result:   HookResult,
    ) -> None:
        """顺序执行模式：若某个 Handler 返回 False，中断后续执行。"""
        for handler in handlers:
            log = await self._invoke_one(handler, ctx)
            self._append_log(log)
            result.logs.append(log)
            if log.success:
                result.succeeded += 1
            else:
                result.failed += 1
                # Handler 显式返回 False 时中断链
                if log.error and "ABORT" in log.error:
                    result.aborted = True
                    logger.warning(f"[Hook] {handler.name} 中断了 {result.point} Hook 链")
                    break

    async def _run_parallel(
        self,
        handlers: list[HookHandler],
        ctx:      dict,
        result:   HookResult,
    ) -> None:
        """并行执行模式：所有 Handler 同时启动，等待全部完成。"""
        tasks  = [asyncio.create_task(self._invoke_one(h, ctx)) for h in handlers]
        logs   = await asyncio.gather(*tasks, return_exceptions=True)
        for log in logs:
            if isinstance(log, Exception):
                err_log = HookExecutionLog(
                    point=result.point, handler_name="unknown",
                    success=False, duration_ms=0, error=str(log),
                )
                self._append_log(err_log)
                result.logs.append(err_log)
                result.failed += 1
            else:
                self._append_log(log)
                result.logs.append(log)
                if log.success:
                    result.succeeded += 1
                else:
                    result.failed += 1

    async def _invoke_one(self, hook: HookHandler, ctx: dict) -> HookExecutionLog:
        """安全调用单个 Handler，捕获所有异常，返回执行日志。"""
        start = time.monotonic()
        error = None
        success = True
        try:
            result = hook.handler(ctx)  # type: ignore[call-arg]
            if asyncio.iscoroutine(result):
                result = await result
            # Handler 可以返回 False 来中断顺序链
            if result is False:
                error   = "ABORT: Handler 明确中断执行链"
                success = False
        except Exception as e:
            error   = str(e)
            success = False
            logger.error(f"[Hook] {hook.name} 执行异常: {e}")

        duration_ms = (time.monotonic() - start) * 1000
        return HookExecutionLog(
            point=hook.point.value,
            handler_name=hook.name,
            success=success,
            duration_ms=duration_ms,
            error=error,
            context_keys=list(ctx.keys()),
        )

    # ── 日志管理 ──────────────────────────────────────────────────────────────

    def _append_log(self, log: HookExecutionLog) -> None:
        """追加日志，超出上限时移除最旧的记录。"""
        self._logs.append(log)
        if len(self._logs) > self._max_log_size:
            self._logs = self._logs[-self._max_log_size:]

    def get_logs(
        self,
        point:       str | None = None,
        handler_name: str | None = None,
        limit:       int = 100,
    ) -> list[dict]:
        """
        查询执行日志。

        参数：
          point        — 过滤特定 Hook 点（为 None 则不过滤）
          handler_name — 过滤特定处理器名
          limit        — 最多返回条数
        """
        logs = self._logs
        if point:
            logs = [l for l in logs if l.point == point]
        if handler_name:
            logs = [l for l in logs if l.handler_name == handler_name]
        return [l.to_dict() for l in logs[-limit:]]

    def clear_logs(self) -> int:
        """清除全部日志，返回被清除的条数。"""
        count      = len(self._logs)
        self._logs = []
        return count

    # ── 状态查询 ──────────────────────────────────────────────────────────────

    def list_handlers(self, point: HookPoint | str | None = None) -> list[dict]:
        """列出已注册的处理器信息。"""
        result = []
        items  = (
            [(point.value if isinstance(point, HookPoint) else str(point),
              self._handlers.get(point.value if isinstance(point, HookPoint) else str(point), []))]
            if point else self._handlers.items()
        )
        for pt, handlers in items:
            for h in handlers:
                result.append({
                    "point":       pt,
                    "name":        h.name,
                    "priority":    h.priority,
                    "enabled":     h.enabled,
                    "description": h.description,
                })
        return result

    def get_stats(self) -> dict:
        """获取 Hook 系统统计信息。"""
        total    = sum(len(v) for v in self._handlers.values())
        enabled  = sum(sum(1 for h in v if h.enabled) for v in self._handlers.values())
        return {
            "hook_points":       len(self._handlers),
            "total_handlers":    total,
            "enabled_handlers":  enabled,
            "disabled_handlers": total - enabled,
            "log_count":         len(self._logs),
        }


# ─── 全局单例 ─────────────────────────────────────────────────────────────────

_default_manager: HookManager | None = None


def get_hook_manager() -> HookManager:
    """获取全局默认 Hook 管理器（单例）。"""
    global _default_manager
    if _default_manager is None:
        _default_manager = HookManager()
    return _default_manager
