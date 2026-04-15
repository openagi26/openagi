"""
会话管理 (Session Manager) — 创建/删除/归档/搜索会话
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
功能：
  · 创建/删除/归档会话
  · 会话列表（今天/昨天/近7天/更早 分组）
  · 会话搜索（按标题/内容/标签）
  · 纯函数，无I/O副作用
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
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

class SessionStatus(str, Enum):
    ACTIVE = "active"        # 活跃中
    ARCHIVED = "archived"    # 已归档
    DELETED = "deleted"      # 已删除


class SessionMode(str, Enum):
    DEEP = "deep"            # 深度聊天（用户↔单AI）
    GROUP = "group"          # 群聊模式（多AI协作）


class SessionGroup(str, Enum):
    TODAY = "today"          # 今天
    YESTERDAY = "yesterday"  # 昨天
    LAST_7_DAYS = "last_7_days"  # 近7天
    EARLIER = "earlier"      # 更早


@dataclass
class Message:
    """会话中的单条消息记录。"""
    id: str = field(default_factory=_uuid)
    role: str = "user"           # user / assistant / system
    content: str = ""
    sender_name: str = ""        # 发送者名称（AI成员名或用户名）
    timestamp: datetime = field(default_factory=_now)
    metadata: dict = field(default_factory=dict)


@dataclass
class Session:
    """会话实体。"""
    id: str = field(default_factory=_uuid)
    title: str = ""
    mode: SessionMode = SessionMode.DEEP
    status: SessionStatus = SessionStatus.ACTIVE
    tags: list[str] = field(default_factory=list)
    messages: list[Message] = field(default_factory=list)
    created_at: datetime = field(default_factory=_now)
    updated_at: datetime = field(default_factory=_now)
    archived_at: datetime | None = None
    deleted_at: datetime | None = None
    # 关联的群聊房间ID（仅group模式）
    room_id: str | None = None
    # 关联的AI配置（仅deep模式）
    ai_config: dict = field(default_factory=dict)


@dataclass
class SessionStore:
    """会话存储（内存）。"""
    sessions: dict[str, Session] = field(default_factory=dict)


@dataclass
class GroupedSessions:
    """按时间分组后的会话列表。"""
    today: list[Session] = field(default_factory=list)
    yesterday: list[Session] = field(default_factory=list)
    last_7_days: list[Session] = field(default_factory=list)
    earlier: list[Session] = field(default_factory=list)


# ---------------------------------------------------------------------------
# 会话工厂
# ---------------------------------------------------------------------------

def create_session(
    title: str = "",
    mode: SessionMode = SessionMode.DEEP,
    tags: list[str] | None = None,
    ai_config: dict | None = None,
    room_id: str | None = None,
) -> Session:
    """创建新会话。"""
    now = _now()
    auto_title = title or f"新对话 {now.strftime('%m-%d %H:%M')}"
    return Session(
        title=auto_title,
        mode=mode,
        tags=tags or [],
        ai_config=ai_config or {},
        room_id=room_id,
        created_at=now,
        updated_at=now,
    )


def add_session(store: SessionStore, session: Session) -> SessionStore:
    """将会话加入存储，返回新存储（不可变操作）。"""
    new_sessions = {**store.sessions, session.id: session}
    return SessionStore(sessions=new_sessions)


# ---------------------------------------------------------------------------
# 会话生命周期
# ---------------------------------------------------------------------------

def archive_session(session: Session) -> Session:
    """归档会话。"""
    if session.status == SessionStatus.DELETED:
        return session
    now = _now()
    return Session(
        **{**session.__dict__, "status": SessionStatus.ARCHIVED, "archived_at": now, "updated_at": now}
    )


def delete_session(session: Session) -> Session:
    """软删除会话。"""
    now = _now()
    return Session(
        **{**session.__dict__, "status": SessionStatus.DELETED, "deleted_at": now, "updated_at": now}
    )


def restore_session(session: Session) -> Session:
    """从归档/删除状态恢复为活跃。"""
    now = _now()
    return Session(
        **{**session.__dict__, "status": SessionStatus.ACTIVE, "archived_at": None, "deleted_at": None, "updated_at": now}
    )


def rename_session(session: Session, new_title: str) -> Session:
    """重命名会话。"""
    return Session(**{**session.__dict__, "title": new_title, "updated_at": _now()})


def add_message_to_session(session: Session, message: Message) -> Session:
    """向会话追加消息，自动更新标题（如果首条消息）。"""
    new_messages = [*session.messages, message]
    # 如果是第一条用户消息且标题是自动生成的，截取内容作标题
    new_title = session.title
    if len(session.messages) == 0 and message.role == "user" and message.content:
        new_title = message.content[:40].strip()
        if len(message.content) > 40:
            new_title += "…"
    return Session(**{**session.__dict__, "messages": new_messages, "title": new_title, "updated_at": _now()})


# ---------------------------------------------------------------------------
# 会话列表与分组
# ---------------------------------------------------------------------------

def list_sessions(
    store: SessionStore,
    include_archived: bool = False,
    include_deleted: bool = False,
) -> list[Session]:
    """返回按更新时间倒序排列的会话列表。"""
    result = []
    for s in store.sessions.values():
        if s.status == SessionStatus.DELETED and not include_deleted:
            continue
        if s.status == SessionStatus.ARCHIVED and not include_archived:
            continue
        result.append(s)
    return sorted(result, key=lambda s: s.updated_at, reverse=True)


def group_sessions_by_time(sessions: list[Session]) -> GroupedSessions:
    """将会话按时间段分组：今天/昨天/近7天/更早。"""
    now = _now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    week_start = today_start - timedelta(days=7)

    grouped = GroupedSessions()
    for s in sessions:
        updated = s.updated_at
        if updated >= today_start:
            grouped.today.append(s)
        elif updated >= yesterday_start:
            grouped.yesterday.append(s)
        elif updated >= week_start:
            grouped.last_7_days.append(s)
        else:
            grouped.earlier.append(s)
    return grouped


# ---------------------------------------------------------------------------
# 会话搜索
# ---------------------------------------------------------------------------

def search_sessions(
    store: SessionStore,
    query: str,
    search_content: bool = True,
    include_archived: bool = True,
) -> list[Session]:
    """
    搜索会话。
    - 匹配标题
    - 匹配标签
    - 可选：匹配消息内容
    返回按相关度（匹配次数）排序的结果。
    """
    if not query.strip():
        return []

    q = query.strip().lower()
    scored: list[tuple[int, Session]] = []

    for s in store.sessions.values():
        if s.status == SessionStatus.DELETED:
            continue
        if s.status == SessionStatus.ARCHIVED and not include_archived:
            continue

        score = 0

        # 标题匹配（权重高）
        if q in s.title.lower():
            score += 10

        # 标签匹配
        for tag in s.tags:
            if q in tag.lower():
                score += 5

        # 消息内容匹配
        if search_content:
            for msg in s.messages:
                if q in msg.content.lower():
                    score += 1

        if score > 0:
            scored.append((score, s))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [s for _, s in scored]


def get_session(store: SessionStore, session_id: str) -> Session | None:
    """按ID获取会话。"""
    return store.sessions.get(session_id)


def update_session_in_store(store: SessionStore, session: Session) -> SessionStore:
    """用更新后的会话替换存储中的同ID会话。"""
    if session.id not in store.sessions:
        raise KeyError(f"会话 {session.id} 不存在于存储中")
    new_sessions = {**store.sessions, session.id: session}
    return SessionStore(sessions=new_sessions)


def remove_session_from_store(store: SessionStore, session_id: str) -> SessionStore:
    """从存储中彻底移除会话（物理删除，慎用）。"""
    new_sessions = {k: v for k, v in store.sessions.items() if k != session_id}
    return SessionStore(sessions=new_sessions)
