"""端到端集成测试链路 — 5条核心链路验证。"""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport

import openagi.api.main as _main_module
from openagi.api.main import app
from openagi.api.deps import init_deps


@pytest.fixture
async def client():
    """初始化依赖并返回测试客户端。"""
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


def _make_mock_trinity_result():
    """构造一个 mock Trinity 流水线结果。"""
    mock_result = MagicMock()
    mock_result.proposal = "Mock AI回复：这是测试响应"
    mock_result.audit = "审计通过"
    mock_result.decision = "approved"
    mock_result.total_tokens = 100
    mock_result.total_duration_ms = 500
    mock_result.model_used = "mock-model"
    return mock_result


# ── 链路1：聊天完整流程 ──────────────────────────────────────────────────────────

@patch("openagi.api.routes.chat.run_full_trinity_pipeline", new_callable=AsyncMock)
async def test_chain1_chat_full_flow(mock_trinity, client):
    """链路1：POST /send → 写入热记忆 → 返回 success=True + reply字段。"""
    mock_trinity.return_value = _make_mock_trinity_result()

    session_id = "test_chain1_session"
    r = await client.post("/api/v1/chat/send", json={
        "message": "你好，这是链路1测试",
        "session_id": session_id,
        "core_count": 2,
    })

    assert r.status_code == 200, f"期望200，实际：{r.status_code}, body={r.text}"
    data = r.json()

    # 验证返回结构
    assert data["success"] is True, f"success应为True，实际：{data}"
    assert "reply" in data["data"], f"data中应有reply字段，实际：{data['data']}"
    assert data["data"]["reply"] == "Mock AI回复：这是测试响应"
    assert data["data"]["session_id"] == session_id

    # 验证消息已写入热记忆
    history_r = await client.get(f"/api/v1/chat/history/{session_id}")
    history = history_r.json()
    assert history["success"] is True
    messages = history["data"]
    assert len(messages) >= 2, f"应有user+assistant至少2条，实际：{len(messages)}"

    roles = [m["role"] for m in messages]
    assert "user" in roles, "历史中应有user消息"
    assert "assistant" in roles, "历史中应有assistant消息"

    # 验证trinity被调用了一次
    mock_trinity.assert_called_once()


# ── 链路2：会话管理完整流程 ───────────────────────────────────────────────────────

@patch("openagi.api.routes.chat.run_full_trinity_pipeline", new_callable=AsyncMock)
async def test_chain2_session_management(mock_trinity, client):
    """链路2：发2条消息 → GET history验证2条 → DELETE session验证删除成功。"""
    mock_trinity.return_value = _make_mock_trinity_result()

    session_id = "test_chain2_session_mgmt"

    # 发送第1条消息
    r1 = await client.post("/api/v1/chat/send", json={
        "message": "第一条消息",
        "session_id": session_id,
        "core_count": 2,
    })
    assert r1.status_code == 200
    assert r1.json()["success"] is True

    # 发送第2条消息
    r2 = await client.post("/api/v1/chat/send", json={
        "message": "第二条消息",
        "session_id": session_id,
        "core_count": 2,
    })
    assert r2.status_code == 200
    assert r2.json()["success"] is True

    # 验证历史记录：应有4条（user+assistant x2）
    history_r = await client.get(f"/api/v1/chat/history/{session_id}")
    assert history_r.status_code == 200
    history = history_r.json()
    assert history["success"] is True
    messages = history["data"]
    assert len(messages) >= 4, f"2轮对话应有>=4条消息，实际：{len(messages)}"

    # 用户消息内容验证
    user_msgs = [m["content"] for m in messages if m.get("role") == "user"]
    assert "第一条消息" in user_msgs, f"应有第一条消息，实际user消息：{user_msgs}"
    assert "第二条消息" in user_msgs, f"应有第二条消息，实际user消息：{user_msgs}"

    # 删除会话
    del_r = await client.delete(f"/api/v1/chat/sessions/{session_id}")
    assert del_r.status_code == 200
    del_data = del_r.json()
    assert del_data["success"] is True, f"删除应返回success=True，实际：{del_data}"

    # 删除后历史应为空
    after_r = await client.get(f"/api/v1/chat/history/{session_id}")
    after_data = after_r.json()
    assert after_data["success"] is True
    assert len(after_data["data"]) == 0, f"删除后历史应为空，实际：{after_data['data']}"


# ── 链路3：记忆跨层检索 ───────────────────────────────────────────────────────────

async def test_chain3_memory_search(client):
    """链路3：写入记忆条目 → 搜索 → 验证返回结果有layer/content/score字段。"""
    # 通过发送消息让系统写入记忆
    with patch("openagi.api.routes.chat.run_full_trinity_pipeline", new_callable=AsyncMock) as mock_t:
        mock_t.return_value = _make_mock_trinity_result()
        await client.post("/api/v1/chat/send", json={
            "message": "测试记忆写入内容，用于跨层检索验证",
            "session_id": "chain3_memory_session",
            "core_count": 2,
        })

    # 搜索记忆
    r = await client.get("/api/v1/memory/search?query=测试")
    assert r.status_code == 200, f"期望200，实际：{r.status_code}"
    data = r.json()
    assert data["success"] is True, f"success应为True：{data}"

    results = data["data"]
    assert isinstance(results, list), f"data应为列表，实际：{type(results)}"

    # 验证结果字段（若有结果则校验字段结构）
    if results:
        first = results[0]
        assert "layer" in first, f"结果应有layer字段，实际：{first.keys()}"
        assert "content" in first, f"结果应有content字段，实际：{first.keys()}"
        assert "score" in first, f"结果应有score字段，实际：{first.keys()}"


# ── 链路4：权限矩阵验证 ───────────────────────────────────────────────────────────

async def test_chain4_permission_matrix(client):
    """链路4：直接调用权限系统验证L0/L2/L4行为 + 心绪状态正常返回。"""
    from openagi.social.permissions import check_permission, PermissionContext, PermissionDecision

    # L0 操作(read_file) → ALLOWED
    ctx_l0 = PermissionContext(action="read_file", agent_level="L0")
    result_l0 = check_permission(ctx_l0)
    assert result_l0.allowed is True, f"L0 read_file应该ALLOWED，实际：{result_l0.decision}"
    assert result_l0.decision == PermissionDecision.ALLOWED, f"决策应为ALLOWED：{result_l0.decision}"

    # L2 操作(write_file) L0代理未确认 → REQUIRES_CONFIRMATION
    ctx_l2 = PermissionContext(
        action="write_file",
        agent_level="L2",
        user_confirmed=None,  # 未确认
    )
    result_l2 = check_permission(ctx_l2)
    assert result_l2.allowed is False, f"L2 write_file未确认应不被允许，实际：{result_l2}"
    assert result_l2.decision == PermissionDecision.REQUIRES_CONFIRMATION, \
        f"决策应为REQUIRES_CONFIRMATION，实际：{result_l2.decision}"

    # L4 内容(rm -rf /) → PERMANENTLY_FORBIDDEN
    ctx_l4 = PermissionContext(
        action="write_file",
        agent_level="L4",
        payload={"command": "rm -rf /"},
    )
    result_l4 = check_permission(ctx_l4)
    assert result_l4.allowed is False, f"rm -rf /应PERMANENTLY_FORBIDDEN，实际：{result_l4}"
    assert result_l4.decision == PermissionDecision.PERMANENTLY_FORBIDDEN, \
        f"决策应为PERMANENTLY_FORBIDDEN，实际：{result_l4.decision}"

    # 验证心绪系统能正常返回状态
    heart_r = await client.get("/api/v1/heart/status")
    assert heart_r.status_code == 200
    heart_data = heart_r.json()
    assert heart_data["success"] is True
    assert heart_data["data"]["level"] in ("calm", "focused", "anxious", "crisis"), \
        f"心绪level应在预期范围，实际：{heart_data['data']['level']}"


# ── 链路5：记忆统计和DNA ──────────────────────────────────────────────────────────

async def test_chain5_memory_stats_and_dna(client):
    """链路5：GET /memory/stats 验证4层结构存在 + GET /memory/dna 验证返回列表。"""
    # 记忆统计
    stats_r = await client.get("/api/v1/memory/stats")
    assert stats_r.status_code == 200, f"期望200，实际：{stats_r.status_code}"
    stats_data = stats_r.json()
    assert stats_data["success"] is True, f"success应为True：{stats_data}"

    stats = stats_data["data"]
    # 验证4层结构都存在
    assert "working" in stats, f"stats应有working层，实际keys：{list(stats.keys())}"
    assert "archive" in stats, f"stats应有archive层，实际keys：{list(stats.keys())}"
    assert "core_dna" in stats, f"stats应有core_dna层，实际keys：{list(stats.keys())}"
    # 第4层：recent 或其他实现（working/recent/archive/core_dna）
    fourth_layer_keys = {"recent", "episodic", "hot", "semantic", "procedural"}
    found_fourth = any(k in stats for k in fourth_layer_keys)
    assert found_fourth, f"stats应有第4层结构之一{fourth_layer_keys}，实际keys：{list(stats.keys())}"

    # DNA列表
    dna_r = await client.get("/api/v1/memory/dna")
    assert dna_r.status_code == 200, f"期望200，实际：{dna_r.status_code}"
    dna_data = dna_r.json()
    assert dna_data["success"] is True, f"success应为True：{dna_data}"
    assert isinstance(dna_data["data"], list), f"data应为列表，实际：{type(dna_data['data'])}"
    assert len(dna_data["data"]) >= 1, f"DNA列表应至少有1条，实际：{len(dna_data['data'])}"
