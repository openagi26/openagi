"""
tools/browser/cdp.py — Chrome DevTools Protocol（Chrome调试协议）控制器
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
功能：
  · 通过 CDP WebSocket 连接 Chrome 浏览器
  · 执行 JavaScript（eval注入）
  · 截取网页截图（Base64 PNG）
  · 提取网页文本内容
  · 检测 Chrome 连接状态

使用前提：
  Chrome 需以调试模式启动：
  google-chrome --remote-debugging-port=9222 --headless
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import time
from typing import Any
from urllib.request import urlopen
from urllib.error import URLError

logger = logging.getLogger("openagi.tools.browser.cdp")

# ─── 配置常量 ────────────────────────────────────────────────────────────────

DEFAULT_CDP_HOST = "localhost"
DEFAULT_CDP_PORT = 9222
DEFAULT_TIMEOUT  = 30.0       # WebSocket 操作超时（秒）
MAX_RESPONSE_LEN = 10_000     # 截断过长输出（字符数）


# ─── CDP 客户端 ──────────────────────────────────────────────────────────────

class CDPClient:
    """
    Chrome DevTools Protocol（Chrome调试协议）客户端。

    通过 WebSocket 与 Chrome 通信，支持 JS 注入、截图、文本提取。
    """

    def __init__(self, host: str = DEFAULT_CDP_HOST, port: int = DEFAULT_CDP_PORT):
        self.host    = host
        self.port    = port
        self._ws     = None          # WebSocket 连接
        self._cmd_id = 0             # 命令序号（自增）
        self._pending: dict[int, asyncio.Future] = {}

    # ── 连接管理 ─────────────────────────────────────────────────────────────

    async def connect(self, timeout: float = DEFAULT_TIMEOUT) -> bool:
        """
        连接到 Chrome 调试端口，获取第一个可用 Tab（标签页）的 WebSocket URL。
        返回是否连接成功。
        """
        try:
            import websockets  # type: ignore
        except ImportError:
            logger.error("缺少依赖：请安装 websockets（pip install websockets）")
            return False

        ws_url = await asyncio.get_event_loop().run_in_executor(
            None, self._get_ws_url
        )
        if not ws_url:
            return False

        try:
            self._ws = await asyncio.wait_for(
                websockets.connect(ws_url),
                timeout=timeout,
            )
            # 启动后台消息接收循环
            asyncio.create_task(self._recv_loop())
            logger.info(f"CDP 连接成功: {ws_url}")
            return True
        except Exception as e:
            logger.error(f"CDP WebSocket 连接失败: {e}")
            return False

    async def disconnect(self) -> None:
        """断开 WebSocket 连接。"""
        if self._ws:
            await self._ws.close()
            self._ws = None
            logger.info("CDP 连接已断开")

    def is_connected(self) -> bool:
        """检测当前是否处于连接状态。"""
        return self._ws is not None and not getattr(self._ws, "closed", True)

    @staticmethod
    def check_chrome_running(host: str = DEFAULT_CDP_HOST, port: int = DEFAULT_CDP_PORT) -> bool:
        """
        静态方法：检查 Chrome 调试端口是否可达（不建立 WebSocket）。
        """
        try:
            url = f"http://{host}:{port}/json/version"
            with urlopen(url, timeout=3) as resp:
                data = json.loads(resp.read())
            return "Browser" in data
        except (URLError, json.JSONDecodeError, Exception):
            return False

    # ── 核心命令 ─────────────────────────────────────────────────────────────

    async def execute_js(self, expression: str, timeout: float = DEFAULT_TIMEOUT) -> Any:
        """
        在当前页面执行 JavaScript 表达式，返回执行结果。
        """
        result = await self._send_command(
            "Runtime.evaluate",
            {
                "expression":            expression,
                "returnByValue":         True,
                "awaitPromise":          True,
                "userGesture":           True,
            },
            timeout=timeout,
        )
        # 提取返回值
        if "result" in result:
            rv = result["result"]
            if rv.get("type") == "string":
                return rv.get("value", "")
            return rv.get("value", rv.get("description", ""))
        if "exceptionDetails" in result:
            raise RuntimeError(
                f"JS执行异常: {result['exceptionDetails'].get('text', '未知错误')}"
            )
        return result

    async def take_screenshot(self, timeout: float = DEFAULT_TIMEOUT) -> bytes:
        """
        截取当前页面截图，返回 PNG 二进制数据。
        """
        result = await self._send_command(
            "Page.captureScreenshot",
            {"format": "png", "quality": 90},
            timeout=timeout,
        )
        b64_data = result.get("data", "")
        return base64.b64decode(b64_data)

    async def extract_text(self, timeout: float = DEFAULT_TIMEOUT) -> str:
        """
        提取当前页面的纯文本内容（去除 HTML 标签）。
        """
        text = await self.execute_js(
            "document.body ? document.body.innerText : ''",
            timeout=timeout,
        )
        return str(text)[:MAX_RESPONSE_LEN]

    async def navigate(self, url: str, wait_ms: int = 2000, timeout: float = DEFAULT_TIMEOUT) -> bool:
        """
        导航到指定 URL，等待页面基本加载完成。
        """
        try:
            await self._send_command("Page.navigate", {"url": url}, timeout=timeout)
            # 简单等待，让页面有时间渲染
            await asyncio.sleep(wait_ms / 1000)
            return True
        except Exception as e:
            logger.error(f"导航失败 {url}: {e}")
            return False

    async def get_page_title(self, timeout: float = DEFAULT_TIMEOUT) -> str:
        """获取当前页面标题。"""
        return await self.execute_js("document.title", timeout=timeout)

    # ── 内部机制 ─────────────────────────────────────────────────────────────

    def _get_ws_url(self) -> str | None:
        """
        从 Chrome 调试 HTTP 接口获取第一个可用 Tab 的 WebSocket URL。
        （在 executor 线程中调用，避免阻塞事件循环）
        """
        try:
            url = f"http://{self.host}:{self.port}/json"
            with urlopen(url, timeout=5) as resp:
                tabs = json.loads(resp.read())
            for tab in tabs:
                ws = tab.get("webSocketDebuggerUrl")
                if ws:
                    return ws
            logger.warning("CDP: 未找到可用的 Tab")
            return None
        except Exception as e:
            logger.error(f"无法访问 Chrome 调试端口 {self.host}:{self.port}: {e}")
            return None

    async def _send_command(
        self, method: str, params: dict | None = None, timeout: float = DEFAULT_TIMEOUT
    ) -> dict:
        """
        发送 CDP 命令并等待对应响应。
        线程安全，通过 Future（期约）实现异步等待。
        """
        if not self.is_connected():
            raise ConnectionError("CDP 未连接，请先调用 connect()")

        self._cmd_id += 1
        cmd_id = self._cmd_id

        payload = json.dumps({"id": cmd_id, "method": method, "params": params or {}})

        loop = asyncio.get_event_loop()
        future: asyncio.Future = loop.create_future()
        self._pending[cmd_id] = future

        await self._ws.send(payload)

        try:
            result = await asyncio.wait_for(future, timeout=timeout)
            if "error" in result:
                raise RuntimeError(f"CDP错误: {result['error']}")
            return result.get("result", {})
        except asyncio.TimeoutError:
            self._pending.pop(cmd_id, None)
            raise TimeoutError(f"CDP命令 '{method}' 超时（{timeout}s）")

    async def _recv_loop(self) -> None:
        """
        后台消息接收循环，将响应路由到对应的等待 Future（期约）。
        """
        try:
            async for raw in self._ws:
                try:
                    msg = json.loads(raw)
                    msg_id = msg.get("id")
                    if msg_id and msg_id in self._pending:
                        fut = self._pending.pop(msg_id)
                        if not fut.done():
                            fut.set_result(msg)
                except json.JSONDecodeError:
                    logger.warning(f"CDP: 无法解析消息: {raw[:100]}")
        except Exception as e:
            logger.error(f"CDP 接收循环异常: {e}")
            # 清理所有挂起的 Future（期约）
            for fut in self._pending.values():
                if not fut.done():
                    fut.set_exception(ConnectionError("CDP 连接已断开"))
            self._pending.clear()
            self._ws = None

    # ── 上下文管理器支持 ──────────────────────────────────────────────────────

    async def __aenter__(self) -> "CDPClient":
        await self.connect()
        return self

    async def __aexit__(self, *_) -> None:
        await self.disconnect()
