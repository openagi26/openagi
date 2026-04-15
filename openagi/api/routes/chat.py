"""聊天API路由 — 深度聊天+群聊。"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/chat", tags=["聊天"])


class SendMessageRequest(BaseModel):
    message: str
    session_id: str = "default"
    model: str | None = None
    core_count: int = 2  # 1-4核


class CreateGroupRequest(BaseModel):
    name: str
    members: list[dict] = []  # [{persona_id, model, temperature}]
    template: str | None = None  # 预设团队模板名


class GroupMessageRequest(BaseModel):
    room_id: str
    message: str
    mentions: list[str] = []  # @的成员ID列表


class SessionResponse(BaseModel):
    id: str
    title: str
    created_at: str
    message_count: int
    group: str | None = None  # 今天/昨天/近7天/更早


@router.post("/send")
async def send_message(req: SendMessageRequest):
    """发送深度聊天消息（经多核治理）。"""
    return {"success": True, "data": {"reply": "API已就绪，等待LLM集成", "session_id": req.session_id}}


@router.get("/sessions")
async def list_sessions():
    """获取会话列表（按时间分组）。"""
    return {"success": True, "data": []}


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """删除会话。"""
    return {"success": True}


@router.post("/group/create")
async def create_group(req: CreateGroupRequest):
    """创建群聊房间。"""
    return {"success": True, "data": {"room_id": "placeholder", "name": req.name}}


@router.post("/group/send")
async def group_send(req: GroupMessageRequest):
    """发送群聊消息（支持@机制）。"""
    return {"success": True, "data": {"replies": []}}


@router.get("/group/{room_id}/members")
async def group_members(room_id: str):
    """获取群聊成员列表。"""
    return {"success": True, "data": []}


@router.post("/group/{room_id}/mode")
async def switch_mode(room_id: str, mode: str = "discuss"):
    """切换讨论↔工作模式。"""
    return {"success": True, "data": {"mode": mode}}
