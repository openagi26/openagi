"""
L0 热记忆 (Working Memory) — 当前对话上下文
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
内存中维护当前对话的上下文窗口，对话结束后转入温记忆。

特点：
  · 存储在内存中（dict），速度最快
  · 对话结束时自动转存到温记忆
  · 支持上下文压缩（超出窗口时保留关键信息）
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone

logger = logging.getLogger("openagi.memory.working")


@dataclass
class MemoryItem:
    """单条记忆条目。"""

    id: str
    content: str
    role: str  # "user" | "assistant" | "system"
    session_id: str
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    metadata: dict = field(default_factory=dict)
    token_count: int = 0


class WorkingMemory:
    """
    L0 热记忆管理器。

    维护当前活跃对话的上下文。内存中操作，零延迟。
    """

    def __init__(self, max_items: int = 100, max_tokens: int = 32000):
        self._items: dict[str, list[MemoryItem]] = {}  # session_id → items
        self._max_items = max_items
        self._max_tokens = max_tokens

    def add(self, item: MemoryItem) -> None:
        """添加记忆条目到当前会话。"""
        if item.session_id not in self._items:
            self._items[item.session_id] = []
        self._items[item.session_id].append(item)

        # 自动裁剪
        session_items = self._items[item.session_id]
        if len(session_items) > self._max_items:
            self._items[item.session_id] = session_items[-self._max_items:]

    def get_context(self, session_id: str, max_items: int | None = None) -> list[MemoryItem]:
        """获取会话的上下文记忆。"""
        items = self._items.get(session_id, [])
        if max_items:
            return items[-max_items:]
        return list(items)

    def get_messages(self, session_id: str) -> list[dict]:
        """获取LLM格式的消息列表。"""
        return [{"role": item.role, "content": item.content} for item in self.get_context(session_id)]

    def clear_session(self, session_id: str) -> list[MemoryItem]:
        """清除会话上下文，返回被清除的条目（用于转存到温记忆）。"""
        items = self._items.pop(session_id, [])
        logger.info(f"清除会话 {session_id} 的 {len(items)} 条热记忆")
        return items

    def get_token_count(self, session_id: str) -> int:
        """获取会话的总Token数。"""
        return sum(item.token_count for item in self._items.get(session_id, []))

    def get_session_count(self) -> int:
        """获取活跃会话数。"""
        return len(self._items)

    def get_total_items(self) -> int:
        """获取所有会话的总条目数。"""
        return sum(len(items) for items in self._items.values())

    def get_stats(self) -> dict:
        """获取统计信息。"""
        return {
            "sessions": self.get_session_count(),
            "total_items": self.get_total_items(),
            "max_items_per_session": self._max_items,
            "max_tokens": self._max_tokens,
        }
