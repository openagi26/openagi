"""Tests for chat/session.py — 会话管理"""

from datetime import timedelta, timezone
from unittest.mock import patch

from openagi.chat.session import (
    Message,
    Session,
    SessionMode,
    SessionStatus,
    SessionStore,
    add_message_to_session,
    add_session,
    archive_session,
    create_session,
    delete_session,
    get_session,
    group_sessions_by_time,
    list_sessions,
    remove_session_from_store,
    rename_session,
    restore_session,
    search_sessions,
    update_session_in_store,
    _now,
)
import pytest


# ---------------------------------------------------------------------------
# 创建会话
# ---------------------------------------------------------------------------

def test_create_session_defaults():
    s = create_session()
    assert s.mode == SessionMode.DEEP
    assert s.status == SessionStatus.ACTIVE
    assert "新对话" in s.title
    assert s.id


def test_create_session_with_title():
    s = create_session(title="测试会话", tags=["测试"])
    assert s.title == "测试会话"
    assert "测试" in s.tags


def test_create_session_group_mode():
    s = create_session(mode=SessionMode.GROUP, room_id="room-123")
    assert s.mode == SessionMode.GROUP
    assert s.room_id == "room-123"


# ---------------------------------------------------------------------------
# 生命周期
# ---------------------------------------------------------------------------

def test_archive_session():
    s = create_session()
    archived = archive_session(s)
    assert archived.status == SessionStatus.ARCHIVED
    assert archived.archived_at is not None


def test_archive_deleted_session_is_noop():
    s = create_session()
    deleted = delete_session(s)
    result = archive_session(deleted)
    assert result.status == SessionStatus.DELETED


def test_delete_session():
    s = create_session()
    deleted = delete_session(s)
    assert deleted.status == SessionStatus.DELETED
    assert deleted.deleted_at is not None


def test_restore_session():
    s = create_session()
    archived = archive_session(s)
    restored = restore_session(archived)
    assert restored.status == SessionStatus.ACTIVE
    assert restored.archived_at is None


def test_rename_session():
    s = create_session(title="旧名称")
    renamed = rename_session(s, "新名称")
    assert renamed.title == "新名称"
    assert renamed.id == s.id


# ---------------------------------------------------------------------------
# 消息追加
# ---------------------------------------------------------------------------

def test_add_message_updates_title_on_first_user_msg():
    s = create_session()
    msg = Message(role="user", content="帮我写一首诗关于夏天")
    s2 = add_message_to_session(s, msg)
    assert "帮我写一首诗" in s2.title
    assert len(s2.messages) == 1


def test_add_message_truncates_long_title():
    s = create_session()
    long_content = "a" * 100
    msg = Message(role="user", content=long_content)
    s2 = add_message_to_session(s, msg)
    assert len(s2.title) <= 41  # 40字 + 省略号


def test_add_multiple_messages():
    s = create_session()
    s = add_message_to_session(s, Message(role="user", content="你好"))
    s = add_message_to_session(s, Message(role="assistant", content="您好！"))
    assert len(s.messages) == 2


def test_second_message_does_not_change_title():
    s = create_session()
    s = add_message_to_session(s, Message(role="user", content="第一条"))
    title_after_first = s.title
    s = add_message_to_session(s, Message(role="user", content="第二条"))
    assert s.title == title_after_first


# ---------------------------------------------------------------------------
# 存储操作
# ---------------------------------------------------------------------------

def test_add_and_get_session():
    store = SessionStore()
    s = create_session(title="会话A")
    store = add_session(store, s)
    fetched = get_session(store, s.id)
    assert fetched is not None
    assert fetched.title == "会话A"


def test_get_nonexistent_session_returns_none():
    store = SessionStore()
    assert get_session(store, "nonexistent") is None


def test_update_session_in_store():
    store = SessionStore()
    s = create_session()
    store = add_session(store, s)
    renamed = rename_session(s, "更新标题")
    store = update_session_in_store(store, renamed)
    assert get_session(store, s.id).title == "更新标题"


def test_update_nonexistent_session_raises():
    store = SessionStore()
    s = create_session()
    with pytest.raises(KeyError):
        update_session_in_store(store, s)


def test_remove_session_from_store():
    store = SessionStore()
    s = create_session()
    store = add_session(store, s)
    store = remove_session_from_store(store, s.id)
    assert get_session(store, s.id) is None


# ---------------------------------------------------------------------------
# 列表与过滤
# ---------------------------------------------------------------------------

def test_list_sessions_excludes_deleted_by_default():
    store = SessionStore()
    active = create_session(title="活跃")
    deleted = delete_session(create_session(title="已删"))
    store = add_session(add_session(store, active), deleted)
    result = list_sessions(store)
    titles = [s.title for s in result]
    assert "活跃" in titles
    assert "已删" not in titles


def test_list_sessions_excludes_archived_by_default():
    store = SessionStore()
    active = create_session(title="活跃")
    archived = archive_session(create_session(title="已归"))
    store = add_session(add_session(store, active), archived)
    result = list_sessions(store)
    assert len(result) == 1
    assert result[0].title == "活跃"


def test_list_sessions_include_archived():
    store = SessionStore()
    archived = archive_session(create_session(title="归档"))
    store = add_session(store, archived)
    result = list_sessions(store, include_archived=True)
    assert len(result) == 1


# ---------------------------------------------------------------------------
# 时间分组
# ---------------------------------------------------------------------------

def test_group_sessions_today():
    s = create_session()
    groups = group_sessions_by_time([s])
    assert s in groups.today
    assert len(groups.yesterday) == 0


def test_group_sessions_yesterday():
    from datetime import datetime
    s = create_session()
    # 模拟昨天更新
    yesterday = _now() - timedelta(days=1)
    s_old = Session(**{**s.__dict__, "updated_at": yesterday})
    groups = group_sessions_by_time([s_old])
    assert s_old in groups.yesterday


def test_group_sessions_earlier():
    from datetime import datetime
    s = create_session()
    old = _now() - timedelta(days=30)
    s_old = Session(**{**s.__dict__, "updated_at": old})
    groups = group_sessions_by_time([s_old])
    assert s_old in groups.earlier


# ---------------------------------------------------------------------------
# 搜索
# ---------------------------------------------------------------------------

def test_search_by_title():
    store = SessionStore()
    s = create_session(title="机器学习入门")
    store = add_session(store, s)
    result = search_sessions(store, "机器学习")
    assert len(result) == 1
    assert result[0].id == s.id


def test_search_by_tag():
    store = SessionStore()
    s = create_session(title="随机会话", tags=["Python", "编程"])
    store = add_session(store, s)
    result = search_sessions(store, "python")
    assert len(result) == 1


def test_search_by_message_content():
    store = SessionStore()
    s = create_session()
    s = add_message_to_session(s, Message(role="user", content="如何训练神经网络"))
    store = add_session(store, s)
    result = search_sessions(store, "神经网络", search_content=True)
    assert len(result) == 1


def test_search_empty_query_returns_empty():
    store = SessionStore()
    s = create_session()
    store = add_session(store, s)
    assert search_sessions(store, "") == []


def test_search_excludes_deleted():
    store = SessionStore()
    deleted = delete_session(create_session(title="已删机器学习"))
    store = add_session(store, deleted)
    result = search_sessions(store, "机器学习")
    assert len(result) == 0
