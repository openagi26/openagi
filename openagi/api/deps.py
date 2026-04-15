"""
FastAPI 依赖注入 — 全局单例管理
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
在 main.py lifespan 中调用 init_deps() 初始化，
各路由通过 Depends(get_*) 获取实例。
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from openagi.cortex.heart.entropy import HeartEngine
    from openagi.cortex.llm.router import LLMRouter
    from openagi.memory.manager import MemoryManager
    from openagi.social.persona.engine import PersonaEngine
    from openagi.tools.registry import ToolRegistry
    from openagi.cortex.commander.inspector import Commander

# ─── 模块级单例（由 main.py 初始化）────────────────────────────────────────

_heart: "HeartEngine | None" = None
_memory: "MemoryManager | None" = None
_llm: "LLMRouter | None" = None
_persona: "PersonaEngine | None" = None
_tools: "ToolRegistry | None" = None
_commander: "Commander | None" = None


def init_deps(heart, memory, llm, persona, tools, commander) -> None:
    """在应用启动时调用，注册全局单例。"""
    global _heart, _memory, _llm, _persona, _tools, _commander
    _heart = heart
    _memory = memory
    _llm = llm
    _persona = persona
    _tools = tools
    _commander = commander


# ─── Depends 函数 ─────────────────────────────────────────────────────────

def get_heart() -> "HeartEngine":
    assert _heart is not None, "HeartEngine 未初始化"
    return _heart


def get_memory() -> "MemoryManager":
    assert _memory is not None, "MemoryManager 未初始化"
    return _memory


def get_llm() -> "LLMRouter":
    assert _llm is not None, "LLMRouter 未初始化"
    return _llm


def get_persona() -> "PersonaEngine":
    assert _persona is not None, "PersonaEngine 未初始化"
    return _persona


def get_tools() -> "ToolRegistry":
    assert _tools is not None, "ToolRegistry 未初始化"
    return _tools


def get_commander() -> "Commander":
    assert _commander is not None, "Commander 未初始化"
    return _commander
