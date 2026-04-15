"""
深度蒸馏 (Deep Dreaming Distillation)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
最深层的记忆蒸馏。类似人类深度睡眠和梦境期的知识巩固。

功能：
  · 综合知识提取（LLM驱动的prompt蒸馏，无LLM时降级到规则）
  · 梦境日记生成（自然语言叙事总结）
  · DNA更新决策（何时将学习固化到核心记忆）
  · 跨会话知识合并
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import uuid4

if TYPE_CHECKING:
    from openagi.memory.archive import ArchiveMemory, ArchiveEntry
    from openagi.memory.core_dna import CoreDNA, DNAEntry

logger = logging.getLogger("openagi.memory.distill.deep_dreaming")

# DNA更新置信度阈值（冷记忆条目confidence超过此值才考虑更新DNA）
DNA_CONFIDENCE_THRESHOLD = 0.8
# 冷记忆条目出现次数阈值（重复出现的知识更值得固化到DNA）
DNA_REPEAT_THRESHOLD = 3
# 梦境日记最大字数
DREAM_DIARY_MAX_CHARS = 2000


# ── 知识提取（规则降级版）────────────────────────────────────────────────

# 知识类型识别模式
KNOWLEDGE_PATTERNS = {
    "fact": [
        r"是[\u4e00-\u9fff]{1,20}的?",      # "X是Y的"
        r"定义为|定义是|指的是",              # 定义类
        r"等于|计算公式|方法是",              # 数学/技术
        r"is a|is an|means|refers to",       # 英文定义
    ],
    "preference": [
        r"喜欢|偏好|习惯|倾向|prefer",
        r"不喜欢|讨厌|避免|dislike|avoid",
        r"最好|最差|最喜欢|favorite|best",
    ],
    "lesson": [
        r"教训|经验|总结|学到|realized",
        r"应该|不应该|要|不要|should|shouldn't",
        r"注意|避免|陷阱|坑|pitfall|mistake",
    ],
    "skill": [
        r"学会|掌握|能够|learned to|can now",
        r"技巧|方法|技能|skill|technique|method",
    ],
    "relationship": [
        r"用户|陛下|朋友|同事|合作",
        r"user|friend|colleague|partner",
    ],
}


def _classify_knowledge_type(text: str) -> str:
    """
    通过规则识别知识类型。

    Returns: "fact" | "preference" | "lesson" | "skill" | "relationship" | "general"
    """
    text_lower = text.lower()
    scores: dict[str, int] = {}

    for ktype, patterns in KNOWLEDGE_PATTERNS.items():
        count = sum(1 for p in patterns if re.search(p, text_lower))
        if count > 0:
            scores[ktype] = count

    if not scores:
        return "general"
    return max(scores.items(), key=lambda x: x[1])[0]


def _extract_key_sentence(text: str) -> str:
    """
    从长文本中提取核心句子（用于DNA更新内容）。

    策略：
    1. 按句号/换行分割
    2. 取最长且含信息量最高的句子
    """
    # 分割句子
    sentences = re.split(r"[。！？\n.!?]+", text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 5]

    if not sentences:
        return text[:100]

    # 取最长的句子作为核心（启发式：长句子通常信息量更大）
    return max(sentences, key=len)


def _generate_summary_rule_based(entries: list[dict]) -> str:
    """
    基于规则生成摘要（LLM不可用时的降级版本）。

    按主题分组，每组取最具代表性的内容。
    """
    if not entries:
        return "本期无记忆内容。"

    # 按类别分组
    by_category: dict[str, list[str]] = {}
    for entry in entries:
        cat = entry.get("category", "general")
        content = entry.get("content", "")
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(content)

    # 生成摘要
    parts = []
    category_names = {
        "fact": "知识事实",
        "preference": "偏好记录",
        "lesson": "经验教训",
        "skill": "技能学习",
        "relationship": "关系记忆",
        "conversation": "对话记录",
        "general": "综合记忆",
    }

    total = sum(len(v) for v in by_category.values())
    parts.append(f"本期蒸馏共处理 {total} 条记忆，涉及 {len(by_category)} 个类别。\n")

    for cat, items in by_category.items():
        name = category_names.get(cat, cat)
        parts.append(f"【{name}】({len(items)}条)")
        # 取前2条作为代表
        for item in items[:2]:
            parts.append(f"  · {item[:80]}{'...' if len(item) > 80 else ''}")

    return "\n".join(parts)


# ── LLM蒸馏（可选，需要LLM集成）─────────────────────────────────────────

DISTILL_PROMPT_TEMPLATE = """你是一个记忆蒸馏专家。请分析以下记忆片段，提取核心知识。

记忆内容：
{memories}

请完成以下任务：
1. 提取3-5条核心知识要点（每条不超过50字）
2. 识别重要的用户偏好或模式
3. 找出值得长期记住的关键学习

输出格式（JSON）：
{{
  "key_learnings": ["要点1", "要点2", ...],
  "user_preferences": ["偏好1", "偏好2", ...],
  "important_facts": ["事实1", "事实2", ...]
}}

只输出JSON，不要其他内容。"""


async def _llm_distill(memories: list[str], llm_client=None) -> dict:
    """
    调用LLM进行深度蒸馏。

    Args:
        memories: 记忆文本列表
        llm_client: LLM客户端（None则降级到规则）

    Returns:
        {"key_learnings": [...], "user_preferences": [...], "important_facts": [...]}
    """
    if not llm_client:
        # 降级到规则提取
        return {
            "key_learnings": [_extract_key_sentence(m) for m in memories[:3]],
            "user_preferences": [],
            "important_facts": [],
        }

    import json
    memories_text = "\n".join(f"- {m[:200]}" for m in memories[:20])
    prompt = DISTILL_PROMPT_TEMPLATE.format(memories=memories_text)

    try:
        response = await llm_client.complete(prompt)
        result = json.loads(response)
        return result
    except Exception as e:
        logger.warning(f"LLM蒸馏失败，降级到规则: {e}")
        return {
            "key_learnings": [_extract_key_sentence(m) for m in memories[:3]],
            "user_preferences": [],
            "important_facts": [],
        }


# ── 数据结构 ─────────────────────────────────────────────────────────────

@dataclass
class DreamDiary:
    """梦境日记——深度蒸馏的叙事总结。"""

    id: str = field(default_factory=lambda: str(uuid4()))
    narrative: str = ""                   # 自然语言叙事
    key_learnings: list[str] = field(default_factory=list)   # 核心学习
    user_preferences: list[str] = field(default_factory=list)
    important_facts: list[str] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    memories_processed: int = 0
    dna_updates: int = 0


@dataclass
class DeepDreamingResult:
    """深度蒸馏结果。"""

    dream_diary: DreamDiary | None = None
    dna_updates: list[str] = field(default_factory=list)   # 更新的DNA条目ID
    memories_analyzed: int = 0
    knowledge_extracted: int = 0
    duration_ms: float = 0.0


# ── DeepDreamingDistiller ─────────────────────────────────────────────────

class DeepDreamingDistiller:
    """
    深度蒸馏器。

    对冷记忆中积累的知识进行深度整合，
    提取核心学习并更新DNA，生成梦境日记。
    """

    def __init__(
        self,
        archive: "ArchiveMemory",
        core_dna: "CoreDNA",
        llm_client=None,
        dna_confidence_threshold: float = DNA_CONFIDENCE_THRESHOLD,
    ):
        self.archive = archive
        self.core_dna = core_dna
        self.llm_client = llm_client
        self.dna_confidence_threshold = dna_confidence_threshold

    def distill(self, limit: int = 100) -> DeepDreamingResult:
        """
        执行同步深度蒸馏（规则驱动版本）。

        Args:
            limit: 处理的冷记忆条目数量上限

        Returns:
            DeepDreamingResult
        """
        import time
        start_ms = time.time() * 1000
        result = DeepDreamingResult()

        # 获取冷记忆
        entries = self.archive.get_recent(limit=limit)
        result.memories_analyzed = len(entries)

        if not entries:
            logger.info("冷记忆为空，跳过深度蒸馏")
            return result

        logger.info(f"深度蒸馏开始: 处理 {len(entries)} 条冷记忆")

        # 转为字典列表
        entry_dicts = [
            {
                "id": e.id,
                "content": e.content,
                "category": e.category,
                "confidence": e.confidence,
                "tags": e.tags,
            }
            for e in entries
        ]

        # 规则驱动知识提取
        extracted = self._extract_knowledge_rules(entry_dicts)
        result.knowledge_extracted = len(extracted)

        # 生成梦境日记
        diary = self._generate_dream_diary(entry_dicts, extracted)
        result.dream_diary = diary

        # DNA更新决策
        dna_ids = self._update_dna(extracted)
        result.dna_updates = dna_ids

        result.duration_ms = time.time() * 1000 - start_ms
        logger.info(
            f"深度蒸馏完成: 分析={result.memories_analyzed}, "
            f"提取={result.knowledge_extracted}, "
            f"DNA更新={len(result.dna_updates)}, "
            f"耗时={result.duration_ms:.1f}ms"
        )
        return result

    async def distill_async(self, limit: int = 100) -> DeepDreamingResult:
        """
        执行异步深度蒸馏（LLM驱动版本）。

        需要提供 llm_client 才能使用LLM增强。
        """
        import time
        start_ms = time.time() * 1000
        result = DeepDreamingResult()

        entries = self.archive.get_recent(limit=limit)
        result.memories_analyzed = len(entries)

        if not entries:
            return result

        memories = [e.content for e in entries]
        entry_dicts = [
            {"id": e.id, "content": e.content, "category": e.category,
             "confidence": e.confidence, "tags": e.tags}
            for e in entries
        ]

        # LLM蒸馏（或降级）
        llm_result = await _llm_distill(memories, self.llm_client)

        # 合并LLM结果和规则提取
        extracted = self._extract_knowledge_rules(entry_dicts)

        # 将LLM提取的学习加入结果
        for learning in llm_result.get("key_learnings", []):
            extracted.append({
                "content": learning,
                "type": "lesson",
                "source": "llm_distill",
                "confidence": 0.85,
            })

        for pref in llm_result.get("user_preferences", []):
            extracted.append({
                "content": pref,
                "type": "preference",
                "source": "llm_distill",
                "confidence": 0.9,
            })

        result.knowledge_extracted = len(extracted)
        diary = self._generate_dream_diary(entry_dicts, extracted)
        # 加入LLM提取的叙事
        if llm_result.get("key_learnings"):
            diary.key_learnings = llm_result["key_learnings"]
        result.dream_diary = diary

        dna_ids = self._update_dna(extracted)
        result.dna_updates = dna_ids
        result.duration_ms = time.time() * 1000 - start_ms

        return result

    def _extract_knowledge_rules(self, entries: list[dict]) -> list[dict]:
        """
        基于规则从冷记忆中提取知识点。

        Returns:
            [{"content": str, "type": str, "source": str, "confidence": float}, ...]
        """
        extracted = []
        seen_contents: set[str] = set()

        for entry in entries:
            content = entry["content"]
            ktype = _classify_knowledge_type(content)

            # 过滤太短或重复的内容
            key_sentence = _extract_key_sentence(content)
            normalized = key_sentence[:50].lower().strip()
            if normalized in seen_contents or len(key_sentence) < 10:
                continue
            seen_contents.add(normalized)

            confidence = entry.get("confidence", 1.0)
            extracted.append({
                "content": key_sentence,
                "type": ktype,
                "source": entry["id"],
                "confidence": confidence,
                "original_category": entry.get("category", "general"),
                "tags": entry.get("tags", []),
            })

        return extracted

    def _generate_dream_diary(
        self,
        entries: list[dict],
        extracted: list[dict],
    ) -> DreamDiary:
        """
        生成梦境日记（自然语言叙事）。
        """
        # 规则生成摘要
        narrative = _generate_summary_rule_based(entries)

        # 按类型分类提取结果
        learnings = [e["content"] for e in extracted if e["type"] in ("lesson", "general")][:5]
        preferences = [e["content"] for e in extracted if e["type"] == "preference"][:3]
        facts = [e["content"] for e in extracted if e["type"] == "fact"][:5]

        # 截断叙事
        if len(narrative) > DREAM_DIARY_MAX_CHARS:
            narrative = narrative[:DREAM_DIARY_MAX_CHARS] + "...\n（内容已截断）"

        diary = DreamDiary(
            narrative=narrative,
            key_learnings=learnings,
            user_preferences=preferences,
            important_facts=facts,
            memories_processed=len(entries),
        )
        logger.info(f"梦境日记生成完成: {len(narrative)}字, {len(learnings)}条学习")
        return diary

    def _update_dna(self, extracted: list[dict]) -> list[str]:
        """
        决策是否更新核心DNA。

        更新条件：
        1. 提取的知识置信度 >= DNA_CONFIDENCE_THRESHOLD
        2. 类型是 preference / lesson / relationship（持久性强）
        3. 与现有DNA不重复（相似度<0.7）

        Returns:
            新增的DNA条目ID列表
        """
        dna_entry_ids = []
        existing_dna = self.core_dna.get_all()
        existing_contents = [e.content for e in existing_dna]

        for item in extracted:
            if item["confidence"] < self.dna_confidence_threshold:
                continue

            ktype = item["type"]
            if ktype not in ("preference", "lesson", "relationship", "skill"):
                continue

            # 检查是否与现有DNA重复
            content = item["content"]
            is_duplicate = False
            for existing in existing_contents:
                from openagi.memory.distill.light_sleep import jaccard_similarity
                if jaccard_similarity(content, existing) > 0.7:
                    is_duplicate = True
                    break

            if not is_duplicate:
                # DNA类型映射
                dna_category_map = {
                    "preference": "preference",
                    "lesson": "learning",
                    "relationship": "relationship",
                    "skill": "learning",
                }
                dna_category = dna_category_map.get(ktype, "learning")

                new_entry = self.core_dna.add(
                    content=content,
                    category=dna_category,
                    source="deep_dreaming",
                )
                dna_entry_ids.append(new_entry.id)
                existing_contents.append(content)  # 防止本批次内重复
                logger.info(f"DNA更新: [{dna_category}] {content[:50]}...")

        return dna_entry_ids

    def generate_dream_diary_text(self, limit: int = 50) -> str:
        """
        快捷方法：直接生成梦境日记文本。
        """
        result = self.distill(limit=limit)
        if result.dream_diary:
            return result.dream_diary.narrative
        return "本期无梦境记录。"
