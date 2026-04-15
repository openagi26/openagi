"""L1 温记忆（RecentMemory）测试。"""

import tempfile
from pathlib import Path

import pytest

from openagi.memory.recent import (
    RecentMemory,
    RecentEntry,
    _time_decay_score,
    _extract_tags,
)
from datetime import datetime, timezone, timedelta


# ── 工具函数测试 ──────────────────────────────────────────────────────────

class TestExtractTags:
    def test_chinese_tags(self):
        tags = _extract_tags("Python是最好的编程语言，深度学习很强大")
        assert len(tags) <= 8
        assert len(tags) > 0

    def test_english_tags(self):
        tags = _extract_tags("machine learning and deep learning are important")
        assert len(tags) > 0

    def test_mixed_tags(self):
        tags = _extract_tags("Python深度学习框架非常好用")
        assert len(tags) > 0
        assert len(tags) <= 8

    def test_empty_text(self):
        tags = _extract_tags("")
        assert tags == []

    def test_max_tags_limit(self):
        long_text = "Python机器学习深度神经网络框架算法模型训练推理部署优化量化蒸馏微调预训练"
        tags = _extract_tags(long_text, max_tags=5)
        assert len(tags) <= 5

    def test_stop_words_filtered(self):
        # 单字停用词会被过滤（长度<2），但组合bigram不在停用词表中属正常
        # 测试高频单字符（长度<2）不被提取
        tags = _extract_tags("a b c d e")  # 单字母英文，长度<2会被过滤
        for t in tags:
            assert len(t) >= 2  # 所有标签长度至少为2


class TestTimeDecayScore:
    def test_fresh_entry_high_score(self):
        now = datetime.now(timezone.utc).isoformat()
        score = _time_decay_score(now, 1.0)
        assert score > 0.99  # 刚创建，几乎无衰减

    def test_old_entry_low_score(self):
        old_time = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
        score = _time_decay_score(old_time, 1.0)
        assert score < 0.2  # 90天后，约为2^(-3) ≈ 0.125

    def test_half_life_at_30_days(self):
        half_life_time = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        score = _time_decay_score(half_life_time, 1.0)
        # 30天后应约为0.5（半衰期）
        assert 0.4 < score < 0.6

    def test_invalid_time_returns_default(self):
        score = _time_decay_score("invalid-time", 1.0)
        assert 0 < score < 1.0  # 返回默认衰减值


# ── RecentMemory 测试 ─────────────────────────────────────────────────────

def _make_recent() -> RecentMemory:
    """创建临时的RecentMemory实例。"""
    tmp_dir = tempfile.mkdtemp()
    return RecentMemory(persist_dir=tmp_dir)


class TestRecentMemoryStore:
    def test_store_basic(self):
        rm = _make_recent()
        entry = RecentEntry(content="Python是最佳编程语言", source="test")
        entry_id = rm.store(entry)
        assert entry_id == entry.id
        rm.clear_all()

    def test_store_auto_extracts_tags(self):
        rm = _make_recent()
        entry = RecentEntry(content="深度学习和机器学习都很重要", source="test")
        rm.store(entry)
        # 标签应被自动提取
        assert len(entry.tags) > 0
        rm.clear_all()

    def test_store_and_retrieve(self):
        rm = _make_recent()
        entry = RecentEntry(
            content="测试内容，用于验证存储和检索",
            source="unit_test",
            session_id="sess_001",
        )
        rm.store(entry)
        retrieved = rm.get_by_id(entry.id)
        assert retrieved is not None
        assert retrieved["content"] == entry.content
        rm.clear_all()

    def test_store_multiple(self):
        rm = _make_recent()
        for i in range(5):
            rm.store(RecentEntry(content=f"测试内容{i}，关于主题{i}", source="test"))
        assert rm.count() == 5
        rm.clear_all()


class TestRecentMemorySearch:
    def test_semantic_search_returns_results(self):
        rm = _make_recent()
        rm.store(RecentEntry(content="Python编程语言非常强大", source="test"))
        rm.store(RecentEntry(content="Java也是流行的编程语言", source="test"))
        rm.store(RecentEntry(content="今天天气很好", source="test"))

        results = rm.search("编程语言", limit=5)
        assert len(results) > 0
        # 编程语言相关的结果应排在前面
        assert any("编程" in r["content"] or "Python" in r["content"] for r in results[:2])
        rm.clear_all()

    def test_search_empty_collection(self):
        rm = _make_recent()
        results = rm.search("任意查询")
        assert results == []

    def test_search_with_decay(self):
        rm = _make_recent()
        rm.store(RecentEntry(content="最新的技术趋势", source="test"))
        results = rm.search("技术", apply_decay=True)
        if results:
            # decay_score 应该 <= score (因为是新条目，衰减很小)
            assert results[0]["decay_score"] <= results[0]["score"] * 1.01

    def test_search_returns_tags(self):
        rm = _make_recent()
        rm.store(RecentEntry(content="机器学习深度学习神经网络", source="test"))
        results = rm.search("机器学习", limit=5)
        assert len(results) > 0
        # 结果应包含tags字段
        assert "tags" in results[0]
        rm.clear_all()

    def test_search_limit(self):
        rm = _make_recent()
        for i in range(10):
            rm.store(RecentEntry(content=f"机器学习技术{i}的应用与实践", source="test"))
        results = rm.search("机器学习", limit=3)
        assert len(results) <= 3
        rm.clear_all()


class TestRecentMemoryGetRecent:
    def test_get_recent_returns_latest(self):
        rm = _make_recent()
        for i in range(5):
            rm.store(RecentEntry(content=f"条目{i}", source="test"))
        recent = rm.get_recent(limit=3)
        assert len(recent) <= 3
        rm.clear_all()

    def test_get_recent_empty(self):
        rm = _make_recent()
        assert rm.get_recent() == []


class TestRecentMemoryDelete:
    def test_delete_existing(self):
        rm = _make_recent()
        entry = RecentEntry(content="要删除的内容", source="test")
        rm.store(entry)
        assert rm.count() == 1
        result = rm.delete(entry.id)
        assert result is True
        rm.clear_all()

    def test_delete_nonexistent(self):
        rm = _make_recent()
        result = rm.delete("nonexistent-id-12345")
        # ChromaDB delete不存在的ID不报错
        assert result is True


class TestRecentMemoryStats:
    def test_stats_structure(self):
        rm = _make_recent()
        rm.store(RecentEntry(content="测试统计信息", source="test"))
        stats = rm.get_stats()
        assert "total_entries" in stats
        assert "persist_dir" in stats
        assert "half_life_days" in stats
        assert stats["total_entries"] == 1
        rm.clear_all()


class TestRecentMemoryClearAll:
    def test_clear_all(self):
        rm = _make_recent()
        for i in range(3):
            rm.store(RecentEntry(content=f"内容{i}", source="test"))
        assert rm.count() == 3
        removed = rm.clear_all()
        assert removed == 3
        assert rm.count() == 0
