"""
tools/mcp/client.py — MCP（Model Context Protocol，模型上下文协议）客户端
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
功能：
  · 启动 MCP 服务器子进程并建立 JSON-RPC（远程过程调用）通道
  · 发现服务器提供的工具列表（tools/list）
  · 调用工具并返回结果（tools/call）
  · 服务器健康检查（ping）
  · 支持多服务器并发管理
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger("openagi.tools.mcp")

# ─── 配置常量 ────────────────────────────────────────────────────────────────

DEFAULT_TIMEOUT     = 30.0    # 默认请求超时（秒）
HEALTH_CHECK_INTERVAL = 60.0  # 健康检查间隔（秒）
MAX_MSG_SIZE        = 10 * 1024 * 1024  # 单条消息最大 10MB


# ─── 数据结构 ─────────────────────────────────────────────────────────────────

@dataclass
class MCPTool:
    """MCP 服务器暴露的单个工具描述。"""
    name:        str
    description: str = ""
    input_schema: dict = field(default_factory=dict)  # JSON Schema（模式）

    def to_dict(self) -> dict:
        return {
            "name":         self.name,
            "description":  self.description,
            "input_schema": self.input_schema,
        }


@dataclass
class MCPCallResult:
    """工具调用结果。"""
    tool_name:  str
    success:    bool
    content:    Any   = None   # 原始返回内容
    error:      str | None = None
    duration_ms: float = 0.0

    @property
    def text(self) -> str:
        """提取文本内容（适配 MCP 标准 content 格式）。"""
        if not self.content:
            return ""
        if isinstance(self.content, str):
            return self.content
        if isinstance(self.content, list):
            parts = []
            for item in self.content:
                if isinstance(item, dict):
                    parts.append(item.get("text", str(item)))
                else:
                    parts.append(str(item))
            return "\n".join(parts)
        return str(self.content)


# ─── MCP 服务器连接 ───────────────────────────────────────────────────────────

class MCPServerConnection:
    """
    单个 MCP 服务器的连接管理。

    使用 stdio（标准输入输出）作为传输层，通过 JSON-RPC 2.0 协议与服务器通信。
    """

    def __init__(self, name: str, command: list[str], env: dict[str, str] | None = None):
        self.name    = name
        self.command = command
        self.env     = env or {}

        self._process: asyncio.subprocess.Process | None = None
        self._reader:  asyncio.StreamReader | None       = None
        self._writer:  asyncio.StreamWriter | None       = None
        self._msg_id   = 0
        self._pending: dict[int, asyncio.Future] = {}
        self._recv_task: asyncio.Task | None     = None
        self._tools_cache: list[MCPTool] | None  = None
        self._connected = False
        self._last_health_check: float = 0.0

    # ── 连接/断开 ─────────────────────────────────────────────────────────────

    async def connect(self, timeout: float = DEFAULT_TIMEOUT) -> bool:
        """启动 MCP 服务器子进程并完成 MCP 握手（initialize）。"""
        import os
        env = {**os.environ, **self.env}

        try:
            self._process = await asyncio.wait_for(
                asyncio.create_subprocess_exec(
                    *self.command,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env=env,
                ),
                timeout=timeout,
            )
        except FileNotFoundError:
            logger.error(f"[MCP:{self.name}] 命令不存在: {self.command[0]}")
            return False
        except Exception as e:
            logger.error(f"[MCP:{self.name}] 启动子进程失败: {e}")
            return False

        self._reader = self._process.stdout
        self._writer = self._process.stdin

        # 启动异步消息接收循环
        self._recv_task = asyncio.create_task(self._recv_loop())

        # MCP 握手：发送 initialize（初始化）请求
        try:
            resp = await asyncio.wait_for(
                self._send_request("initialize", {
                    "protocolVersion": "2024-11-05",
                    "capabilities":    {},
                    "clientInfo":      {"name": "openagi", "version": "0.1.0"},
                }),
                timeout=timeout,
            )
            # 发送 initialized 通知
            await self._send_notification("notifications/initialized", {})
            self._connected = True
            logger.info(f"[MCP:{self.name}] 连接成功，服务器信息: {resp.get('serverInfo', {})}")
            return True
        except Exception as e:
            logger.error(f"[MCP:{self.name}] 握手失败: {e}")
            await self.disconnect()
            return False

    async def disconnect(self) -> None:
        """断开连接，终止子进程。"""
        self._connected = False
        if self._recv_task:
            self._recv_task.cancel()
            try:
                await self._recv_task
            except asyncio.CancelledError:
                pass
        if self._process:
            try:
                self._process.terminate()
                await asyncio.wait_for(self._process.wait(), timeout=5)
            except Exception:
                self._process.kill()
        self._process = None
        logger.info(f"[MCP:{self.name}] 已断开连接")

    def is_connected(self) -> bool:
        """检测连接状态。"""
        return (
            self._connected
            and self._process is not None
            and self._process.returncode is None
        )

    # ── 工具发现 ──────────────────────────────────────────────────────────────

    async def list_tools(
        self, force_refresh: bool = False, timeout: float = DEFAULT_TIMEOUT
    ) -> list[MCPTool]:
        """
        获取服务器提供的工具列表。
        结果会被缓存，使用 force_refresh=True 强制重新获取。
        """
        if self._tools_cache is not None and not force_refresh:
            return self._tools_cache

        try:
            resp  = await asyncio.wait_for(
                self._send_request("tools/list", {}), timeout=timeout
            )
            tools = []
            for item in resp.get("tools", []):
                tools.append(MCPTool(
                    name=item.get("name", ""),
                    description=item.get("description", ""),
                    input_schema=item.get("inputSchema", {}),
                ))
            self._tools_cache = tools
            logger.info(f"[MCP:{self.name}] 发现 {len(tools)} 个工具")
            return tools
        except Exception as e:
            logger.error(f"[MCP:{self.name}] tools/list 失败: {e}")
            return []

    # ── 工具调用 ──────────────────────────────────────────────────────────────

    async def call_tool(
        self,
        tool_name: str,
        arguments: dict | None = None,
        timeout:   float = DEFAULT_TIMEOUT,
    ) -> MCPCallResult:
        """
        调用 MCP 服务器上的指定工具。

        参数：
          tool_name — 工具名称
          arguments — 传入参数字典
          timeout   — 超时秒数
        """
        if not self.is_connected():
            return MCPCallResult(
                tool_name=tool_name, success=False,
                error=f"[MCP:{self.name}] 服务器未连接"
            )

        start = time.monotonic()
        try:
            resp = await asyncio.wait_for(
                self._send_request("tools/call", {
                    "name":      tool_name,
                    "arguments": arguments or {},
                }),
                timeout=timeout,
            )
            duration = (time.monotonic() - start) * 1000
            # MCP 规范：content 字段为 [{type, text}] 列表
            is_error = resp.get("isError", False)
            content  = resp.get("content", [])
            return MCPCallResult(
                tool_name=tool_name,
                success=not is_error,
                content=content,
                error=None if not is_error else str(content),
                duration_ms=duration,
            )
        except asyncio.TimeoutError:
            duration = (time.monotonic() - start) * 1000
            return MCPCallResult(
                tool_name=tool_name, success=False,
                error=f"工具调用超时（{timeout}s）",
                duration_ms=duration,
            )
        except Exception as e:
            duration = (time.monotonic() - start) * 1000
            logger.error(f"[MCP:{self.name}] 调用 {tool_name} 失败: {e}")
            return MCPCallResult(
                tool_name=tool_name, success=False,
                error=str(e), duration_ms=duration,
            )

    # ── 健康检查 ──────────────────────────────────────────────────────────────

    async def ping(self, timeout: float = 5.0) -> bool:
        """
        发送 ping 请求检测服务器响应性。
        MCP 规范中 ping 是可选方法，不支持时回退为 tools/list 检测。
        """
        if not self.is_connected():
            return False
        try:
            await asyncio.wait_for(
                self._send_request("ping", {}), timeout=timeout
            )
            self._last_health_check = time.time()
            return True
        except Exception:
            # 回退：用 tools/list 检测存活性
            try:
                await asyncio.wait_for(
                    self._send_request("tools/list", {}), timeout=timeout
                )
                self._last_health_check = time.time()
                return True
            except Exception:
                return False

    # ── JSON-RPC 核心实现 ─────────────────────────────────────────────────────

    async def _send_request(self, method: str, params: dict, timeout: float = 30.0) -> dict:
        """发送 JSON-RPC 请求并等待响应。timeout（超时）单位为秒，默认 30 秒。"""
        self._msg_id += 1
        msg_id = self._msg_id

        payload = {
            "jsonrpc": "2.0",
            "id":      msg_id,
            "method":  method,
            "params":  params,
        }

        loop   = asyncio.get_event_loop()
        future: asyncio.Future = loop.create_future()
        self._pending[msg_id]  = future

        await self._write_message(payload)

        try:
            result = await asyncio.wait_for(future, timeout=timeout)
        except asyncio.TimeoutError:
            # 清理挂起请求，防止内存泄漏
            self._pending.pop(msg_id, None)
            raise TimeoutError(f"MCP请求 '{method}' 超时（{timeout}秒）")
        if "error" in result:
            err = result["error"]
            raise RuntimeError(f"MCP错误 [{err.get('code')}]: {err.get('message')}")
        return result.get("result", {})

    async def _send_notification(self, method: str, params: dict) -> None:
        """发送 JSON-RPC 通知（无响应期望）。"""
        payload = {"jsonrpc": "2.0", "method": method, "params": params}
        await self._write_message(payload)

    async def _write_message(self, payload: dict) -> None:
        """将 JSON 消息写入子进程 stdin，以换行符分隔。"""
        if not self._writer:
            raise ConnectionError("子进程 stdin（标准输入）未就绪")
        line = json.dumps(payload, ensure_ascii=False) + "\n"
        self._writer.write(line.encode("utf-8"))
        await self._writer.drain()

    async def _recv_loop(self) -> None:
        """持续读取子进程 stdout，解析 JSON-RPC 消息并路由到对应 Future（期约）。"""
        try:
            while self._reader and not self._reader.at_eof():
                line = await self._reader.readline()
                if not line:
                    break
                try:
                    msg    = json.loads(line.decode("utf-8").strip())
                    msg_id = msg.get("id")
                    if msg_id is not None and msg_id in self._pending:
                        fut = self._pending.pop(msg_id)
                        if not fut.done():
                            fut.set_result(msg)
                    # 忽略通知（无 id 的消息）
                except json.JSONDecodeError as e:
                    logger.debug(f"[MCP:{self.name}] JSON 解析失败: {e}")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"[MCP:{self.name}] 接收循环异常: {e}")
        finally:
            # 清理所有挂起的 Future（期约）
            for fut in self._pending.values():
                if not fut.done():
                    fut.set_exception(ConnectionError(f"[MCP:{self.name}] 连接已断开"))
            self._pending.clear()
            self._connected = False


# ─── MCP 多服务器管理器 ───────────────────────────────────────────────────────

class MCPClient:
    """
    MCP 多服务器客户端管理器。

    支持同时管理多个 MCP 服务器，提供统一的工具发现和调用接口。
    """

    def __init__(self):
        self._servers: dict[str, MCPServerConnection] = {}

    async def add_server(
        self,
        name:    str,
        command: list[str],
        env:     dict[str, str] | None = None,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> bool:
        """
        添加并连接一个 MCP 服务器。

        参数：
          name    — 服务器唯一标识
          command — 启动命令，如 ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
          env     — 额外环境变量
          timeout — 连接超时
        """
        if name in self._servers:
            logger.warning(f"[MCPClient] 服务器 {name} 已存在，先断开旧连接")
            await self.remove_server(name)

        conn = MCPServerConnection(name=name, command=command, env=env)
        ok   = await conn.connect(timeout=timeout)
        if ok:
            self._servers[name] = conn
        return ok

    async def remove_server(self, name: str) -> None:
        """移除并断开某个服务器。"""
        conn = self._servers.pop(name, None)
        if conn:
            await conn.disconnect()

    async def remove_all(self) -> None:
        """断开全部服务器连接。"""
        names = list(self._servers.keys())
        for name in names:
            await self.remove_server(name)

    # ── 工具发现 ──────────────────────────────────────────────────────────────

    async def list_all_tools(self) -> dict[str, list[MCPTool]]:
        """列出所有已连接服务器的工具，返回 {server_name: [MCPTool, ...]}。"""
        result = {}
        tasks  = {name: conn.list_tools() for name, conn in self._servers.items() if conn.is_connected()}
        for name, coro in tasks.items():
            result[name] = await coro
        return result

    async def find_tool(self, tool_name: str) -> tuple[str, MCPTool] | None:
        """
        在所有服务器中查找指定工具。
        返回 (server_name, MCPTool) 或 None（未找到）。
        """
        for server_name, conn in self._servers.items():
            if not conn.is_connected():
                continue
            tools = await conn.list_tools()
            for tool in tools:
                if tool.name == tool_name:
                    return server_name, tool
        return None

    # ── 工具调用 ──────────────────────────────────────────────────────────────

    async def call_tool(
        self,
        tool_name:   str,
        arguments:   dict | None = None,
        server_name: str | None  = None,
        timeout:     float = DEFAULT_TIMEOUT,
    ) -> MCPCallResult:
        """
        调用工具。

        参数：
          tool_name   — 工具名称
          arguments   — 参数字典
          server_name — 指定服务器（为 None 时自动搜索）
          timeout     — 超时
        """
        # 若未指定服务器，自动查找
        if server_name is None:
            found = await self.find_tool(tool_name)
            if not found:
                return MCPCallResult(
                    tool_name=tool_name, success=False,
                    error=f"未找到工具 '{tool_name}'（已连接服务器：{list(self._servers.keys())}）",
                )
            server_name, _ = found

        conn = self._servers.get(server_name)
        if not conn:
            return MCPCallResult(
                tool_name=tool_name, success=False,
                error=f"服务器 '{server_name}' 不存在",
            )

        return await conn.call_tool(tool_name, arguments, timeout=timeout)

    # ── 健康检查 ──────────────────────────────────────────────────────────────

    async def health_check(self) -> dict[str, bool]:
        """对所有服务器执行健康检查，返回 {server_name: is_healthy}。"""
        results = {}
        for name, conn in self._servers.items():
            results[name] = await conn.ping()
        return results

    async def get_healthy_servers(self) -> list[str]:
        """返回当前健康（正常响应）的服务器名称列表。"""
        health = await self.health_check()
        return [name for name, ok in health.items() if ok]

    # ── 状态查询 ──────────────────────────────────────────────────────────────

    def list_servers(self) -> list[dict]:
        """列出所有服务器及其连接状态。"""
        return [
            {
                "name":        name,
                "connected":   conn.is_connected(),
                "command":     conn.command,
                "tools_count": len(conn._tools_cache) if conn._tools_cache else None,
            }
            for name, conn in self._servers.items()
        ]

    def get_stats(self) -> dict:
        """获取统计信息。"""
        total     = len(self._servers)
        connected = sum(1 for c in self._servers.values() if c.is_connected())
        return {
            "total_servers":     total,
            "connected_servers": connected,
            "disconnected":      total - connected,
        }

    # ── 上下文管理器 ──────────────────────────────────────────────────────────

    async def __aenter__(self) -> "MCPClient":
        return self

    async def __aexit__(self, *_) -> None:
        await self.remove_all()
