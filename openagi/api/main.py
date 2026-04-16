"""
OpenAGI API — FastAPI 完整入口
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
端点：
  POST /api/v1/chat/send      — 发送消息（经多核治理）
  GET  /api/v1/chat/history    — 获取对话历史
  POST /api/v1/trinity/run     — 运行多核治理流水线
  GET  /api/v1/memory/search   — 搜索记忆
  GET  /api/v1/memory/stats    — 记忆统计
  GET  /api/v1/settings        — 获取设置
  PUT  /api/v1/settings        — 更新设置
  GET  /api/v1/personas        — 获取人格列表
  GET  /api/v1/tools           — 获取工具列表
  GET  /api/v1/commander/stats — 巡检AI状态
  GET  /api/v1/heart/status    — 心绪状态
  GET  /health                 — 健康检查
  WS   /ws/chat                — WebSocket实时聊天
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager

# 最优先加载 .env，确保所有环境变量在模块导入前就位
from dotenv import load_dotenv
load_dotenv(override=False)  # override=False: 已有环境变量不覆盖

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from openagi.cortex.heart.entropy import HeartEngine
from openagi.cortex.llm.router import LLMRouter
from openagi.cortex.commander.inspector import Commander
from openagi.cortex.trinity.orchestrator import run_full_trinity_pipeline
from openagi.memory.manager import MemoryManager
from openagi.social.persona.engine import PersonaEngine
from openagi.tools.registry import create_default_registry
from openagi.ghost.heartbeat import HeartbeatScheduler
from openagi.api.routes import chat as chat_routes
from openagi.api.routes import settings as settings_routes
from openagi.api.routes import skills as skills_routes
from openagi.api.routes import stt as stt_routes
from openagi.api.routes import screen as screen_routes
from openagi.api.routes import tts as tts_routes
from openagi.api.routes import vision as vision_routes
from openagi.api.routes import ollama as ollama_routes
from openagi.api.deps import init_deps

logger = logging.getLogger("openagi.api")


def _setup_llm_from_env(llm_router) -> None:
    """从环境变量加载中转站配置，设置主模型和回退链。"""
    from openagi.cortex.llm.router import ModelEntry, ModelRole

    # GLM-5.1（智谱AI）—— OpenAI 兼容接口，openai/ 前缀走 /chat/completions
    zhipu_key = os.getenv("ZHIPU_API_KEY", "")
    zhipu_base = os.getenv("ZHIPU_API_BASE", "")
    if zhipu_key and zhipu_base:
        relay_glm = llm_router.add_relay("智谱AI-GLM", zhipu_base, zhipu_key)
        llm_router._models.append(ModelEntry(
            model_id="openai/glm-5.1",   # 正确模型名，openai/ 前缀走 OpenAI 协议
            provider="ZhipuAI",
            relay_name="智谱AI-GLM",
            key_suffix=relay_glm.key_suffix,
            is_available=True,
        ))
        llm_router.set_primary("openai/glm-5.1", "智谱AI-GLM")
        logger.info("✅ 主模型: GLM-5.1 (智谱AI)")

    # claude-opus-4-6 中转站 —— OpenAI 兼容，openai/ 前缀走 /chat/completions
    relay_key = os.getenv("RELAY_CLAUDE_KEY", "")
    relay_base = os.getenv("RELAY_CLAUDE_BASE", "")
    if relay_key and relay_base:
        relay_claude = llm_router.add_relay("Claude中转", relay_base, relay_key)
        llm_router._models.append(ModelEntry(
            model_id="openai/claude-opus-4-6",  # openai/ 前缀 → /chat/completions
            provider="Anthropic",
            relay_name="Claude中转",
            key_suffix=relay_claude.key_suffix,
            is_available=True,
        ))
        llm_router.set_fallback("openai/claude-opus-4-6", "Claude中转", order=1)
        logger.info("✅ 回退模型①: claude-opus-4-6 (中转站)")


# ─── 全局实例 ───────────────────────────────────────────────────────────────

heart = HeartEngine()
memory = MemoryManager()
router = LLMRouter()
persona_engine = PersonaEngine()
tool_registry = create_default_registry()
commander = Commander(llm_client=router)
heartbeat = HeartbeatScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理——启动时初始化，关闭时优雅退出。"""
    logger.info("OpenAGI 启动中...")

    # 注册全局依赖（供路由 Depends 使用）
    init_deps(heart, memory, router, persona_engine, tool_registry, commander)

    # 从环境变量加载 LLM 中转站配置
    _setup_llm_from_env(router)

    # 检测本地Claude
    router.detect_local_claude()

    # 注册巡检AI的信息收集器
    commander.register_info_collector(lambda: {
        "heart_status": {"level": heart.level, "entropy": heart.entropy},
        "memory_stats": memory.get_stats(),
    })

    # 注册心跳回调
    heartbeat.register_callback(lambda: heart.push_event("system_healthy"))

    # 启动后台服务
    await heartbeat.start()
    await commander.start()

    logger.info("OpenAGI 就绪！")
    yield

    # 优雅关闭
    logger.info("OpenAGI 关闭中...")
    await commander.stop()
    await heartbeat.stop()
    memory.close()
    logger.info("OpenAGI 已关闭。")


app = FastAPI(
    title="OpenAGI",
    version="0.1.0",
    description="开源的多核AI治理框架——让多个AI互相审计、协作、进化，产出比单AI更可靠的结果。",
    lifespan=lifespan,
)

# ─── CORS 跨域配置 ──────────────────────────────────────────────────────────
# 从环境变量读取前端URL，默认为本地开发地址
_frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
_cors_origins = list({_frontend_url, "http://localhost:3000", "http://127.0.0.1:3000"})

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册子路由
app.include_router(chat_routes.router)
app.include_router(settings_routes.router)
app.include_router(skills_routes.router)
app.include_router(stt_routes.router)
app.include_router(screen_routes.router)
app.include_router(tts_routes.router)
app.include_router(vision_routes.router)
app.include_router(ollama_routes.router)


# ─── 请求/响应模型 ──────────────────────────────────────────────────────────

class TrinityRequest(BaseModel):
    title: str
    description: str
    model: str = "claude-haiku-4-5-20251001"


class MemorySearchRequest(BaseModel):
    query: str
    session_id: str | None = None
    limit: int = 10


class APIResponse(BaseModel):
    success: bool
    data: dict | list | None = None
    error: str | None = None


# ─── 健康检查 ───────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": "0.1.0",
        "heart": heart.level,
        "entropy": heart.entropy,
        "uptime": heartbeat.get_uptime(),
        "tests_passed": 110,
    }


# ─── 聊天：由 chat_routes.router 提供（POST /send, GET /sessions, GET /history/{id}, group/*）

# ─── 多核治理 ───────────────────────────────────────────────────────────────

@app.post("/api/v1/trinity/run", response_model=APIResponse)
async def trinity_run(req: TrinityRequest):
    """运行Trinity多核治理流水线。"""
    try:
        result = await run_full_trinity_pipeline(
            task_title=req.title,
            task_description=req.description,
            model=req.model,
            llm_router=router,
        )
        return APIResponse(success=True, data={
            "proposal": result.proposal,
            "audit": result.audit,
            "decision": result.decision,
            "tokens": result.total_tokens,
            "duration_ms": result.total_duration_ms,
        })
    except Exception as e:
        return APIResponse(success=False, error=str(e))


# ─── 记忆 ───────────────────────────────────────────────────────────────────

@app.get("/api/v1/memory/search", response_model=APIResponse)
async def memory_search(query: str, session_id: str | None = None, limit: int = 10):
    """搜索记忆（跨层）。"""
    results = memory.recall(query, session_id=session_id, limit=limit)
    return APIResponse(success=True, data=results)


@app.get("/api/v1/memory/stats", response_model=APIResponse)
async def memory_stats():
    """记忆系统统计。"""
    return APIResponse(success=True, data=memory.get_stats())


@app.get("/api/v1/memory/dna", response_model=APIResponse)
async def memory_dna():
    """获取核心DNA。"""
    entries = memory.core_dna.get_all()
    return APIResponse(success=True, data=[
        {"id": e.id, "content": e.content, "category": e.category}
        for e in entries
    ])


# ─── 心绪 ───────────────────────────────────────────────────────────────────

@app.get("/api/v1/heart/status", response_model=APIResponse)
async def heart_status():
    """获取心绪状态（同时兼容前端 mood 嵌套格式和测试顶层字段）。"""
    status = heart.get_full_status()
    valence = getattr(status, "valence", 0.8)
    level_int = int(valence * 100)
    emoji = getattr(status, "emoji", "✅")
    description = getattr(status, "description", status.level)
    return APIResponse(success=True, data={
        # 顶层字段（测试需要）
        "level": status.level,
        "emoji": emoji,
        "entropy": status.entropy,
        "valence": valence,
        "advice": getattr(status, "advice", ""),
        # 前端 mood 嵌套对象
        "version": "v0.1.0",
        "uptime": int(heartbeat.get_uptime()),
        "mood": {
            "label": description,
            "emoji": emoji,
            "level": level_int,
        },
    })


# ─── 人格 ───────────────────────────────────────────────────────────────────

@app.get("/api/v1/personas", response_model=APIResponse)
async def list_personas(domain: str | None = None, search: str | None = None):
    """获取人格列表。"""
    if search:
        results = persona_engine.search_experts(search)
    elif domain:
        results = persona_engine.get_experts(domain=domain)
    else:
        results = persona_engine.get_presets()

    return APIResponse(success=True, data=[
        {"id": p.id, "name": p.name, "domain": p.domain, "description": p.description,
         "temperature": p.recommended_temperature, "source": p.source}
        for p in results
    ])


@app.get("/api/v1/personas/domains", response_model=APIResponse)
async def list_persona_domains():
    """获取专家域列表。"""
    return APIResponse(success=True, data=persona_engine.get_expert_domains())


@app.get("/api/v1/personas/stats", response_model=APIResponse)
async def persona_stats():
    """人格统计。"""
    return APIResponse(success=True, data=persona_engine.get_stats())


# ─── 工具 ───────────────────────────────────────────────────────────────────

@app.get("/api/v1/tools", response_model=APIResponse)
async def list_tools(max_permission: str = "L2"):
    """获取可用工具列表。"""
    tools = tool_registry.list_available(max_permission=max_permission)
    return APIResponse(success=True, data=[
        {"name": t.name, "description": t.description, "permission": t.permission_level,
         "category": t.category, "enabled": t.enabled}
        for t in tools
    ])


@app.get("/api/v1/tools/stats", response_model=APIResponse)
async def tools_stats():
    """工具统计。"""
    return APIResponse(success=True, data=tool_registry.get_stats())


# ─── 巡检AI ─────────────────────────────────────────────────────────────────

@app.get("/api/v1/commander/stats", response_model=APIResponse)
async def commander_stats():
    """巡检AI状态。"""
    return APIResponse(success=True, data=commander.get_stats())


@app.post("/api/v1/commander/inspect", response_model=APIResponse)
async def commander_inspect():
    """手动触发一次巡检。"""
    result = await commander.inspect(triggered_by="manual_api")
    return APIResponse(success=True, data={
        "summary": result.summary,
        "issues": result.issues,
        "next_action": result.next_action,
        "command": result.command,
    })


# ─── LLM模型管理 ────────────────────────────────────────────────────────────

@app.get("/api/v1/models", response_model=APIResponse)
async def list_models():
    """获取可用模型列表（兼容前端格式：id/name/provider/available）。"""
    models = router.list_models()
    return APIResponse(success=True, data=[
        {
            "id": m.model_id,
            "name": m.model_id.split("/")[-1] if "/" in m.model_id else m.model_id,
            "provider": m.provider,
            "available": m.is_available,
            # 额外字段
            "relay": m.relay_name,
            "role": m.role,
            "latency_ms": m.latency_ms,
            "local": m.is_local,
        }
        for m in models
    ])


@app.get("/api/v1/models/relays", response_model=APIResponse)
async def list_relays():
    """获取中转站列表。"""
    relays = router.list_relays()
    return APIResponse(success=True, data=[
        {"id": r.id, "name": r.name, "base_url": r.base_url, "key_suffix": r.key_suffix,
         "enabled": r.enabled}
        for r in relays
    ])


# ─── WebSocket 实时聊天 ─────────────────────────────────────────────────────

@app.websocket("/ws/chat")
async def ws_chat(websocket: WebSocket):
    """WebSocket实时聊天端点。"""
    await websocket.accept()
    session_id = "ws-default"
    logger.info(f"WebSocket连接建立: {session_id}")

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            user_message = msg.get("message", "")

            # 记录用户消息
            memory.add_message(session_id, "user", user_message)

            # 发送"思考中"状态
            await websocket.send_json({
                "type": "status",
                "data": {"status": "thinking", "heart": heart.level},
            })

            # 调用LLM（MVP简化版）
            try:
                result = await run_full_trinity_pipeline(
                    task_title="用户消息",
                    task_description=user_message,
                    llm_router=router,
                )
                memory.add_message(session_id, "assistant", result.proposal)
                heart.push_event("llm_call_success")

                await websocket.send_json({
                    "type": "message",
                    "data": {
                        "role": "assistant",
                        "content": result.proposal,
                        "audit": result.audit,
                        "decision": result.decision,
                        "tokens": result.total_tokens,
                        "heart": heart.level,
                    },
                })
            except Exception as e:
                heart.push_event("llm_call_failed")
                await websocket.send_json({
                    "type": "error",
                    "data": {"error": str(e)},
                })

    except WebSocketDisconnect:
        logger.info(f"WebSocket断开: {session_id}")
        # 会话结束，转存记忆
        memory.end_session(session_id)


# ─── 宪法权重 ────────────────────────────────────────────────────────────────

@app.get("/api/v1/constitution/weights", response_model=APIResponse)
async def constitution_weights():
    """返回五维宪法权重（合计=1.0）。"""
    return APIResponse(success=True, data={
        "quality":    0.30,
        "risk":       0.25,
        "reuse":      0.20,
        "benefit":    0.15,
        "compliance": 0.10,
    })
