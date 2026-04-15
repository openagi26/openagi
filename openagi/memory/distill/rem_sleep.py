"""
REM睡眠蒸馏 (REM Sleep Distillation)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
温记忆 → 冷记忆的深化整理。类似人类REM睡眠期的记忆巩固。

功能：
  · 跨记忆关联发现（相似概念聚合）
  · 矛盾检测（新旧记忆语义冲突识别）
  · 温记忆向冷记忆的选择性迁移
  · 关联知识图谱构建（简单版本）
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import uuid4

if TYPE_CHECKING:
    from openagi.memory.recent import RecentMemory
    from openagi.memory.archive import ArchiveMemory, ArchiveEntry

logger = logging.getLogger("openagi.memory.distill.rem_sleep")

# 关联阈值（温记忆间相似度超过此值视为关联）
ASSOCIATION_THRESHOLD = 0.4
# 矛盾检测阈值（相似度>此值但含对立词则认为矛盾）
CONTRADICTION_THRESHOLD = 0.3

# 对立词对（简单版本）
CONTRADICTION_PAIRS = [
    ("好", "坏"), ("对", "错"), ("是", "否"), ("喜欢", "讨厌"),
    ("支持", "反对"), ("成功", "失败"), ("快", "慢"), ("多", "少"),
    ("增加", "减少"), ("启动", "停止"), ("开启", "关闭"),
    ("always", "never"), ("yes", "no"), ("true", "false"),
    ("enable", "disable"), ("add", "remove"), ("start", "stop"),
]


# ── 工具函数 ─────────────────────────────────────────────────────────────

def _token_set(text: str) -> set[str]:
    """提取文本词集合（中文bigram + 英文词）。"""
    import re
    chars = [c for c in text if "\u4e00" <= c <= "\u9fff"]
    bigrams = {chars[i] + chars[i + 1] for i in range(len(chars) - 1)}
    words = set(re.findall(r"\b[a-zA-Z]{2,}\b", text.lower()))
    return bigrams | words


def _jaccard(a: str, b: str) -> float:
    """Jaccard相似度。"""
    sa, sb = _token_set(a), _token_set(b)
    if not sa and not sb:
        return 1.0
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


def _has_contradiction(text_a: str, text_b: str) -> tuple[bool, str]:
    """
    检测两段文本是否存在语义矛盾。

    策略：
    1. 计算相似度（相似才有矛盾可能）
    2. 检查是否存在对立词对（一段含正向，另一段含负向）

    Returns:
        (is_contradiction, reason) 元组
    """
    sim = _jaccard(text_a, text_b)
    if sim < CONTRADICTION_THRESHOLD:
        return False, ""  # 相似度太低，不构成矛盾

    text_a_lower = text_a.lower()
    text_b_lower = text_b.lower()

    for pos_word, neg_word in CONTRADICTION_PAIRS:
        a_has_pos = pos_word in text_a_lower
        a_has_neg = neg_word in text_a_lower
        b_has_pos = pos_word in text_b_lower
        b_has_neg = neg_word in text_b_lower

        if (a_has_pos and b_has_neg) or (a_has_neg and b_has_pos):
            return True, f"对立词: '{pos_word}' vs '{neg_word}'"

    return False, ""


# ── 数据结构 ─────────────────────────────────────────────────────────────

@dataclass
class MemoryAssociation:
    """记忆关联关系。"""

    id_a: str
    content_a: str
    id_b: str
    content_b: str
    similarity: float
    shared_tags: list[str] = field(default_factory=list)
    association_type: str = "semantic"  # "semantic" | "temporal" | "topical"


@dataclass
class MemoryContradiction:
    """记忆矛盾。"""

    id_new: str
    content_new: str
    id_old: str
    content_old: str
    similarity: float
    reason: str
    resolution: str = "keep_both"  # "keep_new" | "keep_old" | "keep_both" | "merge"


@dataclass
class REMSleepResult:
    """REM蒸馏结果。"""

    associations_found: int = 0
    contradictions_found: int = 0
    migrated_to_archive: int = 0
    associations: list[MemoryAssociation] = field(default_factory=list)
    contradictions: list[MemoryContradiction] = field(default_factory=list)
    duration_ms: float = 0.0


# ── REMSleepDistiller ─────────────────────────────────────────────────────

class REMSleepDistiller:
    """
    REM睡眠蒸馏器。

    发现温记忆之间的语义关联，检测与冷记忆的矛盾，
    并将高价值温记忆迁移到冷记忆。
    """

    def __init__(
        self,
        recent: "RecentMemory",
        archive: "ArchiveMemory",
        association_threshold: float = ASSOCIATION_THRESHOLD,
    ):
        self.recent = recent
        self.archive = archive
        self.association_threshold = association_threshold

    def distill(self, limit: int = 50) -> REMSleepResult:
        """
        执行REM蒸馏。

        流程：
        1. 从温记忆获取最近条目
        2. 两两计算相似度，发现关联
        3. 与冷记忆对比，检测矛盾
        4. 将稳定的温记忆迁移到冷记忆

        Args:
            limit: 处理的温记忆条目数量上限

        Returns:
            REMSleepResult 包含蒸馏统计
        """
        import time
        start_ms = time.time() * 1000
        result = REMSleepResult()

        # 获取温记忆
        recent_items = self.recent.get_recent(limit=limit)
        if not recent_items:
            logger.info("温记忆为空，跳过REM蒸馏")
            return result

        logger.info(f"REM蒸馏开始: 处理 {len(recent_items)} 条温记忆")

        # 发现关联
        associations = self._find_associations(recent_items)
        result.associations = associations
        result.associations_found = len(associations)

        # 检测矛盾
        contradictions = self._detect_contradictions(recent_items)
        result.contradictions = contradictions
        result.contradictions_found = len(contradictions)

        # 迁移高价值温记忆到冷记忆
        migrated = self._migrate_to_archive(recent_items, associations)
        result.migrated_to_archive = migrated

        result.duration_ms = time.time() * 1000 - start_ms
        logger.info(
            f"REM蒸馏完成: 关联={result.associations_found}, "
            f"矛盾={result.contradictions_found}, "
            f"迁移={result.migrated_to_archive}, "
            f"耗时={result.duration_ms:.1f}ms"
        )
        return result

    def _find_associations(self, items: list[dict]) -> list[MemoryAssociation]:
        """
        在温记忆条目间发现语义关联。

        使用O(n²)两两比较（记忆量不大，可接受）。
        """
        associations = []
        n = len(items)

        for i in range(n):
            for j in range(i + 1, n):
                a = items[i]
                b = items[j]

                sim = _jaccard(a["content"], b["content"])
                if sim >= self.association_threshold:
                    # 计算共享标签
                    tags_a = set(a.get("tags", []))
                    tags_b = set(b.get("tags", []))
                    shared_tags = list(tags_a & tags_b)

                    associations.append(MemoryAssociation(
                        id_a=a["id"],
                        content_a=a["content"],
                        id_b=b["id"],
                        content_b=b["content"],
                        similarity=round(sim, 3),
                        shared_tags=shared_tags,
                        association_type="semantic",
                    ))

        # 按相似度排序
        associations.sort(key=lambda x: x.similarity, reverse=True)
        logger.debug(f"发现 {len(associations)} 条语义关联")
        return associations

    def _detect_contradictions(self, recent_items: list[dict]) -> list[MemoryContradiction]:
        """
        检测温记忆与冷记忆之间的矛盾。

        对每条温记忆，在冷记忆中搜索相似内容并检查是否矛盾。
        """
        contradictions = []

        for item in recent_items:
            # 在冷记忆中搜索相关内容
            archive_results = self.archive.search(item["content"][:50], limit=5)

            for arch_entry in archive_results:
                is_contra, reason = _has_contradiction(item["content"], arch_entry.content)
                if is_contra:
                    sim = _jaccard(item["content"], arch_entry.content)
                    contradictions.append(MemoryContradiction(
                        id_new=item["id"],
                        content_new=item["content"],
                        id_old=arch_entry.id,
                        content_old=arch_entry.content,
                        similarity=round(sim, 3),
                        reason=reason,
                        resolution="keep_both",  # 保守策略，两条都保留
                    ))
                    logger.warning(
                        f"发现矛盾: [{reason}] "
                        f"新={item['content'][:30]}... "
                        f"旧={arch_entry.content[:30]}..."
                    )

        return contradictions

    def _migrate_to_archive(
        self,
        items: list[dict],
        associations: list[MemoryAssociation],
    ) -> int:
        """
        将有价值的温记忆迁移到冷记忆。

        策略：
        - 有关联的温记忆（出现在关联关系中）优先迁移
        - 按内容长度过滤（太短的可能无实质信息）
        - 避免重复迁移（检查冷记忆中是否已存在）
        """
        from openagi.memory.archive import ArchiveEntry

        # 统计关联频次（关联次数多的条目更有价值）
        association_count: dict[str, int] = {}
        for assoc in associations:
            association_count[assoc.id_a] = association_count.get(assoc.id_a, 0) + 1
            association_count[assoc.id_b] = association_count.get(assoc.id_b, 0) + 1

        migrated = 0
        for item in items:
            content = item["content"]

            # 过滤太短的内容（少于10字符的可能是噪音）
            if len(content) < 10:
                continue

            # 有关联关系的优先迁移
            is_associated = item["id"] in association_count

            # 检查冷记忆中是否已存在相似内容
            existing = self.archive.search(content[:30], limit=3)
            already_exists = any(_jaccard(content, e.content) > 0.85 for e in existing)
            if already_exists:
                continue

            # 只迁移有关联或内容较长的条目
            if is_associated or len(content) > 50:
                entry = ArchiveEntry(
                    content=content,
                    source="rem_sleep",
                    category="conversation",
                    tags=item.get("tags", []),
                    metadata={
                        "original_id": item["id"],
                        "session_id": item.get("session_id", ""),
                        "association_count": association_count.get(item["id"], 0),
                        "distill_stage": "rem_sleep",
                    },
                )
                self.archive.store(entry)
                migrated += 1

        logger.info(f"REM迁移: {migrated}/{len(items)} 条温记忆 → 冷记忆")
        return migrated

    def find_associations_in_texts(
        self, texts: list[str]
    ) -> list[MemoryAssociation]:
        """
        对给定文本列表直接计算关联（工具方法）。
        """
        items = [
            {"id": str(uuid4()), "content": text, "tags": []}
            for text in texts
        ]
        return self._find_associations(items)

    def detect_contradiction_in_texts(
        self, text_new: str, text_old: str
    ) -> tuple[bool, str]:
        """
        检测两段文本是否矛盾（工具方法）。
        """
        return _has_contradiction(text_new, text_old)
