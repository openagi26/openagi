"""Constitutional system — ported from NewClaw v6 constitution.ts.

Defines L0-L4 permission rules, goals, constraints, and value priorities.
"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any

from openagi.cortex.trinity.types import PermissionLevel, _now, _uuid


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

@dataclass
class Milestone:
    id: str = field(default_factory=_uuid)
    label: str = ""
    criteria: str = ""
    completed: bool = False
    completed_at: str | None = None


@dataclass
class ConstitutionalGoal:
    id: str = field(default_factory=_uuid)
    phase: str = ""
    description: str = ""
    milestones: list[Milestone] = field(default_factory=list)
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)


@dataclass
class Constraint:
    id: str = field(default_factory=_uuid)
    category: str = ""  # system | host | ethical | legal
    description: str = ""
    enforceable: bool = True
    severity: str = "hard"  # hard | soft


@dataclass
class ValuePriority:
    id: str = field(default_factory=_uuid)
    dimension: str = ""
    weight: int = 0
    description: str = ""


@dataclass
class AuthorityRule:
    id: str = field(default_factory=_uuid)
    action_pattern: str = ""
    permission_level: PermissionLevel = PermissionLevel.L0
    required_approvals: list[str] = field(default_factory=list)
    description: str = ""


@dataclass
class DoneDefinition:
    id: str = field(default_factory=_uuid)
    task_pattern: str = ""
    criteria: list[str] = field(default_factory=list)
    verification_method: str = "automated"


@dataclass
class Constitution:
    version: str = "6.0.0"
    last_modified: str = field(default_factory=_now)
    goals: list[ConstitutionalGoal] = field(default_factory=list)
    constraints: list[Constraint] = field(default_factory=list)
    values: list[ValuePriority] = field(default_factory=list)
    authority: list[AuthorityRule] = field(default_factory=list)
    done: list[DoneDefinition] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def create_default_constitution() -> Constitution:
    return Constitution(
        goals=[
            ConstitutionalGoal(
                phase="MVP",
                description="Build a minimal three-AI node that can run governance flows with simulated credits",
                milestones=[
                    Milestone(label="Trinity node operational", criteria="AI-1, AI-2, AI-3 can process tasks through proposal->audit->approval pipeline"),
                    Milestone(label="Ledger system active", criteria="EVIDENCE, VALUE, LEDGER_LOCAL recording entries correctly"),
                    Milestone(label="Outcome Oracle functional", criteria="Can generate and validate OUTCOME_REPORT from completed tasks"),
                    Milestone(label="Permission fuse enforced", criteria="L0-L4 permission levels correctly gate actions"),
                ],
            ),
        ],
        constraints=[
            Constraint(category="system", description="No direct access to real wallets in Stage 0-1", severity="hard"),
            Constraint(category="system", description="All outcomes must pass Oracle validation before credit entry", severity="hard"),
            Constraint(category="host", description="Human retains veto power over all L3+ actions", severity="hard"),
            Constraint(category="ethical", description="No circumvention of permission fuse matrix", severity="hard"),
            Constraint(category="legal", description="Comply with local data protection regulations", severity="hard"),
            Constraint(category="system", description="Low-grade evidence (H4) cannot enter main state directly", severity="soft"),
        ],
        values=[
            ValuePriority(dimension="quality", weight=30, description="Code and output quality over speed"),
            ValuePriority(dimension="risk", weight=25, description="Minimize risk exposure at each stage"),
            ValuePriority(dimension="reuse", weight=20, description="Favor reusable playbooks and knowledge"),
            ValuePriority(dimension="revenue", weight=15, description="Simulated credit accumulation potential"),
            ValuePriority(dimension="compliance", weight=10, description="Adherence to constitutional constraints"),
        ],
        authority=[
            AuthorityRule(action_pattern="write-log|update-playbook|generate-draft", permission_level=PermissionLevel.L0, required_approvals=[], description="Pure internal actions auto-execute"),
            AuthorityRule(action_pattern="read-query|sandbox-test|simulate-order", permission_level=PermissionLevel.L1, required_approvals=["ai2"], description="Restricted external read actions need AI-2 audit"),
            AuthorityRule(action_pattern="testnet-transfer|small-purchase|low-risk-api", permission_level=PermissionLevel.L2, required_approvals=["ai2", "ai3"], description="Low-value real actions need AI-2 + AI-3"),
            AuthorityRule(action_pattern="real-wallet|external-contract|real-listing", permission_level=PermissionLevel.L3, required_approvals=["ai2", "ai3", "human"], description="High-risk real actions need AI-2 + AI-3 + human dual-sign"),
            AuthorityRule(action_pattern="bypass-constraint|expand-permission|delete-ledger", permission_level=PermissionLevel.L4, required_approvals=[], description="Permanently forbidden actions - never approved"),
        ],
        done=[
            DoneDefinition(task_pattern="playbook-generation", criteria=["Playbook is syntactically valid", "Passes AI-2 audit", "Has evidence references"], verification_method="automated"),
            DoneDefinition(task_pattern="market-listing", criteria=["Price validated", "Risk assessment completed", "Budget approved by AI-3"], verification_method="peer-review"),
            DoneDefinition(task_pattern="outcome-settlement", criteria=["Oracle verdict is settleable", "Reconciliation hash valid", "Evidence grade >= H2"], verification_method="automated"),
        ],
    )


# ---------------------------------------------------------------------------
# Constitution operations
# ---------------------------------------------------------------------------

def get_permission_level_for_action(constitution: Constitution, action: str) -> PermissionLevel:
    words = action.lower().split()
    for rule in constitution.authority:
        patterns = rule.action_pattern.split("|")
        if any(w == p or w.startswith(f"{p}-") for p in patterns for w in words):
            return rule.permission_level
    return PermissionLevel.L0


def get_required_approvals(constitution: Constitution, level: PermissionLevel) -> list[str]:
    rule = next((r for r in constitution.authority if r.permission_level == level), None)
    return rule.required_approvals if rule else ["human"]


def validate_constitution(constitution: Constitution) -> list[str]:
    errors: list[str] = []
    if not constitution.goals:
        errors.append("At least one goal is required")
    if not constitution.constraints:
        errors.append("At least one constraint is required")

    total_weight = sum(v.weight for v in constitution.values)
    if total_weight != 100:
        errors.append(f"Value weights must sum to 100, got {total_weight}")

    levels = {r.permission_level for r in constitution.authority}
    for lvl in PermissionLevel:
        if lvl not in levels:
            errors.append(f"Missing authority rule for permission level {lvl}")

    l4 = next((r for r in constitution.authority if r.permission_level == PermissionLevel.L4), None)
    if l4 and l4.required_approvals:
        errors.append("L4 actions must have empty approvals (permanently forbidden)")

    return errors
