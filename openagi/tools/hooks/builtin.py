"""
tools/hooks/builtin.py — 内置 Hook（钩子）处理器
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
内置三个核心处理器：
  · before_file_write  — 敏感信息检测（密钥/密码泄漏防护）
  · after_tool_call    — 心绪引擎事件上报（工具调用后通知）
  · on_error           — 错误日志记录（统一错误追踪）
"""

from __future__ import annotations

import logging
import re
import time
from typing import Any

from openagi.tools.hooks.manager import HookManager, HookPoint

logger = logging.getLogger("openagi.tools.hooks.builtin")

# ─── 敏感信息检测规则 ────────────────────────────────────────────────────────

_SENSITIVE_PATTERNS: list[tuple[str, str]] = [
    # (正则模式, 描述)
    (r"(?i)(api[_-]?key|apikey)\s*[:=]\s*['\"]?[A-Za-z0-9\-_]{16,}", "API密钥（API Key）"),
    (r"(?i)(secret[_-]?key|secret)\s*[:=]\s*['\"]?[A-Za-z0-9\-_]{16,}", "密钥（Secret Key）"),
    (r"(?i)password\s*[:=]\s*['\"]?.{6,}", "密码（Password）"),
    (r"(?i)token\s*[:=]\s*['\"]?[A-Za-z0-9\-_.]{16,}", "令牌（Token）"),
    (r"sk-[A-Za-z0-9]{32,}", "OpenAI密钥"),
    (r"ghp_[A-Za-z0-9]{36}", "GitHub个人访问令牌"),
    (r"AIza[A-Za-z0-9\-_]{35}", "Google API密钥"),
    (r"(?i)aws[_-]?access[_-]?key[_-]?id\s*[:=]\s*[A-Z0-9]{16,}", "AWS访问密钥ID"),
    (r"(?i)private[_-]?key\s*[:=]\s*['\"]?[A-Za-z0-9\-_/+]{16,}", "私钥（Private Key）"),
    (r"-----BEGIN\s+(RSA\s+)?PRIVATE KEY-----", "RSA私钥（PEM格式）"),
    (r"(?i)mysql://.*:.*@", "MySQL连接串（含密码）"),
    (r"(?i)postgres://.*:.*@", "PostgreSQL连接串（含密码）"),
    (r"(?i)(access_token|refresh_token)\s*[:=]\s*['\"]?[A-Za-z0-9\-_.]{16,}", "OAuth令牌"),
]


def before_file_write(ctx: dict[str, Any]) -> bool | None:
    """
    内置 Hook：写文件前检测敏感信息。

    Context（上下文）期望包含：
      - path: 文件路径（字符串）
      - content: 即将写入的内容（字符串）

    若检测到敏感信息：
      - 在 ctx 中写入 "sensitive_warnings" 列表（不阻断，由上层决定是否中止）
      - 记录警告日志
    """
    path    = ctx.get("path", "<未知路径>")
    content = ctx.get("content", "")

    if not isinstance(content, str):
        return None  # 非文本内容，跳过

    warnings: list[str] = []
    for pattern, description in _SENSITIVE_PATTERNS:
        if re.search(pattern, content):
            warnings.append(description)
            logger.warning(f"[敏感检测] 文件 {path} 中检测到疑似 {description}")

    if warnings:
        ctx["sensitive_warnings"] = warnings
        ctx["sensitive_detected"] = True
        logger.warning(
            f"[敏感检测] 共检测到 {len(warnings)} 类敏感信息: {', '.join(warnings)}"
        )
    else:
        ctx["sensitive_detected"] = False

    return None  # 不阻断，仅记录


def after_tool_call(ctx: dict[str, Any]) -> None:
    """
    内置 Hook：工具调用完成后向心绪引擎（HeartEngine）上报事件。

    Context（上下文）期望包含：
      - tool_name:    工具名称
      - success:      是否成功（bool）
      - duration_ms:  耗时毫秒数（float）
      - error:        错误信息（若有）

    心绪引擎不可用时，仅记录日志，不抛出异常。
    """
    tool_name   = ctx.get("tool_name", "unknown")
    success     = ctx.get("success", True)
    duration_ms = ctx.get("duration_ms", 0)
    error       = ctx.get("error")

    # 记录结构化日志（可被监控系统采集）
    log_data = {
        "event":       "tool_call",
        "tool":        tool_name,
        "success":     success,
        "duration_ms": duration_ms,
        "timestamp":   time.time(),
    }
    if error:
        log_data["error"] = error

    if success:
        logger.info(f"[工具上报] {tool_name} 成功, 耗时 {duration_ms:.1f}ms")
    else:
        logger.warning(f"[工具上报] {tool_name} 失败: {error}")

    # 尝试调用心绪引擎（HeartEngine）的 push_event 方法
    heart = ctx.get("heart_engine")
    if heart is not None:
        try:
            event_type = "task_success" if success else "task_failed"
            note       = f"工具 {tool_name} {'成功' if success else '失败'}, 耗时 {duration_ms:.1f}ms"
            if hasattr(heart, "push_event"):
                heart.push_event(event_type, source="tool_hook", note=note)
        except Exception as e:
            logger.debug(f"[工具上报] 心绪引擎上报失败（非致命）: {e}")

    # 写入上下文，供后续 Hook 读取
    ctx["reported"] = True


def on_error(ctx: dict[str, Any]) -> None:
    """
    内置 Hook：统一错误日志记录。

    Context（上下文）期望包含：
      - error:       错误信息（字符串或异常对象）
      - source:      错误来源（工具名/模块名等）
      - error_type:  错误类型分类（可选，如 timeout/network/permission）
      - traceback:   异常堆栈（可选字符串）

    错误按严重程度分级：
      - critical: 系统级错误（OOM（内存溢出）/权限拒绝）
      - error:    功能性错误（工具调用失败）
      - warning:  可恢复的非致命错误
    """
    error      = ctx.get("error", "未知错误")
    source     = ctx.get("source", "unknown")
    error_type = ctx.get("error_type", "error")
    traceback  = ctx.get("traceback", "")

    error_str = str(error)

    # 判断严重程度
    is_critical = any(kw in error_str.lower() for kw in [
        "memoryerror", "permission denied", "segfault",
        "killed", "oom", "out of memory",
    ])

    log_entry = {
        "source":     source,
        "error":      error_str[:500],
        "type":       error_type,
        "timestamp":  time.time(),
    }
    if traceback:
        log_entry["traceback"] = traceback[:1000]

    if is_critical:
        logger.critical(f"[错误记录] 严重错误 — 来源: {source} | 错误: {error_str[:200]}")
    else:
        logger.error(f"[错误记录] 来源: {source} | 类型: {error_type} | 错误: {error_str[:200]}")

    if traceback:
        logger.debug(f"[错误记录] 堆栈:\n{traceback[:500]}")

    # 统计累计错误（写回上下文供调用方读取）
    ctx["error_logged"]   = True
    ctx["error_critical"] = is_critical
    ctx["log_entry"]      = log_entry


# ─── 注册内置 Hook ────────────────────────────────────────────────────────────

def register_builtin_hooks(manager: HookManager) -> None:
    """
    将三个内置 Hook 处理器注册到 HookManager（钩子管理器）。

    优先级设计：
      - before_file_write: priority=10（最早执行，保证安全检测先行）
      - after_tool_call:   priority=50（中等优先级）
      - on_error:          priority=10（最早执行，确保错误被第一时间记录）
    """
    manager.register(
        point=HookPoint.BEFORE_FILE_WRITE,
        handler=before_file_write,
        name="builtin_sensitive_detector",
        priority=10,
        description="写文件前自动检测密钥/密码等敏感信息泄露",
    )
    manager.register(
        point=HookPoint.AFTER_TOOL_CALL,
        handler=after_tool_call,
        name="builtin_tool_reporter",
        priority=50,
        description="工具调用后向心绪引擎上报事件，记录成功/失败统计",
    )
    manager.register(
        point=HookPoint.ON_ERROR,
        handler=on_error,
        name="builtin_error_logger",
        priority=10,
        description="统一错误日志记录，按严重程度分级输出",
    )
    logger.info("[内置Hook] 已注册 3 个内置处理器: 敏感检测/工具上报/错误记录")
