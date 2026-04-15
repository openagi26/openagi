"""
companion/tts.py — 文字转语音引擎 (Text-to-Speech Engine)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MVP版本：定义完整接口和声音配置，不实际合成音频。
实际合成需安装 piper-tts / coqui-tts 或使用系统TTS。

支持引擎：
  PIPER   — Piper TTS（离线，高质量，推荐）
  COQUI   — Coqui TTS（离线，多语言）
  SYSTEM  — 系统TTS（macOS say / espeak）
  MOCK    — Mock模式（仅生成配置文件，MVP默认）

预设声音：6种中英文声音（女声/男声/中性）
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, asdict
from enum import Enum
from pathlib import Path
from typing import Optional

logger = logging.getLogger("openagi.companion.tts")

# ─── 数据目录 ────────────────────────────────────────────────────────────────

_DATA_DIR   = Path.home() / ".openagi" / "data" / "tts"
_AUDIO_DIR  = _DATA_DIR / "audio"
_MODELS_DIR = _DATA_DIR / "models"


# ─── 引擎枚举 ────────────────────────────────────────────────────────────────

class TTSEngine(str, Enum):
    PIPER  = "piper"    # 推荐：Piper TTS
    COQUI  = "coqui"    # 备选：Coqui TTS
    SYSTEM = "system"   # 系统TTS（macOS say / Linux espeak）
    MOCK   = "mock"     # Mock：只生成配置文件，不合成音频


# ─── 预设声音定义 ────────────────────────────────────────────────────────────

@dataclass
class VoiceProfile:
    """声音档案。"""
    voice_id:     str          # 唯一标识
    name:         str          # 显示名称
    language:     str          # 语言代码（zh-CN / en-US / ja-JP）
    gender:       str          # female / male / neutral
    engine:       TTSEngine    # 所需引擎
    model_name:   str          # 引擎内部模型名
    description:  str          # 声音描述
    sample_rate:  int = 22050  # 采样率（Hz）
    # Piper/Coqui专用参数
    speaker_id:   Optional[int] = None


# 6种预设声音
PRESET_VOICES: dict[str, VoiceProfile] = {
    "zh_female_warm": VoiceProfile(
        voice_id="zh_female_warm",
        name="小暖（中文女声）",
        language="zh-CN",
        gender="female",
        engine=TTSEngine.PIPER,
        model_name="zh_CN-huayan-medium",
        description="温柔温暖的中文女声，适合伴侣/闺蜜模式",
        sample_rate=22050,
    ),
    "zh_female_cool": VoiceProfile(
        voice_id="zh_female_cool",
        name="冷霜（中文女声·冷静）",
        language="zh-CN",
        gender="female",
        engine=TTSEngine.PIPER,
        model_name="zh_CN-huayan-medium",
        description="干练冷静的中文女声，适合专业助手模式",
        sample_rate=22050,
        speaker_id=1,
    ),
    "zh_male_gentle": VoiceProfile(
        voice_id="zh_male_gentle",
        name="君泽（中文男声）",
        language="zh-CN",
        gender="male",
        engine=TTSEngine.PIPER,
        model_name="zh_CN-huayan-medium",
        description="温和沉稳的中文男声，适合朋友/伙伴模式",
        sample_rate=22050,
        speaker_id=2,
    ),
    "en_female_warm": VoiceProfile(
        voice_id="en_female_warm",
        name="Luna (English Female)",
        language="en-US",
        gender="female",
        engine=TTSEngine.PIPER,
        model_name="en_US-lessac-medium",
        description="Warm and friendly English female voice",
        sample_rate=22050,
    ),
    "en_male_deep": VoiceProfile(
        voice_id="en_male_deep",
        name="Rex (English Male)",
        language="en-US",
        gender="male",
        engine=TTSEngine.PIPER,
        model_name="en_US-danny-low",
        description="Deep and calm English male voice",
        sample_rate=16000,
    ),
    "system_default": VoiceProfile(
        voice_id="system_default",
        name="系统默认",
        language="zh-CN",
        gender="neutral",
        engine=TTSEngine.SYSTEM,
        model_name="system",
        description="使用操作系统内置TTS，无需额外安装",
        sample_rate=22050,
    ),
}


# ─── TTS配置 ─────────────────────────────────────────────────────────────────

@dataclass
class TTSConfig:
    """TTS合成参数配置。"""
    voice_id:        str   = "zh_female_warm"
    engine:          TTSEngine = TTSEngine.MOCK
    speed:           float = 1.0    # 语速：0.5(慢) ~ 2.0(快)，1.0=正常
    pitch:           float = 1.0    # 音调：0.5(低沉) ~ 2.0(高亢)，1.0=正常
    emotion_strength: float = 0.5   # 情感强度：0.0(平淡) ~ 1.0(丰富)
    volume:          float = 1.0    # 音量：0.0 ~ 1.0
    output_format:   str   = "wav"  # wav / mp3 / ogg


# ─── 合成结果 ────────────────────────────────────────────────────────────────

@dataclass
class TTSResult:
    """TTS合成结果。"""
    success:    bool
    audio_path: Optional[str]   # 音频文件路径（None则合成失败）
    duration_ms: int            # 预估时长（毫秒）
    config_path: Optional[str]  # MVP模式下保存的配置文件路径
    engine_used: TTSEngine
    error:      Optional[str] = None
    elapsed_ms: int = 0

    def __repr__(self) -> str:
        status = "OK" if self.success else f"ERR:{self.error}"
        return f"TTSResult({status}, engine={self.engine_used.value}, {self.duration_ms}ms)"


# ─── 引擎基类 ────────────────────────────────────────────────────────────────

class BaseTTSEngine:
    """TTS引擎抽象基类。所有引擎必须实现 synthesize 方法。"""

    def synthesize(
        self,
        text: str,
        config: TTSConfig,
        output_path: Optional[Path] = None,
    ) -> TTSResult:
        raise NotImplementedError

    def is_available(self) -> bool:
        """检查引擎是否可用（依赖是否安装）。"""
        return False


# ─── Mock引擎（MVP） ─────────────────────────────────────────────────────────

class MockTTSEngine(BaseTTSEngine):
    """
    Mock TTS引擎（MVP使用）。
    不实际合成音频，只将配置和文本写入JSON文件，
    供后续真实引擎接管时使用。
    """

    def synthesize(
        self,
        text: str,
        config: TTSConfig,
        output_path: Optional[Path] = None,
    ) -> TTSResult:
        t0 = time.monotonic()
        _AUDIO_DIR.mkdir(parents=True, exist_ok=True)

        ts = int(time.time() * 1000)
        config_file = _AUDIO_DIR / f"tts_{ts}.json"

        voice = PRESET_VOICES.get(config.voice_id)
        payload = {
            "text": text,
            "text_length": len(text),
            "voice_id": config.voice_id,
            "voice_name": voice.name if voice else "unknown",
            "engine": config.engine.value,
            "speed": config.speed,
            "pitch": config.pitch,
            "emotion_strength": config.emotion_strength,
            "volume": config.volume,
            "output_format": config.output_format,
            "mock": True,
            "note": "MVP模式：实际音频合成需安装piper-tts",
            "generated_at": ts,
        }
        with open(config_file, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

        # 估算时长：约5个字/秒，受speed影响
        estimated_chars_per_sec = 5 * config.speed
        duration_ms = int(len(text) / estimated_chars_per_sec * 1000)

        elapsed = int((time.monotonic() - t0) * 1000)
        logger.debug(f"[MockTTS] 配置已写入 {config_file}，预估{duration_ms}ms")

        return TTSResult(
            success=True,
            audio_path=None,
            duration_ms=duration_ms,
            config_path=str(config_file),
            engine_used=TTSEngine.MOCK,
            elapsed_ms=elapsed,
        )

    def is_available(self) -> bool:
        return True


# ─── Piper引擎（需安装piper-tts） ────────────────────────────────────────────

class PiperTTSEngine(BaseTTSEngine):
    """
    Piper TTS引擎。
    需要：pip install piper-tts
    模型下载：https://huggingface.co/rhasspy/piper-voices
    """

    def is_available(self) -> bool:
        try:
            import importlib
            return importlib.util.find_spec("piper") is not None
        except Exception:
            return False

    def synthesize(
        self,
        text: str,
        config: TTSConfig,
        output_path: Optional[Path] = None,
    ) -> TTSResult:
        t0 = time.monotonic()
        if not self.is_available():
            return TTSResult(
                success=False,
                audio_path=None,
                duration_ms=0,
                config_path=None,
                engine_used=TTSEngine.PIPER,
                error="piper-tts未安装，请执行: pip install piper-tts",
            )

        try:
            from piper import PiperVoice  # type: ignore
            import wave

            voice_profile = PRESET_VOICES.get(config.voice_id)
            model_name = voice_profile.model_name if voice_profile else "zh_CN-huayan-medium"
            model_path = _MODELS_DIR / f"{model_name}.onnx"

            if not model_path.exists():
                return TTSResult(
                    success=False,
                    audio_path=None,
                    duration_ms=0,
                    config_path=None,
                    engine_used=TTSEngine.PIPER,
                    error=f"模型文件不存在: {model_path}，请下载对应模型",
                )

            piper_voice = PiperVoice.load(str(model_path))

            _AUDIO_DIR.mkdir(parents=True, exist_ok=True)
            if output_path is None:
                ts = int(time.time() * 1000)
                output_path = _AUDIO_DIR / f"tts_{ts}.wav"

            with wave.open(str(output_path), "w") as wav_file:
                piper_voice.synthesize(text, wav_file)

            elapsed = int((time.monotonic() - t0) * 1000)
            duration_ms = int(len(text) / (5 * config.speed) * 1000)

            logger.info(f"[PiperTTS] 合成完成: {output_path}，耗时{elapsed}ms")
            return TTSResult(
                success=True,
                audio_path=str(output_path),
                duration_ms=duration_ms,
                config_path=None,
                engine_used=TTSEngine.PIPER,
                elapsed_ms=elapsed,
            )

        except Exception as e:
            elapsed = int((time.monotonic() - t0) * 1000)
            logger.error(f"[PiperTTS] 合成失败: {e}")
            return TTSResult(
                success=False,
                audio_path=None,
                duration_ms=0,
                config_path=None,
                engine_used=TTSEngine.PIPER,
                error=str(e),
                elapsed_ms=elapsed,
            )


# ─── 系统TTS引擎（macOS say / Linux espeak） ─────────────────────────────────

class SystemTTSEngine(BaseTTSEngine):
    """使用操作系统内置TTS，无需额外安装。"""

    def is_available(self) -> bool:
        import shutil
        import sys
        if sys.platform == "darwin":
            return shutil.which("say") is not None
        return shutil.which("espeak") is not None or shutil.which("espeak-ng") is not None

    def synthesize(
        self,
        text: str,
        config: TTSConfig,
        output_path: Optional[Path] = None,
    ) -> TTSResult:
        import sys
        import subprocess
        t0 = time.monotonic()

        _AUDIO_DIR.mkdir(parents=True, exist_ok=True)
        if output_path is None:
            ts = int(time.time() * 1000)
            output_path = _AUDIO_DIR / f"tts_{ts}.aiff"

        try:
            if sys.platform == "darwin":
                # macOS say 命令
                rate = int(180 * config.speed)  # 默认180词/分钟
                cmd = ["say", "-r", str(rate), "-o", str(output_path), text]
            else:
                # Linux espeak
                speed = int(175 * config.speed)
                cmd = ["espeak", "-s", str(speed), "-w", str(output_path), text]

            result = subprocess.run(cmd, capture_output=True, timeout=30)
            elapsed = int((time.monotonic() - t0) * 1000)

            if result.returncode == 0:
                duration_ms = int(len(text) / (5 * config.speed) * 1000)
                logger.info(f"[SystemTTS] 合成完成: {output_path}")
                return TTSResult(
                    success=True,
                    audio_path=str(output_path),
                    duration_ms=duration_ms,
                    config_path=None,
                    engine_used=TTSEngine.SYSTEM,
                    elapsed_ms=elapsed,
                )
            else:
                error = result.stderr.decode("utf-8", errors="replace")
                return TTSResult(
                    success=False,
                    audio_path=None,
                    duration_ms=0,
                    config_path=None,
                    engine_used=TTSEngine.SYSTEM,
                    error=error,
                    elapsed_ms=elapsed,
                )
        except Exception as e:
            elapsed = int((time.monotonic() - t0) * 1000)
            return TTSResult(
                success=False,
                audio_path=None,
                duration_ms=0,
                config_path=None,
                engine_used=TTSEngine.SYSTEM,
                error=str(e),
                elapsed_ms=elapsed,
            )


# ─── TTS管理器（统一入口） ───────────────────────────────────────────────────

class TTSManager:
    """
    TTS管理器：统一入口，自动选择可用引擎。

    优先级：用户指定引擎 > Piper > System > Mock
    """

    _ENGINES: dict[TTSEngine, BaseTTSEngine] = {
        TTSEngine.MOCK:   MockTTSEngine(),
        TTSEngine.PIPER:  PiperTTSEngine(),
        TTSEngine.SYSTEM: SystemTTSEngine(),
    }

    def __init__(self, default_config: Optional[TTSConfig] = None):
        self._config = default_config or TTSConfig()
        logger.info(
            f"TTSManager 初始化 — 引擎={self._config.engine.value} "
            f"声音={self._config.voice_id}"
        )

    @property
    def config(self) -> TTSConfig:
        return self._config

    def set_voice(self, voice_id: str) -> bool:
        """切换声音。返回True表示声音ID有效。"""
        if voice_id not in PRESET_VOICES:
            logger.warning(f"未知声音ID: {voice_id}，有效ID: {list(PRESET_VOICES.keys())}")
            return False
        self._config.voice_id = voice_id
        voice = PRESET_VOICES[voice_id]
        self._config.engine = voice.engine
        return True

    def set_params(
        self,
        speed: Optional[float] = None,
        pitch: Optional[float] = None,
        emotion_strength: Optional[float] = None,
        volume: Optional[float] = None,
    ) -> None:
        """调整合成参数。"""
        if speed is not None:
            self._config.speed = max(0.5, min(2.0, speed))
        if pitch is not None:
            self._config.pitch = max(0.5, min(2.0, pitch))
        if emotion_strength is not None:
            self._config.emotion_strength = max(0.0, min(1.0, emotion_strength))
        if volume is not None:
            self._config.volume = max(0.0, min(1.0, volume))

    def synthesize(
        self,
        text: str,
        config_override: Optional[TTSConfig] = None,
        output_path: Optional[Path] = None,
    ) -> TTSResult:
        """合成语音。"""
        cfg = config_override or self._config
        engine = self._ENGINES.get(cfg.engine, self._ENGINES[TTSEngine.MOCK])

        if not engine.is_available():
            logger.warning(f"引擎 {cfg.engine.value} 不可用，降级为Mock")
            engine = self._ENGINES[TTSEngine.MOCK]
            cfg = TTSConfig(
                voice_id=cfg.voice_id,
                engine=TTSEngine.MOCK,
                speed=cfg.speed,
                pitch=cfg.pitch,
                emotion_strength=cfg.emotion_strength,
                volume=cfg.volume,
            )

        return engine.synthesize(text, cfg, output_path)

    def list_voices(self) -> list[dict]:
        """列出所有预设声音。"""
        return [
            {
                "voice_id": v.voice_id,
                "name": v.name,
                "language": v.language,
                "gender": v.gender,
                "engine": v.engine.value,
                "description": v.description,
            }
            for v in PRESET_VOICES.values()
        ]

    def get_available_engines(self) -> list[str]:
        """返回当前系统上可用的引擎名称列表。"""
        return [
            name.value
            for name, engine in self._ENGINES.items()
            if engine.is_available()
        ]
