"""
群聊房间 (Group Room) — 多AI协作的聊天房间管理
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
功能：
  · 创建/删除群聊房间
  · 添加/移除AI成员
  · 成员列表管理
  · 每个成员独立配置（模型/人格/温度）
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

class MemberStatus(str, Enum):
    ACTIVE = "active"       # 活跃（参与对话）
    MUTED = "muted"         # 静音（不主动回复，但接收消息）
    OFFLINE = "offline"     # 离线（暂时退出）


class RoomStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    DELETED = "deleted"


@dataclass
class MemberConfig:
    """
    群聊成员的独立配置。
    每个AI成员可有不同的模型、人格、温度设置。
    """
    # 显示信息
    display_name: str = ""           # 显示名称（如"数据分析师"）
    avatar: str = ""                  # 头像标识（emoji或URL）
    # 模型配置
    model: str = "claude-3-5-sonnet-20241022"
    temperature: float = 0.7
    max_tokens: int = 1024
    # 人格配置
    persona_id: str | None = None    # 关联的Persona ID
    system_prompt: str = ""          # 覆盖人格的system prompt
    # 行为配置
    auto_reply: bool = True          # 是否自动回复@提及
    can_mention_others: bool = True  # 是否允许@其他成员（触发链式协作）
    response_delay_ms: int = 0       # 模拟回复延迟（毫秒）


@dataclass
class RoomMember:
    """群聊房间成员。"""
    id: str = field(default_factory=_uuid)
    member_type: str = "ai"          # ai / human
    config: MemberConfig = field(default_factory=MemberConfig)
    status: MemberStatus = MemberStatus.ACTIVE
    joined_at: datetime = field(default_factory=_now)
    last_active_at: datetime = field(default_factory=_now)
    message_count: int = 0           # 该成员发送的消息数量


@dataclass
class Room:
    """群聊房间。"""
    id: str = field(default_factory=_uuid)
    name: str = ""
    description: str = ""
    members: dict[str, RoomMember] = field(default_factory=dict)  # member_id -> RoomMember
    status: RoomStatus = RoomStatus.ACTIVE
    created_at: datetime = field(default_factory=_now)
    updated_at: datetime = field(default_factory=_now)
    # 房间级配置
    max_members: int = 10
    allow_human_members: bool = True


@dataclass
class RoomStore:
    """房间存储（内存）。"""
    rooms: dict[str, Room] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# 房间工厂
# ---------------------------------------------------------------------------

def create_room(
    name: str = "",
    description: str = "",
    max_members: int = 10,
) -> Room:
    """创建新群聊房间。"""
    now = _now()
    auto_name = name or f"群聊 {now.strftime('%m-%d %H:%M')}"
    return Room(
        name=auto_name,
        description=description,
        max_members=max_members,
        created_at=now,
        updated_at=now,
    )


def create_ai_member(
    display_name: str,
    model: str = "claude-3-5-sonnet-20241022",
    temperature: float = 0.7,
    system_prompt: str = "",
    persona_id: str | None = None,
    avatar: str = "🤖",
    auto_reply: bool = True,
    can_mention_others: bool = True,
) -> RoomMember:
    """创建AI成员。"""
    config = MemberConfig(
        display_name=display_name,
        avatar=avatar,
        model=model,
        temperature=temperature,
        system_prompt=system_prompt,
        persona_id=persona_id,
        auto_reply=auto_reply,
        can_mention_others=can_mention_others,
    )
    return RoomMember(member_type="ai", config=config)


def create_human_member(display_name: str, avatar: str = "👤") -> RoomMember:
    """创建人类成员（用于代表用户加入群聊）。"""
    config = MemberConfig(
        display_name=display_name,
        avatar=avatar,
        auto_reply=False,
        can_mention_others=True,
    )
    return RoomMember(member_type="human", config=config)


# ---------------------------------------------------------------------------
# 成员管理
# ---------------------------------------------------------------------------

def add_member(room: Room, member: RoomMember) -> Room:
    """
    向房间添加成员。
    若成员数已达上限，抛出 ValueError。
    """
    if len(room.members) >= room.max_members:
        raise ValueError(f"房间 '{room.name}' 已达成员上限（{room.max_members}人）")
    # 检查AI成员名称是否重复
    for existing in room.members.values():
        if existing.config.display_name == member.config.display_name:
            raise ValueError(f"成员名称 '{member.config.display_name}' 已存在于房间中")
    new_members = {**room.members, member.id: member}
    return Room(**{**room.__dict__, "members": new_members, "updated_at": _now()})


def remove_member(room: Room, member_id: str) -> Room:
    """从房间移除成员。"""
    if member_id not in room.members:
        raise KeyError(f"成员 {member_id} 不在房间中")
    new_members = {k: v for k, v in room.members.items() if k != member_id}
    return Room(**{**room.__dict__, "members": new_members, "updated_at": _now()})


def update_member_config(room: Room, member_id: str, **kwargs) -> Room:
    """
    更新成员配置。
    支持的字段：display_name, model, temperature, system_prompt,
                persona_id, auto_reply, can_mention_others, avatar
    """
    if member_id not in room.members:
        raise KeyError(f"成员 {member_id} 不在房间中")
    member = room.members[member_id]
    old_config = member.config
    new_config = MemberConfig(
        display_name=kwargs.get("display_name", old_config.display_name),
        avatar=kwargs.get("avatar", old_config.avatar),
        model=kwargs.get("model", old_config.model),
        temperature=kwargs.get("temperature", old_config.temperature),
        max_tokens=kwargs.get("max_tokens", old_config.max_tokens),
        persona_id=kwargs.get("persona_id", old_config.persona_id),
        system_prompt=kwargs.get("system_prompt", old_config.system_prompt),
        auto_reply=kwargs.get("auto_reply", old_config.auto_reply),
        can_mention_others=kwargs.get("can_mention_others", old_config.can_mention_others),
        response_delay_ms=kwargs.get("response_delay_ms", old_config.response_delay_ms),
    )
    new_member = RoomMember(
        id=member.id,
        member_type=member.member_type,
        config=new_config,
        status=member.status,
        joined_at=member.joined_at,
        last_active_at=_now(),
        message_count=member.message_count,
    )
    new_members = {**room.members, member_id: new_member}
    return Room(**{**room.__dict__, "members": new_members, "updated_at": _now()})


def set_member_status(room: Room, member_id: str, status: MemberStatus) -> Room:
    """设置成员状态（活跃/静音/离线）。"""
    if member_id not in room.members:
        raise KeyError(f"成员 {member_id} 不在房间中")
    member = room.members[member_id]
    new_member = RoomMember(
        id=member.id,
        member_type=member.member_type,
        config=member.config,
        status=status,
        joined_at=member.joined_at,
        last_active_at=_now(),
        message_count=member.message_count,
    )
    new_members = {**room.members, member_id: new_member}
    return Room(**{**room.__dict__, "members": new_members, "updated_at": _now()})


def increment_member_message_count(room: Room, member_id: str) -> Room:
    """递增成员消息计数（每次发言后调用）。"""
    if member_id not in room.members:
        return room
    member = room.members[member_id]
    new_member = RoomMember(
        id=member.id,
        member_type=member.member_type,
        config=member.config,
        status=member.status,
        joined_at=member.joined_at,
        last_active_at=_now(),
        message_count=member.message_count + 1,
    )
    new_members = {**room.members, member_id: new_member}
    return Room(**{**room.__dict__, "members": new_members})


# ---------------------------------------------------------------------------
# 查询函数
# ---------------------------------------------------------------------------

def list_active_members(room: Room) -> list[RoomMember]:
    """列出所有活跃成员（按加入时间排序）。"""
    active = [m for m in room.members.values() if m.status == MemberStatus.ACTIVE]
    return sorted(active, key=lambda m: m.joined_at)


def list_ai_members(room: Room) -> list[RoomMember]:
    """列出所有AI成员。"""
    return [m for m in room.members.values() if m.member_type == "ai"]


def get_member_by_name(room: Room, display_name: str) -> RoomMember | None:
    """按显示名称查找成员（大小写不敏感）。"""
    name_lower = display_name.lower()
    for member in room.members.values():
        if member.config.display_name.lower() == name_lower:
            return member
    return None


def get_member(room: Room, member_id: str) -> RoomMember | None:
    """按ID查找成员。"""
    return room.members.get(member_id)


def room_summary(room: Room) -> dict:
    """返回房间摘要信息（用于展示）。"""
    members = list(room.members.values())
    return {
        "id": room.id,
        "name": room.name,
        "description": room.description,
        "status": room.status.value,
        "member_count": len(members),
        "ai_member_count": sum(1 for m in members if m.member_type == "ai"),
        "active_member_count": sum(1 for m in members if m.status == MemberStatus.ACTIVE),
        "members": [
            {
                "id": m.id,
                "display_name": m.config.display_name,
                "avatar": m.config.avatar,
                "type": m.member_type,
                "status": m.status.value,
                "model": m.config.model,
                "message_count": m.message_count,
            }
            for m in sorted(members, key=lambda m: m.joined_at)
        ],
        "created_at": room.created_at.isoformat(),
        "updated_at": room.updated_at.isoformat(),
    }
