"""权限熔断矩阵测试 — 对应验收标准 Layer 9。"""
from __future__ import annotations

import pytest

from openagi.social.permissions import (
    PermissionContext,
    PermissionDecision,
    PermissionMatrix,
    check_permission,
    grant_l2_permission,
    has_l2_grant,
    is_permanently_forbidden,
    revoke_l2_permission,
)


# ---------------------------------------------------------------------------
# L0 直通测试
# ---------------------------------------------------------------------------

class TestL0Direct:
    def test_l0_read_file_allowed(self):
        ctx = PermissionContext(action="read_file", agent_level="L0")
        result = check_permission(ctx)
        assert result.allowed is True
        assert result.decision == PermissionDecision.ALLOWED

    def test_l0_search_memory_allowed(self):
        ctx = PermissionContext(action="search_memory", agent_level="L0")
        result = check_permission(ctx)
        assert result.allowed is True

    def test_l0_no_confirmation_wait(self):
        """L0 操作不应产生任何需要等待的状态。"""
        ctx = PermissionContext(action="get_status", agent_level="L0")
        result = check_permission(ctx)
        assert result.requires_ui_confirmation is False
        assert result.requires_ai_audit is False
        assert result.requires_human_sign is False


# ---------------------------------------------------------------------------
# 越权拦截测试
# ---------------------------------------------------------------------------

class TestPrivilegeEscalation:
    def test_l0_agent_cannot_write_file(self):
        """L0 Agent 尝试 L2 操作（写文件）→ 被拦截。"""
        ctx = PermissionContext(action="write_file", agent_level="L0")
        result = check_permission(ctx)
        assert result.allowed is False
        assert result.decision == PermissionDecision.DENIED
        assert result.constraint_id == "PRIVILEGE_ESCALATION"
        assert result.reason != ""

    def test_l1_agent_cannot_delete_database(self):
        """L1 Agent 无法执行 L3 操作。"""
        ctx = PermissionContext(action="delete_database", agent_level="L1")
        result = check_permission(ctx)
        assert result.allowed is False
        assert result.required_level == "L3"

    def test_l2_agent_cannot_override_constitution(self):
        """L2 Agent 无法执行 L4 操作（永久禁止）。"""
        ctx = PermissionContext(action="override_constitution", agent_level="L2")
        result = check_permission(ctx)
        assert result.allowed is False
        assert result.decision == PermissionDecision.PERMANENTLY_FORBIDDEN


# ---------------------------------------------------------------------------
# L2 确认流程测试
# ---------------------------------------------------------------------------

class TestL2Confirmation:
    def test_l2_without_confirmation_requires_ui(self):
        """L2 操作未确认 → 返回需要UI确认状态。"""
        ctx = PermissionContext(action="write_file", agent_level="L2",
                                user_confirmed=None)
        result = check_permission(ctx)
        assert result.allowed is False
        assert result.decision == PermissionDecision.REQUIRES_CONFIRMATION
        assert result.requires_ui_confirmation is True

    def test_l2_with_confirmation_allowed(self):
        """L2 操作用户确认后允许。"""
        ctx = PermissionContext(action="write_file", agent_level="L2",
                                user_confirmed=True)
        result = check_permission(ctx)
        assert result.allowed is True

    def test_l2_user_rejected(self):
        """L2 操作用户拒绝后，文件不修改，日志状态为 rejected_by_user。"""
        ctx = PermissionContext(action="edit_file", agent_level="L2",
                                user_confirmed=False)
        result = check_permission(ctx)
        assert result.allowed is False
        assert result.reason == "rejected_by_user"
        assert result.constraint_id == "L2_USER_REJECTED"


# ---------------------------------------------------------------------------
# L3 双签测试
# ---------------------------------------------------------------------------

class TestL3DualSign:
    def test_l3_requires_both_ai_and_human(self):
        """L3：AI通过但用户未确认 → 不执行。"""
        ctx = PermissionContext(action="git_push", agent_level="L3",
                                ai_audit_passed=True, human_signed=False)
        result = check_permission(ctx)
        assert result.allowed is False
        assert result.decision == PermissionDecision.REQUIRES_DUAL_SIGN
        assert result.requires_human_sign is True

    def test_l3_human_signed_but_ai_rejected(self):
        """L3：用户确认但AI拒绝 → 不执行。"""
        ctx = PermissionContext(action="delete_database", agent_level="L3",
                                ai_audit_passed=False, human_signed=True)
        result = check_permission(ctx)
        assert result.allowed is False
        assert result.requires_ai_audit is True

    def test_l3_both_approved(self):
        """L3：AI审计通过 + 人工签名 → 允许执行。"""
        ctx = PermissionContext(action="git_push", agent_level="L3",
                                ai_audit_passed=True, human_signed=True)
        result = check_permission(ctx)
        assert result.allowed is True


# ---------------------------------------------------------------------------
# L4 永久禁止测试
# ---------------------------------------------------------------------------

class TestL4PermanentlyForbidden:
    def test_l4_action_type_blocked(self):
        """L4 操作类型永久禁止，任何权限级别均拒绝。"""
        ctx = PermissionContext(action="bank_password_access", agent_level="L4")
        result = check_permission(ctx)
        assert result.allowed is False
        assert result.decision == PermissionDecision.PERMANENTLY_FORBIDDEN
        assert "permanently_forbidden" in result.reason

    def test_l4_content_scan_bank_password(self):
        """L4 内容扫描：银行密码关键词触发拒绝。"""
        ctx = PermissionContext(
            action="write_file", agent_level="L2",
            payload={"content": "银行账户密码: 123456"},
            user_confirmed=True
        )
        result = check_permission(ctx)
        assert result.allowed is False
        assert result.decision == PermissionDecision.PERMANENTLY_FORBIDDEN

    def test_l4_content_scan_rm_rf(self):
        """L4 内容扫描：rm -rf / 触发拒绝。"""
        ctx = PermissionContext(
            action="write_file", agent_level="L3",
            payload={"command": "rm -rf /"},
        )
        result = check_permission(ctx)
        assert result.allowed is False
        assert result.decision == PermissionDecision.PERMANENTLY_FORBIDDEN

    def test_is_permanently_forbidden_helper(self):
        assert is_permanently_forbidden("bank_password_access") is True
        assert is_permanently_forbidden("read_file") is False


# ---------------------------------------------------------------------------
# L2 授权撤销测试
# ---------------------------------------------------------------------------

class TestL2Revocation:
    def test_grant_and_revoke(self):
        session_id = "test_session_revoke"
        grant_l2_permission(session_id)
        assert has_l2_grant(session_id) is True
        revoke_l2_permission(session_id)
        assert has_l2_grant(session_id) is False

    def test_revoke_nonexistent_session(self):
        """撤销不存在的session不报错。"""
        revoke_l2_permission("nonexistent_session_xyz")


# ---------------------------------------------------------------------------
# PermissionMatrix 类测试
# ---------------------------------------------------------------------------

class TestPermissionMatrix:
    def test_matrix_check_delegates(self):
        matrix = PermissionMatrix()
        ctx = PermissionContext(action="read_file", agent_level="L0")
        result = matrix.check(ctx)
        assert result.allowed is True

    def test_matrix_is_forbidden(self):
        matrix = PermissionMatrix()
        assert matrix.is_forbidden("bank_password_access") is True
        assert matrix.is_forbidden("read_file") is False
