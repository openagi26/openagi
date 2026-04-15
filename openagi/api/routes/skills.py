"""技能API路由。"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/skills", tags=["技能"])


@router.get("/installed")
async def list_installed():
    """获取已安装技能列表。"""
    return {"success": True, "data": []}


@router.get("/market")
async def skill_market(source: str = "openclaw", category: str | None = None, search: str | None = None):
    """技能市场浏览。"""
    return {
        "success": True,
        "data": {
            "source": source,
            "sources_available": [
                {"id": "openclaw", "name": "OpenClaw官方中文镜像", "url": "https://cn.clawhub-mirror.com/"},
                {"id": "cocoloop", "name": "CocoLoop技能市场", "url": "https://hub.cocoloop.cn/"},
            ],
            "skills": [],
        },
    }


@router.post("/install")
async def install_skill(skill_id: str, source: str = "openclaw"):
    """安装技能。"""
    return {"success": True, "data": {"skill_id": skill_id, "status": "installed"}}


@router.delete("/{skill_id}")
async def uninstall_skill(skill_id: str):
    """卸载技能。"""
    return {"success": True}
