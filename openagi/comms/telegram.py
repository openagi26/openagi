"""
comms/telegram.py — Telegram Bot集成 (Telegram Bot Integration)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

基于 python-telegram-bot>=20.0（异步版本）的Bot集成。

职责：
  · Token管理（从环境变量/配置文件读取）
  · 消息接收/发送（实现Platform基类）
  · 命令处理框架（/status /help /heal /companion 等）
  · 与心绪引擎联动（熵值过高时主动告警）
  · 与MessageGateway对接（消息标准化后注入网关）

环境变量：
  TELEGRAM_BOT_TOKEN  — Bot Token（从 @BotFather 获取）
  TELEGRAM_CHAT_ID    — 默认聊天ID（@userinfobot 可查）

依赖：
  pip install python-telegram-bot>=20.0
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from dotenv import load_dotenv

from .gateway import (
    MessageGateway,
    MessageType,
    Platform,
    PlatformType,
    UnifiedMessage,
    UnifiedResponse,
)

load_dotenv()
logger = logging.getLogger("openagi.comms.telegram")

# 熵值告警阈值
ENTROPY_ALERT_THRESHOLD = 0.80
ENTROPY_CALM_THRESHOLD  = 0.20

if TYPE_CHECKING:
    from openagi.cortex.heart.entropy import HeartEngine


# ─── Telegram平台实现 ────────────────────────────────────────────────────────

class TelegramPlatform(Platform):
    """
    Telegram平台接入点。
    实现Platform抽象基类，与MessageGateway对接。
    """

    def __init__(
        self,
        token: Optional[str] = None,
        default_chat_id: Optional[str] = None,
        gateway: Optional[MessageGateway] = None,
    ):
        self._token = token or os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
        self._default_chat_id = default_chat_id or os.getenv("TELEGRAM_CHAT_ID", "").strip()
        self._gateway = gateway

        # 运行时对象（需要python-telegram-bot）
        self._app = None
        self._bot = None
        self._connected = False

        # 状态追踪（避免重复推送）
        self._last_entropy_level: str = "focused"

        if not self._token:
            logger.warning(
                "TELEGRAM_BOT_TOKEN 未设置，Telegram功能不可用。"
                "请在 .env 文件中设置 TELEGRAM_BOT_TOKEN。"
            )

    # ── Platform接口实现 ──────────────────────────────────────────────────────

    @property
    def platform_type(self) -> PlatformType:
        return PlatformType.TELEGRAM

    @property
    def is_connected(self) -> bool:
        return self._connected and self._bot is not None

    async def start(self) -> None:
        """启动Telegram Bot监听。"""
        if not self._token:
            logger.error("无法启动Telegram Bot：Token未设置")
            return

        if not self._is_library_available():
            logger.error(
                "无法启动Telegram Bot：python-telegram-bot未安装。"
                "请执行: pip install python-telegram-bot>=20.0"
            )
            return

        try:
            from telegram.ext import (
                Application,
                ApplicationBuilder,
                CommandHandler,
                MessageHandler,
                filters,
            )

            self._app = (
                ApplicationBuilder()
                .token(self._token)
                .build()
            )
            self._bot = self._app.bot

            # 注册命令处理器（转发给网关）
            self._app.add_handler(CommandHandler("start",     self._cmd_start))
            self._app.add_handler(CommandHandler("help",      self._cmd_help))
            self._app.add_handler(CommandHandler("status",    self._cmd_status))
            self._app.add_handler(CommandHandler("heal",      self._cmd_heal))
            self._app.add_handler(CommandHandler("companion", self._cmd_companion))
            self._app.add_handler(CommandHandler("voice",     self._cmd_voice))
            # 通用文本消息
            self._app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self._handle_text))

            await self._app.initialize()
            await self._app.start()
            await self._app.updater.start_polling(drop_pending_updates=True)

            self._connected = True
            logger.info("Telegram Bot 已启动，开始监听消息")

        except Exception as e:
            logger.error(f"Telegram Bot 启动失败: {e}")
            self._connected = False

    async def stop(self) -> None:
        """停止Telegram Bot。"""
        if self._app:
            try:
                await self._app.updater.stop()
                await self._app.stop()
                await self._app.shutdown()
            except Exception as e:
                logger.error(f"Telegram Bot 停止时出错: {e}")
        self._connected = False
        logger.info("Telegram Bot 已停止")

    async def send_message(self, response: UnifiedResponse) -> bool:
        """发送消息（实现Platform.send_message）。"""
        if not self.is_connected:
            logger.warning("Telegram未连接，无法发送消息")
            return False

        chat_id = response.channel_id or response.sender_id or self._default_chat_id
        if not chat_id:
            logger.warning("发送消息失败：未指定chat_id且无默认chat_id")
            return False

        return await self.send_text(
            chat_id=chat_id,
            text=response.content,
            parse_mode=response.parse_mode,
            reply_to_message_id=response.reply_to_message_id,
        )

    async def send_text(
        self,
        chat_id: str,
        text: str,
        parse_mode: str = "text",
        reply_to_message_id: Optional[str] = None,
        **kwargs,
    ) -> bool:
        """发送纯文本消息到指定chat_id。"""
        if not self.is_connected:
            logger.warning("Telegram未连接，消息未发送（已记录日志）")
            logger.debug(f"[Telegram未连接] 目标={chat_id}, 内容={text[:50]}")
            return False

        try:
            from telegram.constants import ParseMode
            pm = None
            if parse_mode == "markdown":
                pm = ParseMode.MARKDOWN_V2
            elif parse_mode == "html":
                pm = ParseMode.HTML

            reply_kwargs = {}
            if reply_to_message_id:
                reply_kwargs["reply_to_message_id"] = int(reply_to_message_id)

            await self._bot.send_message(
                chat_id=chat_id,
                text=text,
                parse_mode=pm,
                **reply_kwargs,
            )
            return True
        except Exception as e:
            logger.error(f"发送Telegram消息失败: {e}")
            return False

    # ── 消息规范化 ───────────────────────────────────────────────────────────

    def normalize_message(self, raw: object) -> UnifiedMessage:
        """将Telegram Update对象转换为UnifiedMessage。"""
        from telegram import Update  # type: ignore

        update: Update = raw
        msg = update.effective_message
        user = update.effective_user
        chat = update.effective_chat

        content = msg.text or msg.caption or ""
        msg_type = MessageType.COMMAND if content.startswith("/") else MessageType.TEXT

        return UnifiedMessage(
            sender_id=str(user.id) if user else "unknown",
            sender_name=user.full_name if user else "unknown",
            content=content,
            platform=PlatformType.TELEGRAM,
            message_type=msg_type,
            message_id=str(msg.message_id),
            channel_id=str(chat.id) if chat else None,
            raw_message=update,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

    # ── 主动推送 ─────────────────────────────────────────────────────────────

    async def push_entropy_alert(self, entropy: float, level: str, description: str) -> None:
        """
        熵值超过阈值时主动发送告警给默认chat_id。
        由心绪引擎回调触发。
        """
        if level == self._last_entropy_level:
            return  # 避免重复推送同一级别

        if not self._default_chat_id:
            return

        if entropy >= ENTROPY_ALERT_THRESHOLD:
            text = (
                f"系统心境告警！\n"
                f"熵值: {entropy:.3f} ({level})\n"
                f"状态: {description}\n\n"
                f"发送 /heal 来安抚系统心境。"
            )
            await self.send_text(self._default_chat_id, text)
            self._last_entropy_level = level
            logger.warning(f"[Telegram] 熵值告警已推送: {entropy:.3f}")

        elif entropy <= ENTROPY_CALM_THRESHOLD and self._last_entropy_level in ("anxious", "crisis"):
            text = (
                f"系统已恢复平静。\n"
                f"熵值: {entropy:.3f} ({level})\n"
                f"一切正常，继续前进！"
            )
            await self.send_text(self._default_chat_id, text)
            self._last_entropy_level = level

    # ── 内置命令处理 ─────────────────────────────────────────────────────────

    async def _cmd_start(self, update, ctx) -> None:
        """处理 /start 命令。"""
        msg = self.normalize_message(update)
        if self._gateway:
            await self._gateway.receive(msg)
        else:
            await update.message.reply_text(
                "你好！我是OpenAGI数字伴侣。\n"
                "发送 /help 查看可用命令。"
            )

    async def _cmd_help(self, update, ctx) -> None:
        """处理 /help 命令。"""
        help_text = (
            "可用命令列表：\n\n"
            "/status    — 查看当前系统状态和心境\n"
            "/heal      — 安抚系统心境（降低熵值）\n"
            "/companion — 查看/切换伴侣关系模式\n"
            "/voice     — 语音设置（TTS/STT）\n"
            "/help      — 显示此帮助信息\n\n"
            "直接发送文字可与我聊天。"
        )
        msg = self.normalize_message(update)
        if self._gateway:
            # 注入网关，但附上帮助文本作为命令响应
            await update.message.reply_text(help_text)
        else:
            await update.message.reply_text(help_text)

    async def _cmd_status(self, update, ctx) -> None:
        """处理 /status 命令，注入网关处理。"""
        await self._inject_to_gateway(update)

    async def _cmd_heal(self, update, ctx) -> None:
        """处理 /heal 命令，注入网关处理。"""
        await self._inject_to_gateway(update)

    async def _cmd_companion(self, update, ctx) -> None:
        """处理 /companion 命令，注入网关处理。"""
        await self._inject_to_gateway(update)

    async def _cmd_voice(self, update, ctx) -> None:
        """处理 /voice 命令，注入网关处理。"""
        await self._inject_to_gateway(update)

    async def _handle_text(self, update, ctx) -> None:
        """处理普通文本消息，注入网关处理。"""
        await self._inject_to_gateway(update)

    async def _inject_to_gateway(self, update) -> None:
        """将消息规范化后注入MessageGateway。"""
        if not self._gateway:
            await update.message.reply_text("网关未初始化，消息无法处理。")
            return
        msg = self.normalize_message(update)
        await self._gateway.receive(msg)

    # ── 工具方法 ─────────────────────────────────────────────────────────────

    @staticmethod
    def _is_library_available() -> bool:
        """检查python-telegram-bot是否已安装。"""
        try:
            import importlib
            return importlib.util.find_spec("telegram") is not None
        except Exception:
            return False

    def get_config_summary(self) -> dict:
        """返回配置摘要（不含敏感Token）。"""
        token_preview = (
            f"{self._token[:6]}...{self._token[-4:]}"
            if len(self._token) > 10 else "未设置"
        )
        return {
            "platform": "telegram",
            "token_preview": token_preview,
            "default_chat_id": self._default_chat_id or "未设置",
            "connected": self._connected,
            "library_available": self._is_library_available(),
            "entropy_alert_threshold": ENTROPY_ALERT_THRESHOLD,
        }


# ─── 便捷工厂函数 ────────────────────────────────────────────────────────────

def create_telegram_platform(
    gateway: MessageGateway,
    token: Optional[str] = None,
    chat_id: Optional[str] = None,
) -> TelegramPlatform:
    """
    创建并注册Telegram平台到MessageGateway。

    Args:
        gateway: 消息网关实例
        token: Bot Token（可选，优先级高于环境变量）
        chat_id: 默认聊天ID（可选）

    Returns:
        已注册到gateway的TelegramPlatform实例
    """
    platform = TelegramPlatform(token=token, default_chat_id=chat_id, gateway=gateway)
    gateway.register_platform(platform)
    return platform
