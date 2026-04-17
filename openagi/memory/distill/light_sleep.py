"""
轻睡眠蒸馏 (Light Sleep Distillation)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
对话结束后的快速整理阶段。相当于人睡着后的浅层睡眠。

功能：
  · 概念标签提取（为每条记忆打标签）
  · 主题聚类（将相关记忆分组）
  · 重复内容去重（相似度>0.8视为重复，保留最优）
  · 热记忆 → 温记忆的向量化转存
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import uuid4

if TYPE_CHECKING:
    from openagi.memory.working import WorkingMemory, MemoryItem
    from openagi.memory.recent import RecentMemory, RecentEntry

logger = logging.getLogger("openagi.memory.distill.light_sleep")

# 相似度阈值（超过此值视为重复）
DEDUP_THRESHOLD = 0.8

# 主题关键词字典（用于简单主题分类）
TOPIC_KEYWORDS: dict[str, list[str]] = {
    "技术": ["代码", "编程", "函数", "API", "数据库", "算法", "bug", "错误", "调试", "python", "javascript", "git"],
    "学习": ["学习", "理解", "概念", "原理", "解释", "教程", "知识", "课程", "笔记"],
    "任务": ["任务", "计划", "完成", "进度", "目标", "需求", "功能", "实现", "做"],
    "情感": ["感谢", "喜欢", "讨厌", "开心", "担心", "希望", "觉得", "认为", "感觉"],
    "人物": ["用户", "我", "你", "他", "她", "团队", "同事", "朋友"],
    "时间": ["今天", "明天", "昨天", "最近", "以前", "未来", "现在", "时间", "日期"],
}


# ── 工具函数 ─────────────────────────────────────────────────────────────

def _tokenize_simple(text: str) -> set[str]:
    """简单分词，返回词集合用于相似度计算。"""
    # 中文bigram
    chars = re.findall(r"[\u4e00-\u9fff]", text)
    bigrams = {chars[i] + chars[i + 1] for i in range(len(chars) - 1)}
    # 英文单词
    words = set(re.findall(r"\b[a-zA-Z]{2,}\b", text.lower()))
    return bigrams | words


def jaccard_similarity(a: str, b: str) -> float:
    """Jaccard相似度，用于重复检测。"""
    set_a = _tokenize_simple(a)
    set_b = _tokenize_simple(b)
    if not set_a and not set_b:
        return 1.0
    if not set_a or not set_b:
        return 0.0
    return len(set_a & set_b) / len(set_a | set_b)


def extract_tags(text: str, max_tags: int = 8) -> list[str]:
    """
    从文本提取概念标签。

    策略：
    1. 中文2-4字词汇提取
    2. 英文关键词提取
    3. 过滤停用词
    4. 按词频排序，取前max_tags个
    """
    STOP_WORDS = {
        "的", "了", "和", "是", "在", "我", "有", "他", "这", "个", "你", "们",
        "来", "到", "说", "不", "也", "就", "但", "都", "时", "会", "对", "很",
        "with", "the", "and", "for", "that", "this", "are", "from", "have",
    }

    # 中文词汇（2-4字连续汉字）
    zh_words = re.findall(r"[\u4e00-\u9fff]{2,4}", text)
    # 英文单词（3+字母）
    en_words = re.findall(r"\b[a-zA-Z]{3,}\b", text.lower())

    all_words = zh_words + en_words
    freq: dict[str, int] = {}
    for w in all_words:
        if w not in STOP_WORDS:
            freq[w] = freq.get(w, 0) + 1

    sorted_words = sorted(freq.items(), key=lambda x: x[1], reverse=True)
    return [w for w, _ in sorted_words[:max_tags]]


def classify_topic(text: str) -> str:
    """
    对文本进行主题分类。

    返回最匹配的主题类别，无法匹配则返回 "通用"。
    """
    text_lower = text.lower()
    best_topic = "通用"
    best_count = 0

    for topic, keywords in TOPIC_KEYWORDS.items():
        count = sum(1 for kw in keywords if kw in text_lower)
        if count > best_count:
            best_count = count
            best_topic = topic

    return best_topic


# ── 聚类 ─────────────────────────────────────────────────────────────────

@dataclass
class MemoryCluster:
    """记忆聚类结果。"""

    topic: str
    items: list[str]      # 内容列表
    item_ids: list[str]   # 对应ID列表
    summary: str = ""     # 聚类摘要（第一条作为代表）
    tags: list[str] = field(default_factory=list)


def cluster_by_topic(items: list[tuple[str, str]]) -> list[MemoryCluster]:
    """
    按主题对记忆条目聚类。

    Args:
        items: [(item_id, content), ...]

    Returns:
        MemoryCluster 列表，每个cluster包含同主题的条目
    """
    clusters: dict[str, MemoryCluster] = {}

    for item_id, content in items:
        topic = classify_topic(content)
        if topic not in clusters:
            clusters[topic] = MemoryCluster(
                topic=topic,
                items=[],
                item_ids=[],
            )
        clusters[topic].items.append(content)
        clusters[topic].item_ids.append(item_id)

    # 为每个cluster生成摘要和标签
    for cluster in clusters.values():
        cluster.summary = cluster.items[0][:100] if cluster.items else ""
        all_text = " ".join(cluster.items)
        cluster.tags = extract_tags(all_text, max_tags=8)

    return list(clusters.values())


# ── 去重 ─────────────────────────────────────────────────────────────────

def deduplicate(
    items: list[tuple[str, str]],
    threshold: float = DEDUP_THRESHOLD,
) -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
    """
    去重：移除与已有条目相似度超过阈值的重复内容。

    Args:
        items: [(item_id, content), ...]，按优先级排序（前面的保留）
        threshold: 相似度阈值，超过此值视为重复

    Returns:
        (unique_items, duplicate_items) 两个列表
    """
    unique: list[tuple[str, str]] = []
    duplicates: list[tuple[str, str]] = []

    for item_id, content in items:
        is_duplicate = False
        for _, kept_content in unique:
            sim = jaccard_similarity(content, kept_content)
            if sim >= threshold:
                is_duplicate = True
                logger.debug(f"去重：相似度={sim:.2f}，跳过 {item_id[:8]}...")
                break

        if is_duplicate:
            duplicates.append((item_id, content))
        else:
            unique.append((item_id, content))

    return unique, duplicates


# ── LightSleepDistiller ───────────────────────────────────────────────────

@dataclass
class LightSleepResult:
    """轻睡眠蒸馏结果。"""

    session_id: str
    total_items: int = 0
    stored_to_recent: int = 0
    duplicates_removed: int = 0
    clusters: list[MemoryCluster] = field(default_factory=list)
    tags_extracted: int = 0
    duration_ms: float = 0.0


class LightSleepDistiller:
    """
    轻睡眠蒸馏器。

    在对话结束后（或定时触发）将热记忆整理并转存到温记忆。
    """

    def __init__(
        self,
        working: "WorkingMemory",
        recent: "RecentMemory",
        dedup_threshold: float = DEDUP_THRESHOLD,
    ):
        self.working = working
        self.recent = recent
        self.dedup_threshold = dedup_threshold

    def distill(self, session_id: str, keep_in_working: bool = False) -> LightSleepResult:
        """
        对指定会话的热记忆执行轻睡眠蒸馏。

        流程：
        1. 从热记忆获取所有条目
        2. 提取概念标签
        3. 主题聚类
        4. 去重（相似度>threshold的移除）
        5. 向量化存储到温记忆
        6. 清空热记忆（可选）

        Args:
            session_id: 要蒸馏的会话ID
            keep_in_working: 是否保留热记忆（True=蒸馏但不清空）

        Returns:
            LightSleepResult 包含蒸馏统计
        """
        import time
        start_ms = time.time() * 1000

        result = LightSleepResult(session_id=session_id)

        # 获取热记忆
        items = self.working.get_context(session_id)
        result.total_items = len(items)

        if not items:
            logger.info(f"会话 {session_id} 无热记忆可蒸馏")
            return result

        # 转为 (id, content) 列表
        raw_items = [(item.id, item.content) for item in items]

        # 去重
        unique_items, dup_items = deduplicate(raw_items, threshold=self.dedup_threshold)
        result.duplicates_removed = len(dup_items)
        logger.info(f"去重: {len(raw_items)}条 → {len(unique_items)}条（移除{len(dup_items)}条重复）")

        # 主题聚类
        clusters = cluster_by_topic(unique_items)
        result.clusters = clusters
        logger.info(f"聚类: {len(unique_items)}条 → {len(clusters)}个主题")

        # 向量化存储到温记忆
        from openagi.memory.recent import RecentEntry
        stored_count = 0
        tags_count = 0

        for item_id, content in unique_items:
            # 找原始item的metadata
            orig_item = next((i for i in items if i.id == item_id), None)
            role = orig_item.role if orig_item else "unknown"

            tags = extract_tags(content)
            tags_count += len(tags)

            entry = RecentEntry(
                id=item_id,
                content=content,
                source="light_sleep",
                session_id=session_id,
                tags=tags,
                metadata={"role": role, "distill_stage": "light_sleep"},
            )
            try:
                self.recent.store(entry)
                stored_count += 1
            except Exception as e:
                logger.error(f"存储温记忆失败 {item_id[:8]}: {e}")

        result.stored_to_recent = stored_count
        result.tags_extracted = tags_count

        # 清空热记忆（可选）
        if not keep_in_working:
            self.working.clear_session(session_id)
            logger.info(f"清空会话 {session_id} 热记忆")

        result.duration_ms = time.time() * 1000 - start_ms
        logger.info(
            f"轻睡眠蒸馏完成: 会话={session_id}, "
            f"存储={stored_count}, 去重={result.duplicates_removed}, "
            f"耗时={result.duration_ms:.1f}ms"
        )
        return result

    def distill_texts(
        self,
        texts: list[str],
        session_id: str = "batch",
    ) -> LightSleepResult:
        """
        直接对文本列表执行蒸馏（不依赖热记忆）。

        用于外部调用方便测试。
        """
        from openagi.memory.working import MemoryItem

        # 临时注入到热记忆
        for i, text in enumerate(texts):
            item = MemoryItem(
                id=str(uuid4()),
                content=text,
                role="user",
                session_id=session_id,
            )
            self.working.add(item)

        return self.distill(session_id, keep_in_working=False)
