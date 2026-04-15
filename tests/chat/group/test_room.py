"""Tests for chat/group/room.py — 群聊房间"""

import pytest
from openagi.chat.group.room import (
    MemberStatus,
    Room,
    RoomStatus,
    add_member,
    create_ai_member,
    create_human_member,
    create_room,
    get_member,
    get_member_by_name,
    increment_member_message_count,
    list_active_members,
    list_ai_members,
    remove_member,
    room_summary,
    set_member_status,
    update_member_config,
)


# ---------------------------------------------------------------------------
# 房间创建
# ---------------------------------------------------------------------------

def test_create_room_defaults():
    room = create_room()
    assert room.status == RoomStatus.ACTIVE
    assert room.max_members == 10
    assert len(room.members) == 0
    assert "群聊" in room.name


def test_create_room_with_name():
    room = create_room(name="产品讨论组", description="日常产品讨论")
    assert room.name == "产品讨论组"
    assert room.description == "日常产品讨论"


# ---------------------------------------------------------------------------
# AI成员创建
# ---------------------------------------------------------------------------

def test_create_ai_member():
    member = create_ai_member(
        display_name="数据分析师",
        model="gpt-4o",
        temperature=0.3,
        avatar="📊",
    )
    assert member.member_type == "ai"
    assert member.config.display_name == "数据分析师"
    assert member.config.model == "gpt-4o"
    assert member.config.temperature == 0.3
    assert member.config.avatar == "📊"
    assert member.status == MemberStatus.ACTIVE


def test_create_human_member():
    member = create_human_member("陛下", avatar="👑")
    assert member.member_type == "human"
    assert member.config.display_name == "陛下"
    assert member.config.auto_reply is False


# ---------------------------------------------------------------------------
# 成员管理
# ---------------------------------------------------------------------------

def test_add_member():
    room = create_room()
    m = create_ai_member("AI助手")
    room = add_member(room, m)
    assert m.id in room.members
    assert len(room.members) == 1


def test_add_member_duplicate_name_raises():
    room = create_room()
    m1 = create_ai_member("重名AI")
    m2 = create_ai_member("重名AI")
    room = add_member(room, m1)
    with pytest.raises(ValueError, match="已存在"):
        add_member(room, m2)


def test_add_member_exceeds_limit_raises():
    room = create_room(max_members=2)
    room = add_member(room, create_ai_member("AI-1"))
    room = add_member(room, create_ai_member("AI-2"))
    with pytest.raises(ValueError, match="上限"):
        add_member(room, create_ai_member("AI-3"))


def test_remove_member():
    room = create_room()
    m = create_ai_member("待移除AI")
    room = add_member(room, m)
    room = remove_member(room, m.id)
    assert m.id not in room.members


def test_remove_nonexistent_member_raises():
    room = create_room()
    with pytest.raises(KeyError):
        remove_member(room, "nonexistent-id")


# ---------------------------------------------------------------------------
# 成员配置更新
# ---------------------------------------------------------------------------

def test_update_member_config():
    room = create_room()
    m = create_ai_member("原始AI", temperature=0.7)
    room = add_member(room, m)
    room = update_member_config(room, m.id, temperature=0.3, model="gpt-4o")
    updated = room.members[m.id]
    assert updated.config.temperature == 0.3
    assert updated.config.model == "gpt-4o"
    assert updated.config.display_name == "原始AI"  # 未变更的字段保持原值


def test_update_nonexistent_member_raises():
    room = create_room()
    with pytest.raises(KeyError):
        update_member_config(room, "ghost-id", temperature=0.5)


# ---------------------------------------------------------------------------
# 成员状态
# ---------------------------------------------------------------------------

def test_set_member_status_muted():
    room = create_room()
    m = create_ai_member("AI助手")
    room = add_member(room, m)
    room = set_member_status(room, m.id, MemberStatus.MUTED)
    assert room.members[m.id].status == MemberStatus.MUTED


def test_set_member_status_offline():
    room = create_room()
    m = create_ai_member("AI助手")
    room = add_member(room, m)
    room = set_member_status(room, m.id, MemberStatus.OFFLINE)
    assert room.members[m.id].status == MemberStatus.OFFLINE


def test_set_status_nonexistent_raises():
    room = create_room()
    with pytest.raises(KeyError):
        set_member_status(room, "ghost", MemberStatus.MUTED)


# ---------------------------------------------------------------------------
# 查询函数
# ---------------------------------------------------------------------------

def test_list_active_members():
    room = create_room()
    m1 = create_ai_member("活跃AI")
    m2 = create_ai_member("静音AI")
    m3 = create_human_member("用户")
    room = add_member(add_member(add_member(room, m1), m2), m3)
    room = set_member_status(room, m2.id, MemberStatus.MUTED)
    active = list_active_members(room)
    active_names = [m.config.display_name for m in active]
    assert "活跃AI" in active_names
    assert "用户" in active_names
    assert "静音AI" not in active_names


def test_list_ai_members():
    room = create_room()
    room = add_member(room, create_ai_member("AI-1"))
    room = add_member(room, create_ai_member("AI-2"))
    room = add_member(room, create_human_member("人类"))
    ai_members = list_ai_members(room)
    assert len(ai_members) == 2
    assert all(m.member_type == "ai" for m in ai_members)


def test_get_member_by_name():
    room = create_room()
    m = create_ai_member("搜索目标")
    room = add_member(room, m)
    found = get_member_by_name(room, "搜索目标")
    assert found is not None
    assert found.id == m.id


def test_get_member_by_name_case_insensitive():
    room = create_room()
    m = create_ai_member("DataAnalyst")
    room = add_member(room, m)
    found = get_member_by_name(room, "dataanalyst")
    assert found is not None


def test_get_member_by_name_not_found():
    room = create_room()
    assert get_member_by_name(room, "不存在的名字") is None


def test_get_member_by_id():
    room = create_room()
    m = create_ai_member("查找AI")
    room = add_member(room, m)
    found = get_member(room, m.id)
    assert found is not None


def test_increment_message_count():
    room = create_room()
    m = create_ai_member("发言AI")
    room = add_member(room, m)
    assert room.members[m.id].message_count == 0
    room = increment_member_message_count(room, m.id)
    room = increment_member_message_count(room, m.id)
    assert room.members[m.id].message_count == 2


# ---------------------------------------------------------------------------
# 房间摘要
# ---------------------------------------------------------------------------

def test_room_summary():
    room = create_room(name="测试群")
    room = add_member(room, create_ai_member("AI-1"))
    room = add_member(room, create_ai_member("AI-2"))
    room = add_member(room, create_human_member("用户"))
    summary = room_summary(room)
    assert summary["name"] == "测试群"
    assert summary["member_count"] == 3
    assert summary["ai_member_count"] == 2
    assert summary["active_member_count"] == 3
    assert len(summary["members"]) == 3
