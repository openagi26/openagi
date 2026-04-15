"""设置API路由 — 22个设置页面的数据接口。"""

from __future__ import annotations

import json
import os
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/settings", tags=["设置"])

# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------

_SETTINGS_PATH = Path.home() / ".openagi" / "data" / "settings.json"

_DEFAULTS: dict = {
    "multicore": {"core_count": 2, "auto_escalate": True},
    "commander": {"enabled": True, "interval_seconds": 600, "send_mode": "draft"},
    "theme": {"mode": "light", "primary_color": "#7c3aed"},
    "chat": {"default_mode": "deep", "markdown": True, "auto_scroll": True},
    "companion": {"relationship_mode": "professional", "emotion_intensity": 20},
    "voice": {"tts_engine": "piper", "auto_read": False},
    "avatar": {"type": "static"},
    "security": {"max_auto_permission": "L2", "sensitive_detection": True},
}


def _load_settings() -> dict:
    if _SETTINGS_PATH.exists():
        try:
            return json.loads(_SETTINGS_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return dict(_DEFAULTS)


def _save_settings(data: dict) -> None:
    os.makedirs(_SETTINGS_PATH.parent, exist_ok=True)
    _SETTINGS_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class MultiCoreSettings(BaseModel):
    core_count: int = 2
    executor: dict = {}
    auditors: list[dict] = []
    commander: dict = {}
    auto_escalate: bool = True


class CommanderSettings(BaseModel):
    enabled: bool = True
    interval_seconds: int = 600
    send_mode: str = "draft"
    smart_wait: bool = True
    events: dict = {}
    check_items: list[str] = []


class ThemeSettings(BaseModel):
    mode: str = "light"  # light/dark/system
    primary_color: str = "#7c3aed"
    font_size: int = 14
    border_radius: int = 8
    animations: bool = True


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/")
async def get_all_settings():
    """获取所有设置。"""
    data = _load_settings()
    return {"success": True, "data": data}


@router.put("/")
async def update_all_settings(body: dict):
    """更新并持久化所有设置（全量合并）。"""
    current = _load_settings()
    current.update(body)
    _save_settings(current)
    return {"success": True, "data": current}


@router.put("/multicore")
async def update_multicore(settings: MultiCoreSettings):
    """更新多核治理设置。"""
    current = _load_settings()
    current["multicore"] = settings.model_dump()
    _save_settings(current)
    return {"success": True, "data": settings.model_dump()}


@router.put("/commander")
async def update_commander(settings: CommanderSettings):
    """更新巡检AI设置。"""
    current = _load_settings()
    current["commander"] = settings.model_dump()
    _save_settings(current)
    return {"success": True, "data": settings.model_dump()}


@router.put("/theme")
async def update_theme(settings: ThemeSettings):
    """更新外观主题。"""
    current = _load_settings()
    current["theme"] = settings.model_dump()
    _save_settings(current)
    return {"success": True, "data": settings.model_dump()}


@router.get("/security/audit-log")
async def get_audit_log(limit: int = 20):
    """获取操作审计日志。"""
    return {"success": True, "data": []}


@router.get("/gateway/platforms")
async def list_gateway_platforms():
    """获取消息网关平台列表。"""
    platforms = [
        {"name": "Telegram", "status": "offline", "configured": False},
        {"name": "Discord", "status": "offline", "configured": False},
        {"name": "微信", "status": "offline", "configured": False},
        {"name": "Slack", "status": "offline", "configured": False},
        {"name": "WhatsApp", "status": "offline", "configured": False},
        {"name": "飞书", "status": "offline", "configured": False},
        {"name": "钉钉", "status": "offline", "configured": False},
        {"name": "邮件", "status": "offline", "configured": False},
    ]
    return {"success": True, "data": platforms}


@router.get("/deploy/status")
async def deploy_status():
    """获取部署状态。"""
    import platform
    import sys
    return {
        "success": True,
        "data": {
            "mode": "standalone",
            "python_version": sys.version,
            "os": platform.platform(),
            "arch": platform.machine(),
        },
    }


@router.get("/about")
async def about():
    """关于OpenAGI。"""
    return {
        "success": True,
        "data": {
            "name": "OpenAGI",
            "version": "0.1.0",
            "tagline": "开源的多核AI治理框架",
            "license": "Apache-2.0",
            "github": "https://github.com/openagi/openagi",
            "acknowledgments_count": 12,
        },
    }
