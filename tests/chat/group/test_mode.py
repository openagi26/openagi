"""Tests for chat/group/mode.py — 讨论↔工作模式"""

import pytest
from openagi.chat.group.mode import (
    DiscussionStyle,
    GroupMode,
    RoomModeState,
    TaskStatus,
    WorkTask,
    add_work_task,
    advance_round_robin,
    create_room_mode_state,
    get_current_speaker_id,
    get_pending_tasks,
    get_work_progress,
    is_discussion_speaker_turn,
    is_work_complete,
    set_discussion_topic,
    switch_to_discussion,
    switch_to_work,
    update_task_status,
    get_tasks_for_member,
)


# ---------------------------------------------------------------------------
# 创建模式状态
# ---------------------------------------------------------------------------

def test_create_room_mode_state_defaults():
    state = create_room_mode_state("room-1")
    assert state.mode == GroupMode.DISCUSSION
    assert state.room_id == "room-1"


def test_create_room_mode_state_work_mode():
    state = create_room_mode_state("room-2", GroupMode.WORK)
    assert state.mode == GroupMode.WORK


# ---------------------------------------------------------------------------
# 讨论模式切换
# ---------------------------------------------------------------------------

def test_switch_to_discussion():
    state = create_room_mode_state("r1", GroupMode.WORK)
    state = switch_to_discussion(state, topic="产品规划")
    assert state.mode == GroupMode.DISCUSSION
    assert state.discussion.topic == "产品规划"


def test_switch_to_discussion_records_history():
    state = create_room_mode_state("r1", GroupMode.WORK)
    state = switch_to_discussion(state, topic="讨论主题")
    assert len(state.switch_history) == 1
    assert state.switch_history[0]["from"] == "work"
    assert state.switch_history[0]["to"] == "discussion"


def test_switch_to_discussion_round_robin_style():
    state = create_room_mode_state("r1")
    state = switch_to_discussion(state, style=DiscussionStyle.ROUND_ROBIN)
    assert state.discussion.style == DiscussionStyle.ROUND_ROBIN


# ---------------------------------------------------------------------------
# 工作模式切换
# ---------------------------------------------------------------------------

def test_switch_to_work():
    state = create_room_mode_state("r1")
    state = switch_to_work(state, objective="开发新功能")
    assert state.mode == GroupMode.WORK
    assert state.work.objective == "开发新功能"


def test_switch_to_work_records_history():
    state = create_room_mode_state("r1")
    state = switch_to_work(state, objective="任务目标")
    assert len(state.switch_history) == 1
    assert "任务目标" in state.switch_history[0]["reason"]


def test_switch_to_work_with_initial_tasks():
    task = WorkTask(title="子任务", description="描述", assigned_member_id="m1", assigned_member_name="AI-1")
    state = create_room_mode_state("r1")
    state = switch_to_work(state, objective="目标", tasks=[task])
    assert len(state.work.tasks) == 1


# ---------------------------------------------------------------------------
# 讨论模式操作
# ---------------------------------------------------------------------------

def test_set_discussion_topic():
    state = create_room_mode_state("r1")
    state = set_discussion_topic(state, "新话题")
    assert state.discussion.topic == "新话题"


def test_set_discussion_topic_in_work_mode_raises():
    state = create_room_mode_state("r1", GroupMode.WORK)
    with pytest.raises(ValueError, match="讨论模式"):
        set_discussion_topic(state, "话题")


def test_advance_round_robin():
    state = create_room_mode_state("r1")
    state = switch_to_discussion(state, style=DiscussionStyle.ROUND_ROBIN)
    state.discussion.round_robin_order = ["m1", "m2", "m3"]
    state = advance_round_robin(state)
    assert state.discussion.current_speaker_index == 1


def test_advance_round_robin_wraps_around():
    state = create_room_mode_state("r1")
    state = switch_to_discussion(state, style=DiscussionStyle.ROUND_ROBIN)
    state.discussion.round_robin_order = ["m1", "m2"]
    state.discussion.current_speaker_index = 1
    state = advance_round_robin(state)
    assert state.discussion.current_speaker_index == 0
    assert state.discussion.completed_rounds == 1


def test_advance_round_robin_in_work_mode_raises():
    state = create_room_mode_state("r1", GroupMode.WORK)
    with pytest.raises(ValueError):
        advance_round_robin(state)


def test_get_current_speaker_id():
    state = create_room_mode_state("r1")
    state = switch_to_discussion(state, style=DiscussionStyle.ROUND_ROBIN)
    state.discussion.round_robin_order = ["m1", "m2"]
    state.discussion.current_speaker_index = 0
    assert get_current_speaker_id(state) == "m1"


def test_is_discussion_speaker_turn_free_mode():
    state = create_room_mode_state("r1")
    # 自由模式：所有人都可发言
    assert is_discussion_speaker_turn(state, "any-member") is True


def test_is_discussion_speaker_turn_round_robin():
    state = create_room_mode_state("r1")
    state = switch_to_discussion(state, style=DiscussionStyle.ROUND_ROBIN)
    state.discussion.round_robin_order = ["m1", "m2"]
    state.discussion.current_speaker_index = 0
    assert is_discussion_speaker_turn(state, "m1") is True
    assert is_discussion_speaker_turn(state, "m2") is False


def test_is_discussion_speaker_turn_work_mode_returns_false():
    state = create_room_mode_state("r1", GroupMode.WORK)
    assert is_discussion_speaker_turn(state, "m1") is False


# ---------------------------------------------------------------------------
# 工作模式操作
# ---------------------------------------------------------------------------

def test_add_work_task():
    state = create_room_mode_state("r1", GroupMode.WORK)
    state = switch_to_work(state, objective="目标")
    state = add_work_task(state, "子任务1", "描述1", "m1", "AI-1", priority=0)
    assert len(state.work.tasks) == 1
    assert state.work.tasks[0].title == "子任务1"


def test_add_work_task_in_discussion_mode_raises():
    state = create_room_mode_state("r1")
    with pytest.raises(ValueError, match="工作模式"):
        add_work_task(state, "任务", "描述", "m1", "AI-1")


def test_update_task_status_to_done():
    state = create_room_mode_state("r1")
    state = switch_to_work(state, objective="目标")
    state = add_work_task(state, "任务A", "描述A", "m1", "AI-1")
    task_id = state.work.tasks[0].id
    state = update_task_status(state, task_id, TaskStatus.DONE, result="完成了")
    updated_task = state.work.tasks[0]
    assert updated_task.status == TaskStatus.DONE
    assert updated_task.result == "完成了"
    assert updated_task.completed_at is not None


def test_update_task_status_to_failed():
    state = create_room_mode_state("r1")
    state = switch_to_work(state, objective="目标")
    state = add_work_task(state, "失败任务", "描述", "m1", "AI-1")
    task_id = state.work.tasks[0].id
    state = update_task_status(state, task_id, TaskStatus.FAILED, error="网络超时")
    assert state.work.tasks[0].error == "网络超时"


def test_get_tasks_for_member():
    state = create_room_mode_state("r1")
    state = switch_to_work(state, objective="目标")
    state = add_work_task(state, "任务1", "描述1", "m1", "AI-1")
    state = add_work_task(state, "任务2", "描述2", "m2", "AI-2")
    state = add_work_task(state, "任务3", "描述3", "m1", "AI-1")
    m1_tasks = get_tasks_for_member(state, "m1")
    assert len(m1_tasks) == 2


def test_get_pending_tasks():
    state = create_room_mode_state("r1")
    state = switch_to_work(state, objective="目标")
    state = add_work_task(state, "任务A", "", "m1", "A", priority=1)
    state = add_work_task(state, "任务B", "", "m2", "B", priority=0)
    state = add_work_task(state, "任务C", "", "m3", "C", priority=2)
    task_id_b = state.work.tasks[1].id
    state = update_task_status(state, task_id_b, TaskStatus.DONE)
    pending = get_pending_tasks(state)
    # 只有A和C未完成，按优先级排序
    assert len(pending) == 2
    assert pending[0].title == "任务A"  # priority=1 < priority=2


# ---------------------------------------------------------------------------
# 进度面板
# ---------------------------------------------------------------------------

def test_get_work_progress():
    state = create_room_mode_state("r1")
    state = switch_to_work(state, objective="开发功能")
    state = add_work_task(state, "任务1", "", "m1", "AI-1")
    state = add_work_task(state, "任务2", "", "m2", "AI-2")
    t1_id = state.work.tasks[0].id
    state = update_task_status(state, t1_id, TaskStatus.DONE)
    progress = get_work_progress(state)
    assert progress["total_tasks"] == 2
    assert progress["done"] == 1
    assert progress["pending"] == 1
    assert progress["progress_pct"] == 50


def test_get_work_progress_in_discussion_mode():
    state = create_room_mode_state("r1")
    progress = get_work_progress(state)
    assert progress["mode"] == "discussion"


def test_is_work_complete_false():
    state = create_room_mode_state("r1")
    state = switch_to_work(state, objective="目标")
    state = add_work_task(state, "任务", "", "m1", "AI-1")
    assert is_work_complete(state) is False


def test_is_work_complete_true():
    state = create_room_mode_state("r1")
    state = switch_to_work(state, objective="目标")
    state = add_work_task(state, "任务", "", "m1", "AI-1")
    task_id = state.work.tasks[0].id
    state = update_task_status(state, task_id, TaskStatus.DONE)
    assert is_work_complete(state) is True


def test_is_work_complete_with_failed_tasks():
    state = create_room_mode_state("r1")
    state = switch_to_work(state, objective="目标")
    state = add_work_task(state, "任务", "", "m1", "AI-1")
    task_id = state.work.tasks[0].id
    state = update_task_status(state, task_id, TaskStatus.FAILED)
    # 全部任务已处理（即使是失败的）
    assert is_work_complete(state) is True


def test_is_work_complete_empty_tasks():
    state = create_room_mode_state("r1")
    state = switch_to_work(state, objective="目标")
    assert is_work_complete(state) is False
