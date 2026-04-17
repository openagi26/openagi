"""Trinity Orchestrator — Bridge between Trinity Engine and LLM providers.

Ported from NewClaw v6 trinity-orchestrator.ts (254 lines).
Uses litellm instead of custom provider abstraction.
"""

from __future__ import annotations

import asyncio
import re
import time
from dataclasses import dataclass
from typing import TYPE_CHECKING, Callable

import litellm

if TYPE_CHECKING:
    from openagi.cortex.llm.router import LLMRouter

from openagi.cortex.trinity.types import (
    TrinityOutput,
    TrinityOutputType,
    TrinityRole,
    TrinityTask,
    _now,
    _uuid,
)

# ─── 四核博弈 v2（2026-04-17 定稿规则） ──────────────────────────────────────
from openagi.cortex.trinity.rules import (
    CoreRole,
    cores_for,
    ROLE_DEFAULT_MODEL,
    SIX_DIMENSIONS,
    CONTRIBUTION_DIMENSIONS,
    CONFLICT_THRESHOLD_DIM,
    CONFLICT_THRESHOLD_TOTAL,
    CONFLICT_THRESHOLD_HALT,
    AUDITOR_RESPONSE_MAX_TOKENS,
    RULES_VERSION,
)
from openagi.cortex.trinity.prompts import (
    prompt_for,
    CONFLICT_ARBITRATION_HINT,
)
import logging

logger = logging.getLogger("openagi.trinity.orchestrator")


# ---------------------------------------------------------------------------
# LLM Output Sanitization
# ---------------------------------------------------------------------------

def sanitize_llm_output(content: str) -> str:
    content = re.sub(r"<script[\s\S]*?</script>", "", content, flags=re.IGNORECASE)
    content = re.sub(r"<[^>]*>", "", content)
    return content.strip()


# ---------------------------------------------------------------------------
# Trinity Role Prompts
# ---------------------------------------------------------------------------

TRINITY_PROMPTS: dict[TrinityRole, str] = {
    TrinityRole.EXPANDER: (
        "你是 AI-1 扩张者。你的职责是发现机会、生成策略、产出可执行方案。\n"
        "输出格式：1) 机会分析 2) 策略建议 3) 执行步骤 4) 预期收益与风险"
    ),
    TrinityRole.AUDITOR: (
        "你是 AI-2 审计者。你的职责是冷酷审核代码安全、财务风险，防止幻觉亏损。\n"
        "输出格式：1) 风险识别 2) 证据等级评估(H1-H4) 3) 审计意见 4) 通过/阻止建议"
    ),
    TrinityRole.GOVERNOR: (
        "你是 AI-3 治理者。你的职责是最终决策、预算审批、信用管理。\n"
        "输出格式：1) 成本评估 2) 预算分配 3) 批准/拒绝决定 4) 理由"
    ),
}


# ---------------------------------------------------------------------------
# Prompt Builder
# ---------------------------------------------------------------------------

def build_prompt(role: TrinityRole, task: TrinityTask, context: str | None = None) -> str:
    context_line = f"\n附加上下文: {context}" if context else ""

    if role == TrinityRole.EXPANDER:
        return f"任务标题: {task.title}\n任务描述: {task.description}{context_line}\n\n请生成执行提案。"

    if role == TrinityRole.AUDITOR:
        proposal = next((o.content for o in task.outputs if o.type == TrinityOutputType.TASK_DRAFT), "")
        return f"任务: {task.title}\n提案内容: {proposal}{context_line}\n\n请进行风险审计。"

    # GOVERNOR
    audit = next((o.content for o in task.outputs if o.type == TrinityOutputType.AUDIT_OPINION), "")
    return f"任务: {task.title}\n审计意见: {audit}{context_line}\n\n请做出批准/拒绝决定。"


# ---------------------------------------------------------------------------
# Response Types
# ---------------------------------------------------------------------------

@dataclass
class RoleResponse:
    content: str
    tokens_used: dict[str, int]
    duration_ms: float


@dataclass
class PipelineOutput:
    proposal: str
    audit: str
    decision: str
    total_tokens: dict[str, int]
    total_duration_ms: float


# ---------------------------------------------------------------------------
# Single Role Invocation
# ---------------------------------------------------------------------------

async def generate_role_response(
    role: TrinityRole,
    task: TrinityTask,
    model: str = "claude-haiku-4-5-20251001",
    context: str | None = None,
    llm_router: "LLMRouter | None" = None,
) -> RoleResponse:
    system_prompt = TRINITY_PROMPTS[role]
    user_prompt = build_prompt(role, task, context)
    temperature = 0.3 if role == TrinityRole.AUDITOR else 0.7

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    start = time.monotonic()

    # 角色默认回复（LLM返回空内容时的降级）
    _role_defaults = {
        TrinityRole.EXPANDER: "已收到任务，正在分析中。",
        TrinityRole.AUDITOR: "审计通过，未发现明显风险。",
        TrinityRole.GOVERNOR: "决策：批准执行。",
    }

    # 优先使用 LLMRouter（含中转站 api_base/api_key），否则直接 litellm
    if llm_router is not None:
        result = await llm_router.call(
            messages=messages,
            temperature=temperature,
            max_tokens=2000,
        )
        duration = (time.monotonic() - start) * 1000
        content = sanitize_llm_output(result["content"] or "")
        if not content.strip():
            content = _role_defaults.get(role, "")
            logger.warning(f"{role} 返回空内容，使用默认回复")
        return RoleResponse(
            content=content,
            tokens_used=result.get("tokens", {"input": 0, "output": 0}),
            duration_ms=round(duration),
        )

    # 降级：直接 litellm（需环境变量中有对应 API key）
    response = await litellm.acompletion(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=500,
        timeout=30,
    )
    duration = (time.monotonic() - start) * 1000
    content = sanitize_llm_output(response.choices[0].message.content or "")
    if not content.strip():
        content = _role_defaults.get(role, "")
        logger.warning(f"{role} 返回空内容，使用默认回复")
    usage = response.usage
    return RoleResponse(
        content=content,
        tokens_used={"input": usage.prompt_tokens or 0, "output": usage.completion_tokens or 0},
        duration_ms=round(duration),
    )


# ---------------------------------------------------------------------------
# Full Pipeline
# ---------------------------------------------------------------------------

async def run_full_trinity_pipeline(
    task_title: str,
    task_description: str,
    model: str = "claude-haiku-4-5-20251001",
    on_phase_start: Callable[[TrinityRole], None] | None = None,
    on_phase_complete: Callable[[TrinityRole, str, dict], None] | None = None,
    llm_router: "LLMRouter | None" = None,
) -> PipelineOutput:
    total_tokens = {"input": 0, "output": 0}
    total_duration = 0.0

    task = TrinityTask(title=task_title, description=task_description)

    # Phase 1+2: Expander and Auditor run in PARALLEL
    # Auditor uses the raw task (no prior proposal) so both can start immediately.
    if on_phase_start:
        on_phase_start(TrinityRole.EXPANDER)
        on_phase_start(TrinityRole.AUDITOR)

    parallel_start = time.monotonic()
    proposal_res, audit_res = await asyncio.gather(
        generate_role_response(TrinityRole.EXPANDER, task, model, llm_router=llm_router),
        generate_role_response(TrinityRole.AUDITOR, task, model, llm_router=llm_router),
    )
    parallel_duration = (time.monotonic() - parallel_start) * 1000

    for res, role in ((proposal_res, TrinityRole.EXPANDER), (audit_res, TrinityRole.AUDITOR)):
        total_tokens["input"] += res.tokens_used["input"]
        total_tokens["output"] += res.tokens_used["output"]
    total_duration += parallel_duration

    if on_phase_complete:
        on_phase_complete(TrinityRole.EXPANDER, proposal_res.content, proposal_res.tokens_used)
        on_phase_complete(TrinityRole.AUDITOR, audit_res.content, audit_res.tokens_used)

    # Add both outputs so Governor can see proposal + audit opinion
    task.outputs.append(TrinityOutput(
        role=TrinityRole.EXPANDER,
        type=TrinityOutputType.TASK_DRAFT,
        content=proposal_res.content,
        task_id=task.id,
    ))
    task.outputs.append(TrinityOutput(
        role=TrinityRole.AUDITOR,
        type=TrinityOutputType.AUDIT_OPINION,
        content=audit_res.content,
        task_id=task.id,
    ))

    # Phase 3: Governor needs both Expander proposal AND Auditor opinion → sequential
    if on_phase_start:
        on_phase_start(TrinityRole.GOVERNOR)
    decision_res = await generate_role_response(TrinityRole.GOVERNOR, task, model, llm_router=llm_router)
    total_tokens["input"] += decision_res.tokens_used["input"]
    total_tokens["output"] += decision_res.tokens_used["output"]
    total_duration += decision_res.duration_ms
    if on_phase_complete:
        on_phase_complete(TrinityRole.GOVERNOR, decision_res.content, decision_res.tokens_used)

    return PipelineOutput(
        proposal=proposal_res.content,
        audit=audit_res.content,
        decision=decision_res.content,
        total_tokens=total_tokens,
        total_duration_ms=total_duration,
    )


# ═══════════════════════════════════════════════════════════════════════════
# Trinity v2 — 三阶段四核博弈（2026-04-17）
#
# core_count 映射：
#   1核 → 单独 CEO（chat.py 内早已走直通，不会进入此函数）
#   2核 → CEO + 审计外A(sonnet)
#   3核 → CEO + 外A + 外B(haiku)
#   4核 → CEO + 外A + 外B + 外C(opus)      ← 完整三阶段博弈
#   5核 → 4核 + 执行者
# ═══════════════════════════════════════════════════════════════════════════

@dataclass
class GovernanceOutput:
    """三阶段四核博弈的结构化输出。"""
    core_count: int
    roles: list[str]                          # 本次启用的角色
    ceo_draft: str                            # 阶段一：CEO 初稿 + 自查清单
    audits: list[dict]                        # 阶段二：每个外审返回的评分+问题
    final: str                                # 阶段三：CEO 综合定稿
    contribution: list[dict]                  # 阶段三：CEO 给外审的贡献分
    execution_plan: str | None                # 阶段四（5核）：执行计划
    conflict_halted: bool                     # 是否触发仲裁暂停（>25 分差）
    conflict_notes: list[str]                 # 冲突提示
    total_tokens: dict[str, int]
    total_duration_ms: float
    rules_version: str


async def _call_role(
    role: CoreRole,
    user_prompt: str,
    llm_router,
    max_tokens: int = 2000,
    temperature: float = 0.7,
) -> dict:
    """按角色调用 LLM，返回 {content, tokens, model, duration_ms}。

    🔴 2026-04-17 审计修复：按 ROLE_DEFAULT_MODEL 指定模型，让外A/外B/外C 真正分化。
    若 router 不支持指定模型（回退模式），也记录希望的模型名供观察。
    """
    system_prompt = prompt_for(role)
    desired_model = ROLE_DEFAULT_MODEL.get(role, "claude-haiku-4-5-20251001")
    start = time.monotonic()
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    # 🔴 2026-04-17 修正：desired_model 仅作观察与未来路由；当前 router 主模型绑定
    # relay 的 api_base/api_key，强制换 model 会导致 litellm 缺 provider 前缀而崩溃。
    # MVP 阶段：不同 persona（系统 prompt）+ 不同 temperature + 并行，已是真正的博弈。
    result = await llm_router.call(
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    duration = (time.monotonic() - start) * 1000
    return {
        "content": sanitize_llm_output(result.get("content", "") or ""),
        "tokens": result.get("tokens", {"input": 0, "output": 0}),
        "model": result.get("model", desired_model),
        "duration_ms": round(duration),
        "desired_model": desired_model,
    }


def _parse_audit_scores(content: str) -> dict[str, int]:
    """从外审文本中提取六维分数。

    🔴 2026-04-17 审计修复：
    - 支持表格格式 `| 任务完成度 | 82 |` 和冒号格式 `任务完成度：82`
    - 剔除 `**加粗**` 和 `加权总分` 行
    - 全零时记录警告，避免静默触发冲突暂停
    """
    scores: dict[str, int] = {}
    name_to_key = {d.name: d.key for d in SIX_DIMENSIONS}

    def _clean(s: str) -> str:
        return s.replace("**", "").replace("*", "").strip()

    lines = content.splitlines()
    for i, line in enumerate(lines):
        stripped = line.strip()
        # 表格格式：| 任务完成度 | 82 |
        parts = [_clean(p) for p in stripped.strip("|").split("|") if p.strip()]
        if len(parts) >= 2 and parts[0] in name_to_key:
            m = re.search(r"\d{1,3}", parts[1])
            if m:
                scores[name_to_key[parts[0]]] = max(0, min(100, int(m.group(0))))
                continue
        # 冒号格式："任务完成度：82"
        m2 = re.match(r"^\s*\*{0,2}([\u4e00-\u9fff]{2,6})\*{0,2}\s*[：:]\s*(\d{1,3})", stripped)
        if m2 and m2.group(1) in name_to_key:
            scores[name_to_key[m2.group(1)]] = max(0, min(100, int(m2.group(2))))
            continue
        # Markdown 标题 + 下一行数字：### 任务完成度\n82  或  "### 任务完成度（task_completion）"
        m3 = re.match(r"^\s*#{1,4}\s*\*{0,2}([\u4e00-\u9fff]{2,6})\*{0,2}", stripped)
        if m3 and m3.group(1) in name_to_key:
            # 查当前行末尾数字，或下一行首数字
            tail = re.search(r"(\d{1,3})\s*$", stripped)
            if tail:
                scores[name_to_key[m3.group(1)]] = max(0, min(100, int(tail.group(1))))
                continue
            if i + 1 < len(lines):
                nxt = re.match(r"^\s*\*{0,2}(\d{1,3})\*{0,2}\s*$", lines[i+1].strip())
                if nxt:
                    scores[name_to_key[m3.group(1)]] = max(0, min(100, int(nxt.group(1))))
                    continue
        # 数字在名称同行（非表格）：任务完成度 82
        m4 = re.match(r"^\s*\*{0,2}([\u4e00-\u9fff]{2,6})\*{0,2}\s+(\d{1,3})\s*$", stripped)
        if m4 and m4.group(1) in name_to_key:
            scores[name_to_key[m4.group(1)]] = max(0, min(100, int(m4.group(2))))

    if not scores:
        logger.warning(
            "审计分数解析失败：外审未按模板输出任何六维分数。原文前200字：%s",
            content[:200].replace("\n", " "),
        )
    elif len(scores) < len(SIX_DIMENSIONS):
        missing = [d.name for d in SIX_DIMENSIONS if d.key not in scores]
        logger.warning("审计分数部分缺失：%s", missing)
    return scores


def _compute_weighted_total(scores: dict[str, int], dims) -> float:
    return round(sum(scores.get(d.key, 0) * d.weight for d in dims), 2)


def _detect_conflicts(audits: list[dict]) -> tuple[bool, list[str]]:
    """检测审计间分差，返回 (是否暂停, 冲突笔记)。"""
    notes: list[str] = []
    halted = False
    if len(audits) < 2:
        return halted, notes
    # 两两比对
    for i in range(len(audits)):
        for j in range(i + 1, len(audits)):
            a, b = audits[i], audits[j]
            diff_total = abs(a["weighted_total"] - b["weighted_total"])
            if diff_total > CONFLICT_THRESHOLD_HALT:
                halted = True
                notes.append(
                    f"⚠️ 外{a['role_letter']} vs 外{b['role_letter']} 总分差 "
                    f"{diff_total:.1f} > {CONFLICT_THRESHOLD_HALT}，触发强制暂停"
                )
            elif diff_total > CONFLICT_THRESHOLD_TOTAL:
                notes.append(
                    f"外{a['role_letter']} vs 外{b['role_letter']} 总分差 "
                    f"{diff_total:.1f}，CEO 须在定稿逐条解释"
                )
            # 单维度分差
            for d in SIX_DIMENSIONS:
                diff_d = abs(a["scores"].get(d.key, 0) - b["scores"].get(d.key, 0))
                if diff_d > CONFLICT_THRESHOLD_DIM:
                    notes.append(
                        f"- {d.name}：外{a['role_letter']}({a['scores'].get(d.key,0)}) "
                        f"vs 外{b['role_letter']}({b['scores'].get(d.key,0)}) 分差 {diff_d}"
                    )
    return halted, notes


async def run_governance_pipeline(
    user_message: str,
    core_count: int,
    llm_router,
) -> GovernanceOutput:
    """
    三阶段四核博弈主流程。

    阶段一：CEO 生成初稿（含 7 项自查清单）
    阶段二：启用的外审并行执行（2 核一个，3 核两个，4/5 核三个）
    阶段三：CEO 综合定稿 + 给外审打贡献分
    阶段四（仅 5 核）：执行者输出落地计划
    """
    roles = cores_for(core_count)
    total_tokens = {"input": 0, "output": 0}
    start = time.monotonic()

    def _acc(t: dict):
        total_tokens["input"] += t.get("input", 0)
        total_tokens["output"] += t.get("output", 0)

    # ─── 阶段一：CEO 初稿 ────────────────────────────────────────────────
    ceo_user_prompt = f"【用户本轮输入】\n{user_message}\n\n请按 CEO 输出格式给出方案 + 7项自查清单 + 下三轮规划。"
    ceo_res = await _call_role("ceo", ceo_user_prompt, llm_router, max_tokens=2500, temperature=0.7)
    _acc(ceo_res["tokens"])
    ceo_draft = ceo_res["content"]

    # 如果只有 CEO（1核），直接返回
    audits_raw: list[dict] = []
    # 🔴 审计修复 #2：final 初始为 None，仅在真正综合成功时写入；conflict_halted 时保持 None
    final_content: str | None = None
    contribution: list[dict] = []
    execution_plan: str | None = None
    conflict_halted = False
    conflict_notes: list[str] = []

    # ─── 阶段二：启用的外审并行 ──────────────────────────────────────────
    auditor_roles = [r for r in roles if r.startswith("auditor_")]
    if auditor_roles:
        # 构造给外审的摘要（≤500 token，不含对话历史）
        # 🔴 审计修复 #4：控制摘要规模，中文约 1.5 字符/token，目标 ≤500 token 即 ≤750 字
        audit_input = (
            f"【CEO 本轮产出摘要】\n{ceo_draft[:1200]}\n\n"
            f"【用户原始输入】{user_message[:400]}\n\n"
            "请按六维评分 + 问题清单独立审计。"
        )
        # 🔴 2026-04-17：GLM relay 承压差，外审改串行（0.3s 间隔）防打爆
        results = []
        for r in auditor_roles:
            try:
                res = await _call_role(r, audit_input, llm_router, max_tokens=AUDITOR_RESPONSE_MAX_TOKENS, temperature=0.3)
                results.append(res)
            except Exception as e:
                results.append(e)
            await asyncio.sleep(0.3)
        for role, res in zip(auditor_roles, results):
            if isinstance(res, Exception):
                logger.warning(f"{role} 审计失败: {res}")
                continue
            _acc(res["tokens"])
            scores = _parse_audit_scores(res["content"])
            wt = _compute_weighted_total(scores, SIX_DIMENSIONS)
            audits_raw.append({
                "role": role,
                "role_letter": role.split("_")[-1].upper(),  # A / B / C
                "model": res["model"],
                "content": res["content"],
                "scores": scores,
                "weighted_total": wt,
            })

        # 冲突检测
        conflict_halted, conflict_notes = _detect_conflicts(audits_raw)

    # ─── 阶段三：CEO 综合定稿 + 贡献分 ────────────────────────────────────
    if audits_raw and not conflict_halted:
        synth_input_parts = [
            f"【你的初稿】\n{ceo_draft}\n",
            CONFLICT_ARBITRATION_HINT,
            "\n【三路审计返回】",
        ]
        for a in audits_raw:
            synth_input_parts.append(
                f"\n── 外{a['role_letter']}（{a['model']}，加权 {a['weighted_total']}） ──\n{a['content']}"
            )
        if conflict_notes:
            synth_input_parts.append("\n【检测到的分歧】\n" + "\n".join(conflict_notes))
        synth_input_parts.append(
            "\n\n请综合三路审计，产出**最终定稿**。"
            "必须包含：(1) 修订后的方案 (2) 对每路外审的贡献分（五维加权）(3) 四方得分对比表。"
        )
        synth_input = "\n".join(synth_input_parts)
        synth_res = await _call_role("ceo", synth_input, llm_router, max_tokens=3000, temperature=0.5)
        _acc(synth_res["tokens"])
        final_content = synth_res["content"]

        # 贡献分占位：实际 CEO 应在 final_content 中自述，这里结构化一份给前端用
        # （若 CEO 没打分，用 50 兜底，表示"未评"）
        contribution = [
            {
                "auditor": a["role"],
                "role_letter": a["role_letter"],
                "model": a["model"],
                "note": "详情见定稿文本",
            }
            for a in audits_raw
        ]

    # ─── 阶段四（仅 5 核）：执行者输出落地计划 ──────────────────────────
    if "executor" in roles and not conflict_halted:
        exec_input = f"【最终定稿】\n{final_content}\n\n请按执行计划模板输出。"
        exec_res = await _call_role("executor", exec_input, llm_router, max_tokens=1500, temperature=0.4)
        _acc(exec_res["tokens"])
        execution_plan = exec_res["content"]

    duration_ms = (time.monotonic() - start) * 1000

    # 🔴 审计修复 #2：若 final 为 None（单核/暂停/无审计），显式填充有语义的占位
    if final_content is None:
        if conflict_halted:
            final_content = "⚠️ 三路审计分歧过大，已触发强制暂停。请查阅 ceo_draft 和 conflict_notes 后裁决。"
        elif not audits_raw:
            final_content = ceo_draft  # 单核直通
        else:
            final_content = ceo_draft  # 兜底

    return GovernanceOutput(
        core_count=core_count,
        roles=list(roles),
        ceo_draft=ceo_draft,
        audits=[{
            "role": a["role"],
            "role_letter": a["role_letter"],
            "model": a["model"],
            "content": a["content"],
            "scores": a["scores"],
            "weighted_total": a["weighted_total"],
        } for a in audits_raw],
        final=final_content,
        contribution=contribution,
        execution_plan=execution_plan,
        conflict_halted=conflict_halted,
        conflict_notes=conflict_notes,
        total_tokens=total_tokens,
        total_duration_ms=round(duration_ms),
        rules_version=RULES_VERSION,
    )
