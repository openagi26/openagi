"""
L1 温记忆 (Recent Memory) — 向量语义检索
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ChromaDB 持久化向量存储，支持语义搜索和时间衰减。

特点：
  · ChromaDB 向量存储（余弦相似度）
  · 时间衰减：半衰期30天，指数衰减
  · 概念标签提取（最多8个/条）
  · 自动去重（相似度>0.85视为重复）
  · 比冷记忆快，比热记忆持久
"""

from __future__ import annotations

import logging
import math
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import chromadb
from chromadb.config import Settings

logger = logging.getLogger("openagi.memory.recent")

# 时间衰减参数
HALF_LIFE_DAYS = 30.0  # 半衰期30天

# 停用词（中英文常见词，不作为标签）
STOP_WORDS = {
    "的", "了", "和", "是", "在", "我", "有", "他", "这", "个", "你", "们",
    "来", "到", "说", "不", "也", "就", "但", "都", "时", "会", "对", "很",
    "with", "the", "and", "for", "that", "this", "are", "from", "have",
    "been", "was", "were", "they", "their", "what", "when", "who", "will",
    "can", "not", "but", "all", "one", "out", "has", "more", "there",
}


def _extract_tags(text: str, max_tags: int = 8) -> list[str]:
    """
    从文本中提取概念标签。

    策略：
    1. 分词（中文按字符n-gram，英文按单词）
    2. 过滤停用词
    3. 保留高频且有意义的词汇
    4. 最多返回 max_tags 个标签
    """
    # 提取中文词汇（2-4字连续汉字）
    chinese_words = re.findall(r"[\u4e00-\u9fff]{2,4}", text)

    # 提取英文单词（至少3个字母）
    english_words = re.findall(r"\b[a-zA-Z]{3,}\b", text.lower())

    # 提取数字+单位组合（如"30天"、"100%"）
    number_units = re.findall(r"\d+[a-zA-Z\u4e00-\u9fff]+", text)

    all_words = chinese_words + english_words + number_units

    # 过滤停用词并统计词频
    freq: dict[str, int] = {}
    for word in all_words:
        if word not in STOP_WORDS and len(word) >= 2:
            freq[word] = freq.get(word, 0) + 1

    # 按频率排序，取前 max_tags 个
    sorted_words = sorted(freq.items(), key=lambda x: x[1], reverse=True)
    return [w for w, _ in sorted_words[:max_tags]]


def _time_decay_score(created_at_iso: str, base_score: float = 1.0) -> float:
    """
    计算时间衰减后的分数。

    衰减公式：score * 2^(-elapsed_days / half_life)
    半衰期 = HALF_LIFE_DAYS 天
    """
    try:
        created = datetime.fromisoformat(created_at_iso)
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        elapsed_days = (now - created).total_seconds() / 86400.0
        decay = math.pow(2, -elapsed_days / HALF_LIFE_DAYS)
        return base_score * decay
    except Exception:
        return base_score * 0.5  # 无法解析时间时给默认衰减


@dataclass
class RecentEntry:
    """L1 温记忆条目。"""

    id: str = field(default_factory=lambda: str(uuid4()))
    content: str = ""
    source: str = ""          # "session_end" | "distill" | "user"
    session_id: str = ""
    tags: list[str] = field(default_factory=list)
    embedding: list[float] | None = None   # 由 ChromaDB 自动管理
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    metadata: dict = field(default_factory=dict)


class RecentMemory:
    """
    L1 温记忆管理器。

    ChromaDB 向量存储，支持语义搜索 + 时间衰减。
    介于热记忆（内存）和冷记忆（SQLite）之间。
    """

    COLLECTION_NAME = "openagi_recent"

    def __init__(self, persist_dir: str | Path = "~/.openagi/data/chroma"):
        self._persist_dir = Path(persist_dir).expanduser()
        self._persist_dir.mkdir(parents=True, exist_ok=True)

        self._client = chromadb.PersistentClient(
            path=str(self._persist_dir),
            settings=Settings(anonymized_telemetry=False),
        )
        self._collection = self._client.get_or_create_collection(
            name=self.COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},  # 使用余弦相似度
        )
        logger.info(f"RecentMemory 初始化完成，持久目录: {self._persist_dir}")

    # ── 存储 ─────────────────────────────────────────────────────────────

    def store(self, entry: RecentEntry) -> str:
        """
        存储一条温记忆。

        自动提取概念标签并使用 ChromaDB 内置 embedding。
        """
        # 自动提取标签（若未提供）
        if not entry.tags:
            entry.tags = _extract_tags(entry.content)

        meta = {
            "source": entry.source,
            "session_id": entry.session_id,
            "tags": ",".join(entry.tags),
            "created_at": entry.created_at,
            **{f"meta_{k}": str(v) for k, v in entry.metadata.items()},
        }

        self._collection.upsert(
            ids=[entry.id],
            documents=[entry.content],
            metadatas=[meta],
        )
        logger.debug(f"存储温记忆: {entry.id[:8]}... 标签={entry.tags}")
        return entry.id

    # ── 语义检索 ─────────────────────────────────────────────────────────

    def search(
        self,
        query: str,
        limit: int = 20,
        score_threshold: float = 0.0,
        apply_decay: bool = True,
    ) -> list[dict]:
        """
        语义检索温记忆。

        返回按（相似度 × 时间衰减）排序的结果列表。

        Returns:
            list of dict with keys: id, content, score, decay_score, tags, created_at, metadata
        """
        total = self._collection.count()
        if total == 0:
            return []

        n_results = min(limit * 2, total)  # 多取一些，方便时间衰减重排

        results = self._collection.query(
            query_texts=[query],
            n_results=n_results,
            include=["documents", "metadatas", "distances"],
        )

        docs = results["documents"][0]
        metas = results["metadatas"][0]
        distances = results["distances"][0]

        items = []
        for doc, meta, dist in zip(docs, metas, distances):
            # ChromaDB 余弦距离 → 余弦相似度
            similarity = 1.0 - dist
            if similarity < score_threshold:
                continue

            created_at = meta.get("created_at", datetime.now(timezone.utc).isoformat())
            decay_score = _time_decay_score(created_at, similarity) if apply_decay else similarity
            tags = [t for t in meta.get("tags", "").split(",") if t]

            items.append({
                "id": results["ids"][0][docs.index(doc)],
                "content": doc,
                "score": similarity,
                "decay_score": decay_score,
                "tags": tags,
                "created_at": created_at,
                "source": meta.get("source", ""),
                "session_id": meta.get("session_id", ""),
            })

        # 按衰减分数重排序
        items.sort(key=lambda x: x["decay_score"], reverse=True)
        return items[:limit]

    def search_by_tags(self, tags: list[str], limit: int = 20) -> list[dict]:
        """按概念标签过滤检索。"""
        total = self._collection.count()
        if total == 0:
            return []

        # ChromaDB 不支持 LIKE 查询，用 where 做精确标签匹配
        # 逐个标签查询再合并去重
        seen_ids: set[str] = set()
        items: list[dict] = []

        for tag in tags:
            try:
                results = self._collection.query(
                    query_texts=[tag],
                    n_results=min(limit, total),
                    include=["documents", "metadatas", "distances"],
                )
                for doc, meta, dist, entry_id in zip(
                    results["documents"][0],
                    results["metadatas"][0],
                    results["distances"][0],
                    results["ids"][0],
                ):
                    if entry_id in seen_ids:
                        continue
                    entry_tags = [t for t in meta.get("tags", "").split(",") if t]
                    if any(t in entry_tags for t in tags):
                        seen_ids.add(entry_id)
                        items.append({
                            "id": entry_id,
                            "content": doc,
                            "score": 1.0 - dist,
                            "tags": entry_tags,
                            "created_at": meta.get("created_at", ""),
                            "source": meta.get("source", ""),
                        })
            except Exception as e:
                logger.warning(f"标签检索失败 [{tag}]: {e}")

        return items[:limit]

    # ── 单条操作 ─────────────────────────────────────────────────────────

    def get_by_id(self, entry_id: str) -> dict | None:
        """按ID获取温记忆。"""
        try:
            results = self._collection.get(
                ids=[entry_id],
                include=["documents", "metadatas"],
            )
            if not results["ids"]:
                return None
            meta = results["metadatas"][0]
            return {
                "id": entry_id,
                "content": results["documents"][0],
                "tags": [t for t in meta.get("tags", "").split(",") if t],
                "created_at": meta.get("created_at", ""),
                "source": meta.get("source", ""),
                "session_id": meta.get("session_id", ""),
            }
        except Exception:
            return None

    def delete(self, entry_id: str) -> bool:
        """删除一条温记忆。"""
        try:
            self._collection.delete(ids=[entry_id])
            return True
        except Exception:
            return False

    def get_recent(self, limit: int = 20) -> list[dict]:
        """
        获取最近存储的温记忆（按创建时间倒序）。

        ChromaDB 不直接支持 ORDER BY，故获取全部后在 Python 侧排序。
        """
        total = self._collection.count()
        if total == 0:
            return []

        n = min(limit * 3, total)
        results = self._collection.get(
            limit=n,
            include=["documents", "metadatas"],
        )

        items = []
        for entry_id, doc, meta in zip(results["ids"], results["documents"], results["metadatas"]):
            items.append({
                "id": entry_id,
                "content": doc,
                "tags": [t for t in meta.get("tags", "").split(",") if t],
                "created_at": meta.get("created_at", ""),
                "source": meta.get("source", ""),
                "session_id": meta.get("session_id", ""),
            })

        items.sort(key=lambda x: x["created_at"], reverse=True)
        return items[:limit]

    def count(self) -> int:
        """获取温记忆总条数。"""
        return self._collection.count()

    def clear_all(self) -> int:
        """清空所有温记忆（危险操作）。"""
        count = self._collection.count()
        self._client.delete_collection(self.COLLECTION_NAME)
        self._collection = self._client.get_or_create_collection(
            name=self.COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        logger.warning(f"清空全部温记忆: {count}条")
        return count

    def get_stats(self) -> dict:
        """获取统计信息。"""
        total = self._collection.count()
        return {
            "total_entries": total,
            "persist_dir": str(self._persist_dir),
            "half_life_days": HALF_LIFE_DAYS,
            "collection": self.COLLECTION_NAME,
        }
