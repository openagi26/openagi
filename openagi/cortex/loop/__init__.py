"""ReAct（Reasoning + Acting）执行循环 — OpenAGI Cortex Loop Layer.

Pure functions, no shared state, concurrent-safe by design.
Each session_id operates on its own ReActPlan instance.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any, Callable
from uuid import uuid4

logger = logging.getLogger("openagi.react")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _uuid() -> str:
    return str(uuid4())


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ReActPhase(StrEnum):
    THINK = "think"
    ACT = "act"
    OBSERVE = "observe"


class ReActStatus(StrEnum):
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    MAX_STEPS_EXCEEDED = "max_steps_exceeded"


# ---------------------------------------------------------------------------
# Data Structures
# ---------------------------------------------------------------------------

@dataclass
class ReActStep:
    """Single step in a ReAct loop execution."""

    step_id: str = field(default_factory=_uuid)
    action: str = ""
    observation: str = ""
    thought: str = ""
    phase: ReActPhase = ReActPhase.THINK
    timestamp: str = field(default_factory=_now)


@dataclass
class ReActPlan:
    """Execution plan for a single ReAct task, scoped to one session."""

    plan_id: str = field(default_factory=_uuid)
    task: str = ""
    steps: list[ReActStep] = field(default_factory=list)
    current_step: int = 0
    status: ReActStatus = ReActStatus.RUNNING
    session_id: str = ""
    max_steps: int = 20


@dataclass
class ReActResult:
    """Final result of a completed ReAct loop."""

    plan_id: str
    status: ReActStatus
    steps: list[ReActStep]
    steps_taken: int
    final_answer: str = ""


# ---------------------------------------------------------------------------
# Prompt Templates
# ---------------------------------------------------------------------------

_THINK_PROMPT = """\
You are an AI assistant executing a ReAct (Reasoning + Acting) loop.

Task: {task}

Previous steps:
{history}

Step {step_num} — THINK phase.
Reason about what action to take next. Respond in this exact format:
Thought: <your reasoning>
Action: <tool_name> | <JSON args> OR "FINISH: <final answer>"

If the task is complete, use: Action: FINISH: <your final answer>
""".strip()

_OBSERVE_PROMPT = """\
You are an AI assistant executing a ReAct loop.

Task: {task}

Previous steps:
{history}

Step {step_num} — OBSERVE phase.
The action "{action}" returned:
{observation}

Summarize this observation in one sentence for the next reasoning step:
""".strip()


# ---------------------------------------------------------------------------
# Private Helpers
# ---------------------------------------------------------------------------

def _format_history(steps: list[ReActStep]) -> str:
    if not steps:
        return "(no previous steps)"
    lines: list[str] = []
    for i, s in enumerate(steps, 1):
        lines.append(f"  Step {i}: [{s.phase}] thought={s.thought!r} action={s.action!r} observation={s.observation!r}")
    return "\n".join(lines)


def _parse_think_response(response: str) -> tuple[str, str]:
    """Extract (thought, action) from a THINK-phase LLM response."""
    thought = ""
    action = ""
    for line in response.splitlines():
        if line.startswith("Thought:"):
            thought = line[len("Thought:"):].strip()
        elif line.startswith("Action:"):
            action = line[len("Action:"):].strip()
    return thought, action


def _is_finish(action: str) -> bool:
    return action.upper().startswith("FINISH:")


def _extract_final_answer(action: str) -> str:
    return action[len("FINISH:"):].strip() if _is_finish(action) else ""


def _parse_tool_call(action: str) -> tuple[str, dict]:
    """Parse 'tool_name | {json_args}' into (tool_name, args_dict)."""
    import json
    if "|" not in action:
        return action.strip(), {}
    parts = action.split("|", 1)
    tool_name = parts[0].strip()
    raw_args = parts[1].strip()
    try:
        args = json.loads(raw_args)
    except (json.JSONDecodeError, ValueError):
        args = {"raw": raw_args}
    return tool_name, args


# ---------------------------------------------------------------------------
# Core Functions
# ---------------------------------------------------------------------------

async def create_plan(
    task: str,
    session_id: str,
    max_steps: int = 20,
) -> ReActPlan:
    """Create a new ReActPlan for the given task and session."""
    plan = ReActPlan(
        task=task,
        session_id=session_id,
        max_steps=max_steps,
    )
    logger.info(
        "[REACT][step_0][init] Created plan plan_id=%s session_id=%s max_steps=%d task=%r",
        plan.plan_id,
        session_id,
        max_steps,
        task,
    )
    return plan


async def execute_step(
    plan: ReActPlan,
    tools: dict[str, Callable],
    llm_call: Callable[[str], Any],
) -> tuple[ReActPlan, ReActStep]:
    """Execute one full ReAct step (think → act → observe) and return updated plan + step."""
    from dataclasses import replace as dc_replace
    import copy

    step_num = plan.current_step + 1
    step = ReActStep(step_id=_uuid(), timestamp=_now())

    # ── THINK ────────────────────────────────────────────────────────────────
    logger.info("[REACT][step_%d][think] Calling LLM for reasoning", step_num)
    step = dc_replace(step, phase=ReActPhase.THINK)

    think_prompt = _THINK_PROMPT.format(
        task=plan.task,
        history=_format_history(plan.steps),
        step_num=step_num,
    )
    try:
        think_response = await llm_call(think_prompt)
    except Exception as exc:
        logger.warning("[REACT][step_%d][think] LLM error: %s", step_num, exc)
        think_response = f"Thought: Error during thinking\nAction: FINISH: Unable to proceed due to LLM error: {exc}"

    thought, action = _parse_think_response(think_response)
    step = dc_replace(step, thought=thought, action=action)
    logger.info("[REACT][step_%d][think] thought=%r action=%r", step_num, thought, action)

    # ── FINISH shortcut ──────────────────────────────────────────────────────
    if _is_finish(action):
        final_answer = _extract_final_answer(action)
        step = dc_replace(step, observation="Task completed.", phase=ReActPhase.OBSERVE)
        new_steps = plan.steps + [step]
        new_plan = dc_replace(
            plan,
            steps=new_steps,
            current_step=step_num,
            status=ReActStatus.COMPLETED,
        )
        logger.info("[REACT][step_%d][observe] FINISH detected — final_answer=%r", step_num, final_answer)
        return new_plan, step

    # ── ACT ──────────────────────────────────────────────────────────────────
    step = dc_replace(step, phase=ReActPhase.ACT)
    logger.info("[REACT][step_%d][act] Executing action=%r", step_num, action)

    tool_name, tool_args = _parse_tool_call(action)
    if tool_name in tools:
        try:
            tool_result = await tools[tool_name](tool_args)
            raw_observation = str(tool_result)
        except Exception as exc:
            logger.warning("[REACT][step_%d][act] Tool %r raised: %s", step_num, tool_name, exc)
            raw_observation = f"Tool error: {exc}"
    else:
        logger.warning("[REACT][step_%d][act] Unknown tool %r", step_num, tool_name)
        raw_observation = f"Unknown tool: {tool_name!r}. Available: {list(tools.keys())}"

    # ── OBSERVE ──────────────────────────────────────────────────────────────
    step = dc_replace(step, phase=ReActPhase.OBSERVE)
    logger.info("[REACT][step_%d][observe] raw_observation=%r", step_num, raw_observation[:120])

    observe_prompt = _OBSERVE_PROMPT.format(
        task=plan.task,
        history=_format_history(plan.steps),
        step_num=step_num,
        action=action,
        observation=raw_observation,
    )
    try:
        summarised_observation = await llm_call(observe_prompt)
    except Exception as exc:
        logger.warning("[REACT][step_%d][observe] LLM summarise error: %s", step_num, exc)
        summarised_observation = raw_observation

    step = dc_replace(step, observation=summarised_observation)
    new_steps = plan.steps + [step]
    new_plan = dc_replace(plan, steps=new_steps, current_step=step_num)
    return new_plan, step


async def run_react_loop(
    task: str,
    session_id: str,
    tools: dict[str, Callable],
    llm_call: Callable[[str], Any],
    max_steps: int = 20,
) -> ReActResult:
    """Run the full ReAct loop until completion, failure, or max_steps exceeded.

    Concurrent-safe: each call creates its own ReActPlan; no shared mutable state.
    Errors in individual steps are recorded in step.observation rather than raised.
    """
    from dataclasses import replace as dc_replace

    plan = await create_plan(task=task, session_id=session_id, max_steps=max_steps)
    logger.info(
        "[REACT][step_0][init] Starting loop session_id=%s max_steps=%d",
        session_id,
        max_steps,
    )

    while plan.status == ReActStatus.RUNNING:
        if plan.current_step >= plan.max_steps:
            plan = dc_replace(plan, status=ReActStatus.MAX_STEPS_EXCEEDED)
            logger.warning(
                "[REACT][step_%d][observe] max_steps=%d exceeded — aborting session_id=%s",
                plan.current_step,
                plan.max_steps,
                session_id,
            )
            break

        try:
            plan, _step = await execute_step(plan=plan, tools=tools, llm_call=llm_call)
        except Exception as exc:
            # Defensive: execute_step should never raise, but guard anyway
            logger.error(
                "[REACT][step_%d][act] Unexpected error in execute_step: %s",
                plan.current_step + 1,
                exc,
            )
            from dataclasses import replace as _r
            plan = _r(plan, status=ReActStatus.FAILED)
            break

    # Determine final answer from the last FINISH action if present
    final_answer = ""
    for s in reversed(plan.steps):
        if _is_finish(s.action):
            final_answer = _extract_final_answer(s.action)
            break

    result = ReActResult(
        plan_id=plan.plan_id,
        status=plan.status,
        steps=plan.steps,
        steps_taken=plan.current_step,
        final_answer=final_answer,
    )
    logger.info(
        "[REACT][step_%d][observe] Loop finished status=%s steps_taken=%d session_id=%s",
        plan.current_step,
        plan.status,
        plan.current_step,
        session_id,
    )
    return result
