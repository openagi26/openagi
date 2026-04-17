"""业务断言验证端点 — 让后端计算 Network/DOM/Store 三项布尔值，CEO 只读 bool。"""
from __future__ import annotations

import re
import logging
from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger("openagi.api.audit")
router = APIRouter()


class AuditVerifyRequest(BaseModel):
    test_id: str
    network_url_pattern: Optional[str] = None
    network_response_must_contain: Optional[List[str]] = None
    dom_selector: Optional[str] = None
    dom_must_not_contain: Optional[List[str]] = None
    dom_min_length: Optional[int] = None
    dom_actual_text: Optional[str] = None
    store_action_expected: Optional[str] = None
    store_action_actual: Optional[str] = None


class AuditVerifyResponse(BaseModel):
    test_id: str
    network_ok: bool
    dom_ok: bool
    store_ok: bool
    all_pass: bool
    details: dict


@router.post("/verify", response_model=AuditVerifyResponse)
async def audit_verify(req: AuditVerifyRequest) -> AuditVerifyResponse:
    """
    计算业务断言三项布尔值。
    - network_ok：pattern 为空则 true；否则检查 dom_actual_text 是否含 pattern（代理模式）
    - dom_ok：检查 must_not_contain + min_length
    - store_ok：检查 store_action_actual == store_action_expected
    """
    details: dict = {}

    # ── network_ok ──────────────────────────────────────────────────────────
    if req.network_url_pattern is None:
        network_ok = True
        details["network"] = "无 pattern，跳过"
    else:
        # 后端无法直接拦截浏览器 Network Tab，改为：
        # 要求前端将 response body 摘要写入 dom_actual_text 中一并传来做关键词匹配
        text_to_check = req.dom_actual_text or ""
        if req.network_response_must_contain:
            missing = [f for f in req.network_response_must_contain if f not in text_to_check]
            if missing:
                network_ok = False
                details["network"] = f"响应缺少字段: {missing}"
            else:
                network_ok = True
                details["network"] = "响应字段全部命中"
        else:
            # 只检查 pattern 是否出现在 dom_actual_text
            network_ok = bool(re.search(req.network_url_pattern, text_to_check))
            details["network"] = "pattern 匹配" if network_ok else f"pattern '{req.network_url_pattern}' 未在文本中找到"

    # ── dom_ok ───────────────────────────────────────────────────────────────
    actual = req.dom_actual_text or ""
    dom_ok = True
    dom_reasons: list[str] = []

    if req.dom_must_not_contain:
        hits = [s for s in req.dom_must_not_contain if s in actual]
        if hits:
            dom_ok = False
            dom_reasons.append(f"含禁止词: {hits}")

    if req.dom_min_length is not None and len(actual) < req.dom_min_length:
        dom_ok = False
        dom_reasons.append(f"文本长度 {len(actual)} < 最低要求 {req.dom_min_length}")

    details["dom"] = "通过" if dom_ok else "; ".join(dom_reasons)

    # ── store_ok ─────────────────────────────────────────────────────────────
    if req.store_action_expected is None:
        store_ok = True
        details["store"] = "无期望 action，跳过"
    else:
        store_ok = req.store_action_actual == req.store_action_expected
        details["store"] = (
            f"action 匹配: {req.store_action_actual}"
            if store_ok
            else f"期望 {req.store_action_expected}，实测 {req.store_action_actual}"
        )

    all_pass = network_ok and dom_ok and store_ok
    logger.info("audit_verify %s => all_pass=%s", req.test_id, all_pass)

    return AuditVerifyResponse(
        test_id=req.test_id,
        network_ok=network_ok,
        dom_ok=dom_ok,
        store_ok=store_ok,
        all_pass=all_pass,
        details=details,
    )
