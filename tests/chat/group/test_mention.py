"""Tests for chat/group/mention.py — @机制"""

import pytest
from openagi.chat.group.mention import (
    ChainState,
    MentionResult,
    add_chain_link,
    can_continue_chain,
    create_chain_state,
    extract_message_without_mentions,
    format_all_mention,
    format_mention,
    get_chain_summary,
    get_triggered_members,
    parse_mentions,
    resolve_mentions,
    strip_mentions,
)
from openagi.chat.group.room import (
    MemberStatus,
    add_member,
    create_ai_member,
    create_room,
    set_member_status,
)


# ---------------------------------------------------------------------------
# parse_mentions
# ---------------------------------------------------------------------------

def test_parse_mentions_single():
    names, is_all = parse_mentions("@Alice 你好")
    assert "Alice" in names
    assert is_all is False


def test_parse_mentions_multiple():
    names, is_all = parse_mentions("@Alice @Bob 请看这个")
    assert "Alice" in names
    assert "Bob" in names
    assert is_all is False


def test_parse_mentions_all_english():
    names, is_all = parse_mentions("@all 大家好")
    assert is_all is True
    assert "all" not in names


def test_parse_mentions_all_chinese():
    names, is_all = parse_mentions("@全体 注意了")
    assert is_all is True


def test_parse_mentions_everyone():
    names, is_all = parse_mentions("@everyone 听我说")
    assert is_all is True


def test_parse_mentions_mixed():
    names, is_all = parse_mentions("@数据分析师 和 @全体 来讨论")
    assert is_all is True
    assert "数据分析师" in names


def test_parse_mentions_chinese_name():
    names, is_all = parse_mentions("@数据分析师 帮我看看这个数据")
    assert "数据分析师" in names
    assert is_all is False


def test_parse_no_mentions():
    # 修复：原文本"没有@提及"中的"@提及"会被正则匹配为一个提及，改为不含@符号的文本
    names, is_all = parse_mentions("这条消息没有提及任何人")
    assert names == []
    assert is_all is False


# ---------------------------------------------------------------------------
# resolve_mentions
# ---------------------------------------------------------------------------

def test_resolve_mentions_found():
    room = create_room()
    m = create_ai_member("数据师")
    room = add_member(room, m)
    result = resolve_mentions("@数据师 帮我分析", room)
    assert "数据师" in result.mentions
    assert len(result.unresolved) == 0


def test_resolve_mentions_unresolved():
    room = create_room()
    result = resolve_mentions("@不存在的人 你好", room)
    assert "不存在的人" in result.unresolved
    assert len(result.mentions) == 0


def test_resolve_mentions_all():
    room = create_room()
    result = resolve_mentions("@全体 开会了", room)
    assert result.is_all_mention is True


def test_resolve_mentions_excludes_self():
    room = create_room()
    m = create_ai_member("自己")
    room = add_member(room, m)
    result = resolve_mentions("@自己 测试", room, sender_id=m.id)
    assert "自己" not in result.mentions


# ---------------------------------------------------------------------------
# get_triggered_members
# ---------------------------------------------------------------------------

def test_get_triggered_members_specific():
    room = create_room()
    m1 = create_ai_member("分析师")
    m2 = create_ai_member("程序员")
    room = add_member(add_member(room, m1), m2)
    mention = resolve_mentions("@分析师 请帮忙", room)
    triggered = get_triggered_members(mention, room)
    assert len(triggered) == 1
    assert triggered[0].config.display_name == "分析师"


def test_get_triggered_members_all():
    room = create_room()
    m1 = create_ai_member("AI-1")
    m2 = create_ai_member("AI-2")
    room = add_member(add_member(room, m1), m2)
    mention = resolve_mentions("@全体 注意", room)
    triggered = get_triggered_members(mention, room)
    assert len(triggered) == 2


def test_get_triggered_members_muted_excluded():
    room = create_room()
    m = create_ai_member("静音AI")
    room = add_member(room, m)
    room = set_member_status(room, m.id, MemberStatus.MUTED)
    mention = resolve_mentions("@全体 通知", room)
    triggered = get_triggered_members(mention, room)
    assert len(triggered) == 0


def test_get_triggered_members_auto_reply_false_excluded():
    room = create_room()
    m = create_ai_member("不自动回复AI", auto_reply=False)
    room = add_member(room, m)
    mention = resolve_mentions("@全体 通知", room)
    triggered = get_triggered_members(mention, room)
    assert len(triggered) == 0


# ---------------------------------------------------------------------------
# 链式协作
# ---------------------------------------------------------------------------

def test_create_chain_state():
    chain = create_chain_state(max_rounds=5)
    assert chain.max_rounds == 5
    assert chain.current_round == 0
    assert can_continue_chain(chain) is True


def test_chain_terminates_at_max_rounds():
    room = create_room()
    m1 = create_ai_member("AI-1")
    m2 = create_ai_member("AI-2")
    room = add_member(add_member(room, m1), m2)

    chain = create_chain_state(max_rounds=2)

    # 第1轮
    chain, triggered = add_chain_link(chain, m1.id, "AI-1", "@AI-2 看看这个", room)
    assert chain.current_round == 1
    assert can_continue_chain(chain) is True

    # 第2轮（达到上限）
    chain, triggered = add_chain_link(chain, m2.id, "AI-2", "@AI-1 好的", room)
    assert chain.current_round == 2
    assert chain.terminated is True
    assert can_continue_chain(chain) is False


def test_chain_terminates_when_no_mentions():
    room = create_room()
    m = create_ai_member("单独AI")
    room = add_member(room, m)

    chain = create_chain_state(max_rounds=5)
    chain, triggered = add_chain_link(chain, m.id, "单独AI", "这条消息没有@", room)
    assert chain.terminated is True
    assert "自然结束" in chain.termination_reason


def test_chain_cannot_continue_after_terminated():
    chain = ChainState(terminated=True, termination_reason="测试")
    assert can_continue_chain(chain) is False


def test_add_chain_link_to_terminated_returns_empty():
    room = create_room()
    chain = ChainState(terminated=True)
    chain, triggered = add_chain_link(chain, "sender", "发送者", "消息", room)
    assert triggered == []


def test_chain_tracks_participants():
    room = create_room()
    m1 = create_ai_member("AI-A")
    m2 = create_ai_member("AI-B")
    room = add_member(add_member(room, m1), m2)

    chain = create_chain_state(max_rounds=3)
    chain, _ = add_chain_link(chain, m1.id, "AI-A", "@AI-B 发起", room)
    assert m1.id in chain.active_member_ids


def test_get_chain_summary():
    room = create_room()
    m = create_ai_member("测试AI")
    room = add_member(room, m)
    chain = create_chain_state()
    chain, _ = add_chain_link(chain, m.id, "测试AI", "测试内容", room)
    summary = get_chain_summary(chain)
    assert "total_rounds" in summary
    assert "terminated" in summary
    assert len(summary["links"]) == 1


# ---------------------------------------------------------------------------
# 文本格式化
# ---------------------------------------------------------------------------

def test_format_mention():
    assert format_mention("Alice") == "@Alice"


def test_format_all_mention():
    assert "@全体" in format_all_mention()


def test_strip_mentions():
    result = strip_mentions("@Alice @Bob 请看这个内容")
    assert "@Alice" not in result
    assert "@Bob" not in result
    assert "请看这个内容" in result


def test_extract_message_without_mentions():
    result = extract_message_without_mentions("@Alice   @Bob  hello world")
    assert result == "hello world"
