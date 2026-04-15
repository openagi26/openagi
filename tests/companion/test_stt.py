"""
tests/companion/test_stt.py — STT引擎测试
"""
from __future__ import annotations

import pytest
from pathlib import Path

from openagi.companion.stt import (
    STTEngine,
    STTConfig,
    STTResult,
    STTManager,
    STTLanguage,
    WhisperModel,
    MockSTTEngine,
)


# ─── MockSTTEngine 测试 ──────────────────────────────────────────────────────

class TestMockSTTEngine:
    @pytest.fixture
    def engine(self, tmp_path, monkeypatch):
        import openagi.companion.stt as stt_module
        monkeypatch.setattr(stt_module, "_CACHE_DIR", tmp_path)
        return MockSTTEngine()

    def test_is_available(self, engine):
        assert engine.is_available() is True

    def test_transcribe_returns_success(self, engine, tmp_path):
        cfg = STTConfig()
        # 创建一个假音频文件（Mock不实际读取内容）
        fake_audio = tmp_path / "test.wav"
        fake_audio.write_bytes(b"RIFF fake audio data")
        result = engine.transcribe(fake_audio, cfg)
        assert result.success is True
        assert result.engine_used == STTEngine.MOCK
        assert isinstance(result.text, str) and len(result.text) > 0

    def test_transcribe_fixed_response(self, tmp_path, monkeypatch):
        import openagi.companion.stt as stt_module
        monkeypatch.setattr(stt_module, "_CACHE_DIR", tmp_path)
        engine = MockSTTEngine(fixed_response="固定测试响应")
        cfg = STTConfig()
        fake_audio = tmp_path / "test.wav"
        fake_audio.write_bytes(b"fake")
        result = engine.transcribe(fake_audio, cfg)
        assert result.text == "固定测试响应"

    def test_transcribe_creates_cache_file(self, engine, tmp_path):
        cfg = STTConfig()
        fake_audio = tmp_path / "test.wav"
        fake_audio.write_bytes(b"fake")
        engine.transcribe(fake_audio, cfg)
        cache_files = list(tmp_path.glob("stt_*.json"))
        assert len(cache_files) >= 1

    def test_transcribe_returns_segments(self, engine, tmp_path):
        cfg = STTConfig()
        fake_audio = tmp_path / "test.wav"
        fake_audio.write_bytes(b"fake")
        result = engine.transcribe(fake_audio, cfg)
        assert len(result.segments) >= 1
        seg = result.segments[0]
        assert seg.text == result.text

    def test_transcribe_language_auto_defaults_to_zh(self, engine, tmp_path):
        cfg = STTConfig(language=STTLanguage.AUTO)
        fake_audio = tmp_path / "test.wav"
        fake_audio.write_bytes(b"fake")
        result = engine.transcribe(fake_audio, cfg)
        assert result.language == "zh"

    def test_transcribe_explicit_language(self, engine, tmp_path):
        cfg = STTConfig(language=STTLanguage.ENGLISH)
        fake_audio = tmp_path / "test.wav"
        fake_audio.write_bytes(b"fake")
        result = engine.transcribe(fake_audio, cfg)
        assert result.language == "en"

    def test_transcribe_bytes(self, engine):
        cfg = STTConfig()
        result = engine.transcribe_bytes(b"fake audio bytes", cfg)
        assert result.success is True


# ─── STTConfig 测试 ──────────────────────────────────────────────────────────

class TestSTTConfig:
    def test_default_config(self):
        cfg = STTConfig()
        assert cfg.engine == STTEngine.MOCK
        assert cfg.model == WhisperModel.BASE
        assert cfg.language == STTLanguage.AUTO
        assert cfg.vad_enabled is True

    def test_custom_config(self):
        cfg = STTConfig(
            model=WhisperModel.SMALL,
            language=STTLanguage.CHINESE,
            word_timestamps=True,
        )
        assert cfg.model == WhisperModel.SMALL
        assert cfg.language == STTLanguage.CHINESE
        assert cfg.word_timestamps is True


# ─── WhisperModel 枚举测试 ────────────────────────────────────────────────────

class TestWhisperModel:
    def test_all_models_defined(self):
        expected = {"tiny", "base", "small", "medium", "large"}
        actual = {m.value for m in WhisperModel}
        assert actual == expected


# ─── STTManager 测试 ─────────────────────────────────────────────────────────

class TestSTTManager:
    @pytest.fixture
    def manager(self, tmp_path, monkeypatch):
        import openagi.companion.stt as stt_module
        monkeypatch.setattr(stt_module, "_CACHE_DIR", tmp_path)
        return STTManager()

    def test_default_config(self, manager):
        assert manager.config.engine == STTEngine.MOCK

    def test_set_model(self, manager):
        manager.set_model(WhisperModel.SMALL)
        assert manager.config.model == WhisperModel.SMALL

    def test_set_language(self, manager):
        manager.set_language(STTLanguage.CHINESE)
        assert manager.config.language == STTLanguage.CHINESE

    def test_transcribe_mock(self, manager, tmp_path):
        fake_audio = tmp_path / "test.wav"
        fake_audio.write_bytes(b"fake")
        result = manager.transcribe(fake_audio)
        assert result.success is True

    def test_get_available_engines(self, manager):
        engines = manager.get_available_engines()
        assert "mock" in engines

    def test_get_model_info(self, manager):
        info = manager.get_model_info()
        assert "tiny" in info
        assert "large" in info
        for model_info in info.values():
            assert "approx_size_mb" in model_info
            assert "speed" in model_info
            assert "accuracy" in model_info
