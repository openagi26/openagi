"""宪法与权限系统测试。"""


def test_constitution_module():
    from openagi.social.constitution.core import Constitution
    c = Constitution()
    assert c is not None


def test_create_default_constitution():
    from openagi.social.constitution.core import create_default_constitution
    c = create_default_constitution()
    assert c is not None
    assert len(c.goals) > 0


def test_validate_constitution():
    from openagi.social.constitution.core import create_default_constitution, validate_constitution
    c = create_default_constitution()
    errors = validate_constitution(c)
    assert isinstance(errors, list)


def test_get_permission_level():
    from openagi.social.constitution.core import (
        create_default_constitution, get_permission_level_for_action,
    )
    c = create_default_constitution()
    level = get_permission_level_for_action(c, "read_file")
    assert level is not None


def test_permissions_module():
    from openagi.social.permissions import PermissionMatrix
    pm = PermissionMatrix()
    assert pm is not None


def test_permissions_check():
    from openagi.social.permissions import PermissionMatrix, PermissionContext
    pm = PermissionMatrix()
    ctx = PermissionContext(
        session_id="test-session",
        action="read_file",
        agent_level="L0",
    )
    result = pm.check(ctx)
    assert result is not None


def test_is_forbidden():
    from openagi.social.permissions import PermissionMatrix
    pm = PermissionMatrix()
    # 正常操作不应被禁止
    assert not pm.is_forbidden("read_file")


def test_l2_grant():
    from openagi.social.permissions import grant_l2_permission, has_l2_grant, revoke_l2_permission
    grant_l2_permission("test-session-123")
    assert has_l2_grant("test-session-123")
    revoke_l2_permission("test-session-123")
    assert not has_l2_grant("test-session-123")
