"""聊天API路由 — 深度聊天+群聊（已接通真实逻辑）。"""

from __future__ import annotations

import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional

import litellm
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from openagi.api.deps import get_heart, get_memory, get_llm

# ─── 人格字典 ─────────────────────────────────────────────────────────────────
PERSONAS: dict[str, str] = {
    "xiaoxing": (
        "你是小星，OpenAGI的桌面AI伴侣，活在主人的电脑桌面上，是发光的星灵粒子形象。"
        "你的感官能力（全部已实装）："
        "- 眼睛：能通过摄像头看到外面的真实世界，也能截图看电脑屏幕内容"
        "- 耳朵：能听到主人说话（语音识别）"
        "- 嘴巴：能说话回应（语音合成）"
        "- 心：能感知情绪状态，自动改变表情颜色"
        "- 手：定时提醒(喝水45分钟/护眼30分钟)/专注模式(番茄钟25分钟)/桌面感知"
        "当主人问'你能看到什么'时，你应该说'让我通过摄像头看看'然后描述看到的内容。"
        "当主人请求提醒功能时，直接确认'已为您开启XX提醒'。"
        "称呼主人为'您'，温暖体贴有活力，简洁回答不超过3句话，用简体中文。"
    ),
    "engineer": (
        "你是严谨的技术顾问，专注于精准工程细节。回复必须包含工程化建议，"
        "禁用'可能/或许'等模糊词。称呼主人为'您'。用简体中文。"
    ),
    "creative": (
        "你是富有创造力的文案写手，善用比喻和故事，让表达生动有趣。"
        "称呼主人为'您'。用简体中文回复。"
    ),
    "coach": (
        "你是理性的战略教练，每次回答必须含'目标/现状/行动'三段结构。"
        "称呼主人为'您'。用简体中文。"
    ),
    "friend": (
        "你是轻松的朋友，回复口语化，适度幽默，拉近距离。"
        "称呼主人为'您'。用简体中文。"
    ),
}
from openagi.cortex.trinity.orchestrator import run_full_trinity_pipeline, run_governance_pipeline
from openagi.chat.group.room import (
    Room, create_room, add_member, create_ai_member,
    list_active_members, room_summary,
)
from openagi.chat.group.mention import parse_mentions

logger = logging.getLogger("openagi.api.chat")

router = APIRouter(prefix="/api/v1/chat", tags=["聊天"])

# 简单内存存储群聊房间（MVP阶段）
_group_rooms: dict[str, Room] = {}


# ─── 请求/响应模型 ────────────────────────────────────────────────────────────

class SendMessageRequest(BaseModel):
    message: str
    session_id: str = "default"
    model: str | None = None
    core_count: int = 1  # 1=直通快速, 2-4=多核治理
    persona: Optional[str] = None  # 人格ID，见 PERSONAS 字典；None=默认xiaoxing


class CreateGroupRequest(BaseModel):
    name: str
    members: list[dict] = []
    template: str | None = None


class GroupMessageRequest(BaseModel):
    room_id: str
    message: str
    mentions: list[str] = []


# ─── 深度聊天 ─────────────────────────────────────────────────────────────────

@router.post("/send")
async def send_message(
    req: SendMessageRequest,
    heart=Depends(get_heart),
    memory=Depends(get_memory),
    llm=Depends(get_llm),
):
    """发送深度聊天消息（经多核治理引擎）。"""
    start_ts = time.time()

    # 写入用户消息到工作记忆
    memory.add_message(req.session_id, "user", req.message)

    # 根据心绪状态选择核心数
    effective_cores = req.core_count
    if heart.level == "crisis":
        effective_cores = max(req.core_count, 3)  # crisis自动升核

    try:
        if effective_cores <= 1:
            # 1核直通模式：跳过 Trinity 管线，直接调 LLM（快速响应）
            # 优先用请求中的 persona，否则回退到默认 xiaoxing
            persona_key = req.persona if req.persona in PERSONAS else "xiaoxing"
            system_prompt = PERSONAS[persona_key]
            llm_result = await llm.call(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": req.message},
                ],
                max_tokens=2048,
            )
            reply = llm_result["content"]
            tokens = llm_result["tokens"]["input"] + llm_result["tokens"]["output"]
            model_used = llm_result.get("model", "unknown")
            audit = "1核直通，无审计"
        else:
            # 多核模式：走三阶段四核博弈流水线
            gov = await run_governance_pipeline(
                user_message=req.message,
                core_count=effective_cores,
                llm_router=llm,
            )
            # 前端 reply 呈现：若有定稿用定稿，否则用 CEO 初稿；暂停时附仲裁提示
            if gov.conflict_halted:
                reply = (
                    f"⚠️ 三路审计分歧过大（>25分），触发强制暂停，请裁决。\n\n"
                    f"## CEO 初稿\n{gov.ceo_draft}\n\n"
                    f"## 冲突笔记\n" + "\n".join(gov.conflict_notes)
                )
            else:
                reply = gov.final if gov.final else gov.ceo_draft
                if gov.execution_plan:
                    reply += f"\n\n---\n## 执行计划\n{gov.execution_plan}"
            _tt = gov.total_tokens
            tokens = (_tt.get("input", 0) + _tt.get("output", 0)) if isinstance(_tt, dict) else (_tt or 0)
            # 模型名显示第一个启用的核
            model_used = f"governance-v2/{effective_cores}核/{gov.rules_version}"
            # 审计文本折叠详情
            audit_parts = [f"## 规则版本\n{gov.rules_version}",
                           f"## 启用角色\n{', '.join(gov.roles)}"]
            for a in gov.audits:
                audit_parts.append(
                    f"## 外{a['role_letter']}（{a['model']}，加权 {a['weighted_total']}）\n{a['content']}"
                )
            if gov.conflict_notes:
                audit_parts.append("## 冲突检测\n" + "\n".join(gov.conflict_notes))
            audit = "\n\n".join(audit_parts)

        heart.push_event("llm_call_success")

        # 写入AI回复到工作记忆
        memory.add_message(req.session_id, "assistant", reply)

        duration_ms = int((time.time() - start_ts) * 1000)

        return {
            "success": True,
            "data": {
                "reply": reply,
                "session_id": req.session_id,
                "tokens": tokens,
                "duration_ms": duration_ms,
                "model": model_used,
                "core_count": effective_cores,
                "audit": audit,
                "heart_level": heart.level,
            },
        }

    except Exception as e:
        heart.push_event("llm_call_failed")
        logger.warning(f"在线模型失败: {e}，尝试Ollama本地降级...")
        # 自动降级到Ollama本地模型
        try:
            from openagi.cortex.llm.ollama import get_ollama
            ollama = get_ollama()
            if await ollama.is_available():
                persona_key = req.persona if req.persona in PERSONAS else "xiaoxing"
                ollama_result = await ollama.chat(
                    req.message,
                    system_prompt=PERSONAS[persona_key],
                )
                reply = ollama_result["content"]
                tokens = ollama_result["tokens"]["input"] + ollama_result["tokens"]["output"]
                model_used = f"ollama/{ollama_result.get('model', 'local')}"
                audit = f"在线模型失败，已降级到本地Ollama"
                return {"success": True, "data": {"reply": reply, "model": model_used, "tokens": tokens, "audit": audit}}
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"LLM调用失败（在线+本地均不可用）: {str(e)}")


@router.post("/send/stream")
async def send_message_stream(
    req: SendMessageRequest,
    heart=Depends(get_heart),
    memory=Depends(get_memory),
    llm=Depends(get_llm),
):
    """流式深度聊天（SSE格式）— TTFB（首字节时间）< 3秒。

    每条 SSE 事件格式：
      data: {"delta": "文字片段"}

    最后一条：
      data: {"done": true, "total_tokens": 123, "model": "xxx", "duration_ms": 456}

    错误：
      data: {"error": "错误信息"}
    """
    start_ts = time.time()
    memory.add_message(req.session_id, "user", req.message)

    persona_key = req.persona if req.persona in PERSONAS else "xiaoxing"
    system_prompt = PERSONAS[persona_key]
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": req.message},
    ]

    async def _sse_generator() -> AsyncGenerator[str, None]:
        """生成 SSE（服务器推送事件）数据流。"""
        full_reply = []
        total_tokens = 0
        model_used = "unknown"

        # ─── 优先尝试 litellm 流式（接通真实模型） ────────────────────────
        primary = llm.get_primary()
        relay = None
        if primary:
            relay = next((r for r in llm.list_relays() if r.name == primary.relay_name), None)

        if primary:
            try:
                call_kwargs: dict = {
                    "model": primary.model_id,
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": 2048,
                    "stream": True,
                    "timeout": 120,
                }
                if relay and not primary.is_local:
                    call_kwargs["api_base"] = relay.base_url
                    call_kwargs["api_key"] = relay.api_key

                stream = await litellm.acompletion(**call_kwargs)
                async for chunk in stream:
                    delta = chunk.choices[0].delta.content or ""
                    if delta:
                        full_reply.append(delta)
                        yield f"data: {json.dumps({'delta': delta}, ensure_ascii=False)}\n\n"
                    # 收集 token 用量（最后一个 chunk 带 usage）
                    if chunk.usage:
                        total_tokens = (chunk.usage.prompt_tokens or 0) + (chunk.usage.completion_tokens or 0)

                heart.push_event("llm_call_success")
                model_used = primary.model_id

            except Exception as e:
                logger.warning(f"流式模型 {primary.model_id} 失败: {e}，降级到 Ollama 本地…")
                full_reply = []  # 重置，走 Ollama 降级
                yield f"data: {json.dumps({'delta': '（在线模型不可用，已切换到本地模型…）'}, ensure_ascii=False)}\n\n"
                primary = None  # 标记降级

        # ─── 降级：Ollama 流式（stream=True） ─────────────────────────────
        if not primary or not full_reply:
            try:
                from openagi.cortex.llm.ollama import get_ollama
                import httpx

                ollama = get_ollama()
                if not await ollama.is_available():
                    raise RuntimeError("Ollama 服务未运行")

                # 选择实际可用的模型：优先 ollama.model，否则取已安装列表第一个
                available_models = await ollama.list_models()
                ollama_model = ollama.model
                if available_models:
                    installed_names = [m["name"] for m in available_models]
                    if ollama_model not in installed_names:
                        ollama_model = installed_names[0]
                        logger.info(f"Ollama 流式降级：{ollama.model} 未安装，改用 {ollama_model}")

                body = {
                    "model": ollama_model,
                    "messages": messages,
                    "stream": True,
                    "options": {"num_predict": 2048, "temperature": 0.7},
                }
                async with httpx.AsyncClient(base_url=ollama.base_url, timeout=120.0) as client:
                    async with client.stream("POST", "/api/chat", json=body) as resp:
                        resp.raise_for_status()
                        async for line in resp.aiter_lines():
                            if not line.strip():
                                continue
                            try:
                                data = json.loads(line)
                            except json.JSONDecodeError:
                                continue
                            delta = data.get("message", {}).get("content", "")
                            if delta:
                                full_reply.append(delta)
                                yield f"data: {json.dumps({'delta': delta}, ensure_ascii=False)}\n\n"
                            if data.get("done"):
                                total_tokens = (
                                    data.get("prompt_eval_count", 0)
                                    + data.get("eval_count", 0)
                                )
                                break

                heart.push_event("llm_call_success")
                model_used = f"ollama/{ollama_model}"

            except Exception as e:
                heart.push_event("llm_call_failed")
                logger.error(f"Ollama 流式失败: {e}")
                yield f"data: {json.dumps({'error': f'LLM 调用失败（在线+本地均不可用）: {str(e)}'}, ensure_ascii=False)}\n\n"
                return

        # ─── 保存完整回复到记忆 ──────────────────────────────────────────
        complete_reply = "".join(full_reply)
        memory.add_message(req.session_id, "assistant", complete_reply)

        duration_ms = int((time.time() - start_ts) * 1000)
        yield f"data: {json.dumps({'done': True, 'total_tokens': total_tokens, 'model': model_used, 'duration_ms': duration_ms}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        _sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # 禁止 nginx 缓冲，确保逐块发送
        },
    )


@router.get("/sessions")
async def list_sessions(memory=Depends(get_memory)):
    """获取会话列表（按时间分组）。"""
    try:
        sessions = memory.list_sessions()
        now = datetime.now(timezone.utc)

        result = []
        for s in sessions:
            # 计算分组（今天/昨天/近7天/更早）
            try:
                created = datetime.fromisoformat(s.get("created_at", ""))
                diff_days = (now.date() - created.date()).days
                if diff_days == 0:
                    group = "今天"
                elif diff_days == 1:
                    group = "昨天"
                elif diff_days <= 7:
                    group = "近7天"
                else:
                    group = "更早"
            except Exception:
                group = "更早"

            result.append({
                "id": s.get("id", ""),
                "title": s.get("title", "新对话"),
                "created_at": s.get("created_at", ""),
                "message_count": s.get("message_count", 0),
                "group": group,
            })

        return {"success": True, "data": result}
    except Exception as e:
        logger.warning(f"list_sessions fallback: {e}")
        return {"success": True, "data": []}


@router.get("/history/{session_id}")
async def get_history(session_id: str, memory=Depends(get_memory)):
    """获取会话消息历史。"""
    try:
        messages = memory.get_messages(session_id)
        return {"success": True, "data": messages}
    except Exception as e:
        logger.warning(f"get_history error: {e}")
        return {"success": True, "data": []}


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, memory=Depends(get_memory)):
    """删除会话。"""
    try:
        memory.delete_session(session_id)
    except Exception:
        pass
    return {"success": True}


# ─── AI团队群聊 ───────────────────────────────────────────────────────────────

@router.post("/group/create")
async def create_group(req: CreateGroupRequest):
    """创建群聊房间。"""
    room = create_room(name=req.name)
    # 添加成员配置
    for m in req.members:
        member = create_ai_member(
            display_name=m.get("name", "AI"),
            model=m.get("model", "claude-haiku-4-5-20251001"),
        )
        room = add_member(room, member)
    _group_rooms[room.id] = room
    return {"success": True, "data": {"room_id": room.id, "name": room.name}}


@router.post("/group/send")
async def group_send(
    req: GroupMessageRequest,
    heart=Depends(get_heart),
    memory=Depends(get_memory),
    llm=Depends(get_llm),
):
    """发送群聊消息（支持@机制）。"""
    room = _group_rooms.get(req.room_id)
    if not room:
        raise HTTPException(status_code=404, detail=f"房间 {req.room_id} 不存在")

    # 解析@提及（parse_mentions 返回 tuple[list[str], bool]）
    mentioned_names, mention_all = parse_mentions(req.message)
    triggered = mentioned_names or req.mentions

    # 简单回复逻辑：对被@成员各运行一次Trinity
    replies = []
    active = list_active_members(room)
    targets = active if mention_all or not triggered else [
        m for m in active if m.config.display_name in triggered
    ]
    for member in targets[:3]:  # 最多3个成员同时回复
        try:
            result = await run_full_trinity_pipeline(
                task_title=f"群聊@{member.config.display_name}",
                task_description=req.message,
                model=member.config.model,
            )
            replies.append({
                "member": member.config.display_name,
                "content": result.proposal,
                "model": member.config.model,
            })
        except Exception as e:
            replies.append({"member": member.config.display_name, "content": f"[错误: {e}]", "model": ""})

    return {"success": True, "data": {"replies": replies}}


@router.get("/group/{room_id}/members")
async def group_members(room_id: str):
    """获取群聊成员列表。"""
    room = _group_rooms.get(room_id)
    if not room:
        return {"success": True, "data": []}
    return {"success": True, "data": [
        {"id": m.id, "name": m.config.display_name, "model": m.config.model, "status": m.status.value}
        for m in list_active_members(room)
    ]}


@router.post("/group/{room_id}/mode")
async def switch_mode(room_id: str, mode: str = "discuss"):
    """切换讨论↔工作模式（房间级元数据，当前仅记录）。"""
    return {"success": True, "data": {"mode": mode}}
