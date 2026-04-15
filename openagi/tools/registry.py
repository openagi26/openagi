"""
动态工具注册表 — 管理AI可调用的所有工具
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
功能：
  · 注册/注销工具
  · 按权限级别过滤可用工具
  · 工具执行与结果收集
  · 权限检查
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable

logger = logging.getLogger("openagi.tools")


@dataclass
class ToolDefinition:
    """工具定义。"""

    name: str
    description: str
    permission_level: str = "L0"  # L0-L3
    handler: Callable | None = None
    enabled: bool = True
    category: str = ""  # 文件/代码/网络/系统/数据
    parameters: dict = field(default_factory=dict)


@dataclass
class ToolResult:
    """工具执行结果。"""

    tool_name: str
    success: bool
    output: Any = None
    error: str | None = None
    duration_ms: float = 0


class ToolRegistry:
    """
    动态工具注册表。

    管理所有工具的注册、查询和执行。
    与权限系统联动——只返回当前权限级别允许的工具。
    """

    PERMISSION_ORDER = {"L0": 0, "L1": 1, "L2": 2, "L3": 3, "L4": 4}

    def __init__(self):
        self._tools: dict[str, ToolDefinition] = {}

    def register(self, tool: ToolDefinition) -> None:
        """注册一个工具。"""
        self._tools[tool.name] = tool
        logger.debug(f"注册工具: {tool.name} [{tool.permission_level}]")

    def unregister(self, name: str) -> bool:
        """注销一个工具。"""
        if name in self._tools:
            del self._tools[name]
            return True
        return False

    def get(self, name: str) -> ToolDefinition | None:
        """获取工具定义。"""
        return self._tools.get(name)

    def list_all(self) -> list[ToolDefinition]:
        """获取所有已注册工具。"""
        return list(self._tools.values())

    def list_available(self, max_permission: str = "L2") -> list[ToolDefinition]:
        """获取当前权限级别下可用的工具。"""
        max_level = self.PERMISSION_ORDER.get(max_permission, 2)
        return [
            t for t in self._tools.values()
            if t.enabled and self.PERMISSION_ORDER.get(t.permission_level, 0) <= max_level
        ]

    def list_by_category(self, category: str) -> list[ToolDefinition]:
        """按类别获取工具。"""
        return [t for t in self._tools.values() if t.category == category]

    async def execute(self, name: str, params: dict | None = None, max_permission: str = "L2") -> ToolResult:
        """
        执行工具。

        检查权限后调用handler，返回结果。
        """
        tool = self._tools.get(name)
        if not tool:
            return ToolResult(tool_name=name, success=False, error=f"工具 '{name}' 不存在")

        if not tool.enabled:
            return ToolResult(tool_name=name, success=False, error=f"工具 '{name}' 已禁用")

        # 权限检查
        tool_level = self.PERMISSION_ORDER.get(tool.permission_level, 0)
        max_level = self.PERMISSION_ORDER.get(max_permission, 2)
        if tool_level > max_level:
            return ToolResult(
                tool_name=name, success=False,
                error=f"权限不足：工具需要{tool.permission_level}，当前最高{max_permission}"
            )

        if not tool.handler:
            return ToolResult(tool_name=name, success=False, error="工具未实现handler")

        start = time.monotonic()
        try:
            result = tool.handler(**(params or {}))
            if asyncio.iscoroutine(result):
                result = await result
            duration = (time.monotonic() - start) * 1000
            return ToolResult(tool_name=name, success=True, output=result, duration_ms=round(duration))
        except Exception as e:
            duration = (time.monotonic() - start) * 1000
            logger.error(f"工具 {name} 执行失败: {e}")
            return ToolResult(tool_name=name, success=False, error=str(e), duration_ms=round(duration))

    def get_categories(self) -> list[str]:
        """获取所有工具类别。"""
        return sorted(set(t.category for t in self._tools.values() if t.category))

    def get_stats(self) -> dict:
        """获取统计。"""
        enabled = sum(1 for t in self._tools.values() if t.enabled)
        categories = {}
        for t in self._tools.values():
            cat = t.category or "未分类"
            categories[cat] = categories.get(cat, 0) + 1
        return {
            "total": len(self._tools),
            "enabled": enabled,
            "disabled": len(self._tools) - enabled,
            "categories": categories,
        }


def create_default_registry() -> ToolRegistry:
    """创建包含内置工具的默认注册表。"""
    registry = ToolRegistry()

    # 文件操作工具
    file_tools = [
        ToolDefinition(name="file_read", description="读取文件内容（文本/图像/PDF）", permission_level="L1", category="文件操作"),
        ToolDefinition(name="file_write", description="创建或修改文件", permission_level="L2", category="文件操作"),
        ToolDefinition(name="file_edit", description="查找替换编辑文件", permission_level="L2", category="文件操作"),
        ToolDefinition(name="glob", description="按模式匹配搜索文件", permission_level="L1", category="文件操作"),
        ToolDefinition(name="grep", description="在文件内容中搜索关键词", permission_level="L1", category="文件操作"),
    ]

    # 代码执行工具
    code_tools = [
        ToolDefinition(name="python_exec", description="在沙盒中运行Python代码", permission_level="L2", category="代码执行"),
        ToolDefinition(name="bash", description="执行Shell命令", permission_level="L2", category="代码执行"),
        ToolDefinition(name="sandbox", description="安全隔离环境运行代码", permission_level="L1", category="代码执行"),
    ]

    # 网络工具
    net_tools = [
        ToolDefinition(name="web_search", description="搜索引擎查询", permission_level="L1", category="网络访问"),
        ToolDefinition(name="web_fetch", description="获取网页内容", permission_level="L1", category="网络访问"),
        ToolDefinition(name="http_request", description="发送HTTP请求", permission_level="L2", category="网络访问"),
    ]

    # 系统工具
    sys_tools = [
        ToolDefinition(name="screenshot", description="截取屏幕内容", permission_level="L1", category="系统集成"),
        ToolDefinition(name="notification", description="发送系统通知", permission_level="L0", category="系统集成"),
        ToolDefinition(name="todo_write", description="管理任务列表", permission_level="L0", category="系统集成"),
    ]

    for tool in file_tools + code_tools + net_tools + sys_tools:
        registry.register(tool)

    return registry
