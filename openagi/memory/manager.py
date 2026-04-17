"""
统一记忆管理器 — 协调四层记忆的读写和流转
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
四层架构：
  L0 热记忆 (Working)  — 内存，当前对话
  L1 温记忆 (Recent)   — 向量DB，语义检索
  L2 冷记忆 (Archive)  — SQLite，全量持久化
  L3 核心DNA (Core)    — JSON，永不衰减

流转：L0 → L1 → L2 → L3（通过蒸馏逐级提升）

蒸馏管道：
  LightSleep（轻睡眠）: L0热 → L1温，去重+标签提取
  REMSleep（REM睡眠）: L1温 → L2冷，关联发现+矛盾检测
  DeepDreaming（深度蒸馏）: L2冷 → L3 DNA，知识提取+DNA更新
"""

from __future__ import annotations

import logging
from uuid import uuid4

from openagi.memory.working import WorkingMemory, MemoryItem
from openagi.memory.recent import RecentMemory
from openagi.memory.archive import ArchiveMemory, ArchiveEntry
from openagi.memory.core_dna import CoreDNA
from openagi.memory.search import HybridSearchEngine, SearchResult
from openagi.memory.distill.light_sleep import LightSleepDistiller, LightSleepResult
from openagi.memory.distill.rem_sleep import REMSleepDistiller, REMSleepResult
from openagi.memory.distill.deep_dreaming import DeepDreamingDistiller, DeepDreamingResult

logger = logging.getLogger("openagi.memory")


class MemoryManager:
    """
    统一记忆管理器。

    提供跨层的存储、检索和流转能力。
    是所有记忆操作的唯一入口。

    蒸馏调用示例：
        # 对话结束后的轻睡眠（热→温）
        manager.run_light_sleep("session_123")

        # 定时REM蒸馏（温→冷）
        manager.run_rem_sleep()

        # 深度蒸馏（冷→DNA）
        manager.run_deep_dreaming()

        # 一键完整蒸馏流水线
        manager.run_full_distillation_pipeline("session_123")
    """

    def __init__(
        self,
        db_path: str = "~/.openagi/data/memory.db",
        dna_path: str = "~/.openagi/data/core_dna.json",
        chroma_dir: str = "~/.openagi/data/chroma",
        llm_client=None,
    ):
        # 四层记忆
        self.working = WorkingMemory()
        self.recent = RecentMemory(persist_dir=chroma_dir)
        self.archive = ArchiveMemory(db_path=db_path)
        self.core_dna = CoreDNA(dna_path=dna_path)

        # 混合检索引擎
        self.search_engine = HybridSearchEngine(
            working=self.working,
            recent=self.recent,
            archive=self.archive,
            core_dna=self.core_dna,
        )

        # 三阶段蒸馏器
        self._light_sleep = LightSleepDistiller(
            working=self.working,
            recent=self.recent,
        )
        self._rem_sleep = REMSleepDistiller(
            recent=self.recent,
            archive=self.archive,
        )
        self._deep_dreaming = DeepDreamingDistiller(
            archive=self.archive,
            core_dna=self.core_dna,
            llm_client=llm_client,
        )

        logger.info("MemoryManager 初始化完成（四层记忆 + 三阶段蒸馏 + 混合检索就绪）")

    # ── 热记忆操作 ──────────────────────────────────────────────────────────

    def add_message(self, session_id: str, role: str, content: str, **metadata) -> str:
        """向热记忆添加一条消息。"""
        item_id = str(uuid4())
        item = MemoryItem(
            id=item_id,
            content=content,
            role=role,
            session_id=session_id,
            metadata=metadata,
            token_count=len(content) // 4,  # 粗估token数
        )
        self.working.add(item)
        return item_id

    def get_context(self, session_id: str) -> list[dict]:
        """获取当前会话的LLM消息格式上下文。"""
        return self.working.get_messages(session_id)

    # ── 会话结束流转 ────────────────────────────────────────────────────────

    def end_session(self, session_id: str, run_distill: bool = True) -> int:
        """
        结束会话，将热记忆转存。

        Args:
            session_id: 会话ID
            run_distill: 是否执行轻睡眠蒸馏（推荐True，向量化存到温记忆）

        Returns:
            转存的条目数量
        """
        if run_distill:
            # 轻睡眠蒸馏：热 → 温（去重+标签+向量化）
            light_result = self._light_sleep.distill(session_id, keep_in_working=False)
            count = light_result.stored_to_recent
            logger.info(
                f"会话 {session_id} 结束，轻睡眠蒸馏: "
                f"存储={count}条到温记忆, 去重={light_result.duplicates_removed}条"
            )
            return count
        else:
            # MVP降级路径：直接热 → 冷（跳过温记忆）
            items = self.working.clear_session(session_id)
            count = 0
            for item in items:
                entry = ArchiveEntry(
                    content=f"[{item.role}] {item.content}",
                    source="session_end",
                    category="conversation",
                    tags=[session_id],
                    metadata={"role": item.role, "session_id": session_id, **item.metadata},
                )
                self.archive.store(entry)
                count += 1
            logger.info(f"会话 {session_id} 结束，{count}条热记忆直接转存到冷记忆")
            return count

    # ── 蒸馏管道 ────────────────────────────────────────────────────────────

    def run_light_sleep(self, session_id: str) -> LightSleepResult:
        """
        轻睡眠蒸馏：热记忆 → 温记忆。

        去重、提取标签、向量化存储。
        """
        result = self._light_sleep.distill(session_id)
        logger.info(
            f"轻睡眠完成: 存储={result.stored_to_recent}, "
            f"去重={result.duplicates_removed}, "
            f"聚类={len(result.clusters)}主题"
        )
        return result

    def run_rem_sleep(self, limit: int = 50) -> REMSleepResult:
        """
        REM蒸馏：温记忆 → 冷记忆。

        发现关联、检测矛盾、迁移高价值记忆。
        """
        result = self._rem_sleep.distill(limit=limit)
        logger.info(
            f"REM蒸馏完成: 关联={result.associations_found}, "
            f"矛盾={result.contradictions_found}, "
            f"迁移={result.migrated_to_archive}"
        )
        return result

    def run_deep_dreaming(self, limit: int = 100) -> DeepDreamingResult:
        """
        深度蒸馏：冷记忆 → DNA。

        提取核心知识，生成梦境日记，更新DNA。
        """
        result = self._deep_dreaming.distill(limit=limit)
        logger.info(
            f"深度蒸馏完成: 分析={result.memories_analyzed}, "
            f"提取={result.knowledge_extracted}, "
            f"DNA更新={len(result.dna_updates)}"
        )
        return result

    def run_full_distillation_pipeline(
        self,
        session_id: str | None = None,
        rem_limit: int = 50,
        deep_limit: int = 100,
    ) -> dict:
        """
        运行完整三阶段蒸馏流水线。

        L0→L1（轻睡眠）→ L1→L2（REM）→ L2→L3（深度蒸馏）

        Args:
            session_id: 若提供，先对该会话运行轻睡眠
            rem_limit: REM蒸馏处理的温记忆条目数
            deep_limit: 深度蒸馏处理的冷记忆条目数

        Returns:
            各阶段结果汇总
        """
        pipeline_result: dict = {}

        # 阶段1：轻睡眠（若有会话）
        if session_id:
            light = self.run_light_sleep(session_id)
            pipeline_result["light_sleep"] = {
                "stored": light.stored_to_recent,
                "dedup": light.duplicates_removed,
                "clusters": len(light.clusters),
                "duration_ms": light.duration_ms,
            }

        # 阶段2：REM蒸馏
        rem = self.run_rem_sleep(limit=rem_limit)
        pipeline_result["rem_sleep"] = {
            "associations": rem.associations_found,
            "contradictions": rem.contradictions_found,
            "migrated": rem.migrated_to_archive,
            "duration_ms": rem.duration_ms,
        }

        # 阶段3：深度蒸馏
        deep = self.run_deep_dreaming(limit=deep_limit)
        pipeline_result["deep_dreaming"] = {
            "analyzed": deep.memories_analyzed,
            "extracted": deep.knowledge_extracted,
            "dna_updates": len(deep.dna_updates),
            "duration_ms": deep.duration_ms,
        }

        if deep.dream_diary:
            pipeline_result["dream_diary"] = deep.dream_diary.narrative[:200] + "..."

        logger.info(f"完整蒸馏流水线完成: {pipeline_result}")
        return pipeline_result

    # ── 混合检索 ────────────────────────────────────────────────────────────

    def recall(
        self,
        query: str,
        session_id: str | None = None,
        limit: int = 10,
        layers: list[str] | None = None,
    ) -> list[dict]:
        """
        跨层混合检索记忆。

        使用 BM25+向量混合检索 + MMR去重。
        搜索顺序：L0热 → L1温 → L2冷 → L3 DNA

        Args:
            query: 查询文本
            session_id: 当前会话ID（用于L0检索）
            limit: 返回条目上限
            layers: 指定检索层，默认全层

        Returns:
            [{"layer": str, "content": str, "score": float, ...}, ...]
        """
        results: list[SearchResult] = self.search_engine.search(
            query=query,
            session_id=session_id,
            limit=limit,
            layers=layers,
        )

        return [
            {
                "layer": r.layer,
                "content": r.content,
                "score": r.score,
                "vector_score": r.vector_score,
                "keyword_score": r.keyword_score,
                "tags": r.tags,
            }
            for r in results
        ]

    def semantic_search(self, query: str, limit: int = 10) -> list[dict]:
        """
        纯语义搜索（仅搜索L1温记忆）。
        """
        return self.recent.search(query, limit=limit)

    # ── 构建LLM Prompt ─────────────────────────────────────────────────────

    def build_system_context(self, session_id: str | None = None, query: str = "") -> str:
        """
        构建注入到LLM system prompt的记忆上下文。

        包含：
        - 核心DNA（始终注入）
        - 相关的检索记忆（按查询动态检索）
        """
        parts = []

        # 核心DNA（最重要，始终注入）
        dna_prompt = self.core_dna.to_prompt()
        if dna_prompt:
            parts.append(dna_prompt)

        # 相关记忆检索（若提供query）
        if query:
            recalled = self.recall(query, session_id=session_id, limit=5)
            if recalled:
                mem_lines = ["## 相关记忆\n"]
                for r in recalled:
                    mem_lines.append(f"- [{r['layer']}] {r['content'][:100]}")
                parts.append("\n".join(mem_lines))

        return "\n\n".join(parts)

    # ── 统计信息 ────────────────────────────────────────────────────────────

    def get_stats(self) -> dict:
        """获取四层记忆的统计信息。"""
        return {
            "working": self.working.get_stats(),
            "recent": self.recent.get_stats(),
            "archive": self.archive.get_stats(),
            "core_dna": self.core_dna.get_stats(),
        }

    # ── 会话管理（API层使用）───────────────────────────────────────────────────

    def list_sessions(self) -> list[dict]:
        """获取所有活跃会话的摘要列表（来自热记忆）。

        🔴 2026-04-17 修复：working._items 历史数据中偶有 str 类型，做兼容。
        """
        sessions = {}
        for item in self.working._items:
            # 兼容字符串或对象：str 即 session_id 裸值
            if isinstance(item, str):
                sid = item
                created_at = ""
            else:
                sid = getattr(item, "session_id", None)
                created_at = getattr(item, "created_at", "")
            if not sid:
                continue
            if sid not in sessions:
                sessions[sid] = {
                    "id": sid,
                    "title": f"对话 {sid[:8]}",
                    "created_at": created_at,
                    "message_count": 0,
                }
            sessions[sid]["message_count"] += 1
        return list(sessions.values())

    def get_messages(self, session_id: str) -> list[dict]:
        """获取会话消息列表（供历史记录API使用）。"""
        return self.working.get_messages(session_id)

    def delete_session(self, session_id: str) -> None:
        """删除会话（清空热记忆）。"""
        self.working.clear_session(session_id)
        logger.info(f"会话 {session_id} 已删除")

    def close(self) -> None:
        """关闭资源。"""
        self.archive.close()
