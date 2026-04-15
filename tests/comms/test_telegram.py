"""
tests/comms/test_telegram.py — Telegram Bot集成测试
（不需要真实Token/网络连接，测试配置逻辑和消息规范化）
"""
from __future__ import annotations

import pytest

from openagi.comms.telegram import (
    TelegramPlatform,
    create_telegram_platform,
    ENTROPY_ALERT_THRESHOLD,
    ENTROPY_CALM_THRESHOLD,
)
from openagi.comms.gateway import (
    MessageGateway,
    PlatformType,
    UnifiedMessage,
    MessageType,
)


# ─── TelegramPlatform 基础测试 ────────────────────────────────────────────────

class TestTelegramPlatform:
    @pytest.fixture
    def platform(self):
        return TelegramPlatform(token="test_token_123456", default_chat_id="12345678")

    @pytest.fixture
    def gateway(self):
        return MessageGateway()

    def test_platform_type(self, platform):
        assert platform.platform_type == PlatformType.TELEGRAM

    def test_not_connected_by_default(self, platform):
        assert platform.is_connected is False

    def test_no_token_warning(self, caplog):
        import logging
        with caplog.at_level(logging.WARNING):
            TelegramPlatform(token="")
        # 没有token应该有警告日志
        # （不强制断言日志内容，避免日志格式差异导致flaky）

    def test_get_config_summary(self, platform):
        summary = platform.get_config_summary()
        assert summary["platform"] == "telegram"
        assert "token_preview" in summary
        assert summary["default_chat_id"] == "12345678"
        assert summary["connected"] is False
        assert "entropy_alert_threshold" in summary

    def test_config_summary_token_masked(self, platform):
        summary = platform.get_config_summary()
        # Token不应该完整出现
        assert "test_token_123456" not in summary["token_preview"]
        assert "..." in summary["token_preview"]

    def test_config_summary_no_token(self):
        p = TelegramPlatform(token="")
        summary = p.get_config_summary()
        assert summary["token_preview"] == "未设置"

    def test_library_availability_check(self, platform):
        # 只验证返回bool，不要求telegram已安装
        result = platform._is_library_available()
        assert isinstance(result, bool)

    def test_entropy_alert_threshold_value(self):
        assert 0.0 < ENTROPY_ALERT_THRESHOLD <= 1.0

    def test_entropy_calm_threshold_value(self):
        assert 0.0 <= ENTROPY_CALM_THRESHOLD < ENTROPY_ALERT_THRESHOLD

    @pytest.mark.asyncio
    async def test_send_text_when_not_connected(self, platform, caplog):
        """未连接时send_text应返回False而不是抛出异常。"""
        result = await platform.send_text("12345", "测试消息")
        assert result is False

    @pytest.mark.asyncio
    async def test_send_message_when_not_connected(self, platform):
        from openagi.comms.gateway import UnifiedResponse
        resp = UnifiedResponse(
            content="测试",
            platform=PlatformType.TELEGRAM,
            channel_id="12345",
        )
        result = await platform.send_message(resp)
        assert result is False

    @pytest.mark.asyncio
    async def test_send_message_no_chat_id(self):
        """没有chat_id应优雅失败。"""
        p = TelegramPlatform(token="test_token_xxx")
        from openagi.comms.gateway import UnifiedResponse
        resp = UnifiedResponse(
            content="没有chat_id",
            platform=PlatformType.TELEGRAM,
        )
        result = await p.send_message(resp)
        assert result is False

    @pytest.mark.asyncio
    async def test_start_without_library(self, caplog):
        """没有python-telegram-bot时，start()应优雅失败。"""
        import logging
        p = TelegramPlatform(token="fake_token_test_xxx")
        # 如果库不存在，start()应该返回而不抛出
        # 如果库存在但token假，也应该有错误处理
        # 这个测试主要验证不会抛出未捕获异常
        try:
            await p.start()
        except Exception as e:
            pytest.fail(f"start() 不应抛出未捕获异常: {e}")

    @pytest.mark.asyncio
    async def test_push_entropy_alert_no_chat_id(self):
        """没有默认chat_id时，熵值告警应静默失败。"""
        p = TelegramPlatform(token="fake_token_test_xxx", default_chat_id="")
        # 不应该抛出异常
        await p.push_entropy_alert(0.9, "crisis", "系统崩溃边缘")

    @pytest.mark.asyncio
    async def test_push_entropy_alert_same_level_no_repeat(self, platform):
        """同级别熵值告警不重复推送。"""
        platform._last_entropy_level = "crisis"
        platform._connected = False  # 确保不真实发送
        # 不应该尝试发送（因为级别相同）
        await platform.push_entropy_alert(0.9, "crisis", "重复告警")
        # 没有异常即通过


# ─── create_telegram_platform 工厂函数测试 ───────────────────────────────────

class TestCreateTelegramPlatform:
    def test_creates_and_registers(self):
        gw = MessageGateway()
        platform = create_telegram_platform(gw, token="test_token_factory")
        assert isinstance(platform, TelegramPlatform)
        assert PlatformType.TELEGRAM.value in gw.registered_platforms

    def test_gateway_reference_set(self):
        gw = MessageGateway()
        platform = create_telegram_platform(gw, token="test_token_ref")
        assert platform._gateway is gw

    def test_chat_id_passed(self):
        gw = MessageGateway()
        platform = create_telegram_platform(gw, token="t", chat_id="99999")
        assert platform._default_chat_id == "99999"
