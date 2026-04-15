"""巡检AI测试 — Commander/Inspector。"""

import asyncio

from openagi.cortex.commander.inspector import (
    Commander, CommanderConfig, EventType, SendMode, InspectionResult,
)


def test_default_config():
    config = CommanderConfig()
    assert config.enabled is True
    assert config.interval_seconds == 600
    assert config.send_mode == SendMode.DRAFT
    assert config.smart_wait is True


def test_commander_initial_state():
    cmd = Commander()
    assert not cmd.is_running
    assert cmd.inspection_count == 0
    assert cmd.last_inspection is None


async def test_start_and_stop():
    cmd = Commander(CommanderConfig(interval_seconds=3600))
    await cmd.start()
    assert cmd.is_running
    await cmd.stop()
    assert not cmd.is_running


async def test_manual_inspect():
    cmd = Commander()
    result = await cmd.inspect(triggered_by="test")
    assert isinstance(result, InspectionResult)
    assert result.triggered_by == "test"
    assert cmd.inspection_count == 1


async def test_inspect_with_collector():
    cmd = Commander()
    cmd.register_info_collector(lambda: {"heart_status": {"level": "crisis", "entropy": 0.92}})
    result = await cmd.inspect()
    assert len(result.issues) >= 1
    assert "熵值" in result.issues[0]


async def test_smart_wait_delays():
    cmd = Commander()
    cmd.set_task_in_progress(True)

    # 事件触发时应该加入待处理队列
    await cmd.on_event(EventType.TASK_COMPLETED)
    assert cmd.inspection_count == 0  # 未立即执行

    # 任务完成后应自动触发
    cmd.set_task_in_progress(False)
    await asyncio.sleep(0.1)  # 等待asyncio task执行
    assert cmd.inspection_count == 1  # 应该触发了一次


async def test_crisis_ignores_smart_wait():
    cmd = Commander(CommanderConfig(events={EventType.ENTROPY_CRISIS: True}))
    cmd.set_task_in_progress(True)  # 有任务在执行

    await cmd.on_event(EventType.ENTROPY_CRISIS)
    assert cmd.inspection_count == 1  # 危机事件应该立即触发，无视智能等待


async def test_disabled_event_ignored():
    cmd = Commander(CommanderConfig(events={EventType.USER_IDLE: False}))
    await cmd.on_event(EventType.USER_IDLE)
    assert cmd.inspection_count == 0


def test_stats():
    cmd = Commander()
    stats = cmd.get_stats()
    assert stats["enabled"] is True
    assert stats["running"] is False
    assert stats["inspection_count"] == 0
    assert stats["send_mode"] == "draft"


async def test_command_handler_draft():
    cmd = Commander(CommanderConfig(send_mode=SendMode.DRAFT))
    handled = []
    cmd.set_command_handler(lambda command, auto: handled.append(("draft", command, auto)))
    # 手动设置一个有command的inspection
    cmd._last_inspection = InspectionResult(summary="test", command="执行下一步")
    # inspect不会自动有command（MVP简化版），所以这里测handler注册
    assert cmd._command_handler is not None


def test_inspection_result():
    result = InspectionResult(
        summary="一切正常",
        issues=["熵值偏高"],
        next_action="继续开发",
        command="继续实现记忆系统",
        triggered_by="timer",
    )
    assert result.summary == "一切正常"
    assert len(result.issues) == 1
    assert result.triggered_by == "timer"
