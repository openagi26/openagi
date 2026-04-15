"""Tests for Trinity Engine — pure function pipeline."""

from openagi.cortex.trinity.engine import (
    advance_task_phase,
    block_task,
    create_task,
    create_trinity_agents,
    record_agent_completion,
    run_approval_phase,
    run_audit_phase,
    run_proposal_phase,
)
from openagi.cortex.trinity.types import (
    PermissionLevel,
    RiskLevel,
    TaskStatus,
    TrinityPhase,
    TrinityRole,
)
from openagi.social.constitution.core import create_default_constitution


def test_create_task():
    task = create_task("Test Task", "Do something")
    assert task.title == "Test Task"
    assert task.phase == TrinityPhase.PROPOSAL
    assert task.status == TaskStatus.DRAFT
    assert task.created_by == TrinityRole.EXPANDER


def test_advance_task_through_phases():
    task = create_task("Test", "Desc")
    # proposal -> audit
    task = advance_task_phase(task)
    assert task.phase == TrinityPhase.AUDIT
    assert task.status == TaskStatus.PENDING_AUDIT
    # audit -> approval
    task = advance_task_phase(task)
    assert task.phase == TrinityPhase.APPROVAL
    assert task.status == TaskStatus.PENDING_APPROVAL
    # approval -> execution
    task = advance_task_phase(task)
    assert task.phase == TrinityPhase.EXECUTION
    assert task.status == TaskStatus.EXECUTING
    # execution -> review
    task = advance_task_phase(task)
    assert task.phase == TrinityPhase.REVIEW
    # review -> settled
    task = advance_task_phase(task)
    assert task.phase == TrinityPhase.SETTLED
    assert task.completed_at is not None
    # settled stays settled
    task2 = advance_task_phase(task)
    assert task2.phase == TrinityPhase.SETTLED


def test_block_task():
    task = create_task("Test", "Desc")
    blocked = block_task(task, "Too risky")
    assert blocked.status == TaskStatus.BLOCKED
    assert any("BLOCKED" in o.content for o in blocked.outputs)


def test_run_proposal_phase():
    task = create_task("Test", "Desc")
    result = run_proposal_phase(task, "Here is my proposal")
    assert not result.blocked
    assert result.task.phase == TrinityPhase.AUDIT
    assert len(result.events) == 1


def test_run_audit_phase_low_risk():
    task = create_task("generate-draft report", "Create a report")
    result = run_proposal_phase(task, "Proposal content")
    constitution = create_default_constitution()
    audit_result = run_audit_phase(result.task, constitution, "All looks good", RiskLevel.LOW)
    assert not audit_result.blocked
    assert audit_result.task.phase == TrinityPhase.APPROVAL


def test_run_audit_phase_critical_risk():
    task = create_task("Test", "Desc")
    result = run_proposal_phase(task, "Proposal")
    constitution = create_default_constitution()
    audit_result = run_audit_phase(result.task, constitution, "Critical vulnerability found", RiskLevel.CRITICAL)
    assert audit_result.blocked
    assert audit_result.task.status == TaskStatus.BLOCKED


def test_run_audit_phase_l4_forbidden():
    task = create_task("delete-ledger entries", "Wipe all records")
    result = run_proposal_phase(task, "Delete everything")
    constitution = create_default_constitution()
    audit_result = run_audit_phase(result.task, constitution, "Checking...", RiskLevel.LOW)
    assert audit_result.blocked
    assert "L4" in (audit_result.reason or "")


def test_run_approval_phase_approved():
    task = create_task("generate-draft", "Write code")
    p = run_proposal_phase(task, "Proposal")
    constitution = create_default_constitution()
    a = run_audit_phase(p.task, constitution, "OK", RiskLevel.LOW)
    approval = run_approval_phase(a.task, constitution, approved=True)
    assert not approval.blocked
    assert approval.task.phase == TrinityPhase.EXECUTION


def test_run_approval_phase_denied():
    task = create_task("Test", "Desc")
    p = run_proposal_phase(task, "Proposal")
    constitution = create_default_constitution()
    a = run_audit_phase(p.task, constitution, "OK", RiskLevel.LOW)
    approval = run_approval_phase(a.task, constitution, approved=False)
    assert approval.blocked
    assert approval.task.status == TaskStatus.BLOCKED


def test_run_approval_phase_needs_human():
    task = create_task("real-wallet transfer", "Send money")
    p = run_proposal_phase(task, "Transfer 100 SOL")
    constitution = create_default_constitution()
    a = run_audit_phase(p.task, constitution, "High risk but proceed", RiskLevel.HIGH)
    approval = run_approval_phase(a.task, constitution, approved=True)
    assert approval.blocked
    assert "human" in (approval.reason or "").lower()


def test_create_trinity_agents():
    agents = create_trinity_agents()
    assert "ai1" in agents
    assert "ai2" in agents
    assert "ai3" in agents
    assert agents["ai1"].role == TrinityRole.EXPANDER


def test_record_agent_completion():
    agents = create_trinity_agents()
    agent = record_agent_completion(agents["ai1"], 500.0)
    assert agent.stats.tasks_completed == 1
    assert agent.stats.avg_response_time == 500
    agent = record_agent_completion(agent, 300.0)
    assert agent.stats.tasks_completed == 2
    assert agent.stats.avg_response_time == 400


def test_full_pipeline_happy_path():
    """End-to-end: proposal -> audit -> approval -> execution."""
    constitution = create_default_constitution()
    task = create_task("generate-draft user guide", "Write a user guide for the dashboard")

    # Phase 1: Proposal
    p1 = run_proposal_phase(task, "## User Guide\n\n1. Login\n2. Dashboard\n3. Settings")
    assert not p1.blocked

    # Phase 2: Audit
    p2 = run_audit_phase(p1.task, constitution, "No risks found. Approved.", RiskLevel.LOW)
    assert not p2.blocked

    # Phase 3: Approval
    p3 = run_approval_phase(p2.task, constitution, approved=True, budget_allocation=0)
    assert not p3.blocked
    assert p3.task.phase == TrinityPhase.EXECUTION
    assert p3.task.status == TaskStatus.EXECUTING
