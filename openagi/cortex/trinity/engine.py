"""Trinity Engine — Three-AI orchestration pipeline.

Ported from NewClaw v6 engine.ts (336 lines).
Pure functions, no side effects, no I/O.
"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import replace

from openagi.cortex.trinity.types import (
    PipelineResult,
    PermissionLevel,
    RiskLevel,
    TaskStatus,
    TrinityAgent,
    TrinityOutput,
    TrinityOutputType,
    TrinityPhase,
    TrinityRole,
    TrinityTask,
    V6Event,
    _now,
    _uuid,
)
from openagi.social.constitution.core import (
    Constitution,
    get_permission_level_for_action,
    get_required_approvals,
)


# ---------------------------------------------------------------------------
# Agent Factory
# ---------------------------------------------------------------------------

def create_trinity_agents() -> dict[str, TrinityAgent]:
    return {
        "ai1": TrinityAgent(role=TrinityRole.EXPANDER, display_name="AI-1 扩张者"),
        "ai2": TrinityAgent(role=TrinityRole.AUDITOR, display_name="AI-2 审计者"),
        "ai3": TrinityAgent(role=TrinityRole.GOVERNOR, display_name="AI-3 治理者"),
    }


# ---------------------------------------------------------------------------
# Task Lifecycle
# ---------------------------------------------------------------------------

PHASE_TRANSITIONS: dict[TrinityPhase, tuple[TrinityPhase, TaskStatus, list[TrinityRole]]] = {
    TrinityPhase.PROPOSAL: (TrinityPhase.AUDIT, TaskStatus.PENDING_AUDIT, [TrinityRole.AUDITOR]),
    TrinityPhase.AUDIT: (TrinityPhase.APPROVAL, TaskStatus.PENDING_APPROVAL, [TrinityRole.GOVERNOR]),
    TrinityPhase.APPROVAL: (TrinityPhase.EXECUTION, TaskStatus.EXECUTING, [TrinityRole.EXPANDER]),
    TrinityPhase.EXECUTION: (TrinityPhase.REVIEW, TaskStatus.COMPLETED, [TrinityRole.AUDITOR, TrinityRole.GOVERNOR]),
    TrinityPhase.REVIEW: (TrinityPhase.SETTLED, TaskStatus.COMPLETED, []),
    TrinityPhase.SETTLED: (TrinityPhase.SETTLED, TaskStatus.COMPLETED, []),
}


def create_task(
    title: str,
    description: str,
    created_by: TrinityRole = TrinityRole.EXPANDER,
    permission_level: PermissionLevel = PermissionLevel.L0,
) -> TrinityTask:
    return TrinityTask(
        title=title,
        description=description,
        created_by=created_by,
        assigned_to=[created_by],
        permission_level=permission_level,
    )


def advance_task_phase(task: TrinityTask) -> TrinityTask:
    if task.phase == TrinityPhase.SETTLED:
        return task

    next_phase, next_status, assign_to = PHASE_TRANSITIONS[task.phase]
    return replace(
        task,
        phase=next_phase,
        status=next_status,
        assigned_to=assign_to,
        updated_at=_now(),
        completed_at=_now() if next_phase == TrinityPhase.SETTLED else task.completed_at,
    )


def block_task(task: TrinityTask, reason: str) -> TrinityTask:
    return replace(
        task,
        status=TaskStatus.BLOCKED,
        updated_at=_now(),
        outputs=[
            *task.outputs,
            _create_output(task.id, TrinityRole.AUDITOR, TrinityOutputType.AUDIT_OPINION, f"BLOCKED: {reason}"),
        ],
    )


def fail_task(task: TrinityTask, reason: str) -> TrinityTask:
    return replace(
        task,
        status=TaskStatus.FAILED,
        phase=TrinityPhase.REVIEW,
        updated_at=_now(),
        outputs=[
            *task.outputs,
            _create_output(task.id, TrinityRole.AUDITOR, TrinityOutputType.RISK_REPORT, f"FAILED: {reason}"),
        ],
    )


# ---------------------------------------------------------------------------
# Output Generation
# ---------------------------------------------------------------------------

def _create_output(
    task_id: str,
    role: TrinityRole,
    output_type: TrinityOutputType,
    content: str,
    metadata: dict | None = None,
) -> TrinityOutput:
    return TrinityOutput(
        role=role,
        type=output_type,
        content=content,
        metadata=metadata or {},
        task_id=task_id,
    )


# ---------------------------------------------------------------------------
# Trinity Pipeline Phases
# ---------------------------------------------------------------------------

def run_proposal_phase(task: TrinityTask, proposal_content: str) -> PipelineResult:
    output = _create_output(task.id, TrinityRole.EXPANDER, TrinityOutputType.TASK_DRAFT, proposal_content)
    updated = replace(task, outputs=[*task.outputs, output], updated_at=_now())

    return PipelineResult(
        task=advance_task_phase(updated),
        events=[V6Event(type="trinity:output", payload=output, source=TrinityRole.EXPANDER)],
    )


def run_audit_phase(
    task: TrinityTask,
    constitution: Constitution,
    audit_findings: str,
    risk_level: RiskLevel = RiskLevel.LOW,
) -> PipelineResult:
    audit_output = _create_output(
        task.id, TrinityRole.AUDITOR, TrinityOutputType.AUDIT_OPINION, audit_findings, {"risk_level": risk_level}
    )

    required_level = get_permission_level_for_action(constitution, task.title)

    if required_level == PermissionLevel.L4:
        return PipelineResult(
            task=block_task(replace(task, outputs=[*task.outputs, audit_output]), "Action permanently forbidden (L4)"),
            events=[V6Event(type="task:failed", payload={"task_id": task.id, "reason": "L4 forbidden action"}, source=TrinityRole.AUDITOR)],
            blocked=True,
            reason="Action permanently forbidden by permission fuse matrix (L4)",
        )

    if risk_level == RiskLevel.CRITICAL:
        return PipelineResult(
            task=block_task(replace(task, outputs=[*task.outputs, audit_output]), f"Critical risk: {audit_findings}"),
            events=[V6Event(type="task:failed", payload={"task_id": task.id, "reason": audit_findings}, source=TrinityRole.AUDITOR)],
            blocked=True,
            reason=audit_findings,
        )

    updated = replace(task, outputs=[*task.outputs, audit_output], permission_level=required_level, updated_at=_now())
    return PipelineResult(
        task=advance_task_phase(updated),
        events=[V6Event(type="trinity:output", payload=audit_output, source=TrinityRole.AUDITOR)],
        permission_required=required_level,
    )


def run_approval_phase(
    task: TrinityTask,
    constitution: Constitution,
    approved: bool,
    budget_allocation: float = 0.0,
) -> PipelineResult:
    required_approvals = get_required_approvals(constitution, task.permission_level)
    needs_human = "human" in required_approvals or "dual-sign" in required_approvals

    if not approved:
        return PipelineResult(
            task=block_task(task, "Approval denied by AI-3 Governor"),
            events=[V6Event(type="task:failed", payload={"task_id": task.id, "reason": "Approval denied"}, source=TrinityRole.GOVERNOR)],
            blocked=True,
            reason="Task approval denied by AI-3 financial governor",
        )

    charter_output = _create_output(
        task.id, TrinityRole.GOVERNOR, TrinityOutputType.TASK_CHARTER, "Task approved and chartered",
        {"budget_allocation": budget_allocation, "permission_level": task.permission_level, "needs_human_approval": needs_human},
    )

    updated = replace(task, outputs=[*task.outputs, charter_output], updated_at=_now())

    if needs_human:
        return PipelineResult(
            task=replace(updated, status=TaskStatus.PENDING_APPROVAL),
            events=[V6Event(type="permission:requested", payload={"task_id": task.id, "level": task.permission_level}, source=TrinityRole.GOVERNOR)],
            blocked=True,
            reason=f"Requires human dual-sign approval ({task.permission_level})",
            permission_required=task.permission_level,
        )

    return PipelineResult(
        task=advance_task_phase(updated),
        events=[V6Event(type="trinity:output", payload=charter_output, source=TrinityRole.GOVERNOR)],
    )


# ---------------------------------------------------------------------------
# Agent Status Management
# ---------------------------------------------------------------------------

def update_agent_status(agent: TrinityAgent, status: str, current_task: str | None = None) -> TrinityAgent:
    return replace(agent, status=status, current_task=current_task, stats=replace(agent.stats, last_active_at=_now()))


def record_agent_completion(agent: TrinityAgent, response_time_ms: float) -> TrinityAgent:
    n = agent.stats.tasks_completed
    new_avg = (agent.stats.avg_response_time * n + response_time_ms) / (n + 1)
    return replace(
        agent,
        status="idle",
        current_task=None,
        stats=replace(agent.stats, tasks_completed=n + 1, avg_response_time=round(new_avg), last_active_at=_now()),
    )
