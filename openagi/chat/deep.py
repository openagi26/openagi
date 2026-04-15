"""
深度聊天模式 (Deep Chat) — 用户↔单AI对话，集成多核治理
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
功能：
  · 用户与单个AI的深度对话
  · 集成1-4核治理（1核=直接回复，2核=二元审核，3核=三方讨论，4核=完整三核博弈）
  · 消息历史管理（滑动窗口）
  · 系统提示注入
  · 纯函数，无I/O副作用
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4


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

class GovernanceMode(int, Enum):
    """多核治理模式。"""
    SINGLE = 1   # 1核：直接回复（无治理）
    DUAL = 2     # 2核：主AI + 审计AI
    TRIPLE = 3   # 3核：扩张者 + 审计者 + 治理者
    QUAD = 4     # 4核：完整三核博弈（含外部审计）


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    AUDIT = "audit"       # 审计层消息（不展示给用户）
    GOVERNANCE = "governance"  # 治理层消息


@dataclass
class DeepMessage:
    """深度聊天消息。"""
    id: str = field(default_factory=_uuid)
    role: MessageRole = MessageRole.USER
    content: str = ""
    ai_name: str = ""           # AI名称（多核模式下区分不同AI）
    governance_core: int = 0    # 来自哪个治理核（0=无，1/2/3/4）
    timestamp: datetime = field(default_factory=_now)
    tokens_used: int = 0
    metadata: dict = field(default_factory=dict)


@dataclass
class AIConfig:
    """深度聊天中单个AI的配置。"""
    name: str = "AI助手"
    model: str = "claude-3-5-sonnet-20241022"
    system_prompt: str = ""
    temperature: float = 0.7
    max_tokens: int = 2048
    persona_id: str | None = None  # 关联的人格ID


@dataclass
class GovernanceConfig:
    """治理配置。"""
    mode: GovernanceMode = GovernanceMode.SINGLE
    # 各核AI配置（SINGLE模式只用primary）
    primary: AIConfig = field(default_factory=AIConfig)
    auditor: AIConfig | None = None     # 2核+使用
    governor: AIConfig | None = None    # 3核+使用
    external: AIConfig | None = None    # 4核使用
    # 审计是否对用户可见
    show_audit_to_user: bool = False


@dataclass
class DeepChatState:
    """深度聊天状态（不可变数据结构）。"""
    session_id: str = field(default_factory=_uuid)
    messages: list[DeepMessage] = field(default_factory=list)
    governance: GovernanceConfig = field(default_factory=GovernanceConfig)
    # 历史窗口大小（最多保留多少条消息传给LLM）
    history_window: int = 20
    created_at: datetime = field(default_factory=_now)
    updated_at: datetime = field(default_factory=_now)
    total_tokens: int = 0


@dataclass
class GovernanceRound:
    """一次完整的治理轮次结果。"""
    user_message: DeepMessage
    primary_response: DeepMessage
    audit_response: DeepMessage | None = None
    governor_response: DeepMessage | None = None
    external_response: DeepMessage | None = None
    final_response: DeepMessage | None = None   # 综合定稿
    consensus_reached: bool = True
    divergence_notes: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# 工厂函数
# ---------------------------------------------------------------------------

def create_deep_chat(
    ai_config: AIConfig | None = None,
    governance_mode: GovernanceMode = GovernanceMode.SINGLE,
    session_id: str | None = None,
    history_window: int = 20,
) -> DeepChatState:
    """创建深度聊天状态。"""
    primary = ai_config or AIConfig()
    governance = GovernanceConfig(mode=governance_mode, primary=primary)

    # 根据模式自动配置审计核
    if governance_mode >= GovernanceMode.DUAL:
        governance.auditor = AIConfig(
            name="审计AI",
            model=primary.model,
            system_prompt="你是审计AI，负责评估主AI的回复质量、逻辑一致性和安全性。",
            temperature=0.3,
        )
    if governance_mode >= GovernanceMode.TRIPLE:
        governance.governor = AIConfig(
            name="治理AI",
            model=primary.model,
            system_prompt="你是治理AI，负责综合主AI和审计AI的意见，给出最终裁决。",
            temperature=0.5,
        )
    if governance_mode >= GovernanceMode.QUAD:
        governance.external = AIConfig(
            name="外部审计",
            model=primary.model,
            system_prompt="你是独立外部审计，上下文隔离，独立评估回复质量并打分。",
            temperature=0.3,
        )

    return DeepChatState(
        session_id=session_id or _uuid(),
        governance=governance,
        history_window=history_window,
    )


# ---------------------------------------------------------------------------
# 消息管理
# ---------------------------------------------------------------------------

def add_user_message(state: DeepChatState, content: str) -> DeepChatState:
    """追加用户消息。"""
    msg = DeepMessage(role=MessageRole.USER, content=content)
    new_messages = [*state.messages, msg]
    return DeepChatState(**{**state.__dict__, "messages": new_messages, "updated_at": _now()})


def add_ai_message(
    state: DeepChatState,
    content: str,
    ai_name: str = "",
    governance_core: int = 1,
    tokens_used: int = 0,
    role: MessageRole = MessageRole.ASSISTANT,
) -> DeepChatState:
    """追加AI回复消息。"""
    msg = DeepMessage(
        role=role,
        content=content,
        ai_name=ai_name or state.governance.primary.name,
        governance_core=governance_core,
        tokens_used=tokens_used,
    )
    new_messages = [*state.messages, msg]
    new_total = state.total_tokens + tokens_used
    return DeepChatState(**{**state.__dict__, "messages": new_messages, "total_tokens": new_total, "updated_at": _now()})


def get_history_for_llm(state: DeepChatState) -> list[dict]:
    """
    提取用于传给LLM的消息历史（滑动窗口）。
    只包含 user/assistant 角色，过滤审计/治理消息。
    """
    visible = [
        m for m in state.messages
        if m.role in (MessageRole.USER, MessageRole.ASSISTANT)
    ]
    # 取最近 history_window 条
    windowed = visible[-state.history_window:]
    return [{"role": m.role.value, "content": m.content} for m in windowed]


def get_visible_messages(state: DeepChatState) -> list[DeepMessage]:
    """返回对用户可见的消息（过滤内部治理消息，除非配置为可见）。"""
    if state.governance.show_audit_to_user:
        return state.messages
    return [m for m in state.messages if m.role not in (MessageRole.AUDIT, MessageRole.GOVERNANCE)]


def clear_history(state: DeepChatState) -> DeepChatState:
    """清空消息历史（保留配置）。"""
    return DeepChatState(**{**state.__dict__, "messages": [], "total_tokens": 0, "updated_at": _now()})


# ---------------------------------------------------------------------------
# 治理流水线（纯数据操作，不调用LLM）
# ---------------------------------------------------------------------------

def build_governance_prompt(
    state: DeepChatState,
    user_input: str,
    core: int = 1,
) -> dict:
    """
    构建LLM请求所需的完整参数字典（不实际调用LLM）。
    返回可直接传给litellm.completion()的参数。
    """
    mode = state.governance.mode

    if core == 1:
        config = state.governance.primary
    elif core == 2:
        config = state.governance.auditor or state.governance.primary
    elif core == 3:
        config = state.governance.governor or state.governance.primary
    else:
        config = state.governance.external or state.governance.primary

    history = get_history_for_llm(state)
    messages = []

    if config.system_prompt:
        messages.append({"role": "system", "content": config.system_prompt})

    messages.extend(history)

    # 审计/治理核需要附加上下文
    if core == 2 and mode >= GovernanceMode.DUAL:
        messages.append({
            "role": "user",
            "content": f"[审计任务] 评估以下用户输入的处理方式：\n{user_input}"
        })
    elif core >= 3:
        messages.append({
            "role": "user",
            "content": f"[治理任务] 综合各方意见，给出最终回复：\n{user_input}"
        })
    else:
        messages.append({"role": "user", "content": user_input})

    return {
        "model": config.model,
        "messages": messages,
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
    }


def create_governance_round(user_content: str) -> GovernanceRound:
    """初始化一个治理轮次（等待各核填充）。"""
    user_msg = DeepMessage(role=MessageRole.USER, content=user_content)
    primary_placeholder = DeepMessage(role=MessageRole.ASSISTANT, content="")
    return GovernanceRound(
        user_message=user_msg,
        primary_response=primary_placeholder,
    )


def finalize_governance_round(
    round_: GovernanceRound,
    state: DeepChatState,
) -> DeepChatState:
    """
    将治理轮次的结果合并进聊天状态。
    最终展示给用户的是 final_response（如有），否则是 primary_response。
    """
    new_state = state
    mode = state.governance.mode

    # 追加用户消息
    new_state = add_user_message(new_state, round_.user_message.content)

    # 追加各核消息
    if mode >= GovernanceMode.DUAL and round_.audit_response:
        new_state = add_ai_message(
            new_state,
            round_.audit_response.content,
            ai_name=round_.audit_response.ai_name,
            governance_core=2,
            role=MessageRole.AUDIT,
        )

    if mode >= GovernanceMode.TRIPLE and round_.governor_response:
        new_state = add_ai_message(
            new_state,
            round_.governor_response.content,
            ai_name=round_.governor_response.ai_name,
            governance_core=3,
            role=MessageRole.GOVERNANCE,
        )

    if mode >= GovernanceMode.QUAD and round_.external_response:
        new_state = add_ai_message(
            new_state,
            round_.external_response.content,
            ai_name=round_.external_response.ai_name,
            governance_core=4,
            role=MessageRole.AUDIT,
        )

    # 最终用户可见回复
    final = round_.final_response or round_.primary_response
    new_state = add_ai_message(
        new_state,
        final.content,
        ai_name=final.ai_name,
        governance_core=1,
        tokens_used=final.tokens_used,
        role=MessageRole.ASSISTANT,
    )

    return new_state


def check_divergence(
    primary_content: str,
    audit_content: str,
    threshold: int = 50,
) -> bool:
    """
    简单检测主AI和审计AI是否存在显著分歧。
    通过内容长度差异和关键词检测。
    """
    diff_ratio = abs(len(primary_content) - len(audit_content)) / max(len(primary_content), 1)
    conflict_keywords = ["不同意", "有误", "错误", "风险", "不建议", "警告", "问题"]
    has_conflict = any(kw in audit_content for kw in conflict_keywords)
    return diff_ratio > 0.5 or has_conflict
