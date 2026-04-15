"""LLM路由器测试 — 中转站管理+模型列表+故障转移。"""

from openagi.cortex.llm.router import LLMRouter, ModelRole, RelayStation, ModelEntry


def test_add_relay():
    """测试添加中转站。"""
    router = LLMRouter()
    relay = router.add_relay("OpenRouter", "https://openrouter.ai/api/v1", "sk-or-test1234Rk")
    assert relay.name == "OpenRouter"
    assert relay.key_suffix == "••Rk"
    assert len(router.list_relays()) == 1


def test_remove_relay():
    """测试删除中转站。"""
    router = LLMRouter()
    relay = router.add_relay("Test", "https://test.com", "sk-test")
    router.remove_relay(relay.id)
    assert len(router.list_relays()) == 0


def test_set_primary():
    """测试设为主模型。"""
    router = LLMRouter()
    router._models.append(ModelEntry(
        model_id="claude-sonnet-4", provider="Anthropic",
        relay_name="OpenRouter", key_suffix="••Rk",
    ))
    router._models.append(ModelEntry(
        model_id="gpt-4o", provider="OpenAI",
        relay_name="OpenAI", key_suffix="••3j",
    ))

    router.set_primary("claude-sonnet-4", "OpenRouter")
    primary = router.get_primary()
    assert primary is not None
    assert primary.model_id == "claude-sonnet-4"
    assert primary.role == ModelRole.PRIMARY


def test_set_fallback():
    """测试设为回退模型。"""
    router = LLMRouter()
    router._models.append(ModelEntry(
        model_id="claude-haiku", provider="Anthropic",
        relay_name="OpenRouter", key_suffix="••Rk",
    ))
    router._models.append(ModelEntry(
        model_id="gpt-4o", provider="OpenAI",
        relay_name="OpenAI", key_suffix="••3j",
    ))

    router.set_fallback("claude-haiku", "OpenRouter")
    router.set_fallback("gpt-4o", "OpenAI")

    chain = router.get_fallback_chain()
    assert len(chain) == 2
    assert chain[0].fallback_order == 1
    assert chain[1].fallback_order == 2


def test_list_models_ordered():
    """测试模型列表排序：主→回退→其他。"""
    router = LLMRouter()
    router._models = [
        ModelEntry(model_id="other", provider="X", relay_name="R", key_suffix="••", role=ModelRole.AVAILABLE),
        ModelEntry(model_id="primary", provider="A", relay_name="R", key_suffix="••", role=ModelRole.PRIMARY),
        ModelEntry(model_id="fb1", provider="B", relay_name="R", key_suffix="••", role=ModelRole.FALLBACK, fallback_order=1),
        ModelEntry(model_id="fb2", provider="C", relay_name="R", key_suffix="••", role=ModelRole.FALLBACK, fallback_order=2),
    ]

    ordered = router.list_models()
    assert ordered[0].model_id == "primary"
    assert ordered[1].model_id == "fb1"
    assert ordered[2].model_id == "fb2"
    assert ordered[3].model_id == "other"


def test_remove_model():
    """测试删除模型。"""
    router = LLMRouter()
    router._models.append(ModelEntry(
        model_id="test-model", provider="Test",
        relay_name="TestRelay", key_suffix="••tt",
    ))
    assert len(router.list_models()) == 1
    router.remove_model("test-model", "TestRelay")
    assert len(router.list_models()) == 0


def test_detect_local_claude():
    """测试本地Claude自动识别。"""
    router = LLMRouter()
    detected = router.detect_local_claude()
    # 在有Claude Code的环境中应该检测到模型
    # 在没有的环境中返回空列表
    assert isinstance(detected, list)
    if detected:
        assert all(m.is_local for m in detected)
        assert all("免API" in m.key_suffix for m in detected)


def test_relay_key_suffix():
    """测试密钥后缀显示。"""
    relay = RelayStation(id="r1", name="Test", base_url="https://test.com", api_key="sk-or-abc123Rk")
    assert relay.key_suffix == "••Rk"

    short_relay = RelayStation(id="r2", name="Short", base_url="https://test.com", api_key="x")
    assert short_relay.key_suffix == "••••"


def test_guess_provider():
    """测试提供商猜测。"""
    assert LLMRouter._guess_provider("claude-sonnet-4") == "Anthropic"
    assert LLMRouter._guess_provider("gpt-4o") == "OpenAI"
    assert LLMRouter._guess_provider("deepseek-chat") == "DeepSeek"
    assert LLMRouter._guess_provider("gemini-2.0-flash") == "Google"
    assert LLMRouter._guess_provider("unknown-model") == "Unknown"


def test_primary_switch():
    """测试切换主模型（旧主模型变为普通）。"""
    router = LLMRouter()
    router._models = [
        ModelEntry(model_id="m1", provider="A", relay_name="R1", key_suffix="••", role=ModelRole.PRIMARY),
        ModelEntry(model_id="m2", provider="B", relay_name="R2", key_suffix="••", role=ModelRole.AVAILABLE),
    ]

    router.set_primary("m2", "R2")
    assert router._models[0].role == ModelRole.AVAILABLE  # m1不再是主模型
    assert router.get_primary().model_id == "m2"
