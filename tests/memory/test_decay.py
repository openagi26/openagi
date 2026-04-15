"""
记忆时间衰减 & Token预算管理 测试
────────────────────────────────
test_decay_removes_old      — RecentMemory.decay_old_entries 删除超龄条目
test_archive_decay          — ArchiveMemory.decay_old_entries 删除超龄条目
test_token_budget_trim      — WorkingMemory.trim_to_budget 移除最旧条目至预算内
test_trim_no_op_within_budget — 未超预算时 trim 不操作
"""

from __future__ import annotations

import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import pytest

from openagi.memory.archive import ArchiveEntry, ArchiveMemory
from openagi.memory.recent import RecentEntry, RecentMemory
from openagi.memory.working import MemoryItem, WorkingMemory


# ── RecentMemory.decay_old_entries ───────────────────────────────────────────

def _make_recent_memory(tmp_path: Path) -> RecentMemory:
    """创建使用临时目录的 RecentMemory，避免加载真实 embedding 模型。"""
    return RecentMemory(persist_dir=tmp_path / "chroma")


def _old_iso(days: int = 40) -> str:
    """返回 days 天前的 ISO 时间戳。"""
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


def _new_iso(days: int = 1) -> str:
    """返回 days 天前（即"新"）的 ISO 时间戳。"""
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


@pytest.mark.parametrize("decay_days", [30])
def test_decay_removes_old(tmp_path: Path, decay_days: int) -> None:
    """decay_old_entries 应删除超龄条目，保留新条目。"""
    mem = _make_recent_memory(tmp_path)

    # 存入2条旧条目（40天前）
    for i in range(2):
        entry = RecentEntry(
            id=str(uuid4()),
            content=f"旧条目 {i}",
            source="test",
            created_at=_old_iso(40),
        )
        mem.store(entry)

    # 存入1条新条目（1天前）
    new_entry = RecentEntry(
        id=str(uuid4()),
        content="新条目 keep",
        source="test",
        created_at=_new_iso(1),
    )
    mem.store(new_entry)

    before = mem.count()
    assert before == 3

    deleted = mem.decay_old_entries(days=decay_days)

    assert deleted == 2
    assert mem.count() == 1


# ── ArchiveMemory.decay_old_entries ──────────────────────────────────────────

def test_archive_decay(tmp_path: Path) -> None:
    """ArchiveMemory.decay_old_entries 应删除超龄条目，保留新条目。"""
    db_path = tmp_path / "memory.db"
    mem = ArchiveMemory(db_path=db_path)

    # 存入2条旧条目
    for i in range(2):
        entry = ArchiveEntry(
            id=str(uuid4()),
            content=f"old archive entry {i}",
            source="test",
            created_at=_old_iso(60),
        )
        mem.store(entry)

    # 存入1条新条目
    new_entry = ArchiveEntry(
        id=str(uuid4()),
        content="new archive entry keep",
        source="test",
        created_at=_new_iso(1),
    )
    mem.store(new_entry)

    stats_before = mem.get_stats()
    assert stats_before["total_entries"] == 3

    deleted = mem.decay_old_entries(days=30)

    assert deleted == 2
    assert mem.get_stats()["total_entries"] == 1

    mem.close()


# ── WorkingMemory.trim_to_budget ─────────────────────────────────────────────

def _make_item(session_id: str, tokens: int, idx: int = 0) -> MemoryItem:
    return MemoryItem(
        id=str(uuid4()),
        content=f"msg {idx}",
        role="user",
        session_id=session_id,
        token_count=tokens,
    )


def test_token_budget_trim() -> None:
    """添加超出预算的消息后，trim_to_budget 应使 token 总量 <= 预算。"""
    mem = WorkingMemory()
    sid = "session-budget-test"

    # 添加4条，每条100 token，总共400
    for i in range(4):
        mem.add(_make_item(sid, tokens=100, idx=i))

    assert mem.get_token_count(sid) == 400

    # 预算200，应移除最旧的2条
    removed = mem.trim_to_budget(sid, max_tokens=200)

    assert removed == 2
    assert mem.get_token_count(sid) <= 200


def test_trim_no_op_within_budget() -> None:
    """未超预算时，trim_to_budget 不应移除任何条目。"""
    mem = WorkingMemory()
    sid = "session-no-op"

    mem.add(_make_item(sid, tokens=50, idx=0))
    mem.add(_make_item(sid, tokens=50, idx=1))

    removed = mem.trim_to_budget(sid, max_tokens=200)

    assert removed == 0
    assert len(mem.get_context(sid)) == 2
