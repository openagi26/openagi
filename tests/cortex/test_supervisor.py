"""Supervisor崩溃恢复 + HeartEngine增强方法测试。"""

import pytest
from openagi.cortex.commander.inspector import Commander, CommanderConfig
from openagi.cortex.heart.entropy import HeartEngine, HeartStatus


# ─── Supervisor 崩溃恢复 ─────────────────────────────────────────────────────

def test_crash_recovery():
    """模拟崩溃后调用 recover_from_crash，验证状态正常恢复。"""
    commander = Commander()

    # 模拟崩溃前状态
    commander._task_in_progress = True
    commander._pending_events = ["task:completed", "task:failed"]

    # 执行崩溃恢复
    commander.recover_from_crash(reason="unittest: simulated OOM crash")

    # 内部状态应被重置
    assert commander._task_in_progress is False
    assert commander._pending_events == []

    # inspection_count 不应被清零（保留历史统计）
    assert commander._inspection_count == 0

    # running 标志不变（恢复不自动重启）
    assert commander.is_running is False


def test_crash_recovery_preserves_inspection_count():
    """崩溃恢复不应重置已完成的巡检计数。"""
    commander = Commander()
    commander._inspection_count = 42

    commander.recover_from_crash(reason="test preserve count")

    assert commander._inspection_count == 42


# ─── Commander get_stats ─────────────────────────────────────────────────────

def test_get_stats_returns_expected_keys():
    """get_stats() 应返回包含 status 语义字段的 dict。"""
    commander = Commander()
    stats = commander.get_stats()

    assert isinstance(stats, dict)
    assert "running" in stats
    assert "inspection_count" in stats
    assert stats["inspection_count"] == 0
    assert stats["running"] is False


# ─── HeartEngine get_full_status ─────────────────────────────────────────────

def test_heart_full_status():
    """get_full_status() 应返回包含所有必需字段的 HeartStatus 对象。"""
    engine = HeartEngine(initial_entropy=0.40, initial_valence=0.60)
    status = engine.get_full_status()

    assert isinstance(status, HeartStatus)

    # 验证所有必需字段存在且类型正确
    assert isinstance(status.entropy, float)
    assert isinstance(status.valence, float)
    assert isinstance(status.level, str)
    assert isinstance(status.emoji, str)
    assert isinstance(status.description, str)
    assert isinstance(status.advice, str)

    # level 必须是四种合法值之一
    assert status.level in ("calm", "focused", "anxious", "crisis")

    # emoji 非空
    assert len(status.emoji) > 0

    # description 和 advice 非空
    assert len(status.description) > 0
    assert len(status.advice) > 0


def test_heart_full_status_all_levels():
    """每个熵级别都应能返回完整的 HeartStatus。"""
    level_configs = [
        (0.10, "calm"),
        (0.40, "focused"),
        (0.70, "anxious"),
        (0.90, "crisis"),
    ]
    for entropy_val, expected_level in level_configs:
        engine = HeartEngine(initial_entropy=entropy_val)
        status = engine.get_full_status()
        assert status.level == expected_level, f"entropy={entropy_val} 应为 {expected_level}，实际为 {status.level}"
        assert status.entropy == round(entropy_val, 4)


# ─── HeartEngine get_recommended_temperature ─────────────────────────────────

def test_heart_temperature():
    """get_recommended_temperature() 应返回 0.0~2.0 之间的 float。"""
    engine = HeartEngine(initial_entropy=0.40)
    temp = engine.get_recommended_temperature()

    assert isinstance(temp, float)
    assert 0.0 <= temp <= 2.0


def test_heart_temperature_decreases_with_entropy():
    """熵值越高，推荐温度应越低（保守策略）。"""
    calm_engine = HeartEngine(initial_entropy=0.10)
    crisis_engine = HeartEngine(initial_entropy=0.90)

    calm_temp = calm_engine.get_recommended_temperature()
    crisis_temp = crisis_engine.get_recommended_temperature()

    assert calm_temp > crisis_temp, (
        f"calm 温度 ({calm_temp}) 应高于 crisis 温度 ({crisis_temp})"
    )


def test_heart_heartbeat_interval():
    """get_heartbeat_interval() 应返回正整数秒数。"""
    engine = HeartEngine(initial_entropy=0.40)
    interval = engine.get_heartbeat_interval()

    assert isinstance(interval, int)
    assert interval > 0
