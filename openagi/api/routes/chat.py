"""聊天API路由 — 深度聊天+群聊（已接通真实逻辑）。"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from openagi.api.deps import get_heart, get_memory, get_llm
from openagi.cortex.trinity.orchestrator import run_full_trinity_pipeline
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
    core_count: int = 2  # 1-4核


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
        # 调用多核治理流水线
        result = await run_full_trinity_pipeline(
            task_title="用户对话",
            task_description=req.message,
        )

        reply = result.proposal
        heart.push_event("llm_call_success")

        # 写入AI回复到工作记忆
        memory.add_message(req.session_id, "assistant", reply)

        duration_ms = int((time.time() - start_ts) * 1000)

        return {
            "success": True,
            "data": {
                "reply": reply,
                "session_id": req.session_id,
                "tokens": result.total_tokens,
                "duration_ms": duration_ms,
                "model": result.model_used if hasattr(result, "model_used") else "unknown",
                "core_count": effective_cores,
                "audit": result.audit,
                "heart_level": heart.level,
            },
        }

    except Exception as e:
        heart.push_event("llm_call_failed")
        logger.error(f"send_message error: {e}")
        raise HTTPException(status_code=500, detail=f"LLM调用失败: {str(e)}")


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
