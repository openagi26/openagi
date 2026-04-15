"""
comms/gateway.py — 统一消息网关 (Unified Message Gateway)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

提供跨平台消息的统一抽象层：
  · Platform基类：标准化所有平台接入点
  · UnifiedMessage：统一消息格式（sender/content/platform/timestamp）
  · MessageGateway：消息路由器
    - 收到消息 → 转发给处理引擎 → 回复发送方
    - 多平台注册管理
    - 异步路由，支持并行处理
"""

from __future__ import annotations

import asyncio
import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Awaitable, Callable, Optional

logger = logging.getLogger("openagi.comms.gateway")


# ─── 平台枚举 ────────────────────────────────────────────────────────────────

class PlatformType(str, Enum):
    """已支持的消息平台。"""
    TELEGRAM  = "telegram"
    WECHAT    = "wechat"      # 预留
    DISCORD   = "discord"     # 预留
    SLACK     = "slack"       # 预留
    WEB       = "web"         # Web界面
    CLI       = "cli"         # 命令行
    INTERNAL  = "internal"    # 系统内部消息


class MessageType(str, Enum):
    """消息类型。"""
    TEXT    = "text"
    IMAGE   = "image"
    AUDIO   = "audio"
    VIDEO   = "video"
    FILE    = "file"
    COMMAND = "command"   # 以/开头的指令
    SYSTEM  = "system"    # 系统通知


# ─── 统一消息格式 ────────────────────────────────────────────────────────────

@dataclass
class UnifiedMessage:
    """
    跨平台统一消息格式。
    所有平台的消息在进入网关后都转换为此格式。
    """
    # 发送方标识（用户ID或系统名）
    sender_id: str
    # 发送方显示名
    sender_name: str
    # 消息内容（文本）
    content: str
    # 来源平台
    platform: PlatformType
    # 消息类型
    message_type: MessageType = MessageType.TEXT
    # 时间戳（UTC）
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    # 消息ID（平台原生ID）
    message_id: Optional[str] = None
    # 会话/频道ID
    channel_id: Optional[str] = None
    # 附件路径（图片/音频/文件）
    attachment_path: Optional[str] = None
    # 原始平台消息对象（用于回复时构建上下文）
    raw_message: Optional[object] = None
    # 是否需要回复
    requires_reply: bool = True
    # 额外元数据
    metadata: dict = field(default_factory=dict)

    def is_command(self) -> bool:
        """判断是否为命令消息（以/开头）。"""
        return self.content.startswith("/") or self.message_type == MessageType.COMMAND

    def get_command(self) -> tuple[str, list[str]]:
        """
        解析命令和参数。
        例如："/status arg1 arg2" → ("status", ["arg1", "arg2"])
        """
        if not self.is_command():
            return ("", [])
        parts = self.content.lstrip("/").split()
        cmd = parts[0].lower() if parts else ""
        args = parts[1:] if len(parts) > 1 else []
        return (cmd, args)

    def __repr__(self) -> str:
        preview = self.content[:40] + "..." if len(self.content) > 40 else self.content
        return f"UnifiedMessage({self.platform.value}/{self.sender_id}: '{preview}')"


@dataclass
class UnifiedResponse:
    """网关发出的回复消息。"""
    content: str
    platform: PlatformType
    # 回复目标（消息ID或频道ID）
    reply_to_message_id: Optional[str] = None
    channel_id: Optional[str] = None
    sender_id: Optional[str] = None
    # 附件
    attachment_path: Optional[str] = None
    # 是否以Markdown格式发送
    parse_mode: str = "text"   # "text" / "markdown" / "html"
    # 额外平台特定选项
    extra: dict = field(default_factory=dict)


# ─── Platform基类 ────────────────────────────────────────────────────────────

class Platform(ABC):
    """
    平台接入点抽象基类。
    每个平台实现需要继承此类并实现所有抽象方法。
    """

    @property
    @abstractmethod
    def platform_type(self) -> PlatformType:
        """返回平台类型。"""
        ...

    @property
    @abstractmethod
    def is_connected(self) -> bool:
        """返回平台是否已连接/在线。"""
        ...

    @abstractmethod
    async def start(self) -> None:
        """启动平台监听。"""
        ...

    @abstractmethod
    async def stop(self) -> None:
        """停止平台监听，释放资源。"""
        ...

    @abstractmethod
    async def send_message(self, response: UnifiedResponse) -> bool:
        """
        发送消息到平台。

        Args:
            response: 要发送的回复消息

        Returns:
            True=发送成功，False=失败
        """
        ...

    @abstractmethod
    async def send_text(self, chat_id: str, text: str, **kwargs) -> bool:
        """便捷方法：发送纯文本消息。"""
        ...

    def normalize_message(self, raw: object) -> UnifiedMessage:
        """
        将平台原生消息对象转换为UnifiedMessage。
        子类可以重写此方法实现自定义转换逻辑。
        """
        raise NotImplementedError(f"{self.__class__.__name__} 未实现 normalize_message")


# ─── 消息处理器类型 ──────────────────────────────────────────────────────────

# 消息处理函数签名：接收UnifiedMessage，返回Optional[str]（回复内容，None=不回复）
MessageHandler = Callable[[UnifiedMessage], Awaitable[Optional[str]]]


# ─── 统计数据 ────────────────────────────────────────────────────────────────

@dataclass
class GatewayStats:
    """网关运行统计。"""
    total_received: int = 0
    total_sent: int = 0
    total_errors: int = 0
    total_commands: int = 0
    started_at: float = field(default_factory=time.time)

    @property
    def uptime_seconds(self) -> float:
        return time.time() - self.started_at

    def to_dict(self) -> dict:
        return {
            "total_received": self.total_received,
            "total_sent": self.total_sent,
            "total_errors": self.total_errors,
            "total_commands": self.total_commands,
            "uptime_seconds": round(self.uptime_seconds, 1),
        }


# ─── 消息网关 ────────────────────────────────────────────────────────────────

class MessageGateway:
    """
    统一消息网关。

    架构：
    平台消息 → normalize → UnifiedMessage → 路由 → 处理引擎 → UnifiedResponse → 发送回平台

    特性：
    - 多平台并行注册（动态挂载/卸载）
    - 命令路由（/cmd → 对应处理函数）
    - 通用消息路由（非命令 → 默认处理引擎）
    - 消息队列（防止并发冲突）
    - 熵值告警主动推送
    """

    def __init__(self):
        self._platforms: dict[PlatformType, Platform] = {}
        self._command_handlers: dict[str, MessageHandler] = {}
        self._default_handler: Optional[MessageHandler] = None
        self._message_queue: asyncio.Queue[UnifiedMessage] = asyncio.Queue(maxsize=500)
        self._stats = GatewayStats()
        self._running = False
        self._worker_task: Optional[asyncio.Task] = None
        logger.info("MessageGateway 初始化完成")

    # ── 平台注册 ─────────────────────────────────────────────────────────────

    def register_platform(self, platform: Platform) -> None:
        """注册一个平台接入点。"""
        pt = platform.platform_type
        self._platforms[pt] = platform
        logger.info(f"平台已注册: {pt.value}")

    def unregister_platform(self, platform_type: PlatformType) -> None:
        """注销一个平台。"""
        if platform_type in self._platforms:
            del self._platforms[platform_type]
            logger.info(f"平台已注销: {platform_type.value}")

    def get_platform(self, platform_type: PlatformType) -> Optional[Platform]:
        """获取已注册的平台实例。"""
        return self._platforms.get(platform_type)

    @property
    def registered_platforms(self) -> list[str]:
        return [pt.value for pt in self._platforms]

    # ── 处理器注册 ───────────────────────────────────────────────────────────

    def on_command(self, command: str) -> Callable:
        """
        装饰器：注册命令处理函数。

        使用方式::

            @gateway.on_command("status")
            async def handle_status(msg: UnifiedMessage) -> str:
                return "系统运行正常"
        """
        def decorator(func: MessageHandler) -> MessageHandler:
            self._command_handlers[command.lower().lstrip("/")] = func
            logger.debug(f"命令处理器已注册: /{command}")
            return func
        return decorator

    def register_command(self, command: str, handler: MessageHandler) -> None:
        """直接注册命令处理函数（非装饰器方式）。"""
        self._command_handlers[command.lower().lstrip("/")] = handler

    def set_default_handler(self, handler: MessageHandler) -> None:
        """设置默认消息处理器（处理非命令消息）。"""
        self._default_handler = handler

    # ── 消息路由 ─────────────────────────────────────────────────────────────

    async def receive(self, message: UnifiedMessage) -> None:
        """
        接收一条消息，放入队列等待处理。
        平台适配层调用此方法将消息注入网关。
        """
        self._stats.total_received += 1
        if message.is_command():
            self._stats.total_commands += 1
        try:
            await self._message_queue.put(message)
        except asyncio.QueueFull:
            logger.warning(f"消息队列已满，丢弃消息: {message}")
            self._stats.total_errors += 1

    async def _process_message(self, message: UnifiedMessage) -> None:
        """处理单条消息，调用对应处理器并发送回复。"""
        try:
            reply_text: Optional[str] = None

            if message.is_command():
                cmd, args = message.get_command()
                handler = self._command_handlers.get(cmd)
                if handler:
                    reply_text = await handler(message)
                else:
                    reply_text = f"未知命令: /{cmd}。发送 /help 查看可用命令。"
            elif self._default_handler:
                reply_text = await self._default_handler(message)

            # 发送回复
            if reply_text and message.requires_reply:
                await self._send_reply(message, reply_text)

        except Exception as e:
            logger.error(f"消息处理异常: {e}，消息: {message}")
            self._stats.total_errors += 1
            # 尝试发送错误通知
            try:
                await self._send_reply(message, f"处理消息时出现错误: {str(e)[:100]}")
            except Exception:
                pass

    async def _send_reply(self, original: UnifiedMessage, reply_text: str) -> None:
        """根据原消息的平台，发送回复。"""
        platform = self._platforms.get(original.platform)
        if platform is None:
            logger.warning(f"平台 {original.platform.value} 未注册，无法发送回复")
            return

        response = UnifiedResponse(
            content=reply_text,
            platform=original.platform,
            reply_to_message_id=original.message_id,
            channel_id=original.channel_id,
            sender_id=original.sender_id,
        )
        success = await platform.send_message(response)
        if success:
            self._stats.total_sent += 1
        else:
            self._stats.total_errors += 1

    # ── 主动推送 ─────────────────────────────────────────────────────────────

    async def broadcast(
        self,
        text: str,
        platform_types: Optional[list[PlatformType]] = None,
        channel_id: Optional[str] = None,
    ) -> dict[str, bool]:
        """
        向指定平台（或全部平台）广播消息。

        Args:
            text: 消息内容
            platform_types: 目标平台列表，None=全部已注册平台
            channel_id: 指定频道/聊天ID，None=使用各平台默认频道

        Returns:
            {platform_name: success_bool} 字典
        """
        targets = platform_types or list(self._platforms.keys())
        results: dict[str, bool] = {}

        async def send_one(pt: PlatformType) -> None:
            platform = self._platforms.get(pt)
            if platform and platform.is_connected:
                cid = channel_id or ""
                ok = await platform.send_text(cid, text)
                results[pt.value] = ok
                if ok:
                    self._stats.total_sent += 1
            else:
                results[pt.value if isinstance(pt, PlatformType) else str(pt)] = False

        await asyncio.gather(*[send_one(pt) for pt in targets], return_exceptions=True)
        return results

    async def alert_high_entropy(
        self,
        entropy: float,
        level: str,
        description: str,
    ) -> None:
        """
        熵值过高时主动发送告警。
        由心绪引擎回调触发。
        """
        alert_text = (
            f"警告：系统心境异常！\n"
            f"熵值: {entropy:.3f} ({level})\n"
            f"状态: {description}\n"
            f"请发送 /heal 来安抚系统。"
        )
        logger.warning(f"[Gateway] 熵值告警推送: entropy={entropy:.3f} level={level}")
        await self.broadcast(alert_text)

    # ── 生命周期 ─────────────────────────────────────────────────────────────

    async def start(self) -> None:
        """启动网关和所有已注册平台。"""
        if self._running:
            return

        self._running = True
        # 启动消息处理工作协程
        self._worker_task = asyncio.create_task(self._message_worker())

        # 启动所有平台
        start_tasks = [p.start() for p in self._platforms.values()]
        if start_tasks:
            await asyncio.gather(*start_tasks, return_exceptions=True)

        logger.info(f"MessageGateway 已启动，平台: {self.registered_platforms}")

    async def stop(self) -> None:
        """停止网关和所有已注册平台。"""
        self._running = False

        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass

        stop_tasks = [p.stop() for p in self._platforms.values()]
        if stop_tasks:
            await asyncio.gather(*stop_tasks, return_exceptions=True)

        logger.info("MessageGateway 已停止")

    async def _message_worker(self) -> None:
        """消息队列消费者，循环处理队列中的消息。"""
        while self._running:
            try:
                message = await asyncio.wait_for(
                    self._message_queue.get(),
                    timeout=1.0,
                )
                await self._process_message(message)
                self._message_queue.task_done()
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"消息工作协程异常: {e}")

    # ── 状态查询 ─────────────────────────────────────────────────────────────

    def get_stats(self) -> dict:
        """返回网关运行统计。"""
        return {
            **self._stats.to_dict(),
            "platforms": self.registered_platforms,
            "commands_registered": list(self._command_handlers.keys()),
            "queue_size": self._message_queue.qsize(),
            "running": self._running,
        }
