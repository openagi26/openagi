"""Trinity Engine type definitions — ported from NewClaw v6 @/types/v6."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any
from uuid import uuid4


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _uuid() -> str:
    return str(uuid4())


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class TrinityRole(StrEnum):
    EXPANDER = "ai1-expander"
    AUDITOR = "ai2-auditor"
    GOVERNOR = "ai3-governor"


class TrinityPhase(StrEnum):
    PROPOSAL = "proposal"
    AUDIT = "audit"
    APPROVAL = "approval"
    EXECUTION = "execution"
    REVIEW = "review"
    SETTLED = "settled"


class TaskStatus(StrEnum):
    DRAFT = "draft"
    PENDING_AUDIT = "pending-audit"
    PENDING_APPROVAL = "pending-approval"
    EXECUTING = "executing"
    COMPLETED = "completed"
    BLOCKED = "blocked"
    FAILED = "failed"


class PermissionLevel(StrEnum):
    L0 = "L0"
    L1 = "L1"
    L2 = "L2"
    L3 = "L3"
    L4 = "L4"


class TrinityOutputType(StrEnum):
    TASK_DRAFT = "task-draft"
    AUDIT_OPINION = "audit-opinion"
    RISK_REPORT = "risk-report"
    TASK_CHARTER = "task-charter"


class RiskLevel(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ---------------------------------------------------------------------------
# Data Classes
# ---------------------------------------------------------------------------

@dataclass
class TrinityOutput:
    id: str = field(default_factory=_uuid)
    role: TrinityRole = TrinityRole.EXPANDER
    type: TrinityOutputType = TrinityOutputType.TASK_DRAFT
    content: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=_now)
    task_id: str = ""


@dataclass
class AgentStats:
    tasks_completed: int = 0
    tasks_blocked: int = 0
    avg_response_time: float = 0.0
    last_active_at: str | None = None


@dataclass
class TrinityAgent:
    role: TrinityRole = TrinityRole.EXPANDER
    display_name: str = ""
    status: str = "idle"
    current_task: str | None = None
    stats: AgentStats = field(default_factory=AgentStats)


@dataclass
class TrinityTask:
    id: str = field(default_factory=_uuid)
    title: str = ""
    description: str = ""
    phase: TrinityPhase = TrinityPhase.PROPOSAL
    priority: int = 5
    created_by: TrinityRole = TrinityRole.EXPANDER
    assigned_to: list[TrinityRole] = field(default_factory=lambda: [TrinityRole.EXPANDER])
    status: TaskStatus = TaskStatus.DRAFT
    outputs: list[TrinityOutput] = field(default_factory=list)
    permission_level: PermissionLevel = PermissionLevel.L0
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)
    completed_at: str | None = None


@dataclass
class V6Event:
    id: str = field(default_factory=_uuid)
    type: str = ""
    payload: Any = None
    timestamp: str = field(default_factory=_now)
    source: str = ""


@dataclass
class PipelineResult:
    task: TrinityTask = field(default_factory=TrinityTask)
    events: list[V6Event] = field(default_factory=list)
    permission_required: PermissionLevel | None = None
    blocked: bool = False
    reason: str | None = None
