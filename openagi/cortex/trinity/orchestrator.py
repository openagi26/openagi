"""Trinity Orchestrator — Bridge between Trinity Engine and LLM providers.

Ported from NewClaw v6 trinity-orchestrator.ts (254 lines).
Uses litellm instead of custom provider abstraction.
"""

from __future__ import annotations

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

    # 优先使用 LLMRouter（含中转站 api_base/api_key），否则直接 litellm
    if llm_router is not None:
        result = await llm_router.call(
            messages=messages,
            temperature=temperature,
            max_tokens=500,
        )
        duration = (time.monotonic() - start) * 1000
        return RoleResponse(
            content=sanitize_llm_output(result["content"] or ""),
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
    content = response.choices[0].message.content or ""
    usage = response.usage
    return RoleResponse(
        content=sanitize_llm_output(content),
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

    # Phase 1: Proposal (AI-1 Expander)
    if on_phase_start:
        on_phase_start(TrinityRole.EXPANDER)
    proposal_res = await generate_role_response(TrinityRole.EXPANDER, task, model, llm_router=llm_router)
    total_tokens["input"] += proposal_res.tokens_used["input"]
    total_tokens["output"] += proposal_res.tokens_used["output"]
    total_duration += proposal_res.duration_ms
    if on_phase_complete:
        on_phase_complete(TrinityRole.EXPANDER, proposal_res.content, proposal_res.tokens_used)

    task.outputs.append(TrinityOutput(
        role=TrinityRole.EXPANDER,
        type=TrinityOutputType.TASK_DRAFT,
        content=proposal_res.content,
        task_id=task.id,
    ))

    # Phase 2: Audit (AI-2 Auditor)
    if on_phase_start:
        on_phase_start(TrinityRole.AUDITOR)
    audit_res = await generate_role_response(TrinityRole.AUDITOR, task, model, llm_router=llm_router)
    total_tokens["input"] += audit_res.tokens_used["input"]
    total_tokens["output"] += audit_res.tokens_used["output"]
    total_duration += audit_res.duration_ms
    if on_phase_complete:
        on_phase_complete(TrinityRole.AUDITOR, audit_res.content, audit_res.tokens_used)

    task.outputs.append(TrinityOutput(
        role=TrinityRole.AUDITOR,
        type=TrinityOutputType.AUDIT_OPINION,
        content=audit_res.content,
        task_id=task.id,
    ))

    # Phase 3: Decision (AI-3 Governor)
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
