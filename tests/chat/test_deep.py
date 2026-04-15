"""Tests for chat/deep.py — 深度聊天模式"""

import pytest
from openagi.chat.deep import (
    AIConfig,
    DeepChatState,
    GovernanceConfig,
    GovernanceMode,
    MessageRole,
    add_ai_message,
    add_user_message,
    build_governance_prompt,
    check_divergence,
    clear_history,
    create_deep_chat,
    create_governance_round,
    finalize_governance_round,
    get_history_for_llm,
    get_visible_messages,
    DeepMessage,
)


# ---------------------------------------------------------------------------
# 工厂函数
# ---------------------------------------------------------------------------

def test_create_deep_chat_single_mode():
    state = create_deep_chat()
    assert state.governance.mode == GovernanceMode.SINGLE
    assert state.governance.auditor is None
    assert state.governance.governor is None


def test_create_deep_chat_dual_mode():
    state = create_deep_chat(governance_mode=GovernanceMode.DUAL)
    assert state.governance.auditor is not None
    assert state.governance.governor is None


def test_create_deep_chat_triple_mode():
    state = create_deep_chat(governance_mode=GovernanceMode.TRIPLE)
    assert state.governance.auditor is not None
    assert state.governance.governor is not None
    assert state.governance.external is None


def test_create_deep_chat_quad_mode():
    state = create_deep_chat(governance_mode=GovernanceMode.QUAD)
    assert state.governance.external is not None


def test_create_deep_chat_custom_ai_config():
    config = AIConfig(name="小助手", model="gpt-4o", temperature=0.9)
    state = create_deep_chat(ai_config=config)
    assert state.governance.primary.name == "小助手"
    assert state.governance.primary.temperature == 0.9


# ---------------------------------------------------------------------------
# 消息管理
# ---------------------------------------------------------------------------

def test_add_user_message():
    state = create_deep_chat()
    state = add_user_message(state, "你好")
    assert len(state.messages) == 1
    assert state.messages[0].role == MessageRole.USER
    assert state.messages[0].content == "你好"


def test_add_ai_message():
    state = create_deep_chat()
    state = add_ai_message(state, "你好！有什么可以帮您的？", tokens_used=20)
    assert len(state.messages) == 1
    assert state.messages[0].role == MessageRole.ASSISTANT
    assert state.total_tokens == 20


def test_messages_accumulate():
    state = create_deep_chat()
    state = add_user_message(state, "问题1")
    state = add_ai_message(state, "答案1")
    state = add_user_message(state, "问题2")
    assert len(state.messages) == 3


# ---------------------------------------------------------------------------
# 历史窗口
# ---------------------------------------------------------------------------

def test_get_history_for_llm_basic():
    state = create_deep_chat()
    state = add_user_message(state, "你好")
    state = add_ai_message(state, "您好！")
    history = get_history_for_llm(state)
    assert len(history) == 2
    assert history[0]["role"] == "user"
    assert history[1]["role"] == "assistant"


def test_get_history_respects_window():
    state = create_deep_chat(history_window=4)
    for i in range(10):
        state = add_user_message(state, f"问题{i}")
        state = add_ai_message(state, f"答案{i}")
    history = get_history_for_llm(state)
    assert len(history) == 4


def test_get_history_filters_audit_messages():
    state = create_deep_chat(governance_mode=GovernanceMode.DUAL)
    state = add_user_message(state, "用户问题")
    state = add_ai_message(state, "审计意见", role=MessageRole.AUDIT)
    state = add_ai_message(state, "主AI回复", role=MessageRole.ASSISTANT)
    history = get_history_for_llm(state)
    # audit消息不应出现在history中
    roles = [h["role"] for h in history]
    assert "audit" not in roles


# ---------------------------------------------------------------------------
# 可见消息过滤
# ---------------------------------------------------------------------------

def test_get_visible_messages_hides_audit_by_default():
    state = create_deep_chat()
    state = add_user_message(state, "问题")
    state = add_ai_message(state, "审计", role=MessageRole.AUDIT)
    state = add_ai_message(state, "回复", role=MessageRole.ASSISTANT)
    visible = get_visible_messages(state)
    assert len(visible) == 2
    assert all(m.role != MessageRole.AUDIT for m in visible)


def test_get_visible_messages_shows_audit_when_enabled():
    config = GovernanceConfig(mode=GovernanceMode.DUAL, show_audit_to_user=True)
    state = DeepChatState(governance=config)
    state = add_ai_message(state, "审计内容", role=MessageRole.AUDIT)
    visible = get_visible_messages(state)
    assert len(visible) == 1


def test_clear_history():
    state = create_deep_chat()
    state = add_user_message(state, "你好")
    state = add_ai_message(state, "您好", tokens_used=50)
    cleared = clear_history(state)
    assert len(cleared.messages) == 0
    assert cleared.total_tokens == 0


# ---------------------------------------------------------------------------
# 治理Prompt构建
# ---------------------------------------------------------------------------

def test_build_governance_prompt_single():
    state = create_deep_chat()
    state = add_user_message(state, "之前的问题")
    state = add_ai_message(state, "之前的回复")
    prompt = build_governance_prompt(state, "新问题", core=1)
    assert "model" in prompt
    assert "messages" in prompt
    assert "temperature" in prompt
    # 最后一条应是新问题
    assert prompt["messages"][-1]["content"] == "新问题"


def test_build_governance_prompt_includes_history():
    state = create_deep_chat()
    state = add_user_message(state, "历史消息")
    state = add_ai_message(state, "历史回复")
    prompt = build_governance_prompt(state, "新问题", core=1)
    contents = [m["content"] for m in prompt["messages"]]
    assert "历史消息" in contents


def test_build_governance_prompt_audit_core():
    state = create_deep_chat(governance_mode=GovernanceMode.DUAL)
    prompt = build_governance_prompt(state, "测试输入", core=2)
    # 审计核的消息应包含审计相关标识
    last_content = prompt["messages"][-1]["content"]
    assert "审计" in last_content


def test_build_governance_prompt_includes_system_prompt():
    config = AIConfig(system_prompt="你是一个专家。")
    state = create_deep_chat(ai_config=config)
    prompt = build_governance_prompt(state, "问题", core=1)
    system_msgs = [m for m in prompt["messages"] if m["role"] == "system"]
    assert len(system_msgs) == 1
    assert "专家" in system_msgs[0]["content"]


# ---------------------------------------------------------------------------
# 治理轮次
# ---------------------------------------------------------------------------

def test_create_governance_round():
    round_ = create_governance_round("用户问题")
    assert round_.user_message.content == "用户问题"
    assert round_.audit_response is None


def test_finalize_governance_round_single():
    state = create_deep_chat()
    round_ = create_governance_round("问题")
    round_.primary_response = DeepMessage(
        role=MessageRole.ASSISTANT, content="主AI回复", tokens_used=30
    )
    new_state = finalize_governance_round(round_, state)
    visible = get_visible_messages(new_state)
    assert len(visible) == 2  # user + assistant
    assert new_state.total_tokens == 30


def test_finalize_governance_round_with_audit():
    state = create_deep_chat(governance_mode=GovernanceMode.DUAL)
    round_ = create_governance_round("问题")
    round_.primary_response = DeepMessage(role=MessageRole.ASSISTANT, content="主AI回复")
    round_.audit_response = DeepMessage(
        role=MessageRole.AUDIT, content="审计意见", ai_name="审计AI"
    )
    new_state = finalize_governance_round(round_, state)
    # 可见消息：user + assistant（审计被过滤）
    visible = get_visible_messages(new_state)
    assert len(visible) == 2
    # 全部消息包括审计
    assert len(new_state.messages) == 3


# ---------------------------------------------------------------------------
# 分歧检测
# ---------------------------------------------------------------------------

def test_check_divergence_no_conflict():
    assert check_divergence("这是一个正常回复。", "同意，这个回复很好。") is False


def test_check_divergence_with_conflict_keyword():
    assert check_divergence("A方案", "有误，这个方案存在风险") is True


def test_check_divergence_large_length_diff():
    short = "短回复"
    long = "很长的回复" * 50
    assert check_divergence(short, long) is True
