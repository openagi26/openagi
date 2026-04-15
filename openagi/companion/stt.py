"""
companion/stt.py — 语音识别引擎 (Speech-to-Text Engine)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MVP版本：定义完整接口和配置框架，不实际运行Whisper。
实际识别需安装 whisper.cpp 或 openai-whisper。

支持引擎：
  WHISPER_CPP — Whisper.cpp（高效离线推理，推荐）
  OPENAI_WHISPER — OpenAI Whisper Python包
  MOCK        — Mock模式（返回预设文本，MVP默认）

模型规格：tiny / base / small / medium / large
语言支持：auto / zh / en / ja（可扩展）
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Optional

logger = logging.getLogger("openagi.companion.stt")

# ─── 数据目录 ────────────────────────────────────────────────────────────────

_DATA_DIR   = Path.home() / ".openagi" / "data" / "stt"
_MODELS_DIR = _DATA_DIR / "models"
_CACHE_DIR  = _DATA_DIR / "cache"


# ─── 枚举定义 ────────────────────────────────────────────────────────────────

class STTEngine(str, Enum):
    WHISPER_CPP    = "whisper_cpp"      # whisper.cpp（C++实现，高效）
    OPENAI_WHISPER = "openai_whisper"   # OpenAI Whisper Python包
    MOCK           = "mock"             # Mock模式，MVP用


class WhisperModel(str, Enum):
    """Whisper模型规格。越大越准确但越慢。"""
    TINY   = "tiny"    # ~39M，最快，适合实时
    BASE   = "base"    # ~74M，快速，日常用
    SMALL  = "small"   # ~244M，均衡，推荐
    MEDIUM = "medium"  # ~769M，高精度
    LARGE  = "large"   # ~1.5G，最高精度，需要GPU


class STTLanguage(str, Enum):
    """识别语言。"""
    AUTO    = "auto"    # 自动检测
    CHINESE = "zh"      # 中文（普通话）
    ENGLISH = "en"      # 英文
    JAPANESE = "ja"     # 日文
    KOREAN  = "ko"      # 韩文
    FRENCH  = "fr"      # 法文


# ─── 配置与结果 ──────────────────────────────────────────────────────────────

@dataclass
class STTConfig:
    """语音识别参数配置。"""
    engine:      STTEngine    = STTEngine.MOCK
    model:       WhisperModel = WhisperModel.BASE
    language:    STTLanguage  = STTLanguage.AUTO
    # 是否输出时间戳（词级别）
    word_timestamps: bool = False
    # 是否自动过滤噪声片段
    noise_filter: bool = True
    # 沉默检测阈值（dB），低于此值视为沉默
    silence_threshold_db: float = -40.0
    # VAD（语音活动检测）：自动剪切沉默段
    vad_enabled: bool = True
    # 最大录制时长（秒），0=无限制
    max_duration_seconds: int = 60


@dataclass
class STTSegment:
    """识别出的一个语音片段。"""
    start_ms:  int    # 开始时间（毫秒）
    end_ms:    int    # 结束时间（毫秒）
    text:      str    # 识别文本
    confidence: float # 置信度 0.0~1.0


@dataclass
class STTResult:
    """STT识别结果。"""
    success:    bool
    text:       str                  # 完整识别文本
    language:   str                  # 检测到的语言代码
    segments:   list[STTSegment]     # 分段信息（有timestamps时）
    duration_ms: int                 # 音频时长（毫秒）
    engine_used: STTEngine
    error:      Optional[str] = None
    elapsed_ms: int = 0

    def __repr__(self) -> str:
        status = "OK" if self.success else f"ERR:{self.error}"
        preview = self.text[:30] + "..." if len(self.text) > 30 else self.text
        return f"STTResult({status}, lang={self.language}, '{preview}')"


# ─── 引擎基类 ────────────────────────────────────────────────────────────────

class BaseSTTEngine:
    """STT引擎抽象基类。"""

    def transcribe(
        self,
        audio_path: Path,
        config: STTConfig,
    ) -> STTResult:
        """
        转录音频文件。

        Args:
            audio_path: 音频文件路径（wav/mp3/ogg/m4a）
            config: STT配置

        Returns:
            STTResult
        """
        raise NotImplementedError

    def transcribe_bytes(
        self,
        audio_bytes: bytes,
        config: STTConfig,
    ) -> STTResult:
        """
        从bytes转录（适合实时流式识别）。
        默认实现：先写临时文件再调用transcribe。
        """
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio_bytes)
            tmp_path = Path(f.name)
        try:
            return self.transcribe(tmp_path, config)
        finally:
            tmp_path.unlink(missing_ok=True)

    def is_available(self) -> bool:
        return False


# ─── Mock引擎（MVP） ─────────────────────────────────────────────────────────

class MockSTTEngine(BaseSTTEngine):
    """
    Mock STT引擎（MVP使用）。
    不实际识别，返回预设响应，同时将请求元数据写入缓存目录。
    """

    # 预设响应（用于测试）
    MOCK_RESPONSES = [
        "你好，今天天气怎么样？",
        "帮我看看最新的消息。",
        "我想聊聊天。",
        "Hello, how are you today?",
    ]

    def __init__(self, fixed_response: Optional[str] = None):
        self._fixed_response = fixed_response
        self._call_count = 0

    def transcribe(
        self,
        audio_path: Path,
        config: STTConfig,
    ) -> STTResult:
        t0 = time.monotonic()
        _CACHE_DIR.mkdir(parents=True, exist_ok=True)

        self._call_count += 1
        ts = int(time.time() * 1000)

        # 选择响应文本
        if self._fixed_response:
            text = self._fixed_response
        else:
            idx = self._call_count % len(self.MOCK_RESPONSES)
            text = self.MOCK_RESPONSES[idx]

        # 写入元数据缓存
        meta = {
            "audio_path": str(audio_path),
            "config_engine": config.engine.value,
            "config_model": config.model.value,
            "config_language": config.language.value,
            "mock_response": text,
            "call_count": self._call_count,
            "mock": True,
            "note": "MVP模式：实际识别需安装whisper.cpp",
            "requested_at": ts,
        }
        cache_file = _CACHE_DIR / f"stt_{ts}.json"
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

        elapsed = int((time.monotonic() - t0) * 1000)
        # 估算音频时长（mock：假设5秒）
        duration_ms = 5000

        logger.debug(f"[MockSTT] 返回预设文本: '{text[:30]}'")
        return STTResult(
            success=True,
            text=text,
            language=config.language.value if config.language != STTLanguage.AUTO else "zh",
            segments=[
                STTSegment(start_ms=0, end_ms=duration_ms, text=text, confidence=0.99)
            ],
            duration_ms=duration_ms,
            engine_used=STTEngine.MOCK,
            elapsed_ms=elapsed,
        )

    def is_available(self) -> bool:
        return True


# ─── OpenAI Whisper引擎 ───────────────────────────────────────────────────────

class OpenAIWhisperEngine(BaseSTTEngine):
    """
    OpenAI Whisper Python包引擎。
    需要：pip install openai-whisper
    """

    def is_available(self) -> bool:
        try:
            import importlib
            return importlib.util.find_spec("whisper") is not None
        except Exception:
            return False

    def transcribe(
        self,
        audio_path: Path,
        config: STTConfig,
    ) -> STTResult:
        t0 = time.monotonic()

        if not self.is_available():
            return STTResult(
                success=False,
                text="",
                language="",
                segments=[],
                duration_ms=0,
                engine_used=STTEngine.OPENAI_WHISPER,
                error="openai-whisper未安装，请执行: pip install openai-whisper",
            )

        try:
            import whisper  # type: ignore

            model_name = config.model.value
            lang = None if config.language == STTLanguage.AUTO else config.language.value

            model = whisper.load_model(model_name)
            result = model.transcribe(
                str(audio_path),
                language=lang,
                word_timestamps=config.word_timestamps,
                verbose=False,
            )

            text = result.get("text", "").strip()
            detected_lang = result.get("language", "unknown")

            # 解析分段
            segments: list[STTSegment] = []
            if config.word_timestamps:
                for seg in result.get("segments", []):
                    segments.append(STTSegment(
                        start_ms=int(seg["start"] * 1000),
                        end_ms=int(seg["end"] * 1000),
                        text=seg["text"].strip(),
                        confidence=seg.get("avg_logprob", 0) + 1.0,  # 归一化
                    ))

            elapsed = int((time.monotonic() - t0) * 1000)
            logger.info(f"[WhisperSTT] 识别完成: '{text[:30]}'，耗时{elapsed}ms")

            return STTResult(
                success=True,
                text=text,
                language=detected_lang,
                segments=segments,
                duration_ms=0,  # whisper不直接返回时长
                engine_used=STTEngine.OPENAI_WHISPER,
                elapsed_ms=elapsed,
            )

        except Exception as e:
            elapsed = int((time.monotonic() - t0) * 1000)
            logger.error(f"[WhisperSTT] 识别失败: {e}")
            return STTResult(
                success=False,
                text="",
                language="",
                segments=[],
                duration_ms=0,
                engine_used=STTEngine.OPENAI_WHISPER,
                error=str(e),
                elapsed_ms=elapsed,
            )


# ─── Whisper.cpp引擎 ─────────────────────────────────────────────────────────

class WhisperCppEngine(BaseSTTEngine):
    """
    Whisper.cpp引擎（通过Python绑定或命令行）。
    需要：pip install pywhispercpp
    或：编译 whisper.cpp 并将 main 二进制放入 PATH
    """

    def is_available(self) -> bool:
        try:
            import importlib
            if importlib.util.find_spec("pywhispercpp") is not None:
                return True
        except Exception:
            pass
        import shutil
        return shutil.which("whisper-cpp") is not None or shutil.which("main") is not None

    def transcribe(
        self,
        audio_path: Path,
        config: STTConfig,
    ) -> STTResult:
        t0 = time.monotonic()

        if not self.is_available():
            return STTResult(
                success=False,
                text="",
                language="",
                segments=[],
                duration_ms=0,
                engine_used=STTEngine.WHISPER_CPP,
                error="whisper.cpp未安装，请安装pywhispercpp或编译whisper.cpp",
            )

        try:
            import importlib
            if importlib.util.find_spec("pywhispercpp") is not None:
                return self._transcribe_via_python(audio_path, config, t0)
            else:
                return self._transcribe_via_cli(audio_path, config, t0)
        except Exception as e:
            elapsed = int((time.monotonic() - t0) * 1000)
            return STTResult(
                success=False,
                text="",
                language="",
                segments=[],
                duration_ms=0,
                engine_used=STTEngine.WHISPER_CPP,
                error=str(e),
                elapsed_ms=elapsed,
            )

    def _transcribe_via_python(
        self, audio_path: Path, config: STTConfig, t0: float
    ) -> STTResult:
        """通过pywhispercpp Python绑定调用。"""
        from pywhispercpp.model import Model  # type: ignore

        model_path = _MODELS_DIR / f"ggml-{config.model.value}.bin"
        lang = "auto" if config.language == STTLanguage.AUTO else config.language.value

        model = Model(str(model_path), language=lang)
        segments_raw = model.transcribe(str(audio_path))

        text = " ".join(seg.text for seg in segments_raw).strip()
        segments = [
            STTSegment(
                start_ms=int(seg.t0 * 10),  # whisper.cpp时间单位是10ms
                end_ms=int(seg.t1 * 10),
                text=seg.text.strip(),
                confidence=0.9,  # whisper.cpp不返回置信度
            )
            for seg in segments_raw
        ]

        elapsed = int((time.monotonic() - t0) * 1000)
        return STTResult(
            success=True,
            text=text,
            language=lang,
            segments=segments,
            duration_ms=segments[-1].end_ms if segments else 0,
            engine_used=STTEngine.WHISPER_CPP,
            elapsed_ms=elapsed,
        )

    def _transcribe_via_cli(
        self, audio_path: Path, config: STTConfig, t0: float
    ) -> STTResult:
        """通过命令行调用whisper.cpp的main二进制。"""
        import subprocess
        import shutil

        binary = shutil.which("whisper-cpp") or shutil.which("main")
        model_path = _MODELS_DIR / f"ggml-{config.model.value}.bin"
        lang = "auto" if config.language == STTLanguage.AUTO else config.language.value

        cmd = [
            binary,
            "-m", str(model_path),
            "-f", str(audio_path),
            "-l", lang,
            "--output-txt",
            "--no-timestamps",
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        elapsed = int((time.monotonic() - t0) * 1000)

        if result.returncode != 0:
            return STTResult(
                success=False,
                text="",
                language="",
                segments=[],
                duration_ms=0,
                engine_used=STTEngine.WHISPER_CPP,
                error=result.stderr[:200],
                elapsed_ms=elapsed,
            )

        text = result.stdout.strip()
        return STTResult(
            success=True,
            text=text,
            language=lang,
            segments=[STTSegment(start_ms=0, end_ms=0, text=text, confidence=0.9)],
            duration_ms=0,
            engine_used=STTEngine.WHISPER_CPP,
            elapsed_ms=elapsed,
        )


# ─── STT管理器（统一入口） ───────────────────────────────────────────────────

class STTManager:
    """
    STT管理器：统一入口，自动选择可用引擎。

    优先级：用户指定 > Whisper.cpp > OpenAI Whisper > Mock
    """

    _ENGINES: dict[STTEngine, BaseSTTEngine] = {
        STTEngine.MOCK:           MockSTTEngine(),
        STTEngine.OPENAI_WHISPER: OpenAIWhisperEngine(),
        STTEngine.WHISPER_CPP:    WhisperCppEngine(),
    }

    def __init__(self, default_config: Optional[STTConfig] = None):
        self._config = default_config or STTConfig()
        logger.info(
            f"STTManager 初始化 — 引擎={self._config.engine.value} "
            f"模型={self._config.model.value} 语言={self._config.language.value}"
        )

    @property
    def config(self) -> STTConfig:
        return self._config

    def set_model(self, model: WhisperModel) -> None:
        """设置Whisper模型规格。"""
        self._config.model = model

    def set_language(self, language: STTLanguage) -> None:
        """设置识别语言。"""
        self._config.language = language

    def transcribe(
        self,
        audio_path: Path,
        config_override: Optional[STTConfig] = None,
    ) -> STTResult:
        """转录音频文件。"""
        cfg = config_override or self._config
        engine = self._ENGINES.get(cfg.engine, self._ENGINES[STTEngine.MOCK])

        if not engine.is_available():
            logger.warning(f"引擎 {cfg.engine.value} 不可用，降级为Mock")
            engine = self._ENGINES[STTEngine.MOCK]

        return engine.transcribe(audio_path, cfg)

    def transcribe_bytes(
        self,
        audio_bytes: bytes,
        config_override: Optional[STTConfig] = None,
    ) -> STTResult:
        """从音频bytes转录。"""
        cfg = config_override or self._config
        engine = self._ENGINES.get(cfg.engine, self._ENGINES[STTEngine.MOCK])

        if not engine.is_available():
            engine = self._ENGINES[STTEngine.MOCK]

        return engine.transcribe_bytes(audio_bytes, cfg)

    def get_available_engines(self) -> list[str]:
        """返回当前系统可用的引擎列表。"""
        return [
            name.value
            for name, engine in self._ENGINES.items()
            if engine.is_available()
        ]

    def get_model_info(self) -> dict:
        """返回模型规格说明。"""
        return {
            model.value: {
                "name": model.value,
                "approx_size_mb": {"tiny": 39, "base": 74, "small": 244, "medium": 769, "large": 1500}.get(model.value, 0),
                "speed": {"tiny": "最快", "base": "快", "small": "均衡", "medium": "慢", "large": "最慢"}.get(model.value, ""),
                "accuracy": {"tiny": "一般", "base": "良好", "small": "较高", "medium": "高", "large": "最高"}.get(model.value, ""),
            }
            for model in WhisperModel
        }
