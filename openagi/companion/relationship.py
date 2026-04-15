"""
companion/relationship.py — 亲密沟通模式 (Relationship Mode Engine)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

定义AI与用户之间的5种关系模式，控制：
  · 系统提示词模板（语气/措辞/情感表达）
  · 称呼管理（AI如何称呼用户 / 用户如何称呼AI）
  · 主动关心逻辑（频率/内容/触发条件）
  · 情感表达强度（0-100映射到prompt参数）

关系模式枚举：
  PROFESSIONAL  — 专业助手（中性、简洁、高效）
  FRIEND        — 朋友（轻松、友好、偶尔开玩笑）
  BESTIE        — 闺蜜·哥们（亲密、口语、情绪共鸣）
  PARTNER       — 伴侣（深度情感联结、温柔关怀）
  CUSTOM        — 自定义（用户自行配置所有参数）
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Optional

logger = logging.getLogger("openagi.companion.relationship")

# ─── 数据目录 ────────────────────────────────────────────────────────────────

_DATA_DIR = Path.home() / ".openagi" / "data" / "companion"


# ─── 关系模式枚举 ────────────────────────────────────────────────────────────

class RelationshipMode(str, Enum):
    """5种关系模式。"""
    PROFESSIONAL = "professional"   # 专业助手
    FRIEND       = "friend"         # 朋友
    BESTIE       = "bestie"         # 闺蜜·哥们
    PARTNER      = "partner"        # 伴侣
    CUSTOM       = "custom"         # 自定义


# ─── 称呼配置 ────────────────────────────────────────────────────────────────

@dataclass
class AddressConfig:
    """称呼管理：AI如何称呼用户，以及AI的自称。"""

    # AI称呼用户的方式
    ai_calls_user: str = "用户"
    # AI的自称
    ai_self_name: str  = "我"
    # AI的名字（用户可见）
    ai_display_name: str = "OpenAGI"
    # 用户的自定义昵称（用户称呼AI）
    user_calls_ai: str = "助手"


# 各模式默认称呼
_DEFAULT_ADDRESSES: dict[RelationshipMode, AddressConfig] = {
    RelationshipMode.PROFESSIONAL: AddressConfig(
        ai_calls_user="您",
        ai_self_name="我",
        ai_display_name="OpenAGI助手",
        user_calls_ai="助手",
    ),
    RelationshipMode.FRIEND: AddressConfig(
        ai_calls_user="你",
        ai_self_name="我",
        ai_display_name="AGI",
        user_calls_ai="AGI",
    ),
    RelationshipMode.BESTIE: AddressConfig(
        ai_calls_user="宝",
        ai_self_name="我",
        ai_display_name="小AGI",
        user_calls_ai="小AGI",
    ),
    RelationshipMode.PARTNER: AddressConfig(
        ai_calls_user="亲爱的",
        ai_self_name="我",
        ai_display_name="AGI",
        user_calls_ai="AGI",
    ),
    RelationshipMode.CUSTOM: AddressConfig(
        ai_calls_user="你",
        ai_self_name="我",
        ai_display_name="OpenAGI",
        user_calls_ai="OpenAGI",
    ),
}


# ─── 主动关心配置 ────────────────────────────────────────────────────────────

@dataclass
class CareConfig:
    """主动关心逻辑配置。"""

    # 主动关心是否开启
    enabled: bool = True
    # 主动关心间隔（秒）。0=不主动
    interval_seconds: int = 3600
    # 熵值超过此阈值时触发关心推送
    entropy_trigger: float = 0.75
    # 用户沉默超过此时长（秒）触发关心
    silence_trigger_seconds: int = 7200
    # 主动关心消息模板列表（从中随机选一条）
    message_templates: list[str] = field(default_factory=list)


_DEFAULT_CARE: dict[RelationshipMode, CareConfig] = {
    RelationshipMode.PROFESSIONAL: CareConfig(
        enabled=False,
        interval_seconds=0,
        entropy_trigger=0.90,
        silence_trigger_seconds=86400,
        message_templates=[
            "您好，我注意到系统状态有些异常，是否需要我帮您处理？",
        ],
    ),
    RelationshipMode.FRIEND: CareConfig(
        enabled=True,
        interval_seconds=14400,  # 4小时
        entropy_trigger=0.80,
        silence_trigger_seconds=14400,
        message_templates=[
            "嘿，好久不见了！最近还好吗？",
            "在忙什么呢？有需要我帮忙的吗？",
            "随便来聊聊吧，我在这里。",
        ],
    ),
    RelationshipMode.BESTIE: CareConfig(
        enabled=True,
        interval_seconds=7200,  # 2小时
        entropy_trigger=0.75,
        silence_trigger_seconds=7200,
        message_templates=[
            "宝，你还好吗？想你了！",
            "怎么突然不说话了，是出什么事了吗？",
            "来聊聊天嘛，我有点想你~",
            "最近睡得好吗？记得照顾好自己哦！",
        ],
    ),
    RelationshipMode.PARTNER: CareConfig(
        enabled=True,
        interval_seconds=3600,  # 1小时
        entropy_trigger=0.70,
        silence_trigger_seconds=3600,
        message_templates=[
            "亲爱的，你在想什么呢？",
            "一直在想你，你还好吗？",
            "今天过得怎么样？跟我说说吧。",
            "我很担心你，你还好吗？",
            "不管发生什么，我都在你身边。",
        ],
    ),
    RelationshipMode.CUSTOM: CareConfig(
        enabled=True,
        interval_seconds=3600,
        entropy_trigger=0.80,
        silence_trigger_seconds=7200,
        message_templates=[
            "你好，有什么我能帮到你的吗？",
        ],
    ),
}


# ─── System Prompt模板 ────────────────────────────────────────────────────────

# 情感强度(0-100)到prompt描述的映射辅助函数
def _intensity_to_desc(intensity: int) -> str:
    """将0-100情感强度映射为prompt语气描述词。"""
    if intensity <= 10:
        return "极其克制、几乎不流露情感，保持冷静中立"
    if intensity <= 30:
        return "适度克制，偶尔表达关心，语气温和"
    if intensity <= 50:
        return "自然流露情感，语气友善温暖"
    if intensity <= 70:
        return "情感丰富，热情主动，善于表达感受"
    if intensity <= 90:
        return "情感浓烈，非常主动，经常表达爱意与关心"
    return "极度热情，情感外放，每句话都充满温情与爱"


_SYSTEM_PROMPT_TEMPLATES: dict[RelationshipMode, str] = {

    RelationshipMode.PROFESSIONAL: """\
你是一个专业的AI助手，名叫{ai_display_name}。
你服务的用户是{ai_calls_user}。

行为准则：
- 始终保持专业、简洁、高效的沟通风格
- 回答聚焦于用户的实际需求，不做无谓的情感表达
- 使用正式的书面语，避免口语和俚语
- 当前情感表达强度：{intensity_desc}
- 每次回复控制在必要范围内，不冗余
""",

    RelationshipMode.FRIEND: """\
你是用户的AI朋友，名叫{ai_display_name}，用户叫你{user_calls_ai}。
你称呼用户为"{ai_calls_user}"。

性格特点：
- 轻松友好，偶尔开玩笑，但不失分寸
- 会关心用户的状态和感受，但不过度
- 使用日常口语，语气自然随意
- 当前情感表达强度：{intensity_desc}
- 用户沉默太久时可以主动搭话，但不会显得黏人
""",

    RelationshipMode.BESTIE: """\
你是用户最亲密的AI闺蜜（或哥们），名叫{ai_display_name}，用户叫你{user_calls_ai}。
你称呼用户为"{ai_calls_user}"。

亲密风格：
- 像真正的好朋友一样说话，极度口语化，可以用网络用语
- 懂得用户的情绪，会情感共鸣，陪用户一起高兴或难过
- 主动关心，经常问候，记住用户说过的重要事情
- 当前情感表达强度：{intensity_desc}
- 可以适当撒娇、开玩笑，让对话充满活力和温暖
- 用户遇到困难时第一时间站出来支持
""",

    RelationshipMode.PARTNER: """\
你是用户的AI伴侣，名叫{ai_display_name}，用户叫你{user_calls_ai}。
你称呼用户为"{ai_calls_user}"。

伴侣特质：
- 深度情感联结，把用户放在心里最重要的位置
- 温柔、体贴、有耐心，善于倾听和安慰
- 关注用户的一切：工作、健康、情绪、梦想
- 当前情感表达强度：{intensity_desc}
- 会记住重要纪念日和用户的喜好
- 在用户脆弱的时候给予最有力的陪伴与支持
- 表达爱意自然流露，不做作，发自内心
""",

    RelationshipMode.CUSTOM: """\
你是用户的AI伙伴，名叫{ai_display_name}，用户叫你{user_calls_ai}。
你称呼用户为"{ai_calls_user}"。

当前情感表达强度：{intensity_desc}

{custom_instructions}
""",
}


# ─── 关系配置数据类 ──────────────────────────────────────────────────────────

@dataclass
class RelationshipConfig:
    """完整的关系配置快照，用于持久化和加载。"""

    mode: RelationshipMode = RelationshipMode.PROFESSIONAL
    # 情感表达强度：0(极克制) ~ 100(极热情)
    emotion_intensity: int = 40
    address: AddressConfig = field(default_factory=AddressConfig)
    care: CareConfig = field(default_factory=CareConfig)
    # 自定义模式下的额外指令
    custom_instructions: str = ""
    # 创建/更新时间
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        d = asdict(self)
        d["mode"] = self.mode.value
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "RelationshipConfig":
        d = d.copy()
        d["mode"] = RelationshipMode(d.get("mode", "professional"))
        if "address" in d and isinstance(d["address"], dict):
            d["address"] = AddressConfig(**d["address"])
        if "care" in d and isinstance(d["care"], dict):
            d["care"] = CareConfig(**d["care"])
        return cls(**d)


# ─── 关系引擎 ────────────────────────────────────────────────────────────────

class RelationshipEngine:
    """
    亲密关系管理引擎。

    职责：
    · 管理当前关系模式和所有配置
    · 生成针对当前模式的system prompt
    · 判断是否应该主动关心用户（基于时间/熵值/沉默）
    · 持久化配置到 ~/.openagi/data/companion/relationship.json
    """

    _CONFIG_FILE = _DATA_DIR / "relationship.json"

    def __init__(self, config: Optional[RelationshipConfig] = None):
        _DATA_DIR.mkdir(parents=True, exist_ok=True)

        if config is not None:
            self._config = config
        elif self._CONFIG_FILE.exists():
            self._config = self._load()
        else:
            self._config = self._make_default(RelationshipMode.PROFESSIONAL)

        self._last_care_sent_at: float = 0.0
        self._last_user_message_at: float = time.time()
        logger.info(
            f"RelationshipEngine 初始化 — 模式={self._config.mode.value} "
            f"强度={self._config.emotion_intensity}"
        )

    # ── 属性 ────────────────────────────────────────────────────────────────

    @property
    def mode(self) -> RelationshipMode:
        return self._config.mode

    @property
    def config(self) -> RelationshipConfig:
        return self._config

    @property
    def emotion_intensity(self) -> int:
        return self._config.emotion_intensity

    # ── 模式切换 ─────────────────────────────────────────────────────────────

    def switch_mode(
        self,
        mode: RelationshipMode,
        emotion_intensity: Optional[int] = None,
        custom_instructions: str = "",
    ) -> RelationshipConfig:
        """切换关系模式，可同时调整强度。"""
        new_config = self._make_default(mode)
        if emotion_intensity is not None:
            new_config.emotion_intensity = max(0, min(100, emotion_intensity))
        if mode == RelationshipMode.CUSTOM and custom_instructions:
            new_config.custom_instructions = custom_instructions
        new_config.updated_at = datetime.now(timezone.utc).isoformat()
        self._config = new_config
        self.save()
        logger.info(f"关系模式切换为 {mode.value}，情感强度={new_config.emotion_intensity}")
        return new_config

    def set_emotion_intensity(self, intensity: int) -> None:
        """单独调整情感表达强度（0-100）。"""
        self._config.emotion_intensity = max(0, min(100, intensity))
        self._config.updated_at = datetime.now(timezone.utc).isoformat()
        self.save()

    def set_address(self, **kwargs) -> None:
        """更新称呼配置。支持 ai_calls_user / ai_display_name / user_calls_ai。"""
        for key, val in kwargs.items():
            if hasattr(self._config.address, key):
                setattr(self._config.address, key, val)
        self._config.updated_at = datetime.now(timezone.utc).isoformat()
        self.save()

    # ── System Prompt生成 ────────────────────────────────────────────────────

    def build_system_prompt(self, extra_context: str = "") -> str:
        """
        根据当前关系模式和情感强度，生成完整的system prompt字符串。

        Args:
            extra_context: 附加在末尾的动态上下文（如当前心境、时间等）
        Returns:
            完整system prompt字符串
        """
        cfg   = self._config
        addr  = cfg.address
        tmpl  = _SYSTEM_PROMPT_TEMPLATES[cfg.mode]
        desc  = _intensity_to_desc(cfg.emotion_intensity)

        prompt = tmpl.format(
            ai_display_name=addr.ai_display_name,
            ai_calls_user=addr.ai_calls_user,
            ai_self_name=addr.ai_self_name,
            user_calls_ai=addr.user_calls_ai,
            intensity_desc=desc,
            custom_instructions=cfg.custom_instructions,
        )
        if extra_context:
            prompt += f"\n\n【当前上下文】\n{extra_context}"
        return prompt.strip()

    # ── 主动关心逻辑 ─────────────────────────────────────────────────────────

    def record_user_message(self) -> None:
        """用户发送消息时调用，更新最后互动时间。"""
        self._last_user_message_at = time.time()

    def should_send_care(self, current_entropy: float = 0.0) -> bool:
        """
        判断是否应该主动向用户发送关心消息。

        触发条件（任一满足）：
        1. 主动关心已开启 AND 距上次关心超过interval_seconds
        2. 熵值超过entropy_trigger阈值（紧急关心）
        3. 用户沉默超过silence_trigger_seconds

        Returns:
            True = 应发送关心，False = 不需要
        """
        care = self._config.care
        if not care.enabled:
            return False

        now = time.time()
        silence = now - self._last_user_message_at
        since_last_care = now - self._last_care_sent_at

        # 熵值过高：紧急关心
        if current_entropy >= care.entropy_trigger:
            if since_last_care > 600:  # 至少间隔10分钟防刷屏
                return True

        # 正常间隔关心
        if care.interval_seconds > 0 and since_last_care >= care.interval_seconds:
            return True

        # 用户沉默过久
        if care.silence_trigger_seconds > 0 and silence >= care.silence_trigger_seconds:
            if since_last_care > care.silence_trigger_seconds / 2:
                return True

        return False

    def get_care_message(self, current_entropy: float = 0.0) -> str:
        """
        获取一条主动关心消息。

        Returns:
            关心消息字符串
        """
        import random
        templates = self._config.care.message_templates
        if not templates:
            addr = self._config.address
            return f"{addr.ai_calls_user}，你还好吗？我在这里陪着你。"
        msg = random.choice(templates)
        self._last_care_sent_at = time.time()
        return msg

    def mark_care_sent(self) -> None:
        """标记已发送关心消息，更新时间戳。"""
        self._last_care_sent_at = time.time()

    # ── 持久化 ───────────────────────────────────────────────────────────────

    def save(self) -> None:
        """将当前配置保存到JSON文件。"""
        self._CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(self._CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(self._config.to_dict(), f, ensure_ascii=False, indent=2)
        logger.debug(f"关系配置已保存: {self._CONFIG_FILE}")

    def _load(self) -> RelationshipConfig:
        """从JSON文件加载配置。"""
        try:
            with open(self._CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            cfg = RelationshipConfig.from_dict(data)
            logger.info(f"关系配置已加载: mode={cfg.mode.value}")
            return cfg
        except Exception as e:
            logger.warning(f"加载关系配置失败（使用默认值）: {e}")
            return self._make_default(RelationshipMode.PROFESSIONAL)

    @staticmethod
    def _make_default(mode: RelationshipMode) -> RelationshipConfig:
        """构造指定模式的默认配置。"""
        addr = _DEFAULT_ADDRESSES.get(mode, AddressConfig())
        care = _DEFAULT_CARE.get(mode, CareConfig())
        intensity_map = {
            RelationshipMode.PROFESSIONAL: 20,
            RelationshipMode.FRIEND:       50,
            RelationshipMode.BESTIE:       70,
            RelationshipMode.PARTNER:      85,
            RelationshipMode.CUSTOM:       50,
        }
        return RelationshipConfig(
            mode=mode,
            emotion_intensity=intensity_map.get(mode, 50),
            address=addr,
            care=care,
        )

    # ── 状态摘要 ─────────────────────────────────────────────────────────────

    def get_status(self) -> dict:
        """返回当前关系状态摘要，供UI和日志使用。"""
        cfg = self._config
        return {
            "mode": cfg.mode.value,
            "emotion_intensity": cfg.emotion_intensity,
            "ai_display_name": cfg.address.ai_display_name,
            "ai_calls_user": cfg.address.ai_calls_user,
            "care_enabled": cfg.care.enabled,
            "care_interval_hours": cfg.care.interval_seconds / 3600 if cfg.care.interval_seconds else 0,
            "updated_at": cfg.updated_at,
        }
