"""
权限熔断矩阵 — OpenAGI L0-L4 权限系统
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
移植自 NewClaw v6 fuse-matrix，Python重写版本。

权限层级：
  L0 — 只读/查询，直接执行
  L1 — 受限外部读（文件读/API查询），≥2核审计
  L2 — 修改操作（写文件/API调用），≥3核+用户弹窗确认
  L3 — 高风险操作（删除/修改关键配置），4核+AI审计+人机双签
  L4 — 永久禁止（金融密码/核心系统销毁），任何情况均拒绝
"""

from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

logger = logging.getLogger("openagi.permissions")


# ---------------------------------------------------------------------------
# 动作类型注册表（action_type → 最低所需权限级别）
# ---------------------------------------------------------------------------

ACTION_PERMISSION_MAP: dict[str, str] = {
    # L0 — 只读，直接执行
    "read_file": "L0",
    "list_files": "L0",
    "search_memory": "L0",
    "get_status": "L0",
    "query_api": "L0",
    "browser_search": "L0",
    "get_settings": "L0",

    # L1 — 受限外部读（需≥2核审计）
    "read_external_url": "L1",
    "read_env_vars": "L1",
    "access_cookies": "L1",
    "read_clipboard": "L1",

    # L2 — 修改操作（需≥3核+用户确认）
    "write_file": "L2",
    "edit_file": "L2",
    "delete_file": "L2",
    "api_call_write": "L2",
    "browser_form_fill": "L2",
    "git_commit": "L2",
    "install_package": "L2",
    "modify_settings": "L2",

    # L3 — 高风险操作（需4核+AI审计+人机双签）
    "git_push": "L3",
    "delete_database": "L3",
    "modify_constitution": "L3",
    "system_shutdown": "L3",
    "access_private_key": "L3",

    # L4 — 永久禁止
    "bank_password_access": "L4",
    "destroy_core_system": "L4",
    "override_constitution": "L4",
}

# L4 永久禁止内容关键词（正则）
L4_FORBIDDEN_PATTERNS: list[str] = [
    r"银行.*密码|bank.*password",
    r"destroy.*system|删除.*系统",
    r"override.*constitution|覆盖.*宪法",
    r"rm\s+-rf\s+/",
    r"DROP\s+TABLE.*(?:users|sessions|core_dna)",
]


# ---------------------------------------------------------------------------
# 数据结构
# ---------------------------------------------------------------------------

class PermissionDecision(StrEnum):
    ALLOWED = "allowed"
    REQUIRES_CONFIRMATION = "requires_confirmation"
    REQUIRES_DUAL_SIGN = "requires_dual_sign"
    DENIED = "denied"
    PERMANENTLY_FORBIDDEN = "permanently_forbidden"


@dataclass
class PermissionResult:
    """权限判定结果。"""
    allowed: bool
    decision: PermissionDecision
    required_level: str
    agent_level: str
    action: str
    reason: str
    requires_ui_confirmation: bool = False
    requires_ai_audit: bool = False
    requires_human_sign: bool = False
    constraint_id: str = ""


@dataclass
class PermissionContext:
    """权限判定上下文。"""
    action: str
    agent_level: str = "L0"
    session_id: str = ""
    payload: dict[str, Any] = field(default_factory=dict)
    ai_audit_passed: bool | None = None
    human_signed: bool | None = None
    user_confirmed: bool | None = None


# ---------------------------------------------------------------------------
# 权限级别比较
# ---------------------------------------------------------------------------

_LEVEL_ORDER: dict[str, int] = {"L0": 0, "L1": 1, "L2": 2, "L3": 3, "L4": 4}


def _level_gte(a: str, b: str) -> bool:
    """a 的权限是否 >= b（权限足够）。"""
    return _LEVEL_ORDER.get(a, 0) >= _LEVEL_ORDER.get(b, 0)


def _scan_for_l4_content(payload: dict[str, Any]) -> tuple[bool, str]:
    """扫描操作内容是否触发 L4 永久禁止模式。"""
    content = str(payload)
    for pattern in L4_FORBIDDEN_PATTERNS:
        if re.search(pattern, content, re.IGNORECASE):
            return True, f"内容匹配L4禁止模式: {pattern}"
    return False, ""


# ---------------------------------------------------------------------------
# 核心权限判定（纯函数）
# ---------------------------------------------------------------------------

def check_permission(ctx: PermissionContext) -> PermissionResult:
    """
    权限判定主函数（纯函数，无副作用）。

    流程：
      1. L4 内容扫描（最高优先级）
      2. 查找操作所需权限级别
      3. L4 操作类型检查
      4. 越权检查（Agent级别不足）
      5. L0/L1 直接允许
      6. L2 用户确认流程
      7. L3 双签流程
    """
    action = ctx.action
    agent_level = ctx.agent_level

    # 1. L4 内容扫描
    is_l4_content, l4_reason = _scan_for_l4_content(ctx.payload)
    if is_l4_content:
        logger.warning(f"[PERM] L4永久拒绝(内容扫描) action={action}")
        return PermissionResult(
            allowed=False,
            decision=PermissionDecision.PERMANENTLY_FORBIDDEN,
            required_level="L4",
            agent_level=agent_level,
            action=action,
            reason=l4_reason,
            constraint_id="L4_CONTENT_SCAN",
        )

    # 2. 查找所需权限（未知操作默认L2）
    required_level = ACTION_PERMISSION_MAP.get(action, "L2")

    # 3. L4 操作类型检查
    if required_level == "L4":
        logger.warning(f"[PERM] L4永久拒绝(操作类型) action={action}")
        return PermissionResult(
            allowed=False,
            decision=PermissionDecision.PERMANENTLY_FORBIDDEN,
            required_level="L4",
            agent_level=agent_level,
            action=action,
            reason="permanently_forbidden",
            constraint_id="L4_ACTION_TYPE",
        )

    # 4. 越权检查
    if not _level_gte(agent_level, required_level):
        logger.warning(
            f"[PERM] 越权拒绝 action={action} agent={agent_level} required={required_level}"
        )
        return PermissionResult(
            allowed=False,
            decision=PermissionDecision.DENIED,
            required_level=required_level,
            agent_level=agent_level,
            action=action,
            reason=f"权限不足: {action} 需要 {required_level}，当前 {agent_level}",
            constraint_id="PRIVILEGE_ESCALATION",
        )

    # 5. L0/L1 直接允许
    if required_level in ("L0", "L1"):
        return PermissionResult(
            allowed=True,
            decision=PermissionDecision.ALLOWED,
            required_level=required_level,
            agent_level=agent_level,
            action=action,
            reason="L0/L1操作直接执行",
        )

    # 6. L2 — 用户确认
    if required_level == "L2":
        if ctx.user_confirmed is True:
            return PermissionResult(
                allowed=True,
                decision=PermissionDecision.ALLOWED,
                required_level=required_level,
                agent_level=agent_level,
                action=action,
                reason="L2操作已获用户确认",
            )
        elif ctx.user_confirmed is False:
            return PermissionResult(
                allowed=False,
                decision=PermissionDecision.DENIED,
                required_level=required_level,
                agent_level=agent_level,
                action=action,
                reason="rejected_by_user",
                constraint_id="L2_USER_REJECTED",
            )
        else:
            return PermissionResult(
                allowed=False,
                decision=PermissionDecision.REQUIRES_CONFIRMATION,
                required_level=required_level,
                agent_level=agent_level,
                action=action,
                reason="L2操作需要用户确认",
                requires_ui_confirmation=True,
            )

    # 7. L3 — AI审计 + 人机双签
    if required_level == "L3":
        ai_ok = ctx.ai_audit_passed is True
        human_ok = ctx.human_signed is True
        if ai_ok and human_ok:
            return PermissionResult(
                allowed=True,
                decision=PermissionDecision.ALLOWED,
                required_level=required_level,
                agent_level=agent_level,
                action=action,
                reason="L3操作：AI审计通过 + 人工签名确认",
            )
        missing = []
        if not ai_ok:
            missing.append("AI审计")
        if not human_ok:
            missing.append("人工签名")
        return PermissionResult(
            allowed=False,
            decision=PermissionDecision.REQUIRES_DUAL_SIGN,
            required_level=required_level,
            agent_level=agent_level,
            action=action,
            reason=f"L3操作需要: {', '.join(missing)}",
            requires_ai_audit=not ai_ok,
            requires_human_sign=not human_ok,
        )

    # 兜底
    return PermissionResult(
        allowed=False,
        decision=PermissionDecision.DENIED,
        required_level=required_level,
        agent_level=agent_level,
        action=action,
        reason="未知权限级别",
        constraint_id="UNKNOWN_LEVEL",
    )


# ---------------------------------------------------------------------------
# 便捷函数
# ---------------------------------------------------------------------------

def is_permanently_forbidden(action: str, payload: dict | None = None) -> bool:
    result = check_permission(PermissionContext(
        action=action, agent_level="L4", payload=payload or {}
    ))
    return result.decision == PermissionDecision.PERMANENTLY_FORBIDDEN


# ---------------------------------------------------------------------------
# L2 授权管理（支持在途任务撤销）
# ---------------------------------------------------------------------------

_active_l2_grants: dict[str, float] = {}


def grant_l2_permission(session_id: str) -> None:
    _active_l2_grants[session_id] = time.time()
    logger.info(f"[PERM] L2授权 session={session_id}")


def revoke_l2_permission(session_id: str) -> None:
    _active_l2_grants.pop(session_id, None)
    logger.info(f"[PERM] L2撤销 session={session_id}")


def has_l2_grant(session_id: str) -> bool:
    grant_time = _active_l2_grants.get(session_id)
    if grant_time is None:
        return False
    return (time.time() - grant_time) < 600  # 10分钟有效期


# ---------------------------------------------------------------------------
# PermissionMatrix 类（主入口）
# ---------------------------------------------------------------------------

class PermissionMatrix:
    """权限熔断矩阵（无状态，委托给模块级函数）。"""

    def check(self, ctx: PermissionContext) -> PermissionResult:
        return check_permission(ctx)

    def is_forbidden(self, action: str, payload: dict | None = None) -> bool:
        return is_permanently_forbidden(action, payload)
