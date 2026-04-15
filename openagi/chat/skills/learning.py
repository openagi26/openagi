"""
闭合学习循环 (Learning Loop) — 从重复操作中自动提取技能
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
功能：
  · 重复操作检测（≥3次相同模式）
  · 自动从模式中提取技能草稿
  · 技能使用后的反馈优化
  · 学习历史追踪
  · 纯函数，无I/O副作用
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4

from openagi.chat.skills.engine import Skill, SkillCategory, SkillParam, SkillStatus


# ---------------------------------------------------------------------------
# 工具函数
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _uuid() -> str:
    return str(uuid4())


def _fingerprint(text: str) -> str:
    """生成文本的语义指纹（简化版：规范化后取hash）。"""
    # 规范化：小写，去除多余空格，去除标点
    normalized = re.sub(r"[^\w\u4e00-\u9fff\s]", "", text.lower())
    normalized = " ".join(normalized.split())
    return hashlib.md5(normalized.encode("utf-8")).hexdigest()[:12]


# ---------------------------------------------------------------------------
# 类型定义
# ---------------------------------------------------------------------------

class PatternStatus(str, Enum):
    OBSERVING = "observing"      # 观察中（出现次数不足）
    CANDIDATE = "candidate"      # 候选（达到触发阈值）
    EXTRACTED = "extracted"      # 已提取为技能
    REJECTED = "rejected"        # 已拒绝（用户决定不提取）
    DEPRECATED = "deprecated"    # 已废弃（不再出现）


class FeedbackType(str, Enum):
    POSITIVE = "positive"        # 正向反馈（技能运行正确）
    NEGATIVE = "negative"        # 负向反馈（技能有问题）
    SUGGESTION = "suggestion"    # 改进建议


@dataclass
class OperationRecord:
    """单次操作记录。"""
    id: str = field(default_factory=_uuid)
    session_id: str = ""
    user_input: str = ""             # 用户的原始输入
    ai_action: str = ""              # AI执行的动作描述
    result_summary: str = ""         # 执行结果摘要
    fingerprint: str = ""            # 语义指纹
    timestamp: datetime = field(default_factory=_now)
    metadata: dict = field(default_factory=dict)


@dataclass
class RepeatPattern:
    """检测到的重复操作模式。"""
    id: str = field(default_factory=_uuid)
    fingerprint: str = ""            # 模式指纹
    occurrences: list[OperationRecord] = field(default_factory=list)
    count: int = 0                   # 出现次数
    status: PatternStatus = PatternStatus.OBSERVING
    # 提取的技能草稿（候选状态时生成）
    draft_skill_name: str = ""
    draft_display_name: str = ""
    draft_description: str = ""
    draft_inputs: list[SkillParam] = field(default_factory=list)
    first_seen: datetime = field(default_factory=_now)
    last_seen: datetime = field(default_factory=_now)
    extracted_skill_name: str = ""   # 成功提取后的技能名称


@dataclass
class SkillFeedback:
    """技能使用后的反馈记录。"""
    id: str = field(default_factory=_uuid)
    skill_name: str = ""
    feedback_type: FeedbackType = FeedbackType.POSITIVE
    rating: int = 5                  # 1-5分
    comment: str = ""
    suggested_improvement: str = ""
    session_id: str = ""
    timestamp: datetime = field(default_factory=_now)


@dataclass
class LearningState:
    """学习循环全局状态。"""
    patterns: dict[str, RepeatPattern] = field(default_factory=dict)   # fingerprint -> pattern
    operation_log: list[OperationRecord] = field(default_factory=list)
    feedback_log: list[SkillFeedback] = field(default_factory=list)
    # 技能改进建议汇总
    improvement_suggestions: dict[str, list[str]] = field(default_factory=dict)  # skill_name -> suggestions
    # 配置
    repeat_threshold: int = 3        # 触发提取的最低重复次数
    max_log_size: int = 1000         # 操作日志最大条数


# ---------------------------------------------------------------------------
# 操作记录
# ---------------------------------------------------------------------------

def create_learning_state(repeat_threshold: int = 3) -> LearningState:
    """创建学习状态。"""
    return LearningState(repeat_threshold=repeat_threshold)


def record_operation(
    state: LearningState,
    session_id: str,
    user_input: str,
    ai_action: str,
    result_summary: str = "",
    metadata: dict | None = None,
) -> tuple[LearningState, OperationRecord]:
    """
    记录一次操作，并更新模式检测。
    返回 (新状态, 新记录)。
    """
    fp = _fingerprint(user_input + " " + ai_action)
    record = OperationRecord(
        session_id=session_id,
        user_input=user_input,
        ai_action=ai_action,
        result_summary=result_summary,
        fingerprint=fp,
        metadata=metadata or {},
    )

    # 更新操作日志（保持滑动窗口）
    new_log = [*state.operation_log, record]
    if len(new_log) > state.max_log_size:
        new_log = new_log[-state.max_log_size:]

    # 更新模式
    new_patterns = dict(state.patterns)
    if fp in new_patterns:
        existing = new_patterns[fp]
        updated_pattern = RepeatPattern(
            id=existing.id,
            fingerprint=fp,
            occurrences=[*existing.occurrences, record],
            count=existing.count + 1,
            status=existing.status,
            draft_skill_name=existing.draft_skill_name,
            draft_display_name=existing.draft_display_name,
            draft_description=existing.draft_description,
            draft_inputs=existing.draft_inputs,
            first_seen=existing.first_seen,
            last_seen=_now(),
            extracted_skill_name=existing.extracted_skill_name,
        )
        new_patterns[fp] = updated_pattern
    else:
        new_patterns[fp] = RepeatPattern(
            fingerprint=fp,
            occurrences=[record],
            count=1,
        )

    new_state = LearningState(
        patterns=new_patterns,
        operation_log=new_log,
        feedback_log=state.feedback_log,
        improvement_suggestions=state.improvement_suggestions,
        repeat_threshold=state.repeat_threshold,
        max_log_size=state.max_log_size,
    )
    return new_state, record


# ---------------------------------------------------------------------------
# 模式检测与技能提取
# ---------------------------------------------------------------------------

def detect_candidates(state: LearningState) -> list[RepeatPattern]:
    """
    检测已达到重复阈值但尚未处理的候选模式。
    返回应该被提取为技能的模式列表。
    """
    candidates = []
    for pattern in state.patterns.values():
        if (pattern.count >= state.repeat_threshold
                and pattern.status == PatternStatus.OBSERVING):
            candidates.append(pattern)
    return sorted(candidates, key=lambda p: p.count, reverse=True)


def promote_to_candidate(
    state: LearningState,
    fingerprint: str,
) -> LearningState:
    """
    将模式提升为候选状态，并生成技能草稿。
    """
    if fingerprint not in state.patterns:
        raise KeyError(f"模式指纹 {fingerprint} 不存在")
    pattern = state.patterns[fingerprint]
    if pattern.status != PatternStatus.OBSERVING:
        return state

    # 从操作记录中推断技能草稿
    sample = pattern.occurrences[0]
    draft_name, draft_display, draft_desc, draft_inputs = _infer_skill_draft(pattern)

    updated_pattern = RepeatPattern(
        id=pattern.id,
        fingerprint=fingerprint,
        occurrences=pattern.occurrences,
        count=pattern.count,
        status=PatternStatus.CANDIDATE,
        draft_skill_name=draft_name,
        draft_display_name=draft_display,
        draft_description=draft_desc,
        draft_inputs=draft_inputs,
        first_seen=pattern.first_seen,
        last_seen=pattern.last_seen,
    )
    new_patterns = {**state.patterns, fingerprint: updated_pattern}
    return LearningState(
        patterns=new_patterns,
        operation_log=state.operation_log,
        feedback_log=state.feedback_log,
        improvement_suggestions=state.improvement_suggestions,
        repeat_threshold=state.repeat_threshold,
        max_log_size=state.max_log_size,
    )


def _infer_skill_draft(
    pattern: RepeatPattern,
) -> tuple[str, str, str, list[SkillParam]]:
    """
    从模式中推断技能草稿。
    返回 (name, display_name, description, inputs)。
    """
    if not pattern.occurrences:
        return "learned_skill", "学习技能", "从重复操作中提取的技能", []

    sample = pattern.occurrences[0]
    action = sample.ai_action.strip()

    # 简单的名称生成：取动作描述前20字符，转snake_case
    raw_name = re.sub(r"[^\w\u4e00-\u9fff]", "_", action[:20]).strip("_")
    name = f"learned_{pattern.fingerprint}"

    # 显示名称：截取动作描述
    display_name = action[:15] + ("…" if len(action) > 15 else "")

    # 描述：综合多次出现的上下文
    desc = f"自动学习技能（重复{pattern.count}次）：{action[:50]}"

    # 推断输入参数：从用户输入中提取
    inputs = [SkillParam(name="input", type="str", description="输入内容", required=True)]

    return name, display_name, desc, inputs


def extract_skill_from_pattern(
    state: LearningState,
    fingerprint: str,
    override_name: str | None = None,
    override_display: str | None = None,
    override_description: str | None = None,
) -> tuple[LearningState, Skill]:
    """
    从候选模式提取技能。
    返回 (新状态, 提取的技能)。
    """
    if fingerprint not in state.patterns:
        raise KeyError(f"模式指纹 {fingerprint} 不存在")
    pattern = state.patterns[fingerprint]
    if pattern.status not in (PatternStatus.OBSERVING, PatternStatus.CANDIDATE):
        raise ValueError(f"模式状态 {pattern.status} 不可提取")

    # 如果还在OBSERVING，先推断草稿
    if pattern.status == PatternStatus.OBSERVING:
        state = promote_to_candidate(state, fingerprint)
        pattern = state.patterns[fingerprint]

    skill_name = override_name or pattern.draft_skill_name
    display_name = override_display or pattern.draft_display_name
    description = override_description or pattern.draft_description

    # 创建技能（不含handler，需用户后续配置）
    skill = Skill(
        name=skill_name,
        display_name=display_name,
        description=description,
        category=SkillCategory.CUSTOM,
        inputs=pattern.draft_inputs,
        outputs=[SkillParam(name="result", type="str", description="执行结果")],
        status=SkillStatus.ENABLED,
        source="learned",
        tags=["自动学习", f"触发{pattern.count}次"],
    )

    # 更新模式状态
    updated_pattern = RepeatPattern(
        **{**pattern.__dict__, "status": PatternStatus.EXTRACTED, "extracted_skill_name": skill_name}
    )
    new_patterns = {**state.patterns, fingerprint: updated_pattern}
    new_state = LearningState(
        patterns=new_patterns,
        operation_log=state.operation_log,
        feedback_log=state.feedback_log,
        improvement_suggestions=state.improvement_suggestions,
        repeat_threshold=state.repeat_threshold,
        max_log_size=state.max_log_size,
    )
    return new_state, skill


def reject_pattern(state: LearningState, fingerprint: str) -> LearningState:
    """拒绝提取某个候选模式（用户手动拒绝）。"""
    if fingerprint not in state.patterns:
        return state
    pattern = state.patterns[fingerprint]
    updated_pattern = RepeatPattern(**{**pattern.__dict__, "status": PatternStatus.REJECTED})
    new_patterns = {**state.patterns, fingerprint: updated_pattern}
    return LearningState(
        patterns=new_patterns,
        operation_log=state.operation_log,
        feedback_log=state.feedback_log,
        improvement_suggestions=state.improvement_suggestions,
        repeat_threshold=state.repeat_threshold,
        max_log_size=state.max_log_size,
    )


# ---------------------------------------------------------------------------
# 反馈优化
# ---------------------------------------------------------------------------

def record_feedback(
    state: LearningState,
    skill_name: str,
    feedback_type: FeedbackType,
    rating: int = 5,
    comment: str = "",
    suggested_improvement: str = "",
    session_id: str = "",
) -> LearningState:
    """记录技能使用反馈。"""
    rating = max(1, min(5, rating))  # 限制在1-5范围
    feedback = SkillFeedback(
        skill_name=skill_name,
        feedback_type=feedback_type,
        rating=rating,
        comment=comment,
        suggested_improvement=suggested_improvement,
        session_id=session_id,
    )
    new_feedback_log = [*state.feedback_log, feedback]

    # 如果有改进建议，加入建议汇总
    new_suggestions = dict(state.improvement_suggestions)
    if suggested_improvement:
        existing = new_suggestions.get(skill_name, [])
        new_suggestions[skill_name] = [*existing, suggested_improvement]

    return LearningState(
        patterns=state.patterns,
        operation_log=state.operation_log,
        feedback_log=new_feedback_log,
        improvement_suggestions=new_suggestions,
        repeat_threshold=state.repeat_threshold,
        max_log_size=state.max_log_size,
    )


def get_skill_feedback_summary(state: LearningState, skill_name: str) -> dict:
    """获取某技能的反馈汇总统计。"""
    feedbacks = [f for f in state.feedback_log if f.skill_name == skill_name]
    if not feedbacks:
        return {"skill_name": skill_name, "total": 0, "avg_rating": 0.0}

    total = len(feedbacks)
    avg_rating = sum(f.rating for f in feedbacks) / total
    positive = sum(1 for f in feedbacks if f.feedback_type == FeedbackType.POSITIVE)
    negative = sum(1 for f in feedbacks if f.feedback_type == FeedbackType.NEGATIVE)

    return {
        "skill_name": skill_name,
        "total": total,
        "avg_rating": round(avg_rating, 2),
        "positive_count": positive,
        "negative_count": negative,
        "positive_rate": round(positive / total, 2),
        "suggestions": state.improvement_suggestions.get(skill_name, []),
    }


def get_learning_summary(state: LearningState) -> dict:
    """获取学习系统整体摘要。"""
    by_status = {s.value: 0 for s in PatternStatus}
    for p in state.patterns.values():
        by_status[p.status.value] += 1

    return {
        "total_patterns": len(state.patterns),
        "by_status": by_status,
        "candidates_count": by_status[PatternStatus.CANDIDATE.value],
        "extracted_count": by_status[PatternStatus.EXTRACTED.value],
        "total_operations": len(state.operation_log),
        "total_feedbacks": len(state.feedback_log),
        "skills_with_feedback": len(state.improvement_suggestions),
        "repeat_threshold": state.repeat_threshold,
    }
