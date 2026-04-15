"""
L2 冷记忆 (Archive Memory) — 长期持久化存储
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SQLite持久化存储，永不删除。按需检索或蒸馏引用时触发。

特点：
  · SQLite存储，支持大量数据
  · 永不自动删除（除非用户手动清理）
  · 支持关键词搜索和标签过滤
  · 蒸馏后的精华知识存储在此
"""

from __future__ import annotations

import json
import logging
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

logger = logging.getLogger("openagi.memory.archive")


@dataclass
class ArchiveEntry:
    """冷记忆条目。"""

    id: str = field(default_factory=lambda: str(uuid4()))
    content: str = ""
    source: str = ""  # "distill" | "user" | "system"
    category: str = ""  # "fact" | "pattern" | "lesson" | "skill"
    tags: list[str] = field(default_factory=list)
    confidence: float = 1.0
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    metadata: dict = field(default_factory=dict)


class ArchiveMemory:
    """
    L2 冷记忆管理器。

    SQLite持久化，支持全文搜索和标签过滤。
    所有记忆永久保存，是三阶段蒸馏的输出目标。
    """

    def __init__(self, db_path: str | Path = "~/.openagi/data/memory.db"):
        self._db_path = Path(db_path).expanduser()
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(self._db_path))
        self._init_db()

    def _init_db(self) -> None:
        """初始化数据库表。"""
        self._conn.executescript("""
            CREATE TABLE IF NOT EXISTS archive (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                source TEXT DEFAULT '',
                category TEXT DEFAULT '',
                tags TEXT DEFAULT '[]',
                confidence REAL DEFAULT 1.0,
                created_at TEXT NOT NULL,
                metadata TEXT DEFAULT '{}'
            );
            CREATE INDEX IF NOT EXISTS idx_archive_source ON archive(source);
            CREATE INDEX IF NOT EXISTS idx_archive_category ON archive(category);
            CREATE INDEX IF NOT EXISTS idx_archive_created ON archive(created_at);
        """)
        self._conn.commit()

    def store(self, entry: ArchiveEntry) -> str:
        """存储一条冷记忆。"""
        self._conn.execute(
            "INSERT OR REPLACE INTO archive (id, content, source, category, tags, confidence, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (entry.id, entry.content, entry.source, entry.category, json.dumps(entry.tags), entry.confidence, entry.created_at, json.dumps(entry.metadata)),
        )
        self._conn.commit()
        logger.debug(f"存储冷记忆: {entry.id[:8]}... [{entry.category}]")
        return entry.id

    def search(self, query: str, limit: int = 20, category: str | None = None) -> list[ArchiveEntry]:
        """关键词搜索冷记忆。"""
        sql = "SELECT * FROM archive WHERE content LIKE ?"
        params: list = [f"%{query}%"]
        if category:
            sql += " AND category = ?"
            params.append(category)
        sql += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)

        rows = self._conn.execute(sql, params).fetchall()
        return [self._row_to_entry(row) for row in rows]

    def get_by_id(self, entry_id: str) -> ArchiveEntry | None:
        """按ID获取。"""
        row = self._conn.execute("SELECT * FROM archive WHERE id = ?", (entry_id,)).fetchone()
        return self._row_to_entry(row) if row else None

    def get_recent(self, limit: int = 20) -> list[ArchiveEntry]:
        """获取最近的冷记忆。"""
        rows = self._conn.execute("SELECT * FROM archive ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
        return [self._row_to_entry(row) for row in rows]

    def get_by_category(self, category: str, limit: int = 50) -> list[ArchiveEntry]:
        """按类别获取。"""
        rows = self._conn.execute("SELECT * FROM archive WHERE category = ? ORDER BY created_at DESC LIMIT ?", (category, limit)).fetchall()
        return [self._row_to_entry(row) for row in rows]

    def delete(self, entry_id: str) -> bool:
        """删除一条冷记忆。"""
        cursor = self._conn.execute("DELETE FROM archive WHERE id = ?", (entry_id,))
        self._conn.commit()
        return cursor.rowcount > 0

    def clear_all(self) -> int:
        """清空所有冷记忆（危险操作）。"""
        cursor = self._conn.execute("DELETE FROM archive")
        self._conn.commit()
        count = cursor.rowcount
        logger.warning(f"清空全部冷记忆: {count}条")
        return count

    def get_stats(self) -> dict:
        """获取统计信息。"""
        total = self._conn.execute("SELECT COUNT(*) FROM archive").fetchone()[0]
        categories = self._conn.execute(
            "SELECT category, COUNT(*) FROM archive GROUP BY category"
        ).fetchall()
        db_size = self._db_path.stat().st_size if self._db_path.exists() else 0
        return {
            "total_entries": total,
            "categories": {cat: count for cat, count in categories},
            "db_size_bytes": db_size,
            "db_size_mb": round(db_size / 1024 / 1024, 2),
        }

    def close(self) -> None:
        """关闭数据库连接。"""
        self._conn.close()

    @staticmethod
    def _row_to_entry(row: tuple) -> ArchiveEntry:
        return ArchiveEntry(
            id=row[0],
            content=row[1],
            source=row[2],
            category=row[3],
            tags=json.loads(row[4]) if row[4] else [],
            confidence=row[5],
            created_at=row[6],
            metadata=json.loads(row[7]) if row[7] else {},
        )
