"""技能API路由。"""

from __future__ import annotations

import json
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/v1/skills", tags=["技能"])

# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------

_SKILLS_PATH = Path.home() / ".openagi" / "data" / "skills.json"

_MARKET_SKILLS: list[dict] = [
    {
        "id": "code_execution",
        "name": "代码执行",
        "description": "在沙箱中安全执行 Python / JS 代码",
        "category": "开发工具",
        "version": "1.0.0",
        "author": "OpenAGI",
    },
    {
        "id": "web_search",
        "name": "网页搜索",
        "description": "调用搜索引擎检索最新信息",
        "category": "信息获取",
        "version": "1.2.0",
        "author": "OpenAGI",
    },
    {
        "id": "file_rw",
        "name": "文件读写",
        "description": "读取、写入、删除本地文件与目录",
        "category": "系统工具",
        "version": "1.0.0",
        "author": "OpenAGI",
    },
    {
        "id": "data_analysis",
        "name": "数据分析",
        "description": "对结构化数据进行统计分析与可视化",
        "category": "数据科学",
        "version": "0.9.0",
        "author": "OpenAGI",
    },
    {
        "id": "image_generation",
        "name": "图像生成",
        "description": "调用 Stable Diffusion / DALL-E 生成图片",
        "category": "创作工具",
        "version": "1.1.0",
        "author": "OpenAGI",
    },
]


def _load_installed() -> list[dict]:
    if _SKILLS_PATH.exists():
        try:
            return json.loads(_SKILLS_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return []


def _save_installed(skills: list[dict]) -> None:
    os.makedirs(_SKILLS_PATH.parent, exist_ok=True)
    _SKILLS_PATH.write_text(json.dumps(skills, ensure_ascii=False, indent=2), encoding="utf-8")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/")
async def list_installed():
    """获取已安装技能列表。"""
    return {"success": True, "data": _load_installed()}


# Keep legacy path for backward compat
@router.get("/installed")
async def list_installed_legacy():
    """获取已安装技能列表（旧路径）。"""
    return {"success": True, "data": _load_installed()}


@router.get("/market")
async def skill_market(source: str = "openclaw", category: str | None = None, search: str | None = None):
    """技能市场浏览。"""
    skills = _MARKET_SKILLS
    if category:
        skills = [s for s in skills if s.get("category") == category]
    if search:
        q = search.lower()
        skills = [s for s in skills if q in s["name"].lower() or q in s["description"].lower()]
    return {
        "success": True,
        "data": {
            "source": source,
            "sources_available": [
                {"id": "openclaw", "name": "OpenClaw官方中文镜像", "url": "https://cn.clawhub-mirror.com/"},
                {"id": "cocoloop", "name": "CocoLoop技能市场", "url": "https://hub.cocoloop.cn/"},
            ],
            "skills": skills,
        },
    }


@router.post("/install")
async def install_skill(skill_id: str, source: str = "openclaw"):
    """安装技能。"""
    installed = _load_installed()
    # Check if already installed
    if any(s["id"] == skill_id for s in installed):
        return {"success": True, "data": {"skill_id": skill_id, "status": "already_installed"}}

    # Find in market catalogue or create minimal record
    market_record = next((s for s in _MARKET_SKILLS if s["id"] == skill_id), None)
    record = market_record.copy() if market_record else {
        "id": skill_id,
        "name": skill_id,
        "description": "",
        "category": "未知",
        "version": "0.0.1",
        "author": source,
    }
    record["status"] = "installed"
    installed.append(record)
    _save_installed(installed)
    return {"success": True, "data": {"skill_id": skill_id, "status": "installed"}}


@router.delete("/{skill_id}")
async def uninstall_skill(skill_id: str):
    """卸载技能。"""
    installed = _load_installed()
    new_list = [s for s in installed if s["id"] != skill_id]
    if len(new_list) == len(installed):
        raise HTTPException(status_code=404, detail=f"技能 {skill_id!r} 未安装")
    _save_installed(new_list)
    return {"success": True}
