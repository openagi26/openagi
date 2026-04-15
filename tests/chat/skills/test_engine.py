"""Tests for chat/skills/engine.py — 技能引擎"""

import pytest
from openagi.chat.skills.engine import (
    BUILTIN_SKILLS,
    Skill,
    SkillCategory,
    SkillExecutionContext,
    SkillParam,
    SkillStatus,
    create_registry,
    create_registry_with_builtins,
    disable_skill,
    enable_skill,
    execute_skill,
    get_skill,
    increment_usage,
    install_skill,
    list_skills,
    search_skills,
    uninstall_skill,
)


# ---------------------------------------------------------------------------
# 注册表基础操作
# ---------------------------------------------------------------------------

def test_create_empty_registry():
    registry = create_registry()
    assert len(registry.skills) == 0


def test_install_skill():
    registry = create_registry()
    skill = Skill(name="test_skill", display_name="测试技能", description="测试用")
    registry = install_skill(registry, skill)
    assert "test_skill" in registry.skills


def test_install_skill_upgrade():
    registry = create_registry()
    skill_v1 = Skill(name="my_skill", display_name="技能v1", version="1.0.0")
    skill_v2 = Skill(name="my_skill", display_name="技能v2", version="2.0.0")
    registry = install_skill(registry, skill_v1)
    registry = install_skill(registry, skill_v2)
    assert registry.skills["my_skill"].version == "2.0.0"


def test_uninstall_skill():
    registry = create_registry()
    skill = Skill(name="bye_skill", display_name="告别技能")
    registry = install_skill(registry, skill)
    registry = uninstall_skill(registry, "bye_skill")
    assert "bye_skill" not in registry.skills


def test_uninstall_nonexistent_raises():
    registry = create_registry()
    with pytest.raises(KeyError):
        uninstall_skill(registry, "ghost_skill")


def test_enable_and_disable_skill():
    registry = create_registry()
    skill = Skill(name="toggle_skill", display_name="开关技能")
    registry = install_skill(registry, skill)
    registry = disable_skill(registry, "toggle_skill")
    assert registry.skills["toggle_skill"].status == SkillStatus.DISABLED
    registry = enable_skill(registry, "toggle_skill")
    assert registry.skills["toggle_skill"].status == SkillStatus.ENABLED


def test_disable_nonexistent_raises():
    registry = create_registry()
    with pytest.raises(KeyError):
        disable_skill(registry, "nonexistent")


def test_enable_nonexistent_raises():
    registry = create_registry()
    with pytest.raises(KeyError):
        enable_skill(registry, "nonexistent")


# ---------------------------------------------------------------------------
# 查询
# ---------------------------------------------------------------------------

def test_get_skill():
    registry = create_registry_with_builtins()
    skill = get_skill(registry, "echo")
    assert skill is not None
    assert skill.name == "echo"


def test_get_skill_not_found():
    registry = create_registry()
    assert get_skill(registry, "nonexistent") is None


def test_list_skills_all():
    registry = create_registry_with_builtins()
    skills = list_skills(registry)
    assert len(skills) == len(BUILTIN_SKILLS)


def test_list_skills_by_category():
    registry = create_registry_with_builtins()
    tools = list_skills(registry, category=SkillCategory.TOOL)
    assert len(tools) > 0
    assert all(s.category == SkillCategory.TOOL for s in tools)


def test_list_skills_by_status():
    registry = create_registry_with_builtins()
    registry = disable_skill(registry, "echo")
    disabled = list_skills(registry, status=SkillStatus.DISABLED)
    assert len(disabled) == 1
    assert disabled[0].name == "echo"


def test_list_skills_by_source():
    registry = create_registry_with_builtins()
    builtin = list_skills(registry, source="builtin")
    assert len(builtin) == len(BUILTIN_SKILLS)


def test_search_skills_by_name():
    registry = create_registry_with_builtins()
    results = search_skills(registry, "echo")
    assert len(results) == 1
    assert results[0].name == "echo"


def test_search_skills_by_display_name():
    registry = create_registry_with_builtins()
    results = search_skills(registry, "字数")
    assert len(results) >= 1


def test_search_skills_by_tag():
    registry = create_registry_with_builtins()
    results = search_skills(registry, "统计")
    assert any(s.name == "word_count" for s in results)


def test_search_skills_empty_query():
    registry = create_registry_with_builtins()
    assert search_skills(registry, "") == []


# ---------------------------------------------------------------------------
# 使用计数
# ---------------------------------------------------------------------------

def test_increment_usage():
    registry = create_registry_with_builtins()
    assert registry.skills["echo"].usage_count == 0
    registry = increment_usage(registry, "echo")
    registry = increment_usage(registry, "echo")
    assert registry.skills["echo"].usage_count == 2


def test_increment_usage_nonexistent_noop():
    registry = create_registry()
    result = increment_usage(registry, "ghost")
    assert result is registry  # 无变化


# ---------------------------------------------------------------------------
# 技能执行
# ---------------------------------------------------------------------------

def test_execute_builtin_echo():
    registry = create_registry_with_builtins()
    ctx = SkillExecutionContext(skill_name="echo", inputs={"text": "Hello World"})
    result, new_registry = execute_skill(registry, ctx)
    assert result.success is True
    assert result.outputs["output"] == "Hello World"
    assert new_registry.skills["echo"].usage_count == 1


def test_execute_builtin_word_count():
    registry = create_registry_with_builtins()
    ctx = SkillExecutionContext(skill_name="word_count", inputs={"text": "Hello World\nLine2"})
    result, _ = execute_skill(registry, ctx)
    assert result.success is True
    assert result.outputs["char_count"] > 0
    assert result.outputs["line_count"] == 2


def test_execute_builtin_summarize_hint():
    registry = create_registry_with_builtins()
    ctx = SkillExecutionContext(
        skill_name="summarize_hint",
        inputs={"text": "这是一段很长的文本，需要被总结。", "max_words": 50}
    )
    result, _ = execute_skill(registry, ctx)
    assert result.success is True
    assert "50" in result.outputs["prompt"]


def test_execute_nonexistent_skill():
    registry = create_registry()
    ctx = SkillExecutionContext(skill_name="ghost_skill", inputs={})
    result, _ = execute_skill(registry, ctx)
    assert result.success is False
    assert "未安装" in result.error


def test_execute_disabled_skill():
    registry = create_registry_with_builtins()
    registry = disable_skill(registry, "echo")
    ctx = SkillExecutionContext(skill_name="echo", inputs={"text": "test"})
    result, _ = execute_skill(registry, ctx)
    assert result.success is False
    assert "disabled" in result.error


def test_execute_skill_without_handler():
    registry = create_registry()
    skill = Skill(name="no_handler", display_name="无Handler技能", handler=None)
    registry = install_skill(registry, skill)
    ctx = SkillExecutionContext(skill_name="no_handler", inputs={})
    result, _ = execute_skill(registry, ctx)
    assert result.success is False
    assert "handler" in result.error


def test_execute_skill_handler_exception():
    def bad_handler(inputs):
        raise RuntimeError("模拟执行错误")

    registry = create_registry()
    skill = Skill(name="bad_skill", display_name="坏技能", handler=bad_handler)
    registry = install_skill(registry, skill)
    ctx = SkillExecutionContext(skill_name="bad_skill", inputs={})
    result, _ = execute_skill(registry, ctx)
    assert result.success is False
    assert "模拟执行错误" in result.error


def test_execute_records_duration():
    registry = create_registry_with_builtins()
    ctx = SkillExecutionContext(skill_name="echo", inputs={"text": "时间测试"})
    result, _ = execute_skill(registry, ctx)
    assert result.duration_ms >= 0


# ---------------------------------------------------------------------------
# 内置技能注册表
# ---------------------------------------------------------------------------

def test_create_registry_with_builtins_has_all_builtins():
    registry = create_registry_with_builtins()
    for skill in BUILTIN_SKILLS:
        assert skill.name in registry.skills


def test_all_builtin_skills_have_handlers():
    for skill in BUILTIN_SKILLS:
        assert skill.handler is not None, f"内置技能 '{skill.name}' 缺少handler"


def test_all_builtin_skills_have_inputs():
    for skill in BUILTIN_SKILLS:
        assert len(skill.inputs) > 0, f"内置技能 '{skill.name}' 缺少输入参数定义"
