"""
混合检索引擎 — BM25关键字 + 向量语义 + MMR去重
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
跨层检索（热→温→冷→DNA），混合分数合并后MMR去重。

策略：
  · BM25关键字检索（基于词频TF-IDF近似）
  · 向量语义检索（调用 recent.py）
  · 混合分数：α×向量 + (1-α)×关键字，默认 α=0.6
  · MMR去重：λ=0.7相关性, 0.3多样性，避免重复结果
  · 跨层检索：L0热 → L1温 → L2冷 → L3 DNA
"""

from __future__ import annotations

import logging
import math
import re
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from openagi.memory.working import WorkingMemory
    from openagi.memory.recent import RecentMemory
    from openagi.memory.archive import ArchiveMemory
    from openagi.memory.core_dna import CoreDNA

logger = logging.getLogger("openagi.memory.search")

# 默认混合权重
DEFAULT_ALPHA = 0.6    # 向量检索权重
MMR_LAMBDA = 0.7       # MMR相关性权重（1-λ=0.3为多样性权重）
MMR_SIMILARITY_THRESHOLD = 0.8  # MMR去重相似度阈值


# ── BM25 实现 ─────────────────────────────────────────────────────────────

def _tokenize(text: str) -> list[str]:
    """简单分词：中文字符+英文单词混合。"""
    # 中文：逐字切分（2字gram）
    chinese_chars = re.findall(r"[\u4e00-\u9fff]", text)
    chinese_bigrams = [chinese_chars[i] + chinese_chars[i + 1] for i in range(len(chinese_chars) - 1)]

    # 英文：按单词切分（小写，至少2字母）
    english_words = re.findall(r"\b[a-zA-Z]{2,}\b", text.lower())

    return chinese_bigrams + english_words


class BM25Index:
    """
    轻量级 BM25 索引。

    参数：
      k1=1.5（词频饱和度），b=0.75（文档长度归一化）
    """

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self._docs: list[str] = []
        self._doc_ids: list[str] = []
        self._tokenized: list[list[str]] = []
        self._df: dict[str, int] = {}   # 文档频率
        self._avgdl: float = 0.0

    def add_documents(self, doc_ids: list[str], documents: list[str]) -> None:
        """批量添加文档到索引。"""
        self._docs = documents
        self._doc_ids = doc_ids
        self._tokenized = [_tokenize(doc) for doc in documents]

        # 计算文档频率
        self._df = {}
        for tokens in self._tokenized:
            for token in set(tokens):
                self._df[token] = self._df.get(token, 0) + 1

        # 平均文档长度
        self._avgdl = sum(len(t) for t in self._tokenized) / max(len(self._tokenized), 1)

    def score(self, query: str, top_k: int = 20) -> list[tuple[str, str, float]]:
        """
        对查询计算 BM25 分数。

        Returns: [(doc_id, document, score), ...]
        """
        if not self._docs:
            return []

        query_tokens = _tokenize(query)
        n = len(self._docs)
        scores: list[float] = []

        for i, tokens in enumerate(self._tokenized):
            doc_len = len(tokens)
            tf_map: dict[str, int] = {}
            for t in tokens:
                tf_map[t] = tf_map.get(t, 0) + 1

            doc_score = 0.0
            for qt in query_tokens:
                tf = tf_map.get(qt, 0)
                df = self._df.get(qt, 0)
                if df == 0:
                    continue

                # IDF（BM25变体，平滑处理）
                idf = math.log((n - df + 0.5) / (df + 0.5) + 1)

                # TF归一化
                tf_norm = (tf * (self.k1 + 1)) / (
                    tf + self.k1 * (1 - self.b + self.b * doc_len / self._avgdl)
                )

                doc_score += idf * tf_norm

            scores.append(doc_score)

        # 归一化到 [0, 1]
        max_score = max(scores) if scores else 1.0
        if max_score > 0:
            scores = [s / max_score for s in scores]

        # 排序返回
        ranked = sorted(
            zip(self._doc_ids, self._docs, scores),
            key=lambda x: x[2],
            reverse=True,
        )
        return ranked[:top_k]


# ── MMR 去重 ──────────────────────────────────────────────────────────────

def _text_similarity(a: str, b: str) -> float:
    """
    简单文本相似度（Jaccard）用于MMR多样性计算。

    对于精确的向量相似度，应使用embedding；
    此处用词袋Jaccard作为轻量近似。
    """
    tokens_a = set(_tokenize(a))
    tokens_b = set(_tokenize(b))
    if not tokens_a and not tokens_b:
        return 1.0
    if not tokens_a or not tokens_b:
        return 0.0
    intersection = tokens_a & tokens_b
    union = tokens_a | tokens_b
    return len(intersection) / len(union)


def mmr_rerank(
    candidates: list[dict],
    lmbd: float = MMR_LAMBDA,
    top_k: int = 10,
    sim_threshold: float = MMR_SIMILARITY_THRESHOLD,
) -> list[dict]:
    """
    MMR (Maximal Marginal Relevance) 去重重排。

    算法：
    1. 选取相关度最高的条目加入结果集
    2. 对剩余候选，计算 MMR = λ*相关度 - (1-λ)*max(与已选结果的相似度)
    3. 选取MMR最高的条目，循环直到达到 top_k

    Args:
        candidates: 已按相关度排序的候选列表（每条含 content 和 score 字段）
        lmbd: 相关性权重（0=纯多样性，1=纯相关性）
        top_k: 最终返回数量
        sim_threshold: 超过此阈值视为重复

    Returns:
        去重重排后的列表
    """
    if not candidates:
        return []

    selected: list[dict] = []
    remaining = list(candidates)

    while remaining and len(selected) < top_k:
        if not selected:
            # 第一个选最相关的
            best = remaining.pop(0)
            selected.append(best)
            continue

        # 计算每个候选的 MMR 分数
        best_mmr = -float("inf")
        best_idx = 0

        for i, cand in enumerate(remaining):
            relevance = cand.get("score", 0.0)
            # 与已选结果的最大相似度
            max_sim = max(
                _text_similarity(cand["content"], sel["content"])
                for sel in selected
            )
            mmr_score = lmbd * relevance - (1 - lmbd) * max_sim
            if mmr_score > best_mmr:
                best_mmr = mmr_score
                best_idx = i

        selected.append(remaining.pop(best_idx))

    return selected


# ── SearchResult ──────────────────────────────────────────────────────────

@dataclass
class SearchResult:
    """单条检索结果。"""

    id: str
    content: str
    score: float                      # 最终混合分数
    vector_score: float = 0.0        # 向量相似度分
    keyword_score: float = 0.0       # BM25关键字分
    layer: str = ""                   # "L0_working" | "L1_recent" | "L2_archive" | "L3_dna"
    tags: list[str] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)


# ── HybridSearchEngine ────────────────────────────────────────────────────

class HybridSearchEngine:
    """
    混合检索引擎。

    跨 L0→L1→L2→L3 四层检索，混合BM25+向量分数，MMR去重。
    """

    def __init__(
        self,
        working: "WorkingMemory | None" = None,
        recent: "RecentMemory | None" = None,
        archive: "ArchiveMemory | None" = None,
        core_dna: "CoreDNA | None" = None,
        alpha: float = DEFAULT_ALPHA,
    ):
        self.working = working
        self.recent = recent
        self.archive = archive
        self.core_dna = core_dna
        self.alpha = alpha  # 向量权重，(1-alpha)=关键字权重

    def search(
        self,
        query: str,
        session_id: str | None = None,
        limit: int = 10,
        layers: list[str] | None = None,
        apply_mmr: bool = True,
    ) -> list[SearchResult]:
        """
        跨层混合检索。

        Args:
            query: 检索查询
            session_id: 当前会话ID（用于L0热记忆检索）
            limit: 最终返回数量
            layers: 指定检索层，默认全层 ["L0", "L1", "L2", "L3"]
            apply_mmr: 是否应用MMR去重

        Returns:
            按混合分数排序的 SearchResult 列表
        """
        if layers is None:
            layers = ["L0", "L1", "L2", "L3"]

        all_candidates: list[dict] = []

        # L0：热记忆（当前会话关键词匹配）
        if "L0" in layers and self.working and session_id:
            items = self.working.get_context(session_id)
            bm25 = BM25Index()
            docs = [item.content for item in items]
            ids = [item.id for item in items]
            if docs:
                bm25.add_documents(ids, docs)
                for doc_id, doc, kw_score in bm25.score(query, top_k=limit):
                    if kw_score > 0:
                        all_candidates.append({
                            "id": doc_id,
                            "content": doc,
                            "score": kw_score,
                            "vector_score": 0.0,
                            "keyword_score": kw_score,
                            "layer": "L0_working",
                            "tags": [],
                        })

        # L1：温记忆（向量语义检索）
        if "L1" in layers and self.recent:
            vector_results = self.recent.search(query, limit=limit * 2, apply_decay=True)
            for r in vector_results:
                all_candidates.append({
                    "id": r["id"],
                    "content": r["content"],
                    "score": r["decay_score"],
                    "vector_score": r["score"],
                    "keyword_score": 0.0,
                    "layer": "L1_recent",
                    "tags": r.get("tags", []),
                })

        # L2：冷记忆（BM25关键字检索）
        if "L2" in layers and self.archive:
            archive_items = self.archive.search(query, limit=limit * 2)
            if archive_items:
                bm25 = BM25Index()
                bm25.add_documents(
                    [e.id for e in archive_items],
                    [e.content for e in archive_items],
                )
                for doc_id, doc, kw_score in bm25.score(query, top_k=limit):
                    # 找到对应的entry获取更多信息
                    entry = next((e for e in archive_items if e.id == doc_id), None)
                    all_candidates.append({
                        "id": doc_id,
                        "content": doc,
                        "score": kw_score,
                        "vector_score": 0.0,
                        "keyword_score": kw_score,
                        "layer": "L2_archive",
                        "tags": entry.tags if entry else [],
                    })

        # L3：核心DNA（关键词匹配，最高权重）
        if "L3" in layers and self.core_dna:
            for dna in self.core_dna.get_all():
                kw_score = 1.0 if query.lower() in dna.content.lower() else 0.3
                all_candidates.append({
                    "id": dna.id,
                    "content": dna.content,
                    "score": kw_score,
                    "vector_score": 0.0,
                    "keyword_score": kw_score,
                    "layer": "L3_dna",
                    "tags": [dna.category],
                })

        if not all_candidates:
            return []

        # 混合分数合并（对有向量分数的条目）
        for cand in all_candidates:
            v = cand["vector_score"]
            k = cand["keyword_score"]
            if v > 0 and k > 0:
                cand["score"] = self.alpha * v + (1 - self.alpha) * k
            elif v > 0:
                cand["score"] = self.alpha * v
            else:
                cand["score"] = (1 - self.alpha) * k

        # L3 DNA结果提权（始终相关）
        for cand in all_candidates:
            if cand["layer"] == "L3_dna" and query.lower() in cand["content"].lower():
                cand["score"] = min(1.0, cand["score"] * 1.5)

        # 按分数排序
        all_candidates.sort(key=lambda x: x["score"], reverse=True)

        # MMR去重
        if apply_mmr:
            deduped = mmr_rerank(all_candidates, lmbd=MMR_LAMBDA, top_k=limit * 2)
        else:
            deduped = all_candidates[:limit * 2]

        # 转换为 SearchResult
        results = []
        for cand in deduped[:limit]:
            results.append(SearchResult(
                id=cand["id"],
                content=cand["content"],
                score=round(cand["score"], 4),
                vector_score=round(cand["vector_score"], 4),
                keyword_score=round(cand["keyword_score"], 4),
                layer=cand["layer"],
                tags=cand.get("tags", []),
            ))

        logger.info(f"混合检索 '{query[:30]}' → {len(results)} 条结果（跨{len(set(r.layer for r in results))}层）")
        return results

    def keyword_search(self, query: str, documents: list[str], doc_ids: list[str], top_k: int = 10) -> list[tuple[str, str, float]]:
        """
        纯BM25关键字检索（工具方法，可单独使用）。

        Returns: [(doc_id, document, score), ...]
        """
        bm25 = BM25Index()
        bm25.add_documents(doc_ids, documents)
        return bm25.score(query, top_k=top_k)

    def set_alpha(self, alpha: float) -> None:
        """动态调整向量/关键字权重。"""
        if not 0.0 <= alpha <= 1.0:
            raise ValueError(f"alpha 必须在 [0, 1] 之间，当前: {alpha}")
        self.alpha = alpha
        logger.info(f"混合权重更新: 向量={alpha:.2f}, 关键字={1-alpha:.2f}")
