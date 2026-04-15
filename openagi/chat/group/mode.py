"""
讨论↔工作模式 (Group Mode) — 群聊的两种运作模式
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
功能：
  · 讨论模式：头脑风暴，所有活跃成员可自由发言
  · 工作模式：任务分配，并行执行，进度面板
  · 模式切换（带状态迁移）
  · 纯函数，无I/O副作用
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4


# ---------------------------------------------------------------------------
# 工具函数
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _uuid() -> str:
    return str(uuid4())


# ---------------------------------------------------------------------------
# 类型定义
# ---------------------------------------------------------------------------

class GroupMode(str, Enum):
    DISCUSSION = "discussion"   # 讨论模式：头脑风暴，自由发言
    WORK = "work"               # 工作模式：任务分配，并行执行


class TaskStatus(str, Enum):
    PENDING = "pending"         # 待执行
    RUNNING = "running"         # 执行中
    DONE = "done"               # 已完成
    FAILED = "failed"           # 执行失败
    SKIPPED = "skipped"         # 已跳过


class DiscussionStyle(str, Enum):
    FREE = "free"               # 自由发言（无顺序约束）
    ROUND_ROBIN = "round_robin" # 轮流发言（按顺序）
    MODERATED = "moderated"     # 主持人引导


# ---------------------------------------------------------------------------
# 讨论模式配置
# ---------------------------------------------------------------------------

@dataclass
class DiscussionConfig:
    """讨论模式配置。"""
    style: DiscussionStyle = DiscussionStyle.FREE
    topic: str = ""                  # 讨论主题
    # 自由模式：任何成员都可以回复
    # 轮流模式：按成员顺序依次发言
    round_robin_order: list[str] = field(default_factory=list)  # 成员ID排列顺序
    current_speaker_index: int = 0   # 当前发言者索引（轮流模式）
    max_rounds: int = 0              # 0=不限制轮次
    completed_rounds: int = 0        # 已完成轮次
    # 是否允许AI主动发言（无需被@）
    allow_unprompted: bool = True
    # 是否显示发言者标签
    show_speaker_label: bool = True


# ---------------------------------------------------------------------------
# 工作模式配置
# ---------------------------------------------------------------------------

@dataclass
class WorkTask:
    """工作模式中的子任务。"""
    id: str = field(default_factory=_uuid)
    title: str = ""
    description: str = ""
    assigned_member_id: str = ""     # 分配给哪个成员
    assigned_member_name: str = ""   # 成员显示名称
    status: TaskStatus = TaskStatus.PENDING
    result: str = ""                 # 执行结果
    error: str = ""                  # 错误信息（如有）
    created_at: datetime = field(default_factory=_now)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    priority: int = 0                # 优先级（数字越小越高）


@dataclass
class WorkConfig:
    """工作模式配置。"""
    objective: str = ""              # 整体目标
    tasks: list[WorkTask] = field(default_factory=list)
    parallel: bool = True            # 是否并行执行
    # 进度统计（派生字段，不直接赋值）
    auto_summarize: bool = True      # 完成后自动总结


# ---------------------------------------------------------------------------
# 房间模式状态
# ---------------------------------------------------------------------------

@dataclass
class RoomModeState:
    """
    群聊房间的模式状态。
    与 Room 分离，避免循环依赖。
    """
    room_id: str = ""
    mode: GroupMode = GroupMode.DISCUSSION
    discussion: DiscussionConfig = field(default_factory=DiscussionConfig)
    work: WorkConfig = field(default_factory=WorkConfig)
    switched_at: datetime = field(default_factory=_now)
    switch_history: list[dict] = field(default_factory=list)


# ---------------------------------------------------------------------------
# 模式工厂
# ---------------------------------------------------------------------------

def create_room_mode_state(room_id: str, initial_mode: GroupMode = GroupMode.DISCUSSION) -> RoomModeState:
    """创建房间模式状态。"""
    return RoomModeState(room_id=room_id, mode=initial_mode)


def switch_to_discussion(
    state: RoomModeState,
    topic: str = "",
    style: DiscussionStyle = DiscussionStyle.FREE,
    allow_unprompted: bool = True,
) -> RoomModeState:
    """切换到讨论模式。"""
    now = _now()
    history_entry = {
        "from": state.mode.value,
        "to": GroupMode.DISCUSSION.value,
        "at": now.isoformat(),
        "reason": f"切换话题：{topic}" if topic else "进入讨论模式",
    }
    new_discussion = DiscussionConfig(
        style=style,
        topic=topic,
        allow_unprompted=allow_unprompted,
    )
    return RoomModeState(
        room_id=state.room_id,
        mode=GroupMode.DISCUSSION,
        discussion=new_discussion,
        work=state.work,  # 保留工作配置历史
        switched_at=now,
        switch_history=[*state.switch_history, history_entry],
    )


def switch_to_work(
    state: RoomModeState,
    objective: str,
    tasks: list[WorkTask] | None = None,
    parallel: bool = True,
) -> RoomModeState:
    """切换到工作模式。"""
    now = _now()
    history_entry = {
        "from": state.mode.value,
        "to": GroupMode.WORK.value,
        "at": now.isoformat(),
        "reason": f"启动任务：{objective}",
    }
    new_work = WorkConfig(
        objective=objective,
        tasks=tasks or [],
        parallel=parallel,
    )
    return RoomModeState(
        room_id=state.room_id,
        mode=GroupMode.WORK,
        discussion=state.discussion,
        work=new_work,
        switched_at=now,
        switch_history=[*state.switch_history, history_entry],
    )


# ---------------------------------------------------------------------------
# 讨论模式操作
# ---------------------------------------------------------------------------

def set_discussion_topic(state: RoomModeState, topic: str) -> RoomModeState:
    """更新讨论话题。"""
    if state.mode != GroupMode.DISCUSSION:
        raise ValueError("当前不在讨论模式，无法设置话题")
    new_discussion = DiscussionConfig(
        **{**state.discussion.__dict__, "topic": topic}
    )
    return RoomModeState(**{**state.__dict__, "discussion": new_discussion})


def advance_round_robin(state: RoomModeState) -> RoomModeState:
    """轮流模式：推进到下一个发言者。"""
    if state.mode != GroupMode.DISCUSSION:
        raise ValueError("当前不在讨论模式")
    disc = state.discussion
    if disc.style != DiscussionStyle.ROUND_ROBIN:
        raise ValueError("当前不在轮流发言模式")
    if not disc.round_robin_order:
        raise ValueError("轮流顺序列表为空")

    next_index = (disc.current_speaker_index + 1) % len(disc.round_robin_order)
    completed_rounds = disc.completed_rounds
    if next_index == 0:
        completed_rounds += 1

    new_discussion = DiscussionConfig(
        **{**disc.__dict__, "current_speaker_index": next_index, "completed_rounds": completed_rounds}
    )
    return RoomModeState(**{**state.__dict__, "discussion": new_discussion})


def get_current_speaker_id(state: RoomModeState) -> str | None:
    """轮流模式：获取当前发言者ID。"""
    disc = state.discussion
    if state.mode != GroupMode.DISCUSSION or disc.style != DiscussionStyle.ROUND_ROBIN:
        return None
    if not disc.round_robin_order:
        return None
    return disc.round_robin_order[disc.current_speaker_index]


def is_discussion_speaker_turn(state: RoomModeState, member_id: str) -> bool:
    """判断某成员在轮流模式下是否轮到发言。"""
    if state.mode != GroupMode.DISCUSSION:
        return False
    disc = state.discussion
    if disc.style == DiscussionStyle.FREE:
        return True  # 自由模式所有人都可发言
    if disc.style == DiscussionStyle.ROUND_ROBIN:
        current = get_current_speaker_id(state)
        return current == member_id
    return False  # MODERATED 模式由外部控制


# ---------------------------------------------------------------------------
# 工作模式操作
# ---------------------------------------------------------------------------

def add_work_task(
    state: RoomModeState,
    title: str,
    description: str,
    assigned_member_id: str,
    assigned_member_name: str,
    priority: int = 0,
) -> RoomModeState:
    """向工作模式添加子任务。"""
    if state.mode != GroupMode.WORK:
        raise ValueError("当前不在工作模式，无法添加任务")
    task = WorkTask(
        title=title,
        description=description,
        assigned_member_id=assigned_member_id,
        assigned_member_name=assigned_member_name,
        priority=priority,
    )
    new_work = WorkConfig(
        **{**state.work.__dict__, "tasks": [*state.work.tasks, task]}
    )
    return RoomModeState(**{**state.__dict__, "work": new_work})


def update_task_status(
    state: RoomModeState,
    task_id: str,
    status: TaskStatus,
    result: str = "",
    error: str = "",
) -> RoomModeState:
    """更新子任务状态。"""
    now = _now()
    new_tasks = []
    for task in state.work.tasks:
        if task.id == task_id:
            new_task = WorkTask(
                id=task.id,
                title=task.title,
                description=task.description,
                assigned_member_id=task.assigned_member_id,
                assigned_member_name=task.assigned_member_name,
                status=status,
                result=result if result else task.result,
                error=error if error else task.error,
                created_at=task.created_at,
                started_at=task.started_at if task.started_at else (now if status == TaskStatus.RUNNING else None),
                completed_at=now if status in (TaskStatus.DONE, TaskStatus.FAILED, TaskStatus.SKIPPED) else task.completed_at,
                priority=task.priority,
            )
            new_tasks.append(new_task)
        else:
            new_tasks.append(task)
    new_work = WorkConfig(**{**state.work.__dict__, "tasks": new_tasks})
    return RoomModeState(**{**state.__dict__, "work": new_work})


def get_tasks_for_member(state: RoomModeState, member_id: str) -> list[WorkTask]:
    """获取分配给某成员的所有任务。"""
    return [t for t in state.work.tasks if t.assigned_member_id == member_id]


# ---------------------------------------------------------------------------
# 进度面板
# ---------------------------------------------------------------------------

def get_work_progress(state: RoomModeState) -> dict:
    """
    获取工作模式进度面板数据。
    """
    if state.mode != GroupMode.WORK:
        return {"mode": "discussion", "message": "当前为讨论模式"}

    tasks = state.work.tasks
    total = len(tasks)
    by_status = {s.value: 0 for s in TaskStatus}
    for task in tasks:
        by_status[task.status.value] += 1

    done = by_status[TaskStatus.DONE.value]
    failed = by_status[TaskStatus.FAILED.value]
    progress_pct = int(done / total * 100) if total > 0 else 0

    all_done = done + failed + by_status[TaskStatus.SKIPPED.value] == total

    return {
        "objective": state.work.objective,
        "total_tasks": total,
        "done": done,
        "failed": failed,
        "running": by_status[TaskStatus.RUNNING.value],
        "pending": by_status[TaskStatus.PENDING.value],
        "skipped": by_status[TaskStatus.SKIPPED.value],
        "progress_pct": progress_pct,
        "all_done": all_done,
        "parallel": state.work.parallel,
        "tasks": [
            {
                "id": t.id,
                "title": t.title,
                "assignee": t.assigned_member_name,
                "status": t.status.value,
                "result_preview": t.result[:80] + "…" if len(t.result) > 80 else t.result,
                "error": t.error,
            }
            for t in sorted(tasks, key=lambda t: (t.priority, t.created_at))
        ],
    }


def get_pending_tasks(state: RoomModeState) -> list[WorkTask]:
    """获取所有待执行的任务（按优先级排序）。"""
    pending = [t for t in state.work.tasks if t.status == TaskStatus.PENDING]
    return sorted(pending, key=lambda t: (t.priority, t.created_at))


def is_work_complete(state: RoomModeState) -> bool:
    """判断工作模式任务是否全部完成。"""
    if state.mode != GroupMode.WORK or not state.work.tasks:
        return False
    return all(
        t.status in (TaskStatus.DONE, TaskStatus.FAILED, TaskStatus.SKIPPED)
        for t in state.work.tasks
    )
