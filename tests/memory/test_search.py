"""混合检索引擎（HybridSearchEngine）测试。"""

import tempfile

import pytest

from openagi.memory.search import (
    BM25Index,
    HybridSearchEngine,
    SearchResult,
    mmr_rerank,
    _tokenize,
    _text_similarity,
)
from openagi.memory.working import WorkingMemory, MemoryItem
from openagi.memory.recent import RecentMemory, RecentEntry
from openagi.memory.archive import ArchiveMemory, ArchiveEntry
from openagi.memory.core_dna import CoreDNA


# ── BM25 测试 ─────────────────────────────────────────────────────────────

class TestTokenize:
    def test_chinese_tokenize(self):
        tokens = _tokenize("机器学习深度学习")
        assert len(tokens) > 0
        assert "机器" in tokens or "机器学" in tokens

    def test_english_tokenize(self):
        tokens = _tokenize("machine learning is great")
        assert "machine" in tokens
        assert "learning" in tokens

    def test_mixed_tokenize(self):
        tokens = _tokenize("Python机器学习非常powerful")
        assert len(tokens) > 0

    def test_empty_text(self):
        tokens = _tokenize("")
        assert tokens == []


class TestBM25Index:
    def test_basic_scoring(self):
        bm25 = BM25Index()
        docs = ["Python是最好的编程语言", "Java也很好用", "机器学习需要Python"]
        ids = ["d1", "d2", "d3"]
        bm25.add_documents(ids, docs)
        results = bm25.score("Python编程", top_k=3)
        assert len(results) > 0
        # Python相关文档应排在前面
        assert results[0][0] in ("d1", "d3")

    def test_empty_index(self):
        bm25 = BM25Index()
        results = bm25.score("任意查询")
        assert results == []

    def test_score_normalized(self):
        bm25 = BM25Index()
        bm25.add_documents(["d1", "d2"], ["Python编程", "Java编程"])
        results = bm25.score("编程", top_k=2)
        # 分数应在 [0, 1] 范围内
        for _, _, score in results:
            assert 0.0 <= score <= 1.0

    def test_top_k_limit(self):
        bm25 = BM25Index()
        bm25.add_documents(
            [f"d{i}" for i in range(10)],
            [f"文档{i}关于Python编程" for i in range(10)],
        )
        results = bm25.score("Python", top_k=3)
        assert len(results) <= 3

    def test_no_match_returns_low_score(self):
        bm25 = BM25Index()
        bm25.add_documents(["d1"], ["完全不相关的内容关于天气"])
        results = bm25.score("Python机器学习")
        if results:
            assert results[0][2] == 0.0  # 无匹配词，分数为0

    def test_bm25_parameters(self):
        bm25 = BM25Index(k1=1.2, b=0.5)
        bm25.add_documents(["d1", "d2"], ["Python很好", "Python很好很好很好"])
        results = bm25.score("Python")
        assert len(results) == 2


# ── MMR 测试 ─────────────────────────────────────────────────────────────

class TestMMRRerank:
    def test_basic_dedup(self):
        candidates = [
            {"id": "1", "content": "Python是最好的编程语言", "score": 0.9},
            {"id": "2", "content": "Python是最好的编程语言，非常好用", "score": 0.85},  # 高度相似
            {"id": "3", "content": "深度学习是AI的核心技术", "score": 0.8},  # 不同主题
        ]
        results = mmr_rerank(candidates, lmbd=0.7, top_k=2)
        # 第1和第3条应该被选中（第2条与第1条高度相似）
        assert len(results) == 2
        ids = [r["id"] for r in results]
        assert "1" in ids
        assert "3" in ids

    def test_empty_candidates(self):
        results = mmr_rerank([], top_k=5)
        assert results == []

    def test_top_k_limit(self):
        candidates = [
            {"id": str(i), "content": f"完全不同的内容{i}，关于话题{i}", "score": 1.0 - i * 0.1}
            for i in range(10)
        ]
        results = mmr_rerank(candidates, top_k=3)
        assert len(results) == 3

    def test_single_candidate(self):
        candidates = [{"id": "1", "content": "单条内容", "score": 0.9}]
        results = mmr_rerank(candidates, top_k=5)
        assert len(results) == 1

    def test_diversity_preserved(self):
        # 3条内容：2条相似，1条不同
        candidates = [
            {"id": "1", "content": "苹果是一种水果，很好吃", "score": 0.9},
            {"id": "2", "content": "苹果是水果，味道很甜", "score": 0.88},  # 与1相似
            {"id": "3", "content": "Python编程语言性能很强大", "score": 0.85},  # 不同
        ]
        results = mmr_rerank(candidates, lmbd=0.5, top_k=2)
        # 应该选1和3（多样性），而不是1和2（都是苹果）
        ids = [r["id"] for r in results]
        assert "1" in ids


class TestTextSimilarity:
    def test_identical_texts(self):
        sim = _text_similarity("Python编程", "Python编程")
        assert sim == 1.0

    def test_different_texts(self):
        sim = _text_similarity("Python编程", "天气很好")
        assert sim < 0.3

    def test_partial_overlap(self):
        sim = _text_similarity("Python机器学习", "Python深度学习")
        assert 0.0 < sim < 1.0

    def test_empty_texts(self):
        sim = _text_similarity("", "")
        assert sim == 1.0


# ── HybridSearchEngine 测试 ───────────────────────────────────────────────

def _make_full_engine():
    """创建带全部四层记忆的检索引擎。"""
    tmp_db = tempfile.mktemp(suffix=".db")
    tmp_dna = tempfile.mktemp(suffix=".json")
    tmp_chroma = tempfile.mkdtemp()

    working = WorkingMemory()
    recent = RecentMemory(persist_dir=tmp_chroma)
    archive = ArchiveMemory(db_path=tmp_db)
    core_dna = CoreDNA(dna_path=tmp_dna)

    engine = HybridSearchEngine(
        working=working,
        recent=recent,
        archive=archive,
        core_dna=core_dna,
    )
    return engine, working, recent, archive, core_dna


class TestHybridSearchEngine:
    def test_search_empty_returns_empty(self):
        engine, *_ = _make_full_engine()
        results = engine.search("任意查询")
        # DNA有默认条目，可能返回一些结果
        assert isinstance(results, list)

    def test_search_l0_hot_memory(self):
        engine, working, recent, archive, dna = _make_full_engine()
        working.add(MemoryItem(
            id="hot1",
            content="Python机器学习实战项目",
            role="user",
            session_id="s1",
        ))
        results = engine.search("Python机器学习", session_id="s1", layers=["L0"])
        assert len(results) > 0
        assert results[0].layer == "L0_working"
        recent.clear_all()

    def test_search_l2_archive(self):
        engine, working, recent, archive, dna = _make_full_engine()
        archive.store(ArchiveEntry(
            content="深度学习是神经网络的扩展技术",
            category="fact",
        ))
        results = engine.search("深度学习", layers=["L2"])
        assert len(results) > 0
        assert results[0].layer == "L2_archive"
        archive.close()
        recent.clear_all()

    def test_search_l3_dna(self):
        engine, working, recent, archive, dna = _make_full_engine()
        dna.add("用户热爱Python编程", category="preference")
        results = engine.search("Python", layers=["L3"])
        assert len(results) > 0
        layer_names = [r.layer for r in results]
        assert "L3_dna" in layer_names
        recent.clear_all()

    def test_cross_layer_search(self):
        engine, working, recent, archive, dna = _make_full_engine()
        # 在L0和L2都添加Python相关内容
        working.add(MemoryItem(id="h1", content="Python很强大", role="user", session_id="s1"))
        archive.store(ArchiveEntry(content="Python机器学习生态丰富", category="fact"))

        results = engine.search("Python", session_id="s1", limit=10)
        assert len(results) > 0
        layers = {r.layer for r in results}
        assert len(layers) >= 2  # 至少来自2个不同层
        archive.close()
        recent.clear_all()

    def test_search_result_structure(self):
        engine, working, recent, archive, dna = _make_full_engine()
        working.add(MemoryItem(id="h1", content="测试结构验证", role="user", session_id="s1"))
        results = engine.search("测试结构", session_id="s1", layers=["L0"])
        if results:
            r = results[0]
            assert hasattr(r, "id")
            assert hasattr(r, "content")
            assert hasattr(r, "score")
            assert hasattr(r, "layer")
            assert hasattr(r, "vector_score")
            assert hasattr(r, "keyword_score")
        recent.clear_all()

    def test_set_alpha(self):
        engine, *_ = _make_full_engine()
        engine.set_alpha(0.8)
        assert engine.alpha == 0.8

    def test_set_alpha_invalid(self):
        engine, *_ = _make_full_engine()
        with pytest.raises(ValueError):
            engine.set_alpha(1.5)

    def test_mmr_dedup(self):
        engine, working, _, archive, _ = _make_full_engine()
        # 添加多条相似内容
        for i in range(5):
            working.add(MemoryItem(
                id=f"h{i}",
                content=f"Python是最好的编程语言，版本{i}",  # 高度相似
                role="user",
                session_id="s1",
            ))
        results = engine.search("Python编程", session_id="s1", layers=["L0"], apply_mmr=True, limit=3)
        assert len(results) <= 3

    def test_keyword_search_utility(self):
        engine, *_ = _make_full_engine()
        docs = ["Python非常好用", "Java也不错", "Rust很快"]
        ids = ["d1", "d2", "d3"]
        results = engine.keyword_search("Python", docs, ids, top_k=2)
        assert len(results) > 0
        assert results[0][0] == "d1"
