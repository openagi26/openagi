"""心绪引擎测试 — HeartEngine 双轴情绪系统。"""

from openagi.cortex.heart.entropy import HeartEngine, ENTROPY_EVENTS


def test_initial_state():
    """测试初始状态。"""
    engine = HeartEngine(initial_entropy=0.40, initial_valence=0.60)
    assert engine.entropy == 0.40
    assert engine.valence == 0.60
    assert engine.level == "focused"


def test_entropy_levels():
    """测试四级熵状态。"""
    engine = HeartEngine(initial_entropy=0.10)
    assert engine.level == "calm"

    engine = HeartEngine(initial_entropy=0.40)
    assert engine.level == "focused"

    engine = HeartEngine(initial_entropy=0.70)
    assert engine.level == "anxious"

    engine = HeartEngine(initial_entropy=0.90)
    assert engine.level == "crisis"


def test_push_known_event():
    """测试推送已知事件。"""
    engine = HeartEngine(initial_entropy=0.50)
    result = engine.push_event("llm_call_success")
    assert result < 0.50  # 熵应该降低


def test_push_unknown_event():
    """测试推送未知事件（熵不变）。"""
    engine = HeartEngine(initial_entropy=0.50)
    result = engine.push_event("unknown_event_xyz")
    assert result == 0.50


def test_entropy_clamped():
    """测试熵值被钳制在[0,1]范围内。"""
    engine = HeartEngine(initial_entropy=0.05)
    engine.update_entropy(-0.10)
    assert engine.entropy == 0.0

    engine2 = HeartEngine(initial_entropy=0.95)
    engine2.update_entropy(+0.10)
    assert engine2.entropy == 1.0


def test_valence_inverse_correlation():
    """测试效价与熵的反向联动。"""
    engine = HeartEngine(initial_entropy=0.50, initial_valence=0.50)
    engine.update_entropy(+0.10)  # 熵增
    assert engine.valence < 0.50  # 效价应降低

    engine2 = HeartEngine(initial_entropy=0.50, initial_valence=0.50)
    engine2.update_entropy(-0.10)  # 熵减
    assert engine2.valence > 0.50  # 效价应升高


def test_callback_triggered():
    """测试事件回调触发。"""
    engine = HeartEngine()
    callback_events = []
    engine.register_callback(lambda e: callback_events.append(e))

    engine.push_event("task_success")
    assert len(callback_events) == 1
    assert callback_events[0].event_type == "raw_delta"


def test_history_limit():
    """测试历史记录限制。"""
    engine = HeartEngine(history_limit=5)
    for _ in range(10):
        engine.push_event("llm_call_success")
    assert len(engine.recent_events(100)) == 5


def test_get_full_status():
    """测试完整状态摘要。"""
    engine = HeartEngine(initial_entropy=0.15)
    status = engine.get_full_status()
    assert status.level == "calm"
    assert status.emoji == "🧘"
    assert "平静" in status.description or "冷静" in status.description
    assert len(status.advice) > 0


def test_heartbeat_interval():
    """测试心跳间隔根据熵级别变化。"""
    calm = HeartEngine(initial_entropy=0.10)
    assert calm.get_heartbeat_interval() == 300

    focused = HeartEngine(initial_entropy=0.40)
    assert focused.get_heartbeat_interval() == 180

    anxious = HeartEngine(initial_entropy=0.70)
    assert anxious.get_heartbeat_interval() == 120

    crisis = HeartEngine(initial_entropy=0.90)
    assert crisis.get_heartbeat_interval() == 60


def test_recommended_temperature():
    """测试推荐LLM温度根据熵级别变化。"""
    calm = HeartEngine(initial_entropy=0.10)
    assert calm.get_recommended_temperature() == 0.8

    crisis = HeartEngine(initial_entropy=0.90)
    assert crisis.get_recommended_temperature() == 0.3


def test_uptime():
    """测试运行时长。"""
    engine = HeartEngine()
    assert engine.uptime_seconds() >= 0


def test_all_predefined_events_have_weights():
    """验证所有预定义事件都有权重值。"""
    for event_name, weight in ENTROPY_EVENTS.items():
        assert isinstance(weight, float), f"{event_name} 的权重不是float"
        assert -1.0 <= weight <= 1.0, f"{event_name} 的权重超出范围: {weight}"


def test_status_text():
    """测试简短状态文本。"""
    engine = HeartEngine(initial_entropy=0.10)
    text = engine.get_status_text()
    assert "冷静" in text

    engine2 = HeartEngine(initial_entropy=0.90)
    text2 = engine2.get_status_text()
    assert "焦虑" in text2


def test_repr():
    """测试字符串表示。"""
    engine = HeartEngine(initial_entropy=0.50)
    r = repr(engine)
    assert "HeartEngine" in r
    assert "0.500" in r


def test_stress_chain():
    """测试连续压力事件的累积效果。"""
    engine = HeartEngine(initial_entropy=0.30)
    initial = engine.entropy

    # 连续失败
    engine.push_event("task_failed")
    engine.push_event("llm_call_failed")
    engine.push_event("llm_rate_limited")

    # 熵应该显著升高
    assert engine.entropy > initial + 0.20

    # 连续成功
    for _ in range(10):
        engine.push_event("task_success")

    # 熵应该有所恢复
    assert engine.entropy < 0.80
