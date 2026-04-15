"""
tests/tools/test_cdp.py — CDP（Chrome调试协议）客户端测试
"""

from __future__ import annotations

import asyncio
import json
import pytest

from openagi.tools.browser.cdp import CDPClient


# ─── check_chrome_running 测试 ────────────────────────────────────────────────

def test_check_chrome_not_running():
    """Chrome 未运行时应返回 False。"""
    # 使用一个不可能被占用的端口
    assert CDPClient.check_chrome_running(host="127.0.0.1", port=19999) is False


def test_check_chrome_invalid_host():
    """无效主机名应返回 False，不抛出异常。"""
    result = CDPClient.check_chrome_running(host="invalid.host.that.does.not.exist", port=9222)
    assert result is False


# ─── is_connected 测试 ────────────────────────────────────────────────────────

def test_is_connected_initially_false():
    """未调用 connect 时，is_connected 应为 False。"""
    client = CDPClient()
    assert client.is_connected() is False


def test_is_connected_after_manual_ws_close():
    """_ws 为 None 时，is_connected 返回 False。"""
    client = CDPClient()
    client._ws = None
    assert client.is_connected() is False


# ─── connect 失败测试 ────────────────────────────────────────────────────────

async def test_connect_fails_without_chrome():
    """没有 Chrome 时，connect 应返回 False（不抛出异常）。"""
    client = CDPClient(port=19998)  # 使用不存在的端口
    result = await client.connect(timeout=2.0)
    assert result is False
    assert client.is_connected() is False


# ─── disconnect 幂等性测试 ──────────────────────────────────────────────────

async def test_disconnect_when_not_connected():
    """未连接时调用 disconnect 不应抛出异常。"""
    client = CDPClient()
    await client.disconnect()  # 应该正常返回
    assert client.is_connected() is False


# ─── _send_command 未连接时的错误 ────────────────────────────────────────────

async def test_send_command_raises_when_not_connected():
    """未连接时调用 _send_command 应抛出 ConnectionError。"""
    client = CDPClient()
    with pytest.raises(ConnectionError, match="未连接"):
        await client._send_command("Page.navigate", {"url": "https://example.com"})


# ─── 上下文管理器测试 ────────────────────────────────────────────────────────

async def test_context_manager_no_chrome():
    """即使 Chrome 不可用，上下文管理器也不应抛出异常。"""
    async with CDPClient(port=19997) as client:
        assert client.is_connected() is False


# ─── _get_ws_url 测试 ────────────────────────────────────────────────────────

def test_get_ws_url_no_chrome():
    """Chrome 不可用时，_get_ws_url 应返回 None。"""
    client = CDPClient(port=19996)
    result = client._get_ws_url()
    assert result is None


# ─── 初始化参数测试 ──────────────────────────────────────────────────────────

def test_custom_host_port():
    """自定义主机和端口应正确存储。"""
    client = CDPClient(host="192.168.1.100", port=9333)
    assert client.host == "192.168.1.100"
    assert client.port == 9333


def test_default_host_port():
    """默认主机和端口值应正确。"""
    client = CDPClient()
    assert client.host == "localhost"
    assert client.port == 9222
    assert client._cmd_id == 0
    assert len(client._pending) == 0
