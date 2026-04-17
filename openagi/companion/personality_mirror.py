"""用户人格镜像系统 — 学习用户的说话风格。

小星通过分析对话历史，学习用户的：
1. 常用词汇和表达方式
2. 语气偏好（正式/随意/幽默）
3. 话题兴趣分布
4. 对话节奏（长句/短句）

目的：让小星越来越了解用户，
提供更个性化、更贴心的回应。
"""

from __future__ import annotations

import json
import os
import re
from collections import Counter
from pathlib import Path
from typing import Optional

_MIRROR_PATH = Path.home() / ".openagi" / "data" / "personality_mirror.json"


class PersonalityMirror:
    """用户人格镜像。"""

    def __init__(self, path: Path = _MIRROR_PATH):
        self.path = path
        self.data = self._load()

    def _load(self) -> dict:
        if self.path.exists():
            try:
                return json.loads(self.path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                pass
        return {
            "vocab_freq": {},           # 词频统计
            "avg_msg_length": 0,        # 平均消息长度
            "total_messages": 0,        # 总消息数
            "topic_interests": {},      # 话题兴趣
            "style": {
                "formality": 0.5,       # 0=很随意 1=很正式
                "humor": 0.3,           # 幽默程度
                "emoji_usage": 0.2,     # emoji使用频率
                "question_ratio": 0.3,  # 提问比例
            },
            "favorite_phrases": [],     # 常用短语
            "recent_topics": [],        # 最近话题
        }

    def save(self):
        os.makedirs(self.path.parent, exist_ok=True)
        self.path.write_text(
            json.dumps(self.data, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def learn_from_message(self, text: str):
        """从用户消息中学习。"""
        if not text or len(text) < 2:
            return

        self.data["total_messages"] += 1

        # 1. 词频统计（简单分词）
        words = re.findall(r"[\u4e00-\u9fff]+|[a-zA-Z]+", text)
        for w in words:
            if len(w) >= 2:  # 至少2字
                self.data["vocab_freq"][w] = self.data["vocab_freq"].get(w, 0) + 1

        # 2. 平均消息长度（移动平均）
        n = self.data["total_messages"]
        old_avg = self.data["avg_msg_length"]
        self.data["avg_msg_length"] = old_avg + (len(text) - old_avg) / n

        # 3. 风格分析
        style = self.data["style"]

        # emoji检测
        emoji_count = len(re.findall(r"[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF]", text))
        style["emoji_usage"] = style["emoji_usage"] * 0.9 + (1 if emoji_count > 0 else 0) * 0.1

        # 提问检测
        is_question = text.rstrip().endswith(("？", "?", "吗", "呢", "啥", "什么"))
        style["question_ratio"] = style["question_ratio"] * 0.9 + (1 if is_question else 0) * 0.1

        # 正式度（长句=更正式）
        formality_signal = min(1.0, len(text) / 100)
        style["formality"] = style["formality"] * 0.95 + formality_signal * 0.05

        # 4. 话题检测
        topic_keywords = {
            "技术": ["代码", "编程", "API", "bug", "测试", "开发", "架构"],
            "健康": ["喝水", "休息", "运动", "睡觉", "眼睛", "锻炼"],
            "工作": ["项目", "任务", "进度", "报告", "会议", "计划"],
            "创业": ["用户", "产品", "增长", "融资", "市场", "竞争"],
            "生活": ["吃饭", "天气", "旅行", "电影", "音乐", "游戏"],
        }

        for topic, keywords in topic_keywords.items():
            if any(kw in text for kw in keywords):
                self.data["topic_interests"][topic] = self.data["topic_interests"].get(topic, 0) + 1

        # 5. 常用短语提取（4-8字片段）
        for length in range(4, 9):
            for i in range(len(text) - length + 1):
                phrase = text[i:i + length]
                if re.match(r"^[\u4e00-\u9fff]+$", phrase):
                    # 只有在出现3次以上才记录
                    freq = self.data["vocab_freq"].get(phrase, 0) + 1
                    self.data["vocab_freq"][phrase] = freq
                    if freq >= 3 and phrase not in self.data["favorite_phrases"]:
                        self.data["favorite_phrases"].append(phrase)
                        # 最多保留20个
                        self.data["favorite_phrases"] = self.data["favorite_phrases"][-20:]

        # 定期保存
        if n % 10 == 0:
            self.save()

    def get_style_prompt(self) -> str:
        """生成风格描述（嵌入system prompt让AI模仿）。"""
        style = self.data["style"]
        n = self.data["total_messages"]

        if n < 5:
            return ""  # 数据太少，不生成

        parts = []

        # 消息长度偏好
        avg_len = self.data["avg_msg_length"]
        if avg_len < 20:
            parts.append("用户喜欢简短回复")
        elif avg_len > 60:
            parts.append("用户喜欢详细的回答")

        # 提问习惯
        if style["question_ratio"] > 0.5:
            parts.append("用户经常以提问方式交流")

        # 话题偏好
        topics = sorted(self.data["topic_interests"].items(), key=lambda x: x[1], reverse=True)
        if topics:
            top_topics = [t[0] for t in topics[:3]]
            parts.append(f"用户最关注的话题：{'/'.join(top_topics)}")

        # 常用词
        top_words = Counter(self.data["vocab_freq"]).most_common(5)
        if top_words:
            words = [w[0] for w in top_words if len(w[0]) >= 2]
            if words:
                parts.append(f"用户常用的词：{'、'.join(words[:5])}")

        return "。".join(parts) + "。" if parts else ""

    def get_stats(self) -> dict:
        """获取学习统计。"""
        return {
            "total_messages": self.data["total_messages"],
            "avg_msg_length": round(self.data["avg_msg_length"], 1),
            "vocabulary_size": len(self.data["vocab_freq"]),
            "top_topics": sorted(
                self.data["topic_interests"].items(),
                key=lambda x: x[1], reverse=True
            )[:5],
            "style": self.data["style"],
            "favorite_phrases": self.data["favorite_phrases"][-5:],
        }
