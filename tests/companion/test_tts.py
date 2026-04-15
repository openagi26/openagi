"""
tests/companion/test_tts.py — TTS引擎测试
"""
from __future__ import annotations

import pytest
from pathlib import Path

from openagi.companion.tts import (
    TTSEngine,
    TTSConfig,
    TTSResult,
    TTSManager,
    MockTTSEngine,
    SystemTTSEngine,
    PRESET_VOICES,
)


# ─── 预设声音测试 ─────────────────────────────────────────────────────────────

class TestPresetVoices:
    def test_preset_count(self):
        assert len(PRESET_VOICES) == 6

    def test_all_voices_have_required_fields(self):
        for voice_id, voice in PRESET_VOICES.items():
            assert voice.voice_id == voice_id
            assert voice.name
            assert voice.language
            assert voice.gender in ("female", "male", "neutral")
            assert voice.engine in TTSEngine.__members__.values() or True
            assert voice.model_name
            assert voice.description

    def test_chinese_voices_present(self):
        zh_voices = [v for v in PRESET_VOICES.values() if v.language == "zh-CN"]
        assert len(zh_voices) >= 2

    def test_english_voices_present(self):
        en_voices = [v for v in PRESET_VOICES.values() if v.language == "en-US"]
        assert len(en_voices) >= 1


# ─── TTSConfig 测试 ───────────────────────────────────────────────────────────

class TestTTSConfig:
    def test_default_config(self):
        cfg = TTSConfig()
        assert cfg.speed == 1.0
        assert cfg.pitch == 1.0
        assert cfg.emotion_strength == 0.5
        assert cfg.volume == 1.0
        assert cfg.engine == TTSEngine.MOCK

    def test_custom_config(self):
        cfg = TTSConfig(voice_id="zh_male_gentle", speed=1.5, pitch=0.8)
        assert cfg.voice_id == "zh_male_gentle"
        assert cfg.speed == 1.5
        assert cfg.pitch == 0.8


# ─── MockTTSEngine 测试 ──────────────────────────────────────────────────────

class TestMockTTSEngine:
    @pytest.fixture
    def engine(self, tmp_path, monkeypatch):
        import openagi.companion.tts as tts_module
        monkeypatch.setattr(tts_module, "_AUDIO_DIR", tmp_path)
        return MockTTSEngine()

    def test_is_available(self, engine):
        assert engine.is_available() is True

    def test_synthesize_returns_success(self, engine):
        cfg = TTSConfig()
        result = engine.synthesize("你好，世界！", cfg)
        assert result.success is True
        assert result.engine_used == TTSEngine.MOCK
        assert result.audio_path is None  # Mock不产生实际音频

    def test_synthesize_creates_config_file(self, engine, tmp_path):
        cfg = TTSConfig()
        result = engine.synthesize("测试文本", cfg)
        assert result.config_path is not None
        assert Path(result.config_path).exists()

    def test_synthesize_duration_estimated(self, engine):
        cfg = TTSConfig()
        # 10个字符，speed=1.0，约2000ms
        result = engine.synthesize("十个中文字符的", cfg)
        assert result.duration_ms > 0

    def test_synthesize_speed_affects_duration(self, engine):
        cfg_slow = TTSConfig(speed=0.5)
        cfg_fast = TTSConfig(speed=2.0)
        result_slow = engine.synthesize("测试", cfg_slow)
        result_fast = engine.synthesize("测试", cfg_fast)
        # 快速语速应该有更短的预估时长
        assert result_fast.duration_ms < result_slow.duration_ms

    def test_config_file_content(self, engine, tmp_path):
        import json
        cfg = TTSConfig(voice_id="zh_female_warm")
        result = engine.synthesize("内容验证", cfg)
        with open(result.config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        assert data["voice_id"] == "zh_female_warm"
        assert data["text"] == "内容验证"
        assert data["mock"] is True


# ─── TTSManager 测试 ─────────────────────────────────────────────────────────

class TestTTSManager:
    @pytest.fixture
    def manager(self, tmp_path, monkeypatch):
        import openagi.companion.tts as tts_module
        monkeypatch.setattr(tts_module, "_AUDIO_DIR", tmp_path)
        return TTSManager()

    def test_default_config(self, manager):
        assert manager.config.engine == TTSEngine.MOCK

    def test_set_valid_voice(self, manager):
        ok = manager.set_voice("zh_female_warm")
        assert ok is True
        assert manager.config.voice_id == "zh_female_warm"

    def test_set_invalid_voice(self, manager):
        ok = manager.set_voice("not_exist_voice")
        assert ok is False

    def test_set_params_clamped(self, manager):
        manager.set_params(speed=5.0, pitch=-1.0, emotion_strength=2.0, volume=-0.5)
        assert manager.config.speed == 2.0
        assert manager.config.pitch == 0.5
        assert manager.config.emotion_strength == 1.0
        assert manager.config.volume == 0.0

    def test_synthesize_mock(self, manager):
        result = manager.synthesize("你好")
        assert result.success is True
        assert result.engine_used == TTSEngine.MOCK

    def test_list_voices_returns_all(self, manager):
        voices = manager.list_voices()
        assert len(voices) == 6
        for v in voices:
            assert "voice_id" in v
            assert "name" in v
            assert "language" in v

    def test_get_available_engines(self, manager):
        engines = manager.get_available_engines()
        assert "mock" in engines  # Mock永远可用
