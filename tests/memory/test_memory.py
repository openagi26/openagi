"""记忆系统测试 — 四层记忆 + 统一管理器。"""

import tempfile
from pathlib import Path

from openagi.memory.working import WorkingMemory, MemoryItem
from openagi.memory.archive import ArchiveMemory, ArchiveEntry
from openagi.memory.core_dna import CoreDNA, DNAEntry
from openagi.memory.manager import MemoryManager


# ── 热记忆测试 ──────────────────────────────────────────────────────────

class TestWorkingMemory:
    def test_add_and_get(self):
        wm = WorkingMemory()
        wm.add(MemoryItem(id="1", content="hello", role="user", session_id="s1"))
        wm.add(MemoryItem(id="2", content="world", role="assistant", session_id="s1"))
        ctx = wm.get_context("s1")
        assert len(ctx) == 2
        assert ctx[0].content == "hello"

    def test_get_messages_format(self):
        wm = WorkingMemory()
        wm.add(MemoryItem(id="1", content="hi", role="user", session_id="s1"))
        wm.add(MemoryItem(id="2", content="hello", role="assistant", session_id="s1"))
        msgs = wm.get_messages("s1")
        assert msgs == [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}]

    def test_clear_session(self):
        wm = WorkingMemory()
        wm.add(MemoryItem(id="1", content="test", role="user", session_id="s1"))
        items = wm.clear_session("s1")
        assert len(items) == 1
        assert wm.get_context("s1") == []

    def test_max_items(self):
        wm = WorkingMemory(max_items=3)
        for i in range(5):
            wm.add(MemoryItem(id=str(i), content=f"msg{i}", role="user", session_id="s1"))
        ctx = wm.get_context("s1")
        assert len(ctx) == 3
        assert ctx[0].content == "msg2"  # 最早的被裁剪

    def test_multi_session(self):
        wm = WorkingMemory()
        wm.add(MemoryItem(id="1", content="a", role="user", session_id="s1"))
        wm.add(MemoryItem(id="2", content="b", role="user", session_id="s2"))
        assert len(wm.get_context("s1")) == 1
        assert len(wm.get_context("s2")) == 1
        assert wm.get_session_count() == 2

    def test_stats(self):
        wm = WorkingMemory()
        wm.add(MemoryItem(id="1", content="test", role="user", session_id="s1"))
        stats = wm.get_stats()
        assert stats["sessions"] == 1
        assert stats["total_items"] == 1


# ── 冷记忆测试 ──────────────────────────────────────────────────────────

class TestArchiveMemory:
    def _make_archive(self) -> ArchiveMemory:
        tmp = tempfile.mktemp(suffix=".db")
        return ArchiveMemory(db_path=tmp)

    def test_store_and_get(self):
        am = self._make_archive()
        entry = ArchiveEntry(content="重要发现", category="fact", source="distill")
        entry_id = am.store(entry)
        result = am.get_by_id(entry_id)
        assert result is not None
        assert result.content == "重要发现"
        am.close()

    def test_search(self):
        am = self._make_archive()
        am.store(ArchiveEntry(content="Python是最好的语言", category="fact"))
        am.store(ArchiveEntry(content="Rust也很好", category="fact"))
        results = am.search("Python")
        assert len(results) == 1
        assert "Python" in results[0].content
        am.close()

    def test_search_by_category(self):
        am = self._make_archive()
        am.store(ArchiveEntry(content="教训1", category="lesson"))
        am.store(ArchiveEntry(content="事实1", category="fact"))
        results = am.get_by_category("lesson")
        assert len(results) == 1
        am.close()

    def test_delete(self):
        am = self._make_archive()
        entry = ArchiveEntry(content="临时")
        entry_id = am.store(entry)
        assert am.delete(entry_id)
        assert am.get_by_id(entry_id) is None
        am.close()

    def test_stats(self):
        am = self._make_archive()
        am.store(ArchiveEntry(content="a", category="fact"))
        am.store(ArchiveEntry(content="b", category="lesson"))
        stats = am.get_stats()
        assert stats["total_entries"] == 2
        assert "fact" in stats["categories"]
        am.close()

    def test_get_recent(self):
        am = self._make_archive()
        for i in range(5):
            am.store(ArchiveEntry(content=f"entry{i}"))
        recent = am.get_recent(limit=3)
        assert len(recent) == 3
        am.close()


# ── 核心DNA测试 ──────────────────────────────────────────────────────────

class TestCoreDNA:
    def _make_dna(self) -> CoreDNA:
        tmp = tempfile.mktemp(suffix=".json")
        return CoreDNA(dna_path=tmp)

    def test_default_init(self):
        dna = self._make_dna()
        entries = dna.get_all()
        assert len(entries) >= 1  # 至少有默认DNA

    def test_add_and_get(self):
        dna = self._make_dna()
        entry = dna.add("用户喜欢简洁回答", category="preference")
        assert entry.id
        result = dna.get_by_id(entry.id)
        assert result is not None
        assert result.content == "用户喜欢简洁回答"

    def test_update(self):
        dna = self._make_dna()
        entry = dna.add("原始内容")
        dna.update(entry.id, "更新后的内容")
        result = dna.get_by_id(entry.id)
        assert result.content == "更新后的内容"

    def test_delete(self):
        dna = self._make_dna()
        entry = dna.add("临时DNA")
        assert dna.delete(entry.id)
        assert dna.get_by_id(entry.id) is None

    def test_to_prompt(self):
        dna = self._make_dna()
        dna.add("用户名叫陛下", category="relationship")
        prompt = dna.to_prompt()
        assert "核心记忆" in prompt
        assert "陛下" in prompt

    def test_persistence(self):
        """测试重启后DNA持久化。"""
        tmp = tempfile.mktemp(suffix=".json")
        dna1 = CoreDNA(dna_path=tmp)
        dna1.add("持久化测试", category="learning")
        count1 = len(dna1.get_all())

        # 重新加载
        dna2 = CoreDNA(dna_path=tmp)
        count2 = len(dna2.get_all())
        assert count2 == count1

    def test_get_by_category(self):
        dna = self._make_dna()
        dna.add("身份1", category="identity")
        dna.add("偏好1", category="preference")
        identities = dna.get_by_category("identity")
        assert len(identities) >= 1


# ── 统一管理器测试 ──────────────────────────────────────────────────────

class TestMemoryManager:
    def _make_manager(self) -> MemoryManager:
        tmp_db = tempfile.mktemp(suffix=".db")
        tmp_dna = tempfile.mktemp(suffix=".json")
        import os, tempfile as tf
        tmp_chroma = tf.mkdtemp()
        return MemoryManager(db_path=tmp_db, dna_path=tmp_dna, chroma_dir=tmp_chroma)

    def test_add_message(self):
        mm = self._make_manager()
        item_id = mm.add_message("s1", "user", "你好")
        assert item_id
        ctx = mm.get_context("s1")
        assert len(ctx) == 1
        mm.close()

    def test_end_session_transfers(self):
        mm = self._make_manager()
        mm.add_message("s1", "user", "问题")
        mm.add_message("s1", "assistant", "回答")
        # run_distill=False使用MVP降级路径（直接热→冷）
        count = mm.end_session("s1", run_distill=False)
        assert count == 2
        # 热记忆已清空
        assert mm.get_context("s1") == []
        # 冷记忆中有转存的数据
        results = mm.archive.search("问题")
        assert len(results) >= 1
        mm.close()

    def test_recall_cross_layer(self):
        mm = self._make_manager()
        mm.add_message("s1", "user", "Python很好用")
        mm.archive.store(ArchiveEntry(content="Python是主力语言", category="fact"))
        results = mm.recall("Python", session_id="s1")
        # 至少冷记忆应该命中
        assert len(results) >= 1
        layers = {r["layer"] for r in results}
        assert "L2_archive" in layers
        mm.close()

    def test_build_system_context(self):
        mm = self._make_manager()
        ctx = mm.build_system_context()
        assert "核心记忆" in ctx
        mm.close()

    def test_stats(self):
        mm = self._make_manager()
        mm.add_message("s1", "user", "test")
        stats = mm.get_stats()
        assert "working" in stats
        assert "archive" in stats
        assert "core_dna" in stats
        mm.close()
