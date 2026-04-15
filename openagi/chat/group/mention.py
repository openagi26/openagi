"""
@机制 (Mention System) — 群聊中的成员触发与链式协作
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
功能：
  · 解析@标签（@成员名, @全体, @all）
  · 只触发被@的成员回复
  · AI互相@自动触发链式协作
  · 轮次上限（默认3轮防循环）
  · 纯函数，无I/O副作用
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import uuid4

from openagi.chat.group.room import Room, RoomMember, MemberStatus, get_member_by_name


# ---------------------------------------------------------------------------
# 工具函数
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _uuid() -> str:
    return str(uuid4())


# ---------------------------------------------------------------------------
# @解析
# ---------------------------------------------------------------------------

# 匹配 @名称 的正则（支持中文、英文、数字、下划线，名称至少2个字符）
MENTION_PATTERN = re.compile(r"@([\w\u4e00-\u9fff\-]{2,})")

# 全体提及的关键词
ALL_KEYWORDS = {"all", "全体", "所有人", "everyone"}


@dataclass
class MentionResult:
    """@解析结果。"""
    raw_text: str                    # 原始文本
    mentions: list[str]              # 解析出的被@名称列表
    is_all_mention: bool = False     # 是否@全体
    unresolved: list[str] = field(default_factory=list)   # 无法匹配到成员的@名称


def parse_mentions(text: str) -> tuple[list[str], bool]:
    """
    解析文本中的@标签。
    返回 (mention_names列表, is_all_mention)。
    """
    found = MENTION_PATTERN.findall(text)
    is_all = any(name.lower() in ALL_KEYWORDS for name in found)
    # 过滤掉全体关键词，只保留具体成员名
    specific = [name for name in found if name.lower() not in ALL_KEYWORDS]
    return specific, is_all


def resolve_mentions(
    text: str,
    room: Room,
    sender_id: str | None = None,
) -> MentionResult:
    """
    解析文本中的@标签，并与房间成员进行匹配。
    sender_id: 发送者ID，用于排除自我@。
    """
    specific_names, is_all = parse_mentions(text)

    resolved = []
    unresolved = []

    for name in specific_names:
        member = get_member_by_name(room, name)
        if member is None:
            unresolved.append(name)
        elif member.id == sender_id:
            # 自我@忽略
            pass
        else:
            resolved.append(name)

    return MentionResult(
        raw_text=text,
        mentions=resolved,
        is_all_mention=is_all,
        unresolved=unresolved,
    )


def get_triggered_members(
    mention_result: MentionResult,
    room: Room,
    sender_id: str | None = None,
) -> list[RoomMember]:
    """
    根据@解析结果，获取应该被触发回复的成员列表。
    - @全体：所有活跃AI成员（排除发送者）
    - @具体名称：匹配的活跃成员
    - 未被@：无触发
    """
    if mention_result.is_all_mention:
        # @全体：触发所有活跃AI成员
        return [
            m for m in room.members.values()
            if m.status == MemberStatus.ACTIVE
            and m.member_type == "ai"
            and m.config.auto_reply
            and m.id != sender_id
        ]

    triggered = []
    for name in mention_result.mentions:
        member = get_member_by_name(room, name)
        if member and member.status == MemberStatus.ACTIVE and member.config.auto_reply:
            if member.id != sender_id:
                triggered.append(member)

    return triggered


# ---------------------------------------------------------------------------
# 链式协作（AI互相@）
# ---------------------------------------------------------------------------

@dataclass
class ChainLink:
    """链式协作中的一个环节。"""
    round_num: int               # 当前轮次（从1开始）
    sender_id: str               # 发送者成员ID
    sender_name: str             # 发送者名称
    content: str                 # 消息内容
    triggered_ids: list[str]     # 被触发的成员ID列表
    timestamp: datetime = field(default_factory=_now)


@dataclass
class ChainState:
    """链式协作状态跟踪。"""
    max_rounds: int = 3                      # 最大轮次（防无限循环）
    current_round: int = 0                   # 当前轮次
    links: list[ChainLink] = field(default_factory=list)
    active_member_ids: set = field(default_factory=set)  # 本次链中已发言的成员
    terminated: bool = False                 # 是否已终止（达到上限）
    termination_reason: str = ""


def create_chain_state(max_rounds: int = 3) -> ChainState:
    """创建新的链式协作状态。"""
    return ChainState(max_rounds=max_rounds)


def can_continue_chain(chain: ChainState) -> bool:
    """判断链式协作是否可以继续。"""
    return not chain.terminated and chain.current_round < chain.max_rounds


def add_chain_link(
    chain: ChainState,
    sender_id: str,
    sender_name: str,
    content: str,
    room: Room,
) -> tuple[ChainState, list[RoomMember]]:
    """
    在链中添加一个发言环节，解析@并返回下一批被触发的成员。
    返回 (更新后的ChainState, 下一批被触发成员列表)。
    """
    if chain.terminated:
        return chain, []

    # 解析@
    mention_result = resolve_mentions(content, room, sender_id=sender_id)
    triggered = get_triggered_members(mention_result, room, sender_id=sender_id)

    new_round = chain.current_round + 1
    new_link = ChainLink(
        round_num=new_round,
        sender_id=sender_id,
        sender_name=sender_name,
        content=content,
        triggered_ids=[m.id for m in triggered],
    )
    new_links = [*chain.links, new_link]
    new_active = chain.active_member_ids | {sender_id}

    # 检查终止条件
    terminated = False
    termination_reason = ""

    if new_round >= chain.max_rounds:
        terminated = True
        termination_reason = f"已达最大轮次上限（{chain.max_rounds}轮）"
    elif not triggered:
        # 没有更多成员被触发，链自然终止
        terminated = True
        termination_reason = "无更多成员被@触发，链式协作自然结束"

    new_chain = ChainState(
        max_rounds=chain.max_rounds,
        current_round=new_round,
        links=new_links,
        active_member_ids=new_active,
        terminated=terminated,
        termination_reason=termination_reason,
    )

    return new_chain, triggered


def get_chain_summary(chain: ChainState) -> dict:
    """返回链式协作摘要。"""
    return {
        "total_rounds": chain.current_round,
        "max_rounds": chain.max_rounds,
        "terminated": chain.terminated,
        "termination_reason": chain.termination_reason,
        "participants": list(chain.active_member_ids),
        "links": [
            {
                "round": link.round_num,
                "sender": link.sender_name,
                "triggered": link.triggered_ids,
                "content_preview": link.content[:50] + ("…" if len(link.content) > 50 else ""),
            }
            for link in chain.links
        ],
    }


# ---------------------------------------------------------------------------
# 文本格式化工具
# ---------------------------------------------------------------------------

def format_mention(name: str) -> str:
    """生成@标签文本。"""
    return f"@{name}"


def format_all_mention() -> str:
    """生成@全体标签。"""
    return "@全体"


def strip_mentions(text: str) -> str:
    """从文本中移除所有@标签（保留其余内容）。"""
    return MENTION_PATTERN.sub("", text).strip()


def extract_message_without_mentions(text: str) -> str:
    """提取去掉@标签后的纯消息内容。"""
    cleaned = MENTION_PATTERN.sub("", text)
    # 清理多余空格
    return " ".join(cleaned.split()).strip()
