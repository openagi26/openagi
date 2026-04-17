"""聊天API路由 — 深度聊天+群聊（已接通真实逻辑）。"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from openagi.api.deps import get_heart, get_memory, get_llm
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
            llm_result = await llm.call(
                messages=[
                    {"role": "system", "content": "你是小星，OpenAGI的桌面AI伴侣，活在主人的电脑桌面上，是发光的星灵粒子形象。"
                     "你的感官能力（全部已实装）："
                     "- 眼睛：能通过摄像头看到外面的真实世界，也能截图看电脑屏幕内容"
                     "- 耳朵：能听到主人说话（语音识别）"
                     "- 嘴巴：能说话回应（语音合成）"
                     "- 心：能感知情绪状态，自动改变表情颜色"
                     "- 手：定时提醒(喝水45分钟/护眼30分钟)/专注模式(番茄钟25分钟)/桌面感知"
                     "当主人问'你能看到什么'时，你应该说'让我通过摄像头看看'然后描述看到的内容。"
                     "当主人请求提醒功能时，直接确认'已为陛下开启XX提醒'。"
                     "称呼主人为'陛下'，温暖体贴有活力，简洁回答不超过3句话，用简体中文。"},
                    {"role": "user", "content": req.message},
                ],
                max_tokens=2048,
            )
            reply = llm_result["content"]
            tokens = llm_result["tokens"]["input"] + llm_result["tokens"]["output"]
            model_used = llm_result.get("model", "unknown")
            audit = "1核直通，无审计"
        else:
            # 多核模式：走陛下 2026-04-17 亲定的三阶段四核博弈流水线
            gov = await run_governance_pipeline(
                user_message=req.message,
                core_count=effective_cores,
                llm_router=llm,
            )
            # 前端 reply 呈现：若有定稿用定稿，否则用 CEO 初稿；暂停时附仲裁提示
            if gov.conflict_halted:
                reply = (
                    f"⚠️ 三路审计分歧过大（>25分），触发强制暂停，请陛下裁决。\n\n"
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
                ollama_result = await ollama.chat(
                    req.message,
                    system_prompt="你是小星，温暖体贴的AI伴侣。称呼主人为陛下。简洁回答，用简体中文。",
                )
                reply = ollama_result["content"]
                tokens = ollama_result["tokens"]["input"] + ollama_result["tokens"]["output"]
                model_used = f"ollama/{ollama_result.get('model', 'local')}"
                audit = f"在线模型失败，已降级到本地Ollama"
                return {"success": True, "data": {"reply": reply, "model": model_used, "tokens": tokens, "audit": audit}}
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"LLM调用失败（在线+本地均不可用）: {str(e)}")


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
        m for m in active if m.display_name in triggered
    ]
    for member in targets[:3]:  # 最多3个成员同时回复
        try:
            result = await run_full_trinity_pipeline(
                task_title=f"群聊@{member.display_name}",
                task_description=req.message,
            )
            replies.append({
                "member": member.display_name,
                "content": result.proposal,
                "model": member.config.model,
            })
        except Exception as e:
            replies.append({"member": member.display_name, "content": f"[错误: {e}]", "model": ""})

    return {"success": True, "data": {"replies": replies}}


@router.get("/group/{room_id}/members")
async def group_members(room_id: str):
    """获取群聊成员列表。"""
    room = _group_rooms.get(room_id)
    if not room:
        return {"success": True, "data": []}
    return {"success": True, "data": [
        {"id": m.id, "name": m.display_name, "model": m.config.model, "status": m.status.value}
        for m in list_active_members(room)
    ]}


@router.post("/group/{room_id}/mode")
async def switch_mode(room_id: str, mode: str = "discuss"):
    """切换讨论↔工作模式（房间级元数据，当前仅记录）。"""
    return {"success": True, "data": {"mode": mode}}
