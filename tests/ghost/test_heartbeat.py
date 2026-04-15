"""永生层测试 — 心跳调度器。"""

import asyncio
import tempfile

from openagi.ghost.heartbeat import HeartbeatScheduler, HeartbeatConfig, SystemState


def test_initial_state():
    scheduler = HeartbeatScheduler()
    assert not scheduler.is_running
    assert scheduler.heartbeat_count == 0
    assert scheduler.current_interval == 180


def test_update_interval():
    scheduler = HeartbeatScheduler()
    assert scheduler.update_interval("calm") == 300
    assert scheduler.update_interval("focused") == 180
    assert scheduler.update_interval("anxious") == 120
    assert scheduler.update_interval("crisis") == 60


def test_register_callback():
    scheduler = HeartbeatScheduler()
    calls = []
    scheduler.register_callback(lambda: calls.append(1))
    stats = scheduler.get_stats()
    assert stats["callbacks_count"] == 1


def test_state_persistence():
    """测试状态保存和恢复。"""
    tmp = tempfile.mkdtemp()
    config = HeartbeatConfig(state_dir=tmp)
    scheduler = HeartbeatScheduler(config=config)
    scheduler._heartbeat_count = 42
    scheduler._save_state()

    recovered = scheduler._load_state()
    assert recovered is not None
    assert recovered.total_heartbeats == 42


def test_stats():
    scheduler = HeartbeatScheduler()
    stats = scheduler.get_stats()
    assert "running" in stats
    assert "heartbeat_count" in stats
    assert "current_interval" in stats
    assert stats["running"] is False


def test_config_defaults():
    config = HeartbeatConfig()
    assert config.intervals["calm"] == 300
    assert config.intervals["crisis"] == 60
    assert config.auto_save is True
    assert config.crash_recovery is True


async def test_start_and_stop():
    """测试启动和停止。"""
    tmp = tempfile.mkdtemp()
    config = HeartbeatConfig(state_dir=tmp)
    scheduler = HeartbeatScheduler(config=config)

    await scheduler.start()
    assert scheduler.is_running

    await asyncio.sleep(0.1)
    await scheduler.stop()
    assert not scheduler.is_running


def test_system_state_dataclass():
    state = SystemState()
    assert state.entropy == 0.40
    assert state.level == "focused"
    assert state.total_heartbeats == 0
