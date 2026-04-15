"""
tests/companion/test_avatar.py — 形象管理器测试
"""
from __future__ import annotations

import json
import time
import pytest
from pathlib import Path

from openagi.companion.avatar import (
    AvatarManager,
    AvatarConfig,
    AvatarType,
    SelfieConfig,
    SelfieMode,
    Live2DConfig,
    VRMConfig,
    UploadResult,
)


# ─── 测试固件 ────────────────────────────────────────────────────────────────

@pytest.fixture
def patched_manager(tmp_path, monkeypatch):
    """创建使用临时路径的AvatarManager，避免污染用户数据。"""
    import openagi.companion.avatar as av_module
    upload_dir = tmp_path / "uploads"
    selfie_dir = tmp_path / "selfies"
    live2d_dir = tmp_path / "live2d"
    vrm_dir    = tmp_path / "vrm"
    config_file = tmp_path / "avatar_config.json"

    for d in [upload_dir, selfie_dir, live2d_dir, vrm_dir]:
        d.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(av_module, "_AVATAR_DIR",  tmp_path)
    monkeypatch.setattr(av_module, "_UPLOAD_DIR",  upload_dir)
    monkeypatch.setattr(av_module, "_SELFIE_DIR",  selfie_dir)
    monkeypatch.setattr(av_module, "_LIVE2D_DIR",  live2d_dir)
    monkeypatch.setattr(av_module, "_VRM_DIR",     vrm_dir)
    monkeypatch.setattr(av_module, "_CONFIG_FILE", config_file)

    return AvatarManager()


# ─── AvatarConfig 序列化测试 ──────────────────────────────────────────────────

class TestAvatarConfigSerialization:
    def test_to_dict_avatar_type_is_string(self):
        cfg = AvatarConfig(avatar_type=AvatarType.LIVE2D)
        d = cfg.to_dict()
        assert d["avatar_type"] == "live2d"

    def test_from_dict_roundtrip(self):
        cfg = AvatarConfig(avatar_type=AvatarType.VRM)
        cfg.selfie.enabled = True
        cfg.selfie.mode = SelfieMode.PERIODIC
        restored = AvatarConfig.from_dict(cfg.to_dict())
        assert restored.avatar_type == AvatarType.VRM
        assert restored.selfie.enabled is True
        assert restored.selfie.mode == SelfieMode.PERIODIC


# ─── AvatarManager 基础测试 ───────────────────────────────────────────────────

class TestAvatarManager:
    def test_default_type_is_static(self, patched_manager):
        assert patched_manager.avatar_type == AvatarType.STATIC

    def test_current_avatar_path_none_when_not_set(self, patched_manager):
        # 默认没有设置头像
        assert patched_manager.current_avatar_path is None

    def test_switch_avatar_type(self, patched_manager):
        patched_manager.switch_avatar(AvatarType.LIVE2D)
        assert patched_manager.avatar_type == AvatarType.LIVE2D

    def test_get_status_keys(self, patched_manager):
        status = patched_manager.get_status()
        expected = {"avatar_type", "display_name", "current_avatar", "total_avatars",
                    "selfie_enabled", "selfie_mode", "live2d_model", "vrm_model", "updated_at"}
        assert expected.issubset(set(status.keys()))


# ─── 静态头像上传测试 ─────────────────────────────────────────────────────────

class TestStaticAvatarUpload:
    @pytest.fixture
    def fake_png(self, tmp_path):
        """创建一个假PNG文件。"""
        p = tmp_path / "test_avatar.png"
        # PNG文件头
        p.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
        return p

    def test_upload_valid_png(self, patched_manager, fake_png):
        result = patched_manager.upload_static_avatar(fake_png)
        assert result.success is True
        assert result.avatar_type == AvatarType.STATIC
        assert result.saved_path is not None
        assert Path(result.saved_path).exists()

    def test_upload_sets_current_avatar(self, patched_manager, fake_png):
        patched_manager.upload_static_avatar(fake_png)
        assert patched_manager.config.current_avatar_path != ""
        assert patched_manager.current_avatar_path is not None

    def test_upload_adds_to_list(self, patched_manager, fake_png):
        patched_manager.upload_static_avatar(fake_png)
        assert len(patched_manager.config.static_avatar_paths) >= 1

    def test_upload_invalid_format(self, patched_manager, tmp_path):
        bad_file = tmp_path / "test.mp4"
        bad_file.write_bytes(b"fake video")
        result = patched_manager.upload_static_avatar(bad_file)
        assert result.success is False
        assert result.error is not None

    def test_upload_nonexistent_file(self, patched_manager, tmp_path):
        result = patched_manager.upload_static_avatar(tmp_path / "not_exist.png")
        assert result.success is False

    def test_upload_multiple_avatars(self, patched_manager, tmp_path):
        import time
        for i in range(3):
            p = tmp_path / f"source_avatar_{i}.jpg"
            p.write_bytes(b"\xff\xd8\xff" + b"\x00" * 50)
            patched_manager.upload_static_avatar(p)
            time.sleep(0.002)  # 确保毫秒级时间戳不同
        assert len(patched_manager.config.static_avatar_paths) == 3

    def test_list_uploaded_avatars(self, patched_manager, fake_png):
        patched_manager.upload_static_avatar(fake_png)
        avatars = patched_manager.list_uploaded_avatars()
        assert len(avatars) >= 1
        first = avatars[0]
        assert "path" in first
        assert "is_current" in first
        assert "size_kb" in first


# ─── AI自拍配置测试 ──────────────────────────────────────────────────────────

class TestSelfieConfig:
    def test_configure_selfie_enable(self, patched_manager):
        patched_manager.configure_selfie(enabled=True, mode=SelfieMode.PERIODIC)
        assert patched_manager.config.selfie.enabled is True
        assert patched_manager.config.selfie.mode == SelfieMode.PERIODIC

    def test_configure_selfie_style_prompt(self, patched_manager):
        custom_prompt = "油画风格，古典美人"
        patched_manager.configure_selfie(style_prompt=custom_prompt)
        assert patched_manager.config.selfie.style_prompt == custom_prompt

    def test_get_selfie_prompt_keys(self, patched_manager):
        prompt_cfg = patched_manager.get_selfie_prompt()
        assert "prompt" in prompt_cfg
        assert "negative_prompt" in prompt_cfg
        assert "width" in prompt_cfg
        assert "height" in prompt_cfg

    def test_should_generate_selfie_disabled(self, patched_manager):
        patched_manager.configure_selfie(enabled=False)
        patched_manager.switch_avatar(AvatarType.SELFIE)
        assert patched_manager.should_generate_selfie() is False

    def test_should_generate_selfie_wrong_type(self, patched_manager):
        patched_manager.configure_selfie(enabled=True, mode=SelfieMode.PERIODIC)
        patched_manager.switch_avatar(AvatarType.STATIC)
        assert patched_manager.should_generate_selfie() is False

    def test_should_generate_selfie_periodic(self, patched_manager):
        patched_manager.configure_selfie(enabled=True, mode=SelfieMode.PERIODIC, periodic_hours=1)
        patched_manager.switch_avatar(AvatarType.SELFIE)
        patched_manager._last_selfie_at = 0.0  # 很久之前
        assert patched_manager.should_generate_selfie() is True

    def test_should_generate_selfie_mood_change(self, patched_manager):
        patched_manager.configure_selfie(enabled=True, mode=SelfieMode.ON_MOOD_CHANGE)
        patched_manager.switch_avatar(AvatarType.SELFIE)
        patched_manager._last_entropy = 0.2
        # 熵值变化超过0.2阈值
        assert patched_manager.should_generate_selfie(current_entropy=0.8) is True

    def test_record_selfie_generated(self, patched_manager, tmp_path):
        import openagi.companion.avatar as av_module
        monkeypatch_path = tmp_path / "selfies" / "selfie_test.png"
        monkeypatch_path.parent.mkdir(exist_ok=True)
        monkeypatch_path.write_bytes(b"fake img")

        patched_manager.record_selfie_generated(monkeypatch_path)
        assert patched_manager._last_selfie_at > 0


# ─── 持久化测试 ──────────────────────────────────────────────────────────────

class TestAvatarPersistence:
    def test_save_and_reload(self, patched_manager, tmp_path, monkeypatch):
        import openagi.companion.avatar as av_module
        monkeypatch.setattr(av_module, "_AVATAR_DIR", tmp_path)
        monkeypatch.setattr(av_module, "_UPLOAD_DIR", tmp_path / "uploads")
        monkeypatch.setattr(av_module, "_SELFIE_DIR", tmp_path / "selfies")
        monkeypatch.setattr(av_module, "_LIVE2D_DIR", tmp_path / "live2d")
        monkeypatch.setattr(av_module, "_VRM_DIR",    tmp_path / "vrm")
        config_file = tmp_path / "avatar_config.json"
        monkeypatch.setattr(av_module, "_CONFIG_FILE", config_file)
        for d in ["uploads", "selfies", "live2d", "vrm"]:
            (tmp_path / d).mkdir(exist_ok=True)

        patched_manager.config.display_name = "测试AI"
        patched_manager.configure_selfie(enabled=True)
        patched_manager.save()

        mgr2 = AvatarManager()
        assert mgr2.config.display_name == "测试AI"
        assert mgr2.config.selfie.enabled is True
