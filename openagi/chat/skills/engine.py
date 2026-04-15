"""
技能引擎 (Skills Engine) — 技能定义、注册、生命周期管理
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
功能：
  · 技能定义（名称/描述/输入/输出/handler）
  · 技能安装/卸载/启用/禁用
  · 内置技能注册
  · 技能执行上下文
  · 纯函数，无I/O副作用
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable
from uuid import uuid4

logger = logging.getLogger("openagi.skills")


# ---------------------------------------------------------------------------
# 工具函数
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _uuid() -> str:
    return str(uuid4())


# ---------------------------------------------------------------------------
# 类型定义
# ---------------------------------------------------------------------------

class SkillStatus(str, Enum):
    ENABLED = "enabled"      # 已启用
    DISABLED = "disabled"    # 已禁用
    ERROR = "error"          # 错误状态（安装失败等）


class SkillCategory(str, Enum):
    TOOL = "tool"            # 工具类（搜索、计算等）
    KNOWLEDGE = "knowledge"  # 知识类（领域专家等）
    WORKFLOW = "workflow"    # 工作流类（自动化流程）
    COMMUNICATION = "communication"  # 沟通类
    CREATIVE = "creative"    # 创意类
    CUSTOM = "custom"        # 自定义


@dataclass
class SkillParam:
    """技能参数定义（输入/输出）。"""
    name: str
    type: str                # "str" / "int" / "float" / "bool" / "dict" / "list"
    description: str = ""
    required: bool = True
    default: Any = None


@dataclass
class Skill:
    """技能定义。"""
    id: str = field(default_factory=_uuid)
    name: str = ""                  # 技能名称（唯一标识符，英文无空格）
    display_name: str = ""          # 显示名称（中文友好）
    description: str = ""
    category: SkillCategory = SkillCategory.TOOL
    version: str = "1.0.0"
    author: str = ""
    # 输入输出定义
    inputs: list[SkillParam] = field(default_factory=list)
    outputs: list[SkillParam] = field(default_factory=list)
    # 状态
    status: SkillStatus = SkillStatus.ENABLED
    # handler 函数引用（实际执行逻辑）
    # 存储函数引用，执行时调用
    handler: Callable | None = field(default=None, repr=False)
    # 元数据
    tags: list[str] = field(default_factory=list)
    installed_at: datetime = field(default_factory=_now)
    updated_at: datetime = field(default_factory=_now)
    usage_count: int = 0
    # 来源（builtin / market / learned）
    source: str = "builtin"
    source_url: str = ""            # 来源URL（market技能）


@dataclass
class SkillRegistry:
    """技能注册表（内存存储）。"""
    skills: dict[str, Skill] = field(default_factory=dict)  # skill_name -> Skill


@dataclass
class SkillExecutionContext:
    """技能执行上下文。"""
    skill_name: str
    inputs: dict[str, Any]
    session_id: str = ""
    member_id: str = ""      # 调用技能的AI成员ID
    triggered_by: str = ""   # 触发原因（user_request / auto_detect / chain）


@dataclass
class SkillExecutionResult:
    """技能执行结果。"""
    skill_name: str
    success: bool
    outputs: dict[str, Any] = field(default_factory=dict)
    error: str = ""
    duration_ms: int = 0
    executed_at: datetime = field(default_factory=_now)


# ---------------------------------------------------------------------------
# 注册表操作
# ---------------------------------------------------------------------------

def create_registry() -> SkillRegistry:
    """创建空技能注册表。"""
    return SkillRegistry()


def install_skill(registry: SkillRegistry, skill: Skill) -> SkillRegistry:
    """安装技能到注册表。若同名技能已存在则升级版本。"""
    if skill.name in registry.skills:
        logger.info("升级技能 %s -> v%s", skill.name, skill.version)
    else:
        logger.info("安装技能 %s v%s", skill.name, skill.version)
    new_skills = {**registry.skills, skill.name: skill}
    return SkillRegistry(skills=new_skills)


def uninstall_skill(registry: SkillRegistry, skill_name: str) -> SkillRegistry:
    """从注册表卸载技能。"""
    if skill_name not in registry.skills:
        raise KeyError(f"技能 '{skill_name}' 未安装")
    new_skills = {k: v for k, v in registry.skills.items() if k != skill_name}
    logger.info("卸载技能 %s", skill_name)
    return SkillRegistry(skills=new_skills)


def enable_skill(registry: SkillRegistry, skill_name: str) -> SkillRegistry:
    """启用已禁用的技能。"""
    skill = registry.skills.get(skill_name)
    if skill is None:
        raise KeyError(f"技能 '{skill_name}' 未安装")
    updated = Skill(**{**skill.__dict__, "status": SkillStatus.ENABLED, "updated_at": _now()})
    new_skills = {**registry.skills, skill_name: updated}
    return SkillRegistry(skills=new_skills)


def disable_skill(registry: SkillRegistry, skill_name: str) -> SkillRegistry:
    """禁用技能（不卸载，仍可启用）。"""
    skill = registry.skills.get(skill_name)
    if skill is None:
        raise KeyError(f"技能 '{skill_name}' 未安装")
    updated = Skill(**{**skill.__dict__, "status": SkillStatus.DISABLED, "updated_at": _now()})
    new_skills = {**registry.skills, skill_name: updated}
    return SkillRegistry(skills=new_skills)


def get_skill(registry: SkillRegistry, skill_name: str) -> Skill | None:
    """按名称获取技能。"""
    return registry.skills.get(skill_name)


def list_skills(
    registry: SkillRegistry,
    category: SkillCategory | None = None,
    status: SkillStatus | None = None,
    source: str | None = None,
) -> list[Skill]:
    """列出技能（可按分类/状态/来源过滤），按使用次数倒序。"""
    result = list(registry.skills.values())
    if category:
        result = [s for s in result if s.category == category]
    if status:
        result = [s for s in result if s.status == status]
    if source:
        result = [s for s in result if s.source == source]
    return sorted(result, key=lambda s: s.usage_count, reverse=True)


def search_skills(registry: SkillRegistry, query: str) -> list[Skill]:
    """按关键词搜索技能（名称/显示名/描述/标签）。"""
    q = query.lower().strip()
    if not q:
        return []
    result = []
    for skill in registry.skills.values():
        if (q in skill.name.lower()
                or q in skill.display_name.lower()
                or q in skill.description.lower()
                or any(q in tag.lower() for tag in skill.tags)):
            result.append(skill)
    return result


def increment_usage(registry: SkillRegistry, skill_name: str) -> SkillRegistry:
    """递增技能使用次数。"""
    skill = registry.skills.get(skill_name)
    if skill is None:
        return registry
    updated = Skill(**{**skill.__dict__, "usage_count": skill.usage_count + 1, "updated_at": _now()})
    new_skills = {**registry.skills, skill_name: updated}
    return SkillRegistry(skills=new_skills)


# ---------------------------------------------------------------------------
# 技能执行
# ---------------------------------------------------------------------------

def execute_skill(
    registry: SkillRegistry,
    context: SkillExecutionContext,
) -> tuple[SkillExecutionResult, SkillRegistry]:
    """
    执行技能。
    返回 (执行结果, 更新后的注册表（usage_count递增）)。
    """
    import time
    start = time.monotonic()

    skill = registry.skills.get(context.skill_name)
    if skill is None:
        return SkillExecutionResult(
            skill_name=context.skill_name,
            success=False,
            error=f"技能 '{context.skill_name}' 未安装",
        ), registry

    if skill.status != SkillStatus.ENABLED:
        return SkillExecutionResult(
            skill_name=context.skill_name,
            success=False,
            error=f"技能 '{context.skill_name}' 当前状态为 {skill.status.value}，无法执行",
        ), registry

    if skill.handler is None:
        return SkillExecutionResult(
            skill_name=context.skill_name,
            success=False,
            error=f"技能 '{context.skill_name}' 未配置执行函数（handler）",
        ), registry

    try:
        outputs = skill.handler(context.inputs)
        duration_ms = int((time.monotonic() - start) * 1000)
        new_registry = increment_usage(registry, context.skill_name)
        return SkillExecutionResult(
            skill_name=context.skill_name,
            success=True,
            outputs=outputs or {},
            duration_ms=duration_ms,
        ), new_registry
    except Exception as e:
        duration_ms = int((time.monotonic() - start) * 1000)
        logger.exception("技能 '%s' 执行失败", context.skill_name)
        return SkillExecutionResult(
            skill_name=context.skill_name,
            success=False,
            error=str(e),
            duration_ms=duration_ms,
        ), registry


# ---------------------------------------------------------------------------
# 内置技能
# ---------------------------------------------------------------------------

def _builtin_echo_handler(inputs: dict) -> dict:
    """回声技能：原样返回输入内容。"""
    return {"output": inputs.get("text", "")}


def _builtin_word_count_handler(inputs: dict) -> dict:
    """字数统计技能。"""
    text = inputs.get("text", "")
    return {
        "char_count": len(text),
        "word_count": len(text.split()),
        "line_count": len(text.splitlines()),
    }


def _builtin_summarize_hint_handler(inputs: dict) -> dict:
    """摘要提示技能（生成摘要指令，实际由LLM执行）。"""
    text = inputs.get("text", "")
    max_words = inputs.get("max_words", 100)
    return {
        "prompt": f"请将以下内容压缩为不超过{max_words}字的摘要：\n\n{text}"
    }


BUILTIN_SKILLS: list[Skill] = [
    Skill(
        id="builtin-echo",
        name="echo",
        display_name="回声",
        description="原样返回输入的文本内容，用于测试技能管道。",
        category=SkillCategory.TOOL,
        inputs=[SkillParam(name="text", type="str", description="输入文本")],
        outputs=[SkillParam(name="output", type="str", description="输出文本")],
        handler=_builtin_echo_handler,
        tags=["测试", "工具"],
        source="builtin",
    ),
    Skill(
        id="builtin-word-count",
        name="word_count",
        display_name="字数统计",
        description="统计文本的字符数、词数和行数。",
        category=SkillCategory.TOOL,
        inputs=[SkillParam(name="text", type="str", description="待统计文本")],
        outputs=[
            SkillParam(name="char_count", type="int", description="字符数"),
            SkillParam(name="word_count", type="int", description="词数"),
            SkillParam(name="line_count", type="int", description="行数"),
        ],
        handler=_builtin_word_count_handler,
        tags=["统计", "文本", "工具"],
        source="builtin",
    ),
    Skill(
        id="builtin-summarize-hint",
        name="summarize_hint",
        display_name="摘要提示生成",
        description="生成适合LLM的摘要任务提示词。",
        category=SkillCategory.TOOL,
        inputs=[
            SkillParam(name="text", type="str", description="待摘要的文本"),
            SkillParam(name="max_words", type="int", description="最大字数", required=False, default=100),
        ],
        outputs=[SkillParam(name="prompt", type="str", description="生成的提示词")],
        handler=_builtin_summarize_hint_handler,
        tags=["摘要", "提示词", "工具"],
        source="builtin",
    ),
]


def create_registry_with_builtins() -> SkillRegistry:
    """创建预装了所有内置技能的注册表。"""
    registry = create_registry()
    for skill in BUILTIN_SKILLS:
        registry = install_skill(registry, skill)
    return registry
