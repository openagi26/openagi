"""Tests for chat/skills/learning.py — 闭合学习循环"""

import pytest
from openagi.chat.skills.learning import (
    FeedbackType,
    LearningState,
    PatternStatus,
    create_learning_state,
    detect_candidates,
    extract_skill_from_pattern,
    get_learning_summary,
    get_skill_feedback_summary,
    promote_to_candidate,
    record_feedback,
    record_operation,
    reject_pattern,
    _fingerprint,
)


# ---------------------------------------------------------------------------
# 指纹生成
# ---------------------------------------------------------------------------

def test_fingerprint_same_content_same_hash():
    fp1 = _fingerprint("帮我搜索Python教程")
    fp2 = _fingerprint("帮我搜索Python教程")
    assert fp1 == fp2


def test_fingerprint_different_content_different_hash():
    fp1 = _fingerprint("帮我搜索Python教程")
    fp2 = _fingerprint("帮我搜索Java教程")
    assert fp1 != fp2


def test_fingerprint_case_insensitive():
    fp1 = _fingerprint("HELLO WORLD")
    fp2 = _fingerprint("hello world")
    assert fp1 == fp2


# ---------------------------------------------------------------------------
# 操作记录
# ---------------------------------------------------------------------------

def test_record_operation_creates_pattern():
    state = create_learning_state()
    state, record = record_operation(state, "s1", "帮我写代码", "生成了Python代码")
    assert len(state.patterns) == 1
    assert record.session_id == "s1"


def test_record_operation_increments_count():
    state = create_learning_state()
    state, _ = record_operation(state, "s1", "相同操作", "相同动作")
    state, _ = record_operation(state, "s1", "相同操作", "相同动作")
    state, _ = record_operation(state, "s1", "相同操作", "相同动作")
    assert len(state.patterns) == 1
    pattern = list(state.patterns.values())[0]
    assert pattern.count == 3


def test_record_different_operations_creates_separate_patterns():
    state = create_learning_state()
    state, _ = record_operation(state, "s1", "操作A", "动作A")
    state, _ = record_operation(state, "s1", "操作B", "动作B")
    assert len(state.patterns) == 2


def test_record_operation_appends_to_log():
    state = create_learning_state()
    for i in range(5):
        state, _ = record_operation(state, "s1", f"操作{i}", f"动作{i}")
    assert len(state.operation_log) == 5


def test_record_operation_respects_max_log_size():
    state = create_learning_state()
    state.max_log_size = 3
    for i in range(10):
        state, _ = record_operation(state, "s1", f"操作{i}", f"动作{i}")
    assert len(state.operation_log) == 3


# ---------------------------------------------------------------------------
# 模式检测
# ---------------------------------------------------------------------------

def test_detect_candidates_none_below_threshold():
    state = create_learning_state(repeat_threshold=3)
    state, _ = record_operation(state, "s1", "操作A", "动作A")
    state, _ = record_operation(state, "s1", "操作A", "动作A")
    candidates = detect_candidates(state)
    assert len(candidates) == 0


def test_detect_candidates_reaches_threshold():
    state = create_learning_state(repeat_threshold=3)
    for _ in range(3):
        state, _ = record_operation(state, "s1", "重复操作", "重复动作")
    candidates = detect_candidates(state)
    assert len(candidates) == 1
    assert candidates[0].count == 3


def test_detect_candidates_sorted_by_count():
    state = create_learning_state(repeat_threshold=3)
    for _ in range(5):
        state, _ = record_operation(state, "s1", "高频操作", "高频动作")
    for _ in range(3):
        state, _ = record_operation(state, "s1", "低频操作", "低频动作")
    candidates = detect_candidates(state)
    assert len(candidates) == 2
    assert candidates[0].count >= candidates[1].count


# ---------------------------------------------------------------------------
# 候选提升
# ---------------------------------------------------------------------------

def test_promote_to_candidate():
    state = create_learning_state(repeat_threshold=3)
    for _ in range(3):
        state, _ = record_operation(state, "s1", "提升测试", "动作")
    fp = list(state.patterns.keys())[0]
    state = promote_to_candidate(state, fp)
    assert state.patterns[fp].status == PatternStatus.CANDIDATE
    assert state.patterns[fp].draft_skill_name != ""


def test_promote_nonexistent_pattern_raises():
    state = create_learning_state()
    with pytest.raises(KeyError):
        promote_to_candidate(state, "nonexistent-fp")


def test_promote_already_candidate_is_noop():
    state = create_learning_state(repeat_threshold=3)
    for _ in range(3):
        state, _ = record_operation(state, "s1", "测试", "动作")
    fp = list(state.patterns.keys())[0]
    state = promote_to_candidate(state, fp)
    state2 = promote_to_candidate(state, fp)
    # 应该没有变化
    assert state.patterns[fp].draft_skill_name == state2.patterns[fp].draft_skill_name


# ---------------------------------------------------------------------------
# 技能提取
# ---------------------------------------------------------------------------

def test_extract_skill_from_observing_pattern():
    state = create_learning_state(repeat_threshold=3)
    for _ in range(3):
        state, _ = record_operation(state, "s1", "提取测试", "执行动作")
    fp = list(state.patterns.keys())[0]
    state, skill = extract_skill_from_pattern(state, fp)
    assert skill is not None
    assert skill.source == "learned"
    assert state.patterns[fp].status == PatternStatus.EXTRACTED


def test_extract_skill_from_candidate():
    state = create_learning_state(repeat_threshold=3)
    for _ in range(3):
        state, _ = record_operation(state, "s1", "候选提取", "动作")
    fp = list(state.patterns.keys())[0]
    state = promote_to_candidate(state, fp)
    state, skill = extract_skill_from_pattern(state, fp)
    assert state.patterns[fp].extracted_skill_name == skill.name


def test_extract_skill_with_overrides():
    state = create_learning_state(repeat_threshold=3)
    for _ in range(3):
        state, _ = record_operation(state, "s1", "覆盖测试", "动作")
    fp = list(state.patterns.keys())[0]
    state, skill = extract_skill_from_pattern(
        state, fp,
        override_name="custom_skill",
        override_display="自定义技能",
        override_description="这是自定义描述",
    )
    assert skill.name == "custom_skill"
    assert skill.display_name == "自定义技能"
    assert skill.description == "这是自定义描述"


def test_extract_skill_from_rejected_raises():
    state = create_learning_state(repeat_threshold=3)
    for _ in range(3):
        state, _ = record_operation(state, "s1", "拒绝提取测试", "动作")
    fp = list(state.patterns.keys())[0]
    state = reject_pattern(state, fp)
    with pytest.raises(ValueError):
        extract_skill_from_pattern(state, fp)


# ---------------------------------------------------------------------------
# 拒绝模式
# ---------------------------------------------------------------------------

def test_reject_pattern():
    state = create_learning_state(repeat_threshold=3)
    for _ in range(3):
        state, _ = record_operation(state, "s1", "拒绝测试", "动作")
    fp = list(state.patterns.keys())[0]
    state = reject_pattern(state, fp)
    assert state.patterns[fp].status == PatternStatus.REJECTED


def test_reject_nonexistent_is_noop():
    state = create_learning_state()
    result = reject_pattern(state, "ghost-fp")
    assert result is state


# ---------------------------------------------------------------------------
# 反馈系统
# ---------------------------------------------------------------------------

def test_record_positive_feedback():
    state = create_learning_state()
    state = record_feedback(
        state, "echo", FeedbackType.POSITIVE, rating=5, comment="非常好用"
    )
    assert len(state.feedback_log) == 1
    assert state.feedback_log[0].rating == 5


def test_record_negative_feedback_with_suggestion():
    state = create_learning_state()
    state = record_feedback(
        state, "word_count",
        FeedbackType.NEGATIVE,
        rating=2,
        suggested_improvement="应该支持更多语言"
    )
    assert len(state.feedback_log) == 1
    assert "word_count" in state.improvement_suggestions
    assert "更多语言" in state.improvement_suggestions["word_count"][0]


def test_record_feedback_rating_clamped():
    state = create_learning_state()
    state = record_feedback(state, "skill", FeedbackType.POSITIVE, rating=10)
    assert state.feedback_log[0].rating == 5  # 最大5
    state = record_feedback(state, "skill", FeedbackType.NEGATIVE, rating=-1)
    assert state.feedback_log[1].rating == 1  # 最小1


def test_get_skill_feedback_summary_no_feedback():
    state = create_learning_state()
    summary = get_skill_feedback_summary(state, "unknown_skill")
    assert summary["total"] == 0
    assert summary["avg_rating"] == 0.0


def test_get_skill_feedback_summary_with_feedback():
    state = create_learning_state()
    state = record_feedback(state, "my_skill", FeedbackType.POSITIVE, rating=5)
    state = record_feedback(state, "my_skill", FeedbackType.POSITIVE, rating=4)
    state = record_feedback(state, "my_skill", FeedbackType.NEGATIVE, rating=2)
    summary = get_skill_feedback_summary(state, "my_skill")
    assert summary["total"] == 3
    assert summary["avg_rating"] == pytest.approx((5 + 4 + 2) / 3, rel=1e-2)
    assert summary["positive_count"] == 2
    assert summary["negative_count"] == 1


def test_get_skill_feedback_summary_multiple_suggestions():
    state = create_learning_state()
    state = record_feedback(state, "skill_x", FeedbackType.SUGGESTION, suggested_improvement="建议1")
    state = record_feedback(state, "skill_x", FeedbackType.SUGGESTION, suggested_improvement="建议2")
    summary = get_skill_feedback_summary(state, "skill_x")
    assert len(summary["suggestions"]) == 2


# ---------------------------------------------------------------------------
# 学习摘要
# ---------------------------------------------------------------------------

def test_get_learning_summary_empty():
    state = create_learning_state()
    summary = get_learning_summary(state)
    assert summary["total_patterns"] == 0
    assert summary["total_operations"] == 0
    assert summary["extracted_count"] == 0


def test_get_learning_summary_with_data():
    state = create_learning_state(repeat_threshold=3)
    for _ in range(3):
        state, _ = record_operation(state, "s1", "摘要测试", "动作")
    fp = list(state.patterns.keys())[0]
    state, _ = extract_skill_from_pattern(state, fp)
    state = record_feedback(state, "some_skill", FeedbackType.POSITIVE, rating=4)
    summary = get_learning_summary(state)
    assert summary["total_patterns"] == 1
    assert summary["extracted_count"] == 1
    assert summary["total_operations"] == 3
    assert summary["total_feedbacks"] == 1
    assert summary["repeat_threshold"] == 3
