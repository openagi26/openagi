"""
tools/executor.py — 沙盒代码执行器
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
功能：
  · Python 代码沙盒执行（subprocess（子进程）隔离）
  · Shell 命令执行
  · 超时保护（默认 30 秒）
  · 危险命令检测（rm -rf / os.system 等）
  · 结构化结果收集（stdout/stderr/exit_code）

设计参考：openagi_m2/soul/action_executor.py
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import sys
import tempfile
import textwrap
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

logger = logging.getLogger("openagi.tools.executor")

# ─── 配置常量 ────────────────────────────────────────────────────────────────

DEFAULT_TIMEOUT_SEC  = 30
MAX_TIMEOUT_SEC      = 300
MAX_OUTPUT_CHARS     = 10_000    # 超出则截断

# 沙盒工作目录（每次执行隔离在此目录下）
SANDBOX_DIR = Path(tempfile.gettempdir()) / "openagi_sandbox"

# ─── 危险命令/代码模式（命中则拒绝执行）────────────────────────────────────────

_DANGEROUS_SHELL_PATTERNS: list[str] = [
    r"rm\s+-rf?\s+[/~]",           # rm -rf / 或 ~/
    r"rm\s+-rf?\s+\*",             # rm -rf *
    r":\(\)\{:\|:&\};:",           # Fork 炸弹
    r"mkfs\.",                     # 格式化磁盘
    r"dd\s+if=.*of=/dev/",         # 覆写磁盘
    r">\s*/dev/sda",               # 覆写磁盘
    r"chmod\s+-R\s+777\s+/",       # 全局权限放开
    r"curl\s+.*\|\s*(ba)?sh",      # 管道执行远程脚本
    r"wget\s+.*\|\s*(ba)?sh",      # 管道执行远程脚本
    r"sudo\s+rm",                  # sudo 删除
    r">\s*/etc/passwd",            # 覆写系统文件
    r">\s*/etc/shadow",
]

_DANGEROUS_PYTHON_PATTERNS: list[str] = [
    r"shutil\.rmtree\s*\(\s*['\"/]",        # shutil.rmtree("/")
    r"os\.remove\s*\(\s*['\"/]",
    r"os\.system\s*\(",
    r"subprocess\.(call|run|Popen)\s*\(",    # 在沙盒 Python 中禁止再派生子进程
    r"__import__\s*\(\s*['\"]os['\"]",
    r"eval\s*\(.{0,200}(exec|import|open)",  # 嵌套 eval/exec 注入
    r"open\s*\(.*['\"]w['\"].*\)\s*\.",      # 写文件（使用 context manager 方式）
    r"\.env",                                # 不能访问 .env 密钥文件
    r"/etc/shadow",
    r"/etc/passwd",
    r"soul/",                                # 禁止访问 soul/ 核心人格数据目录
]


# ─── 执行结果 ─────────────────────────────────────────────────────────────────

@dataclass
class ExecutionResult:
    """
    代码/命令执行结果。

    属性：
      name        — 脚本名或命令描述
      success     — 是否成功（exit_code == 0）
      stdout      — 标准输出
      stderr      — 标准错误输出
      exit_code   — 退出码（-1=拒绝执行, -2=超时, -3=内部错误）
      elapsed_sec — 实际耗时（秒）
      blocked_by  — 若被拦截，说明触发的危险规则
    """
    name:        str
    success:     bool
    stdout:      str
    stderr:      str
    exit_code:   int
    elapsed_sec: float
    blocked_by:  str | None = None

    def __str__(self) -> str:
        status = "成功" if self.success else "失败"
        if self.blocked_by:
            status = f"已拦截({self.blocked_by})"
        parts = [
            f"[{status}] {self.name}",
            f"耗时: {self.elapsed_sec:.2f}s",
            f"退出码: {self.exit_code}",
        ]
        if self.stdout:
            parts.append(f"输出: {self.stdout[:300]}")
        if self.stderr:
            parts.append(f"错误: {self.stderr[:200]}")
        return " | ".join(parts)

    def to_dict(self) -> dict:
        return {
            "name":        self.name,
            "success":     self.success,
            "stdout":      self.stdout,
            "stderr":      self.stderr,
            "exit_code":   self.exit_code,
            "elapsed_sec": round(self.elapsed_sec, 3),
            "blocked_by":  self.blocked_by,
        }


# ─── 沙盒执行器 ──────────────────────────────────────────────────────────────

class SandboxExecutor:
    """
    沙盒代码执行器。

    所有代码在独立子进程中运行，提供超时保护和危险命令拦截。
    """

    def __init__(
        self,
        sandbox_dir: Path | None    = None,
        default_timeout: int        = DEFAULT_TIMEOUT_SEC,
        enable_safety_check: bool   = True,
    ):
        self.sandbox_dir         = Path(sandbox_dir) if sandbox_dir else SANDBOX_DIR
        self.default_timeout     = min(default_timeout, MAX_TIMEOUT_SEC)
        self.enable_safety_check = enable_safety_check

        # 确保沙盒目录存在
        self.sandbox_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"[Executor] 沙盒目录: {self.sandbox_dir}")

    # ── 公开 API ──────────────────────────────────────────────────────────────

    async def run_python(
        self,
        code:    str,
        name:    str | None = None,
        timeout: int | None = None,
    ) -> ExecutionResult:
        """
        在子进程中执行 Python 代码。

        参数：
          code    — Python 源代码（字符串）
          name    — 标识名（用于日志）
          timeout — 超时秒数，默认 DEFAULT_TIMEOUT_SEC

        实现：
          将代码写入临时 .py 文件，使用当前 Python 解释器执行，
          捕获 stdout/stderr，超时后强制终止。
        """
        name    = name or f"python_{int(time.time())}"
        timeout = min(timeout or self.default_timeout, MAX_TIMEOUT_SEC)

        # 安全检测
        block = self._check_python_safety(code) if self.enable_safety_check else None
        if block:
            logger.warning(f"[Executor] Python 代码被拦截: {block}")
            return ExecutionResult(
                name=name, success=False,
                stdout="", stderr=f"[拦截] 检测到危险代码模式: {block}",
                exit_code=-1, elapsed_sec=0.0, blocked_by=block,
            )

        # 写入临时脚本
        script_path = self.sandbox_dir / f"{name}.py"
        clean_code  = textwrap.dedent(code)
        script_path.write_text(clean_code, encoding="utf-8")
        logger.debug(f"[Executor] 脚本写入: {script_path}")

        result = await self._execute_subprocess(
            cmd=[sys.executable, str(script_path)],
            name=name,
            timeout=timeout,
            cwd=str(self.sandbox_dir),
        )

        # 清理临时文件
        try:
            script_path.unlink(missing_ok=True)
        except Exception:
            pass

        return result

    async def run_shell(
        self,
        command: str,
        name:    str | None = None,
        timeout: int | None = None,
        shell:   bool = True,
    ) -> ExecutionResult:
        """
        执行 Shell 命令。

        参数：
          command — Shell 命令字符串
          name    — 标识名
          timeout — 超时秒数
          shell   — 是否通过 shell 执行（默认 True，支持管道等）

        安全：
          启用 enable_safety_check 时，会检测危险 Shell 命令。
        """
        name    = name or f"shell_{int(time.time())}"
        timeout = min(timeout or self.default_timeout, MAX_TIMEOUT_SEC)

        # 安全检测
        block = self._check_shell_safety(command) if self.enable_safety_check else None
        if block:
            logger.warning(f"[Executor] Shell 命令被拦截: {block}")
            return ExecutionResult(
                name=name, success=False,
                stdout="", stderr=f"[拦截] 检测到危险命令: {block}",
                exit_code=-1, elapsed_sec=0.0, blocked_by=block,
            )

        if shell:
            cmd: list[str] | str = command
        else:
            cmd = command.split()

        return await self._execute_subprocess(
            cmd=cmd, name=name, timeout=timeout,
            cwd=str(self.sandbox_dir), shell=shell,
        )

    async def run_python_file(
        self,
        file_path: str | Path,
        args:      list[str] | None = None,
        timeout:   int | None = None,
    ) -> ExecutionResult:
        """
        执行已存在的 Python 脚本文件。

        参数：
          file_path — 脚本路径
          args      — 传给脚本的命令行参数
          timeout   — 超时秒数
        """
        path    = Path(file_path)
        name    = path.stem
        timeout = min(timeout or self.default_timeout, MAX_TIMEOUT_SEC)

        if not path.exists():
            return ExecutionResult(
                name=name, success=False,
                stdout="", stderr=f"文件不存在: {path}",
                exit_code=-1, elapsed_sec=0.0,
            )

        cmd = [sys.executable, str(path)] + (args or [])
        return await self._execute_subprocess(
            cmd=cmd, name=name, timeout=timeout,
            cwd=str(path.parent),
        )

    # ── 内部实现 ──────────────────────────────────────────────────────────────

    async def _execute_subprocess(
        self,
        cmd:     list[str] | str,
        name:    str,
        timeout: int,
        cwd:     str | None = None,
        shell:   bool       = False,
    ) -> ExecutionResult:
        """
        通用子进程执行，带超时保护。

        使用 asyncio.create_subprocess_exec（非shell）或
        asyncio.create_subprocess_shell（shell 模式）。
        """
        start = time.monotonic()
        try:
            if shell and isinstance(cmd, str):
                proc = await asyncio.create_subprocess_shell(
                    cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=cwd,
                )
            else:
                proc = await asyncio.create_subprocess_exec(
                    *(cmd if isinstance(cmd, list) else cmd.split()),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=cwd,
                )

            try:
                stdout_b, stderr_b = await asyncio.wait_for(
                    proc.communicate(), timeout=timeout
                )
                exit_code = proc.returncode or 0
            except asyncio.TimeoutError:
                proc.kill()
                await proc.communicate()
                elapsed = time.monotonic() - start
                logger.warning(f"[Executor] {name} 执行超时（{timeout}s），已强制终止")
                return ExecutionResult(
                    name=name, success=False,
                    stdout="", stderr=f"[超时] 执行超过 {timeout} 秒，已强制终止",
                    exit_code=-2, elapsed_sec=elapsed,
                )

            elapsed = time.monotonic() - start
            stdout  = stdout_b.decode("utf-8", errors="replace")[:MAX_OUTPUT_CHARS]
            stderr  = stderr_b.decode("utf-8", errors="replace")[:MAX_OUTPUT_CHARS]
            success = (exit_code == 0)

            if success:
                logger.debug(f"[Executor] {name} 执行成功 ({elapsed:.2f}s)")
            else:
                logger.warning(f"[Executor] {name} 执行失败 exit={exit_code}: {stderr[:100]}")

            return ExecutionResult(
                name=name, success=success,
                stdout=stdout, stderr=stderr,
                exit_code=exit_code, elapsed_sec=elapsed,
            )

        except FileNotFoundError as e:
            elapsed = time.monotonic() - start
            return ExecutionResult(
                name=name, success=False,
                stdout="", stderr=f"命令不存在: {e}",
                exit_code=-1, elapsed_sec=elapsed,
            )
        except Exception as e:
            elapsed = time.monotonic() - start
            logger.error(f"[Executor] {name} 内部错误: {e}")
            return ExecutionResult(
                name=name, success=False,
                stdout="", stderr=f"[内部错误] {e}",
                exit_code=-3, elapsed_sec=elapsed,
            )

    # ── 安全检测 ──────────────────────────────────────────────────────────────

    def _check_python_safety(self, code: str) -> str | None:
        """
        检测 Python 代码中的危险模式。
        返回第一个匹配的模式描述，无危险时返回 None。
        """
        for pattern in _DANGEROUS_PYTHON_PATTERNS:
            if re.search(pattern, code, re.IGNORECASE):
                return pattern
        return None

    def _check_shell_safety(self, command: str) -> str | None:
        """
        检测 Shell 命令中的危险模式。
        返回第一个匹配的模式描述，无危险时返回 None。
        """
        for pattern in _DANGEROUS_SHELL_PATTERNS:
            if re.search(pattern, command, re.IGNORECASE):
                return pattern
        return None

    def is_safe_python(self, code: str) -> bool:
        """判断 Python 代码是否安全（无危险模式）。"""
        return self._check_python_safety(code) is None

    def is_safe_shell(self, command: str) -> bool:
        """判断 Shell 命令是否安全。"""
        return self._check_shell_safety(command) is None

    # ── 工具信息 ──────────────────────────────────────────────────────────────

    def get_info(self) -> dict:
        """返回执行器配置信息。"""
        return {
            "sandbox_dir":         str(self.sandbox_dir),
            "default_timeout_sec": self.default_timeout,
            "max_timeout_sec":     MAX_TIMEOUT_SEC,
            "safety_check":        self.enable_safety_check,
            "python_interpreter":  sys.executable,
            "python_patterns":     len(_DANGEROUS_PYTHON_PATTERNS),
            "shell_patterns":      len(_DANGEROUS_SHELL_PATTERNS),
        }
