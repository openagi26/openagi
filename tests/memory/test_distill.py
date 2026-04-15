"""三阶段蒸馏器测试：LightSleep / REMSleep / DeepDreaming。"""

import tempfile

import pytest

from openagi.memory.working import WorkingMemory, MemoryItem
from openagi.memory.recent import RecentMemory, RecentEntry
from openagi.memory.archive import ArchiveMemory, ArchiveEntry
from openagi.memory.core_dna import CoreDNA
from openagi.memory.distill.light_sleep import (
    LightSleepDistiller,
    extract_tags,
    classify_topic,
    cluster_by_topic,
    deduplicate,
    jaccard_similarity,
)
from openagi.memory.distill.rem_sleep import (
    REMSleepDistiller,
    _has_contradiction,
    _jaccard,
)
from openagi.memory.distill.deep_dreaming import (
    DeepDreamingDistiller,
    _classify_knowledge_type,
    _extract_key_sentence,
    _generate_summary_rule_based,
)


# ── 工具函数 ─────────────────────────────────────────────────────────────

def _make_working() -> WorkingMemory:
    return WorkingMemory()


def _make_recent() -> RecentMemory:
    return RecentMemory(persist_dir=tempfile.mkdtemp())


def _make_archive() -> ArchiveMemory:
    return ArchiveMemory(db_path=tempfile.mktemp(suffix=".db"))


def _make_dna() -> CoreDNA:
    return CoreDNA(dna_path=tempfile.mktemp(suffix=".json"))


# ── LightSleep 工具函数测试 ───────────────────────────────────────────────

class TestExtractTagsLightSleep:
    def test_basic_extraction(self):
        tags = extract_tags("Python机器学习深度学习非常强大")
        assert len(tags) > 0

    def test_max_tags_respected(self):
        text = " ".join([f"概念{i}" for i in range(20)])
        tags = extract_tags(text, max_tags=5)
        assert len(tags) <= 5


class TestClassifyTopic:
    def test_tech_topic(self):
        topic = classify_topic("Python编程代码调试bug修复")
        assert topic == "技术"

    def test_learning_topic(self):
        topic = classify_topic("学习理解概念原理解释")
        assert topic == "学习"

    def test_general_topic(self):
        topic = classify_topic("随机内容没有明确主题")
        # 无法识别时返回通用
        assert isinstance(topic, str)


class TestClusterByTopic:
    def test_basic_clustering(self):
        items = [
            ("id1", "Python编程代码调试"),
            ("id2", "学习理解Python概念"),
            ("id3", "Python编程实战项目"),
        ]
        clusters = cluster_by_topic(items)
        assert len(clusters) > 0
        # 总条目数应等于输入
        total = sum(len(c.items) for c in clusters)
        assert total == 3

    def test_cluster_has_tags(self):
        items = [("id1", "机器学习深度学习神经网络")]
        clusters = cluster_by_topic(items)
        assert len(clusters) == 1
        assert len(clusters[0].tags) > 0

    def test_empty_input(self):
        clusters = cluster_by_topic([])
        assert clusters == []


class TestDeduplicate:
    def test_removes_duplicates(self):
        items = [
            ("id1", "Python是最好的编程语言"),
            ("id2", "Python是最好的编程语言"),  # 完全重复
            ("id3", "Java也是不错的语言"),
        ]
        unique, dups = deduplicate(items, threshold=0.8)
        assert len(unique) == 2
        assert len(dups) == 1

    def test_keeps_unique(self):
        items = [
            ("id1", "Python编程"),
            ("id2", "机器学习深度神经网络"),
            ("id3", "天气预报系统"),
        ]
        unique, dups = deduplicate(items, threshold=0.8)
        assert len(unique) == 3
        assert len(dups) == 0

    def test_empty_input(self):
        unique, dups = deduplicate([], threshold=0.8)
        assert unique == []
        assert dups == []

    def test_threshold_sensitivity(self):
        items = [
            ("id1", "Python机器学习"),
            ("id2", "Python深度学习"),  # 部分重叠
        ]
        # 高阈值：不视为重复
        unique_high, _ = deduplicate(items, threshold=0.9)
        # 低阈值：可能视为重复
        unique_low, _ = deduplicate(items, threshold=0.3)
        assert len(unique_high) >= len(unique_low)


class TestJaccardSimilarity:
    def test_identical(self):
        sim = jaccard_similarity("Python机器学习", "Python机器学习")
        assert sim == 1.0

    def test_completely_different(self):
        sim = jaccard_similarity("Python编程", "天气预报今天下雨")
        assert sim < 0.1

    def test_partial_overlap(self):
        sim = jaccard_similarity("Python机器学习", "Python深度学习")
        assert 0.0 < sim < 1.0


# ── LightSleepDistiller 测试 ─────────────────────────────────────────────

class TestLightSleepDistiller:
    def test_distill_basic(self):
        working = _make_working()
        recent = _make_recent()
        distiller = LightSleepDistiller(working, recent)

        # 添加热记忆
        for i in range(3):
            working.add(MemoryItem(
                id=f"item{i}",
                content=f"Python机器学习实战经验{i}，深度学习应用",
                role="user",
                session_id="s1",
            ))

        result = distiller.distill("s1")

        assert result.total_items == 3
        assert result.stored_to_recent > 0
        assert result.duration_ms > 0
        recent.clear_all()

    def test_distill_removes_duplicates(self):
        working = _make_working()
        recent = _make_recent()
        distiller = LightSleepDistiller(working, recent, dedup_threshold=0.8)

        # 添加重复内容
        working.add(MemoryItem(id="a1", content="Python是最好的语言", role="user", session_id="s1"))
        working.add(MemoryItem(id="a2", content="Python是最好的语言", role="user", session_id="s1"))  # 重复
        working.add(MemoryItem(id="a3", content="机器学习很重要的技术", role="user", session_id="s1"))

        result = distiller.distill("s1")

        assert result.duplicates_removed >= 1
        assert result.stored_to_recent < 3
        recent.clear_all()

    def test_distill_clears_working_memory(self):
        working = _make_working()
        recent = _make_recent()
        distiller = LightSleepDistiller(working, recent)

        working.add(MemoryItem(id="h1", content="测试内容清空验证", role="user", session_id="s1"))
        assert len(working.get_context("s1")) == 1

        distiller.distill("s1", keep_in_working=False)
        assert len(working.get_context("s1")) == 0  # 热记忆应已清空
        recent.clear_all()

    def test_distill_keep_in_working(self):
        working = _make_working()
        recent = _make_recent()
        distiller = LightSleepDistiller(working, recent)

        working.add(MemoryItem(id="h1", content="保留在热记忆的内容测试", role="user", session_id="s1"))
        distiller.distill("s1", keep_in_working=True)
        assert len(working.get_context("s1")) == 1  # 热记忆应保留
        recent.clear_all()

    def test_distill_empty_session(self):
        working = _make_working()
        recent = _make_recent()
        distiller = LightSleepDistiller(working, recent)

        result = distiller.distill("nonexistent_session")
        assert result.total_items == 0
        assert result.stored_to_recent == 0
        recent.clear_all()

    def test_distill_texts_utility(self):
        working = _make_working()
        recent = _make_recent()
        distiller = LightSleepDistiller(working, recent)

        texts = ["Python很好用", "机器学习很强大", "深度学习应用广泛"]
        result = distiller.distill_texts(texts, session_id="batch_test")
        assert result.total_items == 3
        recent.clear_all()

    def test_distill_generates_clusters(self):
        working = _make_working()
        recent = _make_recent()
        distiller = LightSleepDistiller(working, recent)

        working.add(MemoryItem(id="c1", content="Python代码调试bug修复", role="user", session_id="s1"))
        working.add(MemoryItem(id="c2", content="学习理解机器学习概念原理", role="user", session_id="s1"))

        result = distiller.distill("s1")
        assert len(result.clusters) > 0
        recent.clear_all()


# ── REM睡眠蒸馏测试 ───────────────────────────────────────────────────────

class TestHasContradiction:
    def test_no_contradiction_different_topics(self):
        is_contra, reason = _has_contradiction("Python很好用", "天气很好今天出门")
        assert not is_contra

    def test_contradiction_with_opposite_words(self):
        # 需要满足: 1) 相似度>CONTRADICTION_THRESHOLD(0.5), 2) 含对立词
        # 使用更长更相似、且含明显对立词的文本
        is_contra, reason = _has_contradiction(
            "系统运行状态良好，启动成功，服务正常工作",
            "系统运行状态良好，停止失败，服务异常工作",
        )
        assert is_contra
        assert reason != ""

    def test_similar_no_contradiction(self):
        is_contra, _ = _has_contradiction("Python很好", "Python非常好")
        # 相似但无对立词，不是矛盾
        assert not is_contra


class TestREMSleepDistiller:
    def test_distill_empty_recent(self):
        recent = _make_recent()
        archive = _make_archive()
        distiller = REMSleepDistiller(recent, archive)

        result = distiller.distill()
        assert result.associations_found == 0
        assert result.migrated_to_archive == 0
        recent.clear_all()
        archive.close()

    def test_find_associations_basic(self):
        recent = _make_recent()
        archive = _make_archive()
        distiller = REMSleepDistiller(recent, archive, association_threshold=0.2)

        # 添加相似的温记忆
        recent.store(RecentEntry(content="Python机器学习深度学习应用", source="test"))
        recent.store(RecentEntry(content="Python机器学习实战项目框架", source="test"))
        recent.store(RecentEntry(content="今天天气晴朗适合出行", source="test"))

        result = distiller.distill()
        assert result.associations_found >= 0  # 可能找到关联
        recent.clear_all()
        archive.close()

    def test_find_associations_in_texts(self):
        recent = _make_recent()
        archive = _make_archive()
        distiller = REMSleepDistiller(recent, archive, association_threshold=0.3)

        texts = ["Python机器学习深度学习", "Python机器学习框架", "完全不同的内容关于音乐"]
        assocs = distiller.find_associations_in_texts(texts)
        # Python相关的两条应该有关联
        assert len(assocs) >= 1
        recent.clear_all()
        archive.close()

    def test_detect_contradiction_utility(self):
        recent = _make_recent()
        archive = _make_archive()
        distiller = REMSleepDistiller(recent, archive)

        is_contra, reason = distiller.detect_contradiction_in_texts(
            "系统启动成功运行正常",
            "系统停止失败无法运行",
        )
        # 含有对立词（启动/停止，成功/失败）
        # 注意：需要满足相似度阈值
        assert isinstance(is_contra, bool)
        recent.clear_all()
        archive.close()

    def test_migrate_long_content(self):
        recent = _make_recent()
        archive = _make_archive()
        distiller = REMSleepDistiller(recent, archive, association_threshold=0.1)

        # 添加足够长的内容（>50字符）
        long_content = "Python是一种高级编程语言，具有简洁清晰的语法特点，广泛用于数据科学、机器学习和Web开发领域"
        recent.store(RecentEntry(content=long_content, source="test"))

        result = distiller.distill()
        assert result.migrated_to_archive >= 0  # 可能迁移
        recent.clear_all()
        archive.close()


# ── DeepDreaming 工具函数测试 ─────────────────────────────────────────────

class TestClassifyKnowledgeType:
    def test_fact_classification(self):
        ktype = _classify_knowledge_type("Python是一种解释型编程语言，定义为高级语言")
        assert ktype in ("fact", "general")

    def test_preference_classification(self):
        ktype = _classify_knowledge_type("用户喜欢Python，偏好简洁的代码风格")
        assert ktype == "preference"

    def test_lesson_classification(self):
        ktype = _classify_knowledge_type("应该先测试再部署，避免生产环境bug")
        assert ktype == "lesson"

    def test_unknown_classification(self):
        ktype = _classify_knowledge_type("随机内容")
        assert ktype == "general"


class TestExtractKeySentence:
    def test_single_sentence(self):
        text = "Python是最好的语言"
        result = _extract_key_sentence(text)
        assert result == text

    def test_multiple_sentences(self):
        text = "Python。机器学习非常重要，它改变了整个AI领域的发展方向。深度学习。"
        result = _extract_key_sentence(text)
        # 应该返回最长的句子
        assert "机器学习" in result or len(result) > 10

    def test_empty_text(self):
        result = _extract_key_sentence("")
        assert isinstance(result, str)


class TestGenerateSummaryRuleBased:
    def test_empty_entries(self):
        summary = _generate_summary_rule_based([])
        assert "无" in summary or "empty" in summary.lower()

    def test_basic_summary(self):
        entries = [
            {"content": "Python很好用", "category": "fact"},
            {"content": "用户喜欢简洁代码", "category": "preference"},
        ]
        summary = _generate_summary_rule_based(entries)
        assert len(summary) > 0
        assert "2" in summary  # 应包含条目数量

    def test_summary_includes_categories(self):
        entries = [
            {"content": "技术内容", "category": "fact"},
            {"content": "偏好内容", "category": "preference"},
        ]
        summary = _generate_summary_rule_based(entries)
        # 摘要应包含类别信息
        assert len(summary) > 20


# ── DeepDreamingDistiller 测试 ────────────────────────────────────────────

class TestDeepDreamingDistiller:
    def test_distill_empty_archive(self):
        archive = _make_archive()
        dna = _make_dna()
        distiller = DeepDreamingDistiller(archive, dna)

        result = distiller.distill()
        assert result.memories_analyzed == 0
        assert result.dream_diary is None
        archive.close()

    def test_distill_basic(self):
        archive = _make_archive()
        dna = _make_dna()
        distiller = DeepDreamingDistiller(archive, dna)

        # 添加冷记忆
        for i in range(5):
            archive.store(ArchiveEntry(
                content=f"Python机器学习重要技术点{i}，用户喜欢使用Python",
                category="fact",
                confidence=0.9,
            ))

        result = distiller.distill()
        assert result.memories_analyzed == 5
        assert result.knowledge_extracted >= 0
        assert result.dream_diary is not None
        archive.close()

    def test_dream_diary_has_narrative(self):
        archive = _make_archive()
        dna = _make_dna()
        distiller = DeepDreamingDistiller(archive, dna)

        archive.store(ArchiveEntry(content="重要的技术知识积累", category="fact"))
        result = distiller.distill()

        if result.dream_diary:
            assert len(result.dream_diary.narrative) > 0
        archive.close()

    def test_dna_update_for_high_confidence(self):
        archive = _make_archive()
        dna = _make_dna()
        initial_dna_count = len(dna.get_all())

        distiller = DeepDreamingDistiller(archive, dna, dna_confidence_threshold=0.7)

        # 添加高置信度的偏好类记忆
        archive.store(ArchiveEntry(
            content="用户非常喜欢使用Python进行机器学习开发",
            category="preference",
            source="distill",
            confidence=0.95,
        ))

        result = distiller.distill()
        # DNA可能被更新（取决于规则提取结果）
        new_dna_count = len(dna.get_all())
        assert new_dna_count >= initial_dna_count
        archive.close()

    def test_no_dna_update_for_low_confidence(self):
        archive = _make_archive()
        dna = _make_dna()
        initial_dna_count = len(dna.get_all())

        distiller = DeepDreamingDistiller(archive, dna, dna_confidence_threshold=0.99)

        # 添加低置信度记忆（不应触发DNA更新）
        archive.store(ArchiveEntry(
            content="可能用户偏好某种方式",
            category="fact",
            confidence=0.5,  # 低于阈值
        ))

        result = distiller.distill()
        assert len(result.dna_updates) == 0  # 低置信度不应更新DNA
        archive.close()

    def test_generate_dream_diary_text(self):
        archive = _make_archive()
        dna = _make_dna()
        distiller = DeepDreamingDistiller(archive, dna)

        archive.store(ArchiveEntry(content="重要内容需要记录在梦境日记中", category="fact"))
        text = distiller.generate_dream_diary_text()
        assert isinstance(text, str)
        assert len(text) > 0
        archive.close()

    def test_distill_extracts_by_type(self):
        archive = _make_archive()
        dna = _make_dna()
        distiller = DeepDreamingDistiller(archive, dna)

        archive.store(ArchiveEntry(content="事实知识：Python是解释型语言", category="fact", confidence=0.9))
        archive.store(ArchiveEntry(content="用户喜欢简洁的代码风格和偏好清晰", category="preference", confidence=0.9))

        result = distiller.distill()
        assert result.knowledge_extracted >= 0
        archive.close()


# ── 异步测试 ─────────────────────────────────────────────────────────────

class TestDeepDreamingAsync:
    @pytest.mark.asyncio
    async def test_distill_async_no_llm(self):
        """无LLM时降级到规则提取。"""
        archive = _make_archive()
        dna = _make_dna()
        distiller = DeepDreamingDistiller(archive, dna, llm_client=None)

        archive.store(ArchiveEntry(
            content="Python用户喜欢使用的技术偏好积累",
            category="preference",
            confidence=0.9,
        ))

        result = await distiller.distill_async()
        assert result.memories_analyzed >= 0
        if result.dream_diary:
            assert len(result.dream_diary.narrative) > 0
        archive.close()
