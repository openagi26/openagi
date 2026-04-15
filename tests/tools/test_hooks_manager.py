"""
tests/tools/test_hooks_manager.py — Hook（钩子）管理器测试
"""

from __future__ import annotations

import asyncio
import pytest

from openagi.tools.hooks.manager import (
    HookManager,
    HookPoint,
    HookHandler,
    ExecutionMode,
    get_hook_manager,
)


# ─── 注册/注销测试 ────────────────────────────────────────────────────────────

def test_register_handler():
    """注册 Handler 后应出现在列表中。"""
    mgr = HookManager()
    mgr.register(HookPoint.BEFORE_FILE_WRITE, lambda ctx: None, name="test_handler")
    handlers = mgr.list_handlers(HookPoint.BEFORE_FILE_WRITE)
    assert any(h["name"] == "test_handler" for h in handlers)


def test_register_duplicate_name_replaces():
    """同名 Handler 重复注册时应覆盖旧的，不重复添加。"""
    mgr  = HookManager()
    mgr.register(HookPoint.ON_ERROR, lambda ctx: None, name="same_name")
    mgr.register(HookPoint.ON_ERROR, lambda ctx: None, name="same_name")
    handlers = [h for h in mgr.list_handlers(HookPoint.ON_ERROR) if h["name"] == "same_name"]
    assert len(handlers) == 1


def test_unregister_handler():
    """注销后 Handler 应从列表中消失。"""
    mgr = HookManager()
    mgr.register(HookPoint.AFTER_FILE_WRITE, lambda ctx: None, name="to_remove")
    result = mgr.unregister(HookPoint.AFTER_FILE_WRITE, "to_remove")
    assert result is True
    handlers = mgr.list_handlers(HookPoint.AFTER_FILE_WRITE)
    assert not any(h["name"] == "to_remove" for h in handlers)


def test_unregister_nonexistent_returns_false():
    """注销不存在的 Handler 应返回 False。"""
    mgr    = HookManager()
    result = mgr.unregister(HookPoint.ON_ERROR, "ghost_handler")
    assert result is False


def test_unregister_all():
    """unregister_all 应清除指定点的全部 Handler。"""
    mgr = HookManager()
    mgr.register(HookPoint.BEFORE_TOOL_CALL, lambda ctx: None, name="h1")
    mgr.register(HookPoint.BEFORE_TOOL_CALL, lambda ctx: None, name="h2")
    count = mgr.unregister_all(HookPoint.BEFORE_TOOL_CALL)
    assert count == 2
    assert mgr.list_handlers(HookPoint.BEFORE_TOOL_CALL) == []


def test_enable_disable_handler():
    """禁用 Handler 后应标记为 disabled，重新启用后恢复。"""
    mgr = HookManager()
    mgr.register(HookPoint.ON_ERROR, lambda ctx: None, name="toggle_test")
    assert mgr.disable(HookPoint.ON_ERROR, "toggle_test") is True
    handlers = {h["name"]: h for h in mgr.list_handlers(HookPoint.ON_ERROR)}
    assert handlers["toggle_test"]["enabled"] is False

    assert mgr.enable(HookPoint.ON_ERROR, "toggle_test") is True
    handlers = {h["name"]: h for h in mgr.list_handlers(HookPoint.ON_ERROR)}
    assert handlers["toggle_test"]["enabled"] is True


def test_priority_ordering():
    """Handler 应按优先级升序排列（数字小的先执行）。"""
    mgr    = HookManager()
    order  = []
    mgr.register(HookPoint.AFTER_TOOL_CALL, lambda ctx: order.append("p90"), name="p90", priority=90)
    mgr.register(HookPoint.AFTER_TOOL_CALL, lambda ctx: order.append("p10"), name="p10", priority=10)
    mgr.register(HookPoint.AFTER_TOOL_CALL, lambda ctx: order.append("p50"), name="p50", priority=50)
    handlers = mgr.list_handlers(HookPoint.AFTER_TOOL_CALL)
    priorities = [h["priority"] for h in handlers]
    assert priorities == sorted(priorities)


def test_invalid_priority_raises():
    """优先级超出 0-100 范围时应抛出 ValueError。"""
    mgr = HookManager()
    with pytest.raises(ValueError):
        mgr.register(HookPoint.ON_ERROR, lambda ctx: None, name="bad", priority=150)


# ─── 顺序执行测试 ─────────────────────────────────────────────────────────────

async def test_sequential_execution_order():
    """顺序模式下 Handler 应按优先级顺序执行。"""
    mgr   = HookManager()
    order = []
    mgr.register(HookPoint.BEFORE_FILE_WRITE, lambda ctx: order.append("first"),  name="first",  priority=10)
    mgr.register(HookPoint.BEFORE_FILE_WRITE, lambda ctx: order.append("second"), name="second", priority=20)
    mgr.register(HookPoint.BEFORE_FILE_WRITE, lambda ctx: order.append("third"),  name="third",  priority=30)

    result = await mgr.trigger(HookPoint.BEFORE_FILE_WRITE, mode=ExecutionMode.SEQUENTIAL)
    assert order == ["first", "second", "third"]
    assert result.succeeded == 3
    assert result.failed == 0


async def test_sequential_abort_on_false():
    """Handler 返回 False 时应中断后续 Handler 执行。"""
    mgr   = HookManager()
    order = []
    mgr.register(HookPoint.BEFORE_GIT_COMMIT, lambda ctx: order.append("first"),  name="first",   priority=10)
    mgr.register(HookPoint.BEFORE_GIT_COMMIT, lambda ctx: False,                  name="aborter", priority=20)
    mgr.register(HookPoint.BEFORE_GIT_COMMIT, lambda ctx: order.append("third"),  name="third",   priority=30)

    result = await mgr.trigger(HookPoint.BEFORE_GIT_COMMIT, mode=ExecutionMode.SEQUENTIAL)
    assert "first" in order
    assert "third" not in order
    assert result.aborted is True


async def test_sequential_context_shared():
    """顺序模式下 context（上下文）应在各 Handler 间共享和传递。"""
    mgr = HookManager()

    def h1(ctx):
        ctx["from_h1"] = "hello"

    def h2(ctx):
        ctx["from_h2"] = ctx["from_h1"] + "_world"

    mgr.register(HookPoint.AFTER_AGENT_CALL, h1, name="h1", priority=10)
    mgr.register(HookPoint.AFTER_AGENT_CALL, h2, name="h2", priority=20)

    ctx = {}
    await mgr.trigger(HookPoint.AFTER_AGENT_CALL, context=ctx, mode=ExecutionMode.SEQUENTIAL)
    assert ctx.get("from_h2") == "hello_world"


# ─── 并行执行测试 ─────────────────────────────────────────────────────────────

async def test_parallel_execution():
    """并行模式下所有 Handler 都应被执行。"""
    mgr     = HookManager()
    results = []

    async def async_handler(ctx):
        await asyncio.sleep(0.01)
        results.append("done")

    mgr.register(HookPoint.AFTER_TOOL_CALL, async_handler, name="h1")
    mgr.register(HookPoint.AFTER_TOOL_CALL, async_handler, name="h2")
    mgr.register(HookPoint.AFTER_TOOL_CALL, async_handler, name="h3")

    result = await mgr.trigger(HookPoint.AFTER_TOOL_CALL, mode=ExecutionMode.PARALLEL)
    assert result.succeeded == 3
    assert len(results) == 3


async def test_parallel_does_not_abort():
    """并行模式下某个 Handler 失败不影响其他 Handler 执行。"""
    mgr     = HookManager()
    results = []

    def failing_handler(ctx):
        raise RuntimeError("模拟失败")

    def ok_handler(ctx):
        results.append("ok")

    mgr.register(HookPoint.ON_ERROR, failing_handler, name="fail", priority=10)
    mgr.register(HookPoint.ON_ERROR, ok_handler,      name="ok",   priority=20)

    result = await mgr.trigger(HookPoint.ON_ERROR, mode=ExecutionMode.PARALLEL)
    assert result.failed == 1
    assert result.succeeded == 1
    assert "ok" in results


# ─── 异步 Handler 测试 ────────────────────────────────────────────────────────

async def test_async_handler_supported():
    """异步 Handler 应被正确 await（等待）。"""
    mgr       = HookManager()
    completed = []

    async def async_hook(ctx):
        await asyncio.sleep(0.001)
        completed.append(True)

    mgr.register(HookPoint.BEFORE_AGENT_CALL, async_hook, name="async_h")
    result = await mgr.trigger(HookPoint.BEFORE_AGENT_CALL)
    assert result.succeeded == 1
    assert completed == [True]


# ─── 禁用 Handler 测试 ────────────────────────────────────────────────────────

async def test_disabled_handler_not_executed():
    """禁用的 Handler 在 trigger 时应被跳过。"""
    mgr     = HookManager()
    called  = []
    mgr.register(HookPoint.ON_AGENT_ERROR, lambda ctx: called.append(True), name="skip_me")
    mgr.disable(HookPoint.ON_AGENT_ERROR, "skip_me")
    await mgr.trigger(HookPoint.ON_AGENT_ERROR)
    assert called == []


# ─── 空 Hook 点测试 ──────────────────────────────────────────────────────────

async def test_trigger_with_no_handlers():
    """没有注册 Handler 时，trigger 应正常返回，total=0。"""
    mgr    = HookManager()
    result = await mgr.trigger(HookPoint.ON_RATE_LIMIT)
    assert result.total == 0
    assert result.succeeded == 0
    assert result.all_passed is True


# ─── 日志测试 ─────────────────────────────────────────────────────────────────

async def test_logs_recorded():
    """执行后应记录执行日志。"""
    mgr = HookManager()
    mgr.register(HookPoint.BEFORE_FILE_READ, lambda ctx: None, name="log_test")
    await mgr.trigger(HookPoint.BEFORE_FILE_READ, context={"path": "/tmp/test"})

    logs = mgr.get_logs(point="before_file_read")
    assert len(logs) >= 1
    assert logs[-1]["handler"] == "log_test"
    assert logs[-1]["success"] is True


async def test_failed_handler_logged():
    """失败的 Handler 应被记录在日志中。"""
    mgr = HookManager()

    def boom(ctx):
        raise ValueError("测试异常")

    mgr.register(HookPoint.ON_ERROR, boom, name="boom_handler")
    await mgr.trigger(HookPoint.ON_ERROR)

    logs = mgr.get_logs(point="on_error")
    assert any(not l["success"] for l in logs)
    assert any("测试异常" in (l["error"] or "") for l in logs)


def test_clear_logs():
    """clear_logs 应清空所有日志，返回被清除的条数。"""
    mgr = HookManager()
    # 手动插入 log
    from openagi.tools.hooks.manager import HookExecutionLog
    mgr._logs = [
        HookExecutionLog(point="test", handler_name="h", success=True, duration_ms=1.0),
        HookExecutionLog(point="test", handler_name="h", success=True, duration_ms=1.0),
    ]
    count = mgr.clear_logs()
    assert count == 2
    assert mgr._logs == []


# ─── 统计信息测试 ─────────────────────────────────────────────────────────────

def test_get_stats():
    """get_stats 应返回正确的统计信息。"""
    mgr = HookManager()
    mgr.register(HookPoint.BEFORE_FILE_WRITE, lambda ctx: None, name="s1")
    mgr.register(HookPoint.AFTER_FILE_WRITE,  lambda ctx: None, name="s2")
    mgr.disable(HookPoint.AFTER_FILE_WRITE, "s2")

    stats = mgr.get_stats()
    assert stats["total_handlers"] == 2
    assert stats["enabled_handlers"] == 1
    assert stats["disabled_handlers"] == 1


# ─── 全局单例测试 ─────────────────────────────────────────────────────────────

def test_get_hook_manager_singleton():
    """get_hook_manager 每次调用应返回同一个实例。"""
    mgr1 = get_hook_manager()
    mgr2 = get_hook_manager()
    assert mgr1 is mgr2


# ─── HookPoint 枚举完整性测试 ────────────────────────────────────────────────

def test_hook_point_values():
    """确认四大类 Hook 点均已定义。"""
    values = {hp.value for hp in HookPoint}
    # 文件类
    assert "before_file_write" in values
    assert "after_file_write"  in values
    # Git 类
    assert "before_git_commit" in values
    assert "after_git_commit"  in values
    # Agent 类
    assert "before_agent_call" in values
    assert "after_agent_call"  in values
    # API 类
    assert "before_tool_call"  in values
    assert "after_tool_call"   in values
    assert "on_error"          in values
