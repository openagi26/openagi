"""
tests/comms/test_gateway.py — 消息网关测试
"""
from __future__ import annotations

import asyncio
import pytest
from typing import Optional
from datetime import datetime, timezone

from openagi.comms.gateway import (
    MessageGateway,
    MessageType,
    Platform,
    PlatformType,
    UnifiedMessage,
    UnifiedResponse,
    GatewayStats,
)


# ─── 测试辅助：Mock平台 ───────────────────────────────────────────────────────

class MockPlatform(Platform):
    """用于测试的Mock平台实现。"""

    def __init__(self, platform_type: PlatformType = PlatformType.CLI):
        self._platform_type = platform_type
        self._connected = False
        self.sent_messages: list[UnifiedResponse] = []
        self.sent_texts: list[tuple[str, str]] = []

    @property
    def platform_type(self) -> PlatformType:
        return self._platform_type

    @property
    def is_connected(self) -> bool:
        return self._connected

    async def start(self) -> None:
        self._connected = True

    async def stop(self) -> None:
        self._connected = False

    async def send_message(self, response: UnifiedResponse) -> bool:
        self.sent_messages.append(response)
        return True

    async def send_text(self, chat_id: str, text: str, **kwargs) -> bool:
        self.sent_texts.append((chat_id, text))
        return True


# ─── UnifiedMessage 测试 ─────────────────────────────────────────────────────

class TestUnifiedMessage:
    def test_is_command_true(self):
        msg = UnifiedMessage(
            sender_id="u1",
            sender_name="Test",
            content="/status",
            platform=PlatformType.CLI,
        )
        assert msg.is_command() is True

    def test_is_command_false(self):
        msg = UnifiedMessage(
            sender_id="u1",
            sender_name="Test",
            content="普通消息",
            platform=PlatformType.CLI,
        )
        assert msg.is_command() is False

    def test_get_command_no_args(self):
        msg = UnifiedMessage(
            sender_id="u1",
            sender_name="Test",
            content="/status",
            platform=PlatformType.CLI,
        )
        cmd, args = msg.get_command()
        assert cmd == "status"
        assert args == []

    def test_get_command_with_args(self):
        msg = UnifiedMessage(
            sender_id="u1",
            sender_name="Test",
            content="/heal arg1 arg2",
            platform=PlatformType.CLI,
        )
        cmd, args = msg.get_command()
        assert cmd == "heal"
        assert args == ["arg1", "arg2"]

    def test_get_command_uppercase_normalized(self):
        msg = UnifiedMessage(
            sender_id="u1",
            sender_name="Test",
            content="/STATUS",
            platform=PlatformType.CLI,
        )
        cmd, _ = msg.get_command()
        assert cmd == "status"

    def test_get_command_on_non_command(self):
        msg = UnifiedMessage(
            sender_id="u1",
            sender_name="Test",
            content="hello",
            platform=PlatformType.CLI,
        )
        cmd, args = msg.get_command()
        assert cmd == ""
        assert args == []

    def test_message_type_command(self):
        msg = UnifiedMessage(
            sender_id="u1",
            sender_name="Test",
            content="anything",
            platform=PlatformType.CLI,
            message_type=MessageType.COMMAND,
        )
        assert msg.is_command() is True

    def test_repr_preview(self):
        # 使用ASCII字符确保长度判断准确（中文字符len()返回字符数不是字节数）
        long_content = "a" * 50  # 50个ASCII字符，肯定超过40字符截断阈值
        msg = UnifiedMessage(
            sender_id="u1",
            sender_name="Test",
            content=long_content,
            platform=PlatformType.CLI,
        )
        repr_str = repr(msg)
        assert "cli" in repr_str
        assert "..." in repr_str


# ─── MessageGateway 测试 ─────────────────────────────────────────────────────

class TestMessageGateway:
    @pytest.fixture
    def gateway(self):
        return MessageGateway()

    @pytest.fixture
    def mock_platform(self):
        return MockPlatform(PlatformType.CLI)

    def test_register_platform(self, gateway, mock_platform):
        gateway.register_platform(mock_platform)
        assert PlatformType.CLI.value in gateway.registered_platforms

    def test_unregister_platform(self, gateway, mock_platform):
        gateway.register_platform(mock_platform)
        gateway.unregister_platform(PlatformType.CLI)
        assert PlatformType.CLI.value not in gateway.registered_platforms

    def test_get_platform(self, gateway, mock_platform):
        gateway.register_platform(mock_platform)
        p = gateway.get_platform(PlatformType.CLI)
        assert p is mock_platform

    def test_get_nonexistent_platform(self, gateway):
        assert gateway.get_platform(PlatformType.DISCORD) is None

    @pytest.mark.asyncio
    async def test_command_handler_registration(self, gateway):
        @gateway.on_command("test_cmd")
        async def handler(msg: UnifiedMessage) -> Optional[str]:
            return "命令已处理"

        assert "test_cmd" in gateway._command_handlers

    @pytest.mark.asyncio
    async def test_command_routing(self, gateway, mock_platform):
        gateway.register_platform(mock_platform)
        await mock_platform.start()

        results = []

        @gateway.on_command("ping")
        async def handle_ping(msg: UnifiedMessage) -> str:
            results.append("ping_called")
            return "pong"

        msg = UnifiedMessage(
            sender_id="u1",
            sender_name="Test",
            content="/ping",
            platform=PlatformType.CLI,
            channel_id="ch1",
        )
        await gateway._process_message(msg)
        assert "ping_called" in results
        assert len(mock_platform.sent_messages) == 1
        assert mock_platform.sent_messages[0].content == "pong"

    @pytest.mark.asyncio
    async def test_unknown_command_returns_error_message(self, gateway, mock_platform):
        gateway.register_platform(mock_platform)
        await mock_platform.start()

        msg = UnifiedMessage(
            sender_id="u1",
            sender_name="Test",
            content="/unknown_cmd_xyz",
            platform=PlatformType.CLI,
            channel_id="ch1",
        )
        await gateway._process_message(msg)
        assert len(mock_platform.sent_messages) == 1
        assert "未知命令" in mock_platform.sent_messages[0].content

    @pytest.mark.asyncio
    async def test_default_handler(self, gateway, mock_platform):
        gateway.register_platform(mock_platform)
        await mock_platform.start()

        async def default_h(msg: UnifiedMessage) -> str:
            return f"你说: {msg.content}"

        gateway.set_default_handler(default_h)

        msg = UnifiedMessage(
            sender_id="u1",
            sender_name="Test",
            content="普通消息",
            platform=PlatformType.CLI,
            channel_id="ch1",
        )
        await gateway._process_message(msg)
        assert "你说: 普通消息" in mock_platform.sent_messages[0].content

    @pytest.mark.asyncio
    async def test_no_reply_when_requires_reply_false(self, gateway, mock_platform):
        gateway.register_platform(mock_platform)
        await mock_platform.start()

        async def h(msg: UnifiedMessage) -> str:
            return "应该不发送"

        gateway.set_default_handler(h)

        msg = UnifiedMessage(
            sender_id="u1",
            sender_name="Test",
            content="无回复消息",
            platform=PlatformType.CLI,
            requires_reply=False,
        )
        await gateway._process_message(msg)
        assert len(mock_platform.sent_messages) == 0

    @pytest.mark.asyncio
    async def test_receive_increments_stats(self, gateway):
        msg = UnifiedMessage(
            sender_id="u1",
            sender_name="Test",
            content="test",
            platform=PlatformType.CLI,
        )
        await gateway.receive(msg)
        assert gateway._stats.total_received == 1

    @pytest.mark.asyncio
    async def test_command_stats(self, gateway):
        msg = UnifiedMessage(
            sender_id="u1",
            sender_name="Test",
            content="/status",
            platform=PlatformType.CLI,
        )
        await gateway.receive(msg)
        assert gateway._stats.total_commands == 1

    @pytest.mark.asyncio
    async def test_broadcast_to_all_platforms(self, gateway):
        p1 = MockPlatform(PlatformType.CLI)
        p2 = MockPlatform(PlatformType.WEB)
        await p1.start()
        await p2.start()
        gateway.register_platform(p1)
        gateway.register_platform(p2)

        results = await gateway.broadcast("广播消息", channel_id="ch1")
        assert results.get("cli") is True
        assert results.get("web") is True

    @pytest.mark.asyncio
    async def test_broadcast_to_specific_platform(self, gateway):
        p1 = MockPlatform(PlatformType.CLI)
        p2 = MockPlatform(PlatformType.WEB)
        await p1.start()
        await p2.start()
        gateway.register_platform(p1)
        gateway.register_platform(p2)

        await gateway.broadcast("仅CLI消息", platform_types=[PlatformType.CLI], channel_id="ch1")
        assert len(p1.sent_texts) == 1
        assert len(p2.sent_texts) == 0

    @pytest.mark.asyncio
    async def test_gateway_lifecycle(self, gateway, mock_platform):
        gateway.register_platform(mock_platform)
        await gateway.start()
        assert gateway._running is True
        assert mock_platform.is_connected is True

        await gateway.stop()
        assert gateway._running is False

    def test_get_stats_keys(self, gateway):
        stats = gateway.get_stats()
        expected = {"total_received", "total_sent", "total_errors", "total_commands",
                    "uptime_seconds", "platforms", "commands_registered", "queue_size", "running"}
        assert expected.issubset(set(stats.keys()))

    @pytest.mark.asyncio
    async def test_register_command_direct(self, gateway, mock_platform):
        gateway.register_platform(mock_platform)
        await mock_platform.start()

        async def handler(msg: UnifiedMessage) -> str:
            return "直接注册成功"

        gateway.register_command("direct_cmd", handler)
        msg = UnifiedMessage(
            sender_id="u1",
            sender_name="Test",
            content="/direct_cmd",
            platform=PlatformType.CLI,
            channel_id="ch1",
        )
        await gateway._process_message(msg)
        assert mock_platform.sent_messages[0].content == "直接注册成功"
