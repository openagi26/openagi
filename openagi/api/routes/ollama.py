"""Ollama本地模型API路由 — 小星永生支柱4。"""

from __future__ import annotations

from fastapi import APIRouter

from openagi.cortex.llm.ollama import get_ollama, RECOMMENDED_MODELS

router = APIRouter(prefix="/api/v1/ollama", tags=["本地模型"])


@router.get("/status")
async def ollama_status():
    """检查Ollama服务状态。"""
    client = get_ollama()
    available = await client.is_available()
    models = await client.list_models() if available else []
    return {
        "success": True,
        "data": {
            "available": available,
            "models": models,
            "recommended": RECOMMENDED_MODELS,
            "current_model": client.model,
        },
    }


@router.get("/models")
async def list_models():
    """列出已下载的本地模型。"""
    client = get_ollama()
    models = await client.list_models()
    return {"success": True, "data": models}


@router.post("/chat")
async def ollama_chat(payload: dict):
    """使用本地模型对话。"""
    message = payload.get("message", "")
    model = payload.get("model")
    system_prompt = payload.get("system_prompt", "你是小星，温暖体贴的AI伴侣。用中文简洁回答。")

    if not message:
        return {"success": False, "error": "缺少消息内容"}

    client = get_ollama()
    result = await client.chat(message, system_prompt=system_prompt, model=model)
    return {"success": True, "data": result}


@router.post("/pull")
async def pull_model(payload: dict):
    """下载模型。"""
    model_name = payload.get("model", "")
    if not model_name:
        return {"success": False, "error": "缺少模型名称"}

    client = get_ollama()
    ok = await client.pull_model(model_name)
    return {"success": ok, "data": {"model": model_name, "status": "downloaded" if ok else "failed"}}
