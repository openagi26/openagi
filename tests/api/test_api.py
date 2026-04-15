"""API端点集成测试。"""

import pytest
from httpx import AsyncClient, ASGITransport
import openagi.api.main as _main_module
from openagi.api.main import app
from openagi.api.deps import init_deps


@pytest.fixture
async def client():
    # 确保 deps 已初始化（ASGI测试不自动触发 lifespan）
    init_deps(
        _main_module.heart,
        _main_module.memory,
        _main_module.router,
        _main_module.persona_engine,
        _main_module.tool_registry,
        _main_module.commander,
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ── 健康检查 ────────────────────────────────────────────────────────────

async def test_health(client):
    r = await client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["version"] == "0.1.0"
    assert "heart" in data
    assert "entropy" in data


# ── 心绪状态 ────────────────────────────────────────────────────────────

async def test_heart_status(client):
    r = await client.get("/api/v1/heart/status")
    assert r.status_code == 200
    data = r.json()
    assert data["success"]
    assert data["data"]["level"] in ("calm", "focused", "anxious", "crisis")
    assert "emoji" in data["data"]


# ── 人格系统 ────────────────────────────────────────────────────────────

async def test_personas_presets(client):
    r = await client.get("/api/v1/personas")
    assert r.status_code == 200
    data = r.json()
    assert data["success"]
    assert len(data["data"]) == 6  # 6个预设


async def test_personas_by_domain(client):
    r = await client.get("/api/v1/personas?domain=工程")
    data = r.json()
    assert data["success"]
    assert len(data["data"]) >= 10


async def test_personas_search(client):
    r = await client.get("/api/v1/personas?search=安全")
    data = r.json()
    assert data["success"]
    assert len(data["data"]) >= 1


async def test_persona_domains(client):
    r = await client.get("/api/v1/personas/domains")
    data = r.json()
    assert data["success"]
    assert len(data["data"]) >= 12


async def test_persona_stats(client):
    r = await client.get("/api/v1/personas/stats")
    data = r.json()
    assert data["success"]
    assert data["data"]["presets"] == 6


# ── 工具系统 ────────────────────────────────────────────────────────────

async def test_tools_list(client):
    r = await client.get("/api/v1/tools")
    data = r.json()
    assert data["success"]
    assert len(data["data"]) >= 10


async def test_tools_permission_filter(client):
    r = await client.get("/api/v1/tools?max_permission=L0")
    data = r.json()
    assert data["success"]
    # L0只有notification和todo_write
    assert all(t["permission"] == "L0" for t in data["data"])


async def test_tools_stats(client):
    r = await client.get("/api/v1/tools/stats")
    data = r.json()
    assert data["success"]
    assert data["data"]["total"] >= 10


# ── 记忆系统 ────────────────────────────────────────────────────────────

async def test_memory_stats(client):
    r = await client.get("/api/v1/memory/stats")
    data = r.json()
    assert data["success"]
    assert "working" in data["data"]
    assert "archive" in data["data"]
    assert "core_dna" in data["data"]


async def test_memory_dna(client):
    r = await client.get("/api/v1/memory/dna")
    data = r.json()
    assert data["success"]
    assert len(data["data"]) >= 1  # 至少有默认DNA


async def test_memory_search(client):
    r = await client.get("/api/v1/memory/search?query=OpenAGI")
    data = r.json()
    assert data["success"]


# ── 模型管理 ────────────────────────────────────────────────────────────

async def test_models_list(client):
    r = await client.get("/api/v1/models")
    data = r.json()
    assert data["success"]
    # 如果本机有Claude Code，应该检测到模型
    assert isinstance(data["data"], list)


async def test_relays_list(client):
    r = await client.get("/api/v1/models/relays")
    data = r.json()
    assert data["success"]


# ── 巡检AI ──────────────────────────────────────────────────────────────

async def test_commander_stats(client):
    r = await client.get("/api/v1/commander/stats")
    data = r.json()
    assert data["success"]
    assert "enabled" in data["data"]
    assert "running" in data["data"]


async def test_commander_inspect(client):
    r = await client.post("/api/v1/commander/inspect")
    data = r.json()
    assert data["success"]
    assert "summary" in data["data"]


# ── 聊天路由 ────────────────────────────────────────────────────────────

async def test_chat_sessions(client):
    r = await client.get("/api/v1/chat/sessions")
    data = r.json()
    assert data["success"]


async def test_group_create(client):
    r = await client.post("/api/v1/chat/group/create", json={"name": "测试团队"})
    data = r.json()
    assert data["success"]


# ── 设置路由 ────────────────────────────────────────────────────────────

async def test_settings_get(client):
    r = await client.get("/api/v1/settings/")
    data = r.json()
    assert data["success"]
    assert "multicore" in data["data"]
    assert "commander" in data["data"]
    assert "theme" in data["data"]


async def test_settings_about(client):
    r = await client.get("/api/v1/settings/about")
    data = r.json()
    assert data["success"]
    assert data["data"]["name"] == "OpenAGI"
    assert data["data"]["license"] == "Apache-2.0"


async def test_settings_deploy(client):
    r = await client.get("/api/v1/settings/deploy/status")
    data = r.json()
    assert data["success"]
    assert "python_version" in data["data"]


async def test_settings_gateway(client):
    r = await client.get("/api/v1/settings/gateway/platforms")
    data = r.json()
    assert data["success"]
    assert len(data["data"]) == 8  # 8个平台


# ── 技能路由 ────────────────────────────────────────────────────────────

async def test_skills_installed(client):
    r = await client.get("/api/v1/skills/installed")
    data = r.json()
    assert data["success"]


async def test_skills_market(client):
    r = await client.get("/api/v1/skills/market")
    data = r.json()
    assert data["success"]
    assert len(data["data"]["sources_available"]) == 2  # OpenClaw + CocoLoop
