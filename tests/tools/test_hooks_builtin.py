"""
tests/tools/test_hooks_builtin.py — 内置 Hook（钩子）处理器测试
"""

from __future__ import annotations

import pytest
from unittest.mock import MagicMock

from openagi.tools.hooks.builtin import (
    before_file_write,
    after_tool_call,
    on_error,
    register_builtin_hooks,
)
from openagi.tools.hooks.manager import HookManager, HookPoint


# ─── before_file_write 敏感信息检测测试 ──────────────────────────────────────

def test_no_sensitive_info():
    """普通文本不应触发敏感检测。"""
    ctx = {"path": "/tmp/hello.txt", "content": "Hello, World!\n这是普通内容。"}
    before_file_write(ctx)
    assert ctx.get("sensitive_detected") is False
    assert ctx.get("sensitive_warnings", []) == []


def test_detects_api_key():
    """包含 API 密钥的内容应被检测到。"""
    ctx = {
        "path": "/tmp/config.py",
        "content": 'api_key = "sk-abcdefghijklmnopqrstuvwxyz1234567890ABCDEF"',
    }
    before_file_write(ctx)
    assert ctx.get("sensitive_detected") is True
    assert len(ctx.get("sensitive_warnings", [])) >= 1


def test_detects_openai_key():
    """OpenAI 密钥格式应被检测到。"""
    ctx = {
        "path": "/tmp/settings.py",
        "content": "OPENAI_API_KEY = 'sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'",
    }
    before_file_write(ctx)
    assert ctx.get("sensitive_detected") is True


def test_detects_github_token():
    """GitHub 个人访问令牌（PAT）应被检测到。"""
    ctx = {
        "path": "/tmp/deploy.sh",
        "content": "export GITHUB_TOKEN=ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890",
    }
    before_file_write(ctx)
    assert ctx.get("sensitive_detected") is True


def test_detects_password():
    """明文密码赋值应被检测到。"""
    ctx = {
        "path": "/tmp/db_config.py",
        "content": "password = 'super_secret_password_123'",
    }
    before_file_write(ctx)
    assert ctx.get("sensitive_detected") is True


def test_detects_rsa_private_key():
    """RSA 私钥 PEM 头部应被检测到。"""
    ctx = {
        "path": "/tmp/key.pem",
        "content": "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----",
    }
    before_file_write(ctx)
    assert ctx.get("sensitive_detected") is True


def test_detects_database_url_with_password():
    """含密码的数据库连接串应被检测到。"""
    ctx = {
        "path": "/tmp/database.py",
        "content": "DB_URL = 'postgres://admin:secretpass@localhost:5432/mydb'",
    }
    before_file_write(ctx)
    assert ctx.get("sensitive_detected") is True


def test_non_string_content_skipped():
    """非字符串内容（如二进制数据）应跳过检测，不抛出异常。"""
    ctx = {"path": "/tmp/image.png", "content": b"\x89PNG\r\n\x1a\n"}
    before_file_write(ctx)  # 不应抛出异常
    assert "sensitive_detected" not in ctx  # 跳过，不写入标志


def test_does_not_raise_on_empty_content():
    """空内容不应引发异常。"""
    ctx = {"path": "/tmp/empty.txt", "content": ""}
    before_file_write(ctx)
    assert ctx.get("sensitive_detected") is False


def test_returns_none_not_false():
    """before_file_write 应返回 None（不阻断 Hook 链）。"""
    ctx    = {"path": "/tmp/test.txt", "content": "safe content"}
    result = before_file_write(ctx)
    assert result is None


# ─── after_tool_call 工具上报测试 ─────────────────────────────────────────────

def test_after_tool_call_success():
    """成功工具调用应标记 reported=True。"""
    ctx = {"tool_name": "web_search", "success": True, "duration_ms": 150.5}
    after_tool_call(ctx)
    assert ctx.get("reported") is True


def test_after_tool_call_failure():
    """失败工具调用也应标记 reported=True。"""
    ctx = {
        "tool_name": "file_write",
        "success":   False,
        "duration_ms": 5.0,
        "error": "权限不足",
    }
    after_tool_call(ctx)
    assert ctx.get("reported") is True


def test_after_tool_call_with_heart_engine():
    """存在心绪引擎时应调用 push_event（事件推送）。"""
    mock_heart     = MagicMock()
    ctx = {
        "tool_name":   "bash",
        "success":     True,
        "duration_ms": 200.0,
        "heart_engine": mock_heart,
    }
    after_tool_call(ctx)
    mock_heart.push_event.assert_called_once()
    call_args = mock_heart.push_event.call_args
    assert call_args[0][0] == "task_success"


def test_after_tool_call_heart_engine_failure_ignored():
    """心绪引擎抛出异常时应被静默忽略，不影响 Hook 执行。"""
    mock_heart = MagicMock()
    mock_heart.push_event.side_effect = RuntimeError("心绪引擎异常")
    ctx = {
        "tool_name":    "python_exec",
        "success":      False,
        "duration_ms":  0.0,
        "heart_engine": mock_heart,
    }
    after_tool_call(ctx)  # 不应抛出异常
    assert ctx.get("reported") is True


def test_after_tool_call_missing_fields():
    """缺少 tool_name 等字段时应有合理默认值，不抛出异常。"""
    ctx = {}
    after_tool_call(ctx)
    assert ctx.get("reported") is True


# ─── on_error 错误日志测试 ───────────────────────────────────────────────────

def test_on_error_basic():
    """基本错误应被记录，error_logged 标志应为 True。"""
    ctx = {"error": "网络连接失败", "source": "web_fetch", "error_type": "network"}
    on_error(ctx)
    assert ctx.get("error_logged") is True
    assert ctx.get("error_critical") is False
    assert "log_entry" in ctx


def test_on_error_critical_detection():
    """包含 'MemoryError' 的错误应被标记为 critical（严重）。"""
    ctx = {
        "error":      "MemoryError: 内存不足",
        "source":     "python_exec",
        "error_type": "runtime",
    }
    on_error(ctx)
    assert ctx.get("error_critical") is True


def test_on_error_permission_denied_is_critical():
    """'permission denied' 错误应被标记为严重。"""
    ctx = {"error": "Permission denied: /etc/shadow", "source": "file_read"}
    on_error(ctx)
    assert ctx.get("error_critical") is True


def test_on_error_normal_exception_not_critical():
    """普通异常不应被标记为严重。"""
    ctx = {"error": "ValueError: 无效参数", "source": "validator"}
    on_error(ctx)
    assert ctx.get("error_critical") is False


def test_on_error_log_entry_structure():
    """log_entry 应包含必要字段。"""
    ctx = {"error": "Test Error", "source": "unit_test", "error_type": "test"}
    on_error(ctx)
    entry = ctx.get("log_entry", {})
    assert "source" in entry
    assert "error" in entry
    assert "type" in entry
    assert "timestamp" in entry


def test_on_error_with_traceback():
    """包含 traceback（堆栈）的错误应被记录在 log_entry 中。"""
    ctx = {
        "error":     "AttributeError: NoneType has no attribute 'run'",
        "source":    "agent_runner",
        "traceback": "Traceback (most recent call last):\n  File ...",
    }
    on_error(ctx)
    assert ctx.get("error_logged") is True


def test_on_error_missing_fields():
    """缺少字段时应有合理默认值，不抛出异常。"""
    ctx = {}
    on_error(ctx)
    assert ctx.get("error_logged") is True


# ─── register_builtin_hooks 集成测试 ─────────────────────────────────────────

def test_register_builtin_hooks():
    """注册后 HookManager 中应包含三个内置处理器。"""
    mgr = HookManager()
    register_builtin_hooks(mgr)
    all_handlers = mgr.list_handlers()
    names = {h["name"] for h in all_handlers}
    assert "builtin_sensitive_detector" in names
    assert "builtin_tool_reporter"      in names
    assert "builtin_error_logger"       in names


def test_builtin_hooks_priority():
    """安全检测和错误日志的优先级应为 10（最高之一）。"""
    mgr = HookManager()
    register_builtin_hooks(mgr)
    all_handlers = {h["name"]: h for h in mgr.list_handlers()}
    assert all_handlers["builtin_sensitive_detector"]["priority"] == 10
    assert all_handlers["builtin_error_logger"]["priority"]       == 10


async def test_builtin_hooks_end_to_end():
    """端到端测试：trigger 触发后内置 Hook 应正确执行。"""
    mgr = HookManager()
    register_builtin_hooks(mgr)

    # 触发 before_file_write
    ctx = {"path": "/tmp/test.py", "content": "print('hello')"}
    result = await mgr.trigger(HookPoint.BEFORE_FILE_WRITE, context=ctx)
    assert result.succeeded >= 1
    assert ctx.get("sensitive_detected") is False

    # 触发 on_error
    ctx2 = {"error": "RuntimeError: test", "source": "test"}
    result2 = await mgr.trigger(HookPoint.ON_ERROR, context=ctx2)
    assert result2.succeeded >= 1
    assert ctx2.get("error_logged") is True
