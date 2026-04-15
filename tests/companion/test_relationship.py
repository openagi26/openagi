"""
tests/companion/test_relationship.py — 关系模式引擎测试
"""
from __future__ import annotations

import time
import pytest

from openagi.companion.relationship import (
    RelationshipEngine,
    RelationshipMode,
    RelationshipConfig,
    AddressConfig,
    CareConfig,
    _intensity_to_desc,
)


# ─── _intensity_to_desc 测试 ─────────────────────────────────────────────────

class TestIntensityToDesc:
    def test_low_intensity(self):
        desc = _intensity_to_desc(5)
        assert "克制" in desc

    def test_mid_intensity(self):
        desc = _intensity_to_desc(50)
        assert desc  # 非空即可

    def test_high_intensity(self):
        desc = _intensity_to_desc(95)
        assert "温情" in desc or "热情" in desc

    def test_boundary_zero(self):
        assert _intensity_to_desc(0)

    def test_boundary_hundred(self):
        assert _intensity_to_desc(100)


# ─── RelationshipEngine 测试 ─────────────────────────────────────────────────

class TestRelationshipEngine:
    """使用临时配置路径，避免污染真实用户配置。"""

    @pytest.fixture
    def engine(self, tmp_path, monkeypatch):
        """创建使用临时路径的RelationshipEngine。"""
        # 注入临时配置目录
        import openagi.companion.relationship as rel_module
        monkeypatch.setattr(rel_module, "_DATA_DIR", tmp_path)
        monkeypatch.setattr(rel_module.RelationshipEngine, "_CONFIG_FILE", tmp_path / "relationship.json")
        return RelationshipEngine()

    def test_default_mode_is_professional(self, engine):
        assert engine.mode == RelationshipMode.PROFESSIONAL

    def test_switch_to_friend_mode(self, engine):
        cfg = engine.switch_mode(RelationshipMode.FRIEND)
        assert cfg.mode == RelationshipMode.FRIEND
        assert engine.mode == RelationshipMode.FRIEND

    def test_switch_mode_updates_intensity(self, engine):
        engine.switch_mode(RelationshipMode.PARTNER)
        # 伴侣模式默认强度 > 朋友模式
        partner_intensity = engine.emotion_intensity
        engine.switch_mode(RelationshipMode.PROFESSIONAL)
        prof_intensity = engine.emotion_intensity
        assert partner_intensity > prof_intensity

    def test_set_emotion_intensity_clamped(self, engine):
        engine.set_emotion_intensity(150)
        assert engine.emotion_intensity == 100
        engine.set_emotion_intensity(-10)
        assert engine.emotion_intensity == 0

    def test_set_emotion_intensity_normal(self, engine):
        engine.set_emotion_intensity(75)
        assert engine.emotion_intensity == 75

    def test_build_system_prompt_contains_ai_name(self, engine):
        engine.switch_mode(RelationshipMode.FRIEND)
        prompt = engine.build_system_prompt()
        assert engine.config.address.ai_display_name in prompt

    def test_build_system_prompt_contains_address(self, engine):
        engine.switch_mode(RelationshipMode.PARTNER)
        prompt = engine.build_system_prompt()
        assert engine.config.address.ai_calls_user in prompt

    def test_build_system_prompt_with_extra_context(self, engine):
        prompt = engine.build_system_prompt(extra_context="熵值=0.42")
        assert "熵值=0.42" in prompt

    def test_custom_mode_with_instructions(self, engine):
        engine.switch_mode(
            RelationshipMode.CUSTOM,
            custom_instructions="专门负责代码审查，语气严格专业。",
        )
        prompt = engine.build_system_prompt()
        assert "代码审查" in prompt

    def test_set_address(self, engine):
        engine.set_address(ai_calls_user="陛下")
        assert engine.config.address.ai_calls_user == "陛下"

    def test_care_config_professional_disabled(self, engine):
        engine.switch_mode(RelationshipMode.PROFESSIONAL)
        assert engine.config.care.enabled is False

    def test_care_config_partner_enabled(self, engine):
        engine.switch_mode(RelationshipMode.PARTNER)
        assert engine.config.care.enabled is True

    def test_should_send_care_disabled(self, engine):
        engine.switch_mode(RelationshipMode.PROFESSIONAL)
        # 专业模式关心关闭
        assert engine.should_send_care(current_entropy=0.5) is False

    def test_should_send_care_entropy_trigger(self, engine):
        engine.switch_mode(RelationshipMode.PARTNER)
        # 强制清零last_care时间（确保不受间隔限制）
        engine._last_care_sent_at = 0.0
        # 熵值超过触发阈值
        assert engine.should_send_care(current_entropy=0.99) is True

    def test_should_send_care_by_interval(self, engine):
        engine.switch_mode(RelationshipMode.FRIEND)
        # 模拟上次关心发生在很久之前
        engine._last_care_sent_at = time.time() - 99999
        assert engine.should_send_care(current_entropy=0.1) is True

    def test_get_care_message_not_empty(self, engine):
        engine.switch_mode(RelationshipMode.BESTIE)
        msg = engine.get_care_message()
        assert isinstance(msg, str) and len(msg) > 0

    def test_get_care_message_fallback(self, engine):
        """当模板列表为空时不崩溃。"""
        engine.config.care.message_templates = []
        msg = engine.get_care_message()
        assert isinstance(msg, str) and len(msg) > 0

    def test_record_user_message_updates_time(self, engine):
        before = engine._last_user_message_at
        time.sleep(0.01)
        engine.record_user_message()
        assert engine._last_user_message_at >= before

    def test_get_status_keys(self, engine):
        status = engine.get_status()
        expected_keys = {"mode", "emotion_intensity", "ai_display_name", "ai_calls_user", "care_enabled", "updated_at"}
        assert expected_keys.issubset(set(status.keys()))

    def test_save_and_reload(self, engine, tmp_path, monkeypatch):
        """测试配置持久化后可以正确重载。"""
        import openagi.companion.relationship as rel_module
        monkeypatch.setattr(rel_module, "_DATA_DIR", tmp_path)
        monkeypatch.setattr(rel_module.RelationshipEngine, "_CONFIG_FILE", tmp_path / "relationship.json")

        engine.switch_mode(RelationshipMode.BESTIE)
        engine.set_emotion_intensity(88)
        engine.save()

        # 重新加载
        engine2 = RelationshipEngine()
        assert engine2.mode == RelationshipMode.BESTIE
        assert engine2.emotion_intensity == 88

    def test_all_modes_produce_prompt(self, engine):
        """所有模式都能生成非空prompt。"""
        for mode in RelationshipMode:
            engine.switch_mode(mode)
            prompt = engine.build_system_prompt()
            assert prompt, f"模式 {mode.value} 生成了空prompt"
