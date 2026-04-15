"""人格系统测试 — 预设+专家+自定义。"""

import tempfile

from openagi.social.persona.engine import (
    PersonaEngine, PRESET_PERSONAS, EXPERT_PERSONAS, EXPERT_DOMAINS,
)


def test_preset_count():
    assert len(PRESET_PERSONAS) == 6


def test_expert_count():
    """验证专家总数与域定义一致。"""
    total = sum(len(experts) for experts in EXPERT_DOMAINS.values())
    assert len(EXPERT_PERSONAS) == total
    assert len(EXPERT_PERSONAS) >= 90  # 当前精选版≥90位，未来扩展到162


def test_expert_domains():
    assert len(EXPERT_DOMAINS) >= 12  # 当前12域，未来扩展到13


def test_engine_get_presets():
    engine = PersonaEngine(custom_path=tempfile.mktemp(suffix=".json"))
    presets = engine.get_presets()
    assert len(presets) == 6
    assert presets[0].name == "通才助手"


def test_engine_get_experts_all():
    engine = PersonaEngine(custom_path=tempfile.mktemp(suffix=".json"))
    experts = engine.get_experts()
    assert len(experts) >= 90


def test_engine_get_experts_by_domain():
    engine = PersonaEngine(custom_path=tempfile.mktemp(suffix=".json"))
    eng_experts = engine.get_experts(domain="工程")
    assert len(eng_experts) >= 10
    assert all(e.domain == "工程" for e in eng_experts)


def test_engine_search():
    engine = PersonaEngine(custom_path=tempfile.mktemp(suffix=".json"))
    results = engine.search_experts("安全")
    assert len(results) >= 1
    assert any("安全" in r.name or "安全" in r.description for r in results)


def test_engine_search_english():
    engine = PersonaEngine(custom_path=tempfile.mktemp(suffix=".json"))
    results = engine.search_experts("Backend")
    assert len(results) >= 1


def test_add_custom():
    engine = PersonaEngine(custom_path=tempfile.mktemp(suffix=".json"))
    persona = engine.add_custom("测试人格", "测试描述", "你是测试人格", 0.5)
    assert persona.id
    assert persona.name == "测试人格"
    assert len(engine.get_custom()) == 1


def test_delete_custom():
    engine = PersonaEngine(custom_path=tempfile.mktemp(suffix=".json"))
    persona = engine.add_custom("临时", "临时", "临时")
    assert engine.delete_custom(persona.id)
    assert len(engine.get_custom()) == 0


def test_copy_persona():
    engine = PersonaEngine(custom_path=tempfile.mktemp(suffix=".json"))
    copied = engine.copy_persona("preset-generalist")
    assert copied is not None
    assert "副本" in copied.name
    assert copied.source == "custom"


def test_get_by_id_preset():
    engine = PersonaEngine(custom_path=tempfile.mktemp(suffix=".json"))
    p = engine.get_by_id("preset-analyst")
    assert p is not None
    assert p.name == "严谨分析师"


def test_get_by_id_expert():
    engine = PersonaEngine(custom_path=tempfile.mktemp(suffix=".json"))
    p = engine.get_by_id("expert-001")
    assert p is not None


def test_get_all():
    engine = PersonaEngine(custom_path=tempfile.mktemp(suffix=".json"))
    engine.add_custom("自定义", "测试", "测试")
    all_personas = engine.get_all()
    assert len(all_personas) == 6 + len(EXPERT_PERSONAS) + 1


def test_stats():
    engine = PersonaEngine(custom_path=tempfile.mktemp(suffix=".json"))
    stats = engine.get_stats()
    assert stats["presets"] == 6
    assert stats["experts"] >= 90
    assert stats["expert_domains"] >= 12
    assert stats["custom"] == 0


def test_expert_all_have_prompts():
    """所有专家都有system_prompt。"""
    for expert in EXPERT_PERSONAS:
        assert len(expert.system_prompt) > 10, f"{expert.name} 缺少prompt"
        assert expert.domain, f"{expert.name} 缺少domain"


def test_custom_persistence():
    """自定义人格持久化。"""
    tmp = tempfile.mktemp(suffix=".json")
    engine1 = PersonaEngine(custom_path=tmp)
    engine1.add_custom("持久化测试", "desc", "prompt")

    engine2 = PersonaEngine(custom_path=tmp)
    assert len(engine2.get_custom()) == 1
    assert engine2.get_custom()[0].name == "持久化测试"
