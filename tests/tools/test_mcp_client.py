"""
tests/tools/test_mcp_client.py — MCP（模型上下文协议）客户端测试
"""

from __future__ import annotations

import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from openagi.tools.mcp.client import (
    MCPClient,
    MCPServerConnection,
    MCPTool,
    MCPCallResult,
)


# ─── MCPTool 测试 ─────────────────────────────────────────────────────────────

def test_mcp_tool_to_dict():
    """MCPTool.to_dict 应返回正确结构。"""
    tool = MCPTool(
        name="read_file",
        description="读取文件内容",
        input_schema={"type": "object", "properties": {"path": {"type": "string"}}},
    )
    d = tool.to_dict()
    assert d["name"] == "read_file"
    assert d["description"] == "读取文件内容"
    assert "input_schema" in d


# ─── MCPCallResult 测试 ──────────────────────────────────────────────────────

def test_mcp_call_result_text_string():
    """content 为字符串时，text 应直接返回。"""
    result = MCPCallResult(tool_name="echo", success=True, content="Hello World")
    assert result.text == "Hello World"


def test_mcp_call_result_text_list():
    """content 为 [{type, text}] 格式时，text 应合并所有文本块。"""
    result = MCPCallResult(
        tool_name="search",
        success=True,
        content=[
            {"type": "text", "text": "第一部分"},
            {"type": "text", "text": "第二部分"},
        ],
    )
    assert "第一部分" in result.text
    assert "第二部分" in result.text


def test_mcp_call_result_text_empty():
    """content 为 None 时，text 应返回空字符串。"""
    result = MCPCallResult(tool_name="noop", success=True, content=None)
    assert result.text == ""


def test_mcp_call_result_failed():
    """失败结果的 success 应为 False，error 不为 None。"""
    result = MCPCallResult(
        tool_name="broken",
        success=False,
        error="工具执行失败",
    )
    assert result.success is False
    assert result.error == "工具执行失败"


# ─── MCPServerConnection 初始化测试 ──────────────────────────────────────────

def test_server_connection_initial_state():
    """新建连接应处于未连接状态。"""
    conn = MCPServerConnection(name="test", command=["echo", "hello"])
    assert conn.is_connected() is False
    assert conn.name == "test"
    assert conn.command == ["echo", "hello"]


def test_server_connection_with_env():
    """自定义环境变量应被存储。"""
    conn = MCPServerConnection(
        name="fs", command=["node", "server.js"],
        env={"HOME": "/tmp", "DEBUG": "1"},
    )
    assert conn.env["DEBUG"] == "1"
    assert conn.env["HOME"] == "/tmp"


# ─── 连接失败测试 ─────────────────────────────────────────────────────────────

async def test_connect_nonexistent_command():
    """不存在的命令应返回 False，不抛出异常。"""
    conn   = MCPServerConnection(name="ghost", command=["__nonexistent_command__"])
    result = await conn.connect(timeout=3.0)
    assert result is False
    assert conn.is_connected() is False


async def test_disconnect_when_not_connected():
    """未连接时调用 disconnect 不应抛出异常。"""
    conn = MCPServerConnection(name="idle", command=["echo"])
    await conn.disconnect()  # 不应抛出
    assert conn.is_connected() is False


# ─── ping 测试 ───────────────────────────────────────────────────────────────

async def test_ping_when_not_connected():
    """未连接时 ping 应返回 False。"""
    conn   = MCPServerConnection(name="idle", command=["echo"])
    result = await conn.ping(timeout=1.0)
    assert result is False


# ─── MCPClient 多服务器管理测试 ──────────────────────────────────────────────

def test_mcp_client_initial_state():
    """新建 MCPClient 应无任何服务器。"""
    client = MCPClient()
    assert client.list_servers() == []
    stats = client.get_stats()
    assert stats["total_servers"] == 0


async def test_add_server_failure():
    """添加无效命令的服务器应返回 False，服务器列表不增加。"""
    client = MCPClient()
    result = await client.add_server(
        name="bad", command=["__nonexistent__"], timeout=2.0
    )
    assert result is False
    assert len(client.list_servers()) == 0


async def test_remove_nonexistent_server():
    """移除不存在的服务器不应抛出异常。"""
    client = MCPClient()
    await client.remove_server("ghost")  # 不应抛出


async def test_call_tool_no_servers():
    """没有服务器时调用工具应返回失败结果。"""
    client = MCPClient()
    result = await client.call_tool("read_file", {"path": "/tmp/test.txt"})
    assert result.success is False
    assert "未找到工具" in result.error or "不存在" in result.error


async def test_call_tool_with_server_name_not_found():
    """指定不存在的服务器名称时应返回失败结果。"""
    client = MCPClient()
    result = await client.call_tool("tool", server_name="ghost_server")
    assert result.success is False
    assert "不存在" in result.error


# ─── health_check 测试 ───────────────────────────────────────────────────────

async def test_health_check_empty():
    """无服务器时健康检查应返回空字典。"""
    client = MCPClient()
    result = await client.health_check()
    assert result == {}


async def test_get_healthy_servers_empty():
    """无服务器时应返回空列表。"""
    client = MCPClient()
    result = await client.get_healthy_servers()
    assert result == []


# ─── get_stats 测试 ──────────────────────────────────────────────────────────

def test_get_stats_structure():
    """get_stats 应包含必要字段。"""
    client = MCPClient()
    stats  = client.get_stats()
    assert "total_servers"     in stats
    assert "connected_servers" in stats
    assert "disconnected"      in stats


# ─── list_all_tools 测试（Mock）──────────────────────────────────────────────

async def test_list_all_tools_empty():
    """无服务器时 list_all_tools 应返回空字典。"""
    client = MCPClient()
    result = await client.list_all_tools()
    assert result == {}


async def test_find_tool_not_found():
    """找不到工具时应返回 None。"""
    client = MCPClient()
    result = await client.find_tool("nonexistent_tool")
    assert result is None


# ─── 上下文管理器测试 ────────────────────────────────────────────────────────

async def test_context_manager():
    """上下文管理器应正常进入和退出，不抛出异常。"""
    async with MCPClient() as client:
        assert isinstance(client, MCPClient)
        assert client.list_servers() == []


# ─── _write_message 测试 ─────────────────────────────────────────────────────

async def test_write_message_without_writer():
    """_writer 为 None 时应抛出 ConnectionError。"""
    conn         = MCPServerConnection(name="test", command=["echo"])
    conn._writer = None
    with pytest.raises(ConnectionError):
        await conn._write_message({"jsonrpc": "2.0", "method": "ping", "params": {}})


# ─── _send_request 测试（Mock）───────────────────────────────────────────────

async def test_send_request_timeout():
    """请求超时时应抛出 TimeoutError。"""
    conn            = MCPServerConnection(name="slow", command=["sleep", "100"])
    conn._connected = True

    # Mock 一个永远不会完成的 Future（期约）
    loop           = asyncio.get_event_loop()
    never_done     = loop.create_future()
    mock_writer    = AsyncMock()
    conn._writer   = mock_writer

    with patch.object(conn, "_pending", {}):
        async def slow_send(payload: dict):
            # payload 是 dict，直接取 id
            msg_id = payload["id"]
            conn._pending[msg_id] = never_done

        mock_writer.write = MagicMock()
        mock_writer.drain = AsyncMock()

        with pytest.raises(TimeoutError, match="超时"):
            with patch.object(conn, "_write_message", new=slow_send):
                # 传入 0.5 秒短超时，让测试快速触发 TimeoutError（超时错误）
                await conn._send_request("slow_method", {}, timeout=0.5)
    # 清理
    never_done.cancel()


# ─── 重复添加同名服务器测试 ───────────────────────────────────────────────────

async def test_add_server_duplicate_name():
    """添加同名服务器时，旧连接应先被断开（幂等性）。"""
    client = MCPClient()
    # 第一次添加失败（命令不存在）
    await client.add_server("dup", command=["__nonexistent__"], timeout=1.0)
    # 第二次添加也应返回 False，但不应抛出异常
    result = await client.add_server("dup", command=["__nonexistent__"], timeout=1.0)
    assert result is False
