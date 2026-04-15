"""工具注册表测试。"""

from openagi.tools.registry import ToolRegistry, ToolDefinition, create_default_registry


def test_register_and_get():
    reg = ToolRegistry()
    tool = ToolDefinition(name="test_tool", description="测试工具")
    reg.register(tool)
    assert reg.get("test_tool") is not None
    assert reg.get("nonexistent") is None


def test_unregister():
    reg = ToolRegistry()
    reg.register(ToolDefinition(name="temp", description="临时"))
    assert reg.unregister("temp")
    assert reg.get("temp") is None


def test_list_available_by_permission():
    reg = ToolRegistry()
    reg.register(ToolDefinition(name="t0", description="L0", permission_level="L0"))
    reg.register(ToolDefinition(name="t1", description="L1", permission_level="L1"))
    reg.register(ToolDefinition(name="t2", description="L2", permission_level="L2"))
    reg.register(ToolDefinition(name="t3", description="L3", permission_level="L3"))

    l1_tools = reg.list_available(max_permission="L1")
    assert len(l1_tools) == 2  # L0 + L1
    assert all(t.permission_level in ("L0", "L1") for t in l1_tools)


def test_disabled_tool_excluded():
    reg = ToolRegistry()
    reg.register(ToolDefinition(name="disabled", description="禁用", enabled=False))
    reg.register(ToolDefinition(name="enabled", description="启用", enabled=True))
    available = reg.list_available()
    assert len(available) == 1
    assert available[0].name == "enabled"


async def test_execute_tool():
    reg = ToolRegistry()
    reg.register(ToolDefinition(
        name="adder", description="加法", permission_level="L0",
        handler=lambda a, b: a + b,
    ))
    result = await reg.execute("adder", {"a": 3, "b": 5})
    assert result.success
    assert result.output == 8
    assert result.duration_ms >= 0


async def test_execute_permission_denied():
    reg = ToolRegistry()
    reg.register(ToolDefinition(name="dangerous", description="危险", permission_level="L3"))
    result = await reg.execute("dangerous", max_permission="L1")
    assert not result.success
    assert "权限不足" in result.error


async def test_execute_nonexistent():
    reg = ToolRegistry()
    result = await reg.execute("ghost_tool")
    assert not result.success
    assert "不存在" in result.error


async def test_execute_handler_error():
    reg = ToolRegistry()
    reg.register(ToolDefinition(
        name="broken", description="坏的", permission_level="L0",
        handler=lambda: 1 / 0,
    ))
    result = await reg.execute("broken")
    assert not result.success
    assert "division" in result.error.lower()


def test_default_registry():
    reg = create_default_registry()
    all_tools = reg.list_all()
    assert len(all_tools) >= 10
    categories = reg.get_categories()
    assert "文件操作" in categories
    assert "代码执行" in categories


def test_list_by_category():
    reg = create_default_registry()
    file_tools = reg.list_by_category("文件操作")
    assert len(file_tools) >= 3


def test_stats():
    reg = create_default_registry()
    stats = reg.get_stats()
    assert stats["total"] >= 10
    assert stats["enabled"] >= 10
    assert "文件操作" in stats["categories"]
