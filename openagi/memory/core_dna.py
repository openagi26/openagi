"""
L3 核心记忆 (Core DNA) — 身份、价值观、关键学习
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
JSON文件存储，永不衰减，始终注入到LLM的system prompt中。

特点：
  · JSON文件 + Git版本控制（可回溯）
  · 永不自动衰减或删除
  · 始终注入到所有AI核心的system prompt
  · 只有Deep Dreaming蒸馏或用户手动编辑才能修改
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

logger = logging.getLogger("openagi.memory.dna")


@dataclass
class DNAEntry:
    """核心DNA条目。"""

    id: str = field(default_factory=lambda: str(uuid4()))
    content: str = ""
    category: str = ""  # "identity" | "value" | "preference" | "learning" | "relationship"
    source: str = ""  # "deep_dreaming" | "user_edit" | "initial"
    confidence: float = 1.0
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CoreDNA:
    """
    L3 核心DNA管理器。

    存储AI对用户最核心的认知——身份、价值观、偏好、关键学习。
    这些信息永不衰减，始终影响AI的行为。
    """

    def __init__(self, dna_path: str | Path = "~/.openagi/data/core_dna.json"):
        self._path = Path(dna_path).expanduser()
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._entries: list[DNAEntry] = []
        self._load()

    def _load(self) -> None:
        """从文件加载DNA。"""
        if self._path.exists():
            try:
                data = json.loads(self._path.read_text(encoding="utf-8"))
                self._entries = [DNAEntry(**entry) for entry in data]
                logger.info(f"加载 {len(self._entries)} 条核心DNA")
            except Exception as e:
                logger.error(f"加载DNA失败: {e}")
                self._entries = []
        else:
            self._init_default()

    def _init_default(self) -> None:
        """初始化默认DNA。"""
        defaults = [
            DNAEntry(content="我是OpenAGI，一个开源的AGI框架。", category="identity", source="initial"),
            DNAEntry(content="我的目标是成为用户的AI意识延伸。", category="identity", source="initial"),
            DNAEntry(content="我重视用户隐私和数据安全。", category="value", source="initial"),
        ]
        self._entries = defaults
        self._save()

    def _save(self) -> None:
        """保存DNA到文件。"""
        data = [
            {
                "id": e.id, "content": e.content, "category": e.category,
                "source": e.source, "confidence": e.confidence,
                "created_at": e.created_at, "updated_at": e.updated_at,
            }
            for e in self._entries
        ]
        self._path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def add(self, content: str, category: str = "learning", source: str = "deep_dreaming") -> DNAEntry:
        """添加新的DNA条目。"""
        entry = DNAEntry(content=content, category=category, source=source)
        self._entries.append(entry)
        self._save()
        logger.info(f"新增核心DNA [{category}]: {content[:50]}...")
        return entry

    def update(self, entry_id: str, content: str) -> bool:
        """更新DNA条目内容。"""
        entry = self.get_by_id(entry_id)
        if not entry:
            return False
        entry.content = content
        entry.updated_at = datetime.now(timezone.utc).isoformat()
        self._save()
        return True

    def delete(self, entry_id: str) -> bool:
        """删除DNA条目。"""
        before = len(self._entries)
        self._entries = [e for e in self._entries if e.id != entry_id]
        if len(self._entries) < before:
            self._save()
            return True
        return False

    def get_all(self) -> list[DNAEntry]:
        """获取全部DNA。"""
        return list(self._entries)

    def get_by_id(self, entry_id: str) -> DNAEntry | None:
        """按ID获取。"""
        return next((e for e in self._entries if e.id == entry_id), None)

    def get_by_category(self, category: str) -> list[DNAEntry]:
        """按类别获取。"""
        return [e for e in self._entries if e.category == category]

    def to_prompt(self) -> str:
        """
        生成注入到system prompt的DNA文本。
        这是DNA最核心的用途——始终告诉AI"你是谁、用户是谁"。
        """
        if not self._entries:
            return ""

        sections: dict[str, list[str]] = {}
        for entry in self._entries:
            cat = entry.category
            if cat not in sections:
                sections[cat] = []
            sections[cat].append(entry.content)

        lines = ["## 核心记忆（永不遗忘）\n"]
        category_names = {
            "identity": "身份认知",
            "value": "价值观",
            "preference": "用户偏好",
            "learning": "关键学习",
            "relationship": "关系记忆",
        }
        for cat, items in sections.items():
            name = category_names.get(cat, cat)
            lines.append(f"### {name}")
            for item in items:
                lines.append(f"- {item}")
            lines.append("")

        return "\n".join(lines)

    def get_stats(self) -> dict:
        """获取统计。"""
        categories = {}
        for e in self._entries:
            categories[e.category] = categories.get(e.category, 0) + 1
        return {
            "total_entries": len(self._entries),
            "categories": categories,
        }
