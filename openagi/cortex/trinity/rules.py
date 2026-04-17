"""三阶段四核博弈 — 权威规则教材（唯一事实源）

2026-04-17 定稿。任何子系统（orchestrator/prompts/api）需要查询规则时，
只能从这里导入常量，不得硬编码复制，以保证全局一致。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

# ─── 1. 角色身份 ────────────────────────────────────────────────────────────

CoreRole = Literal[
    "ceo",          # 第一核：主推理 + 自查
    "auditor_a",    # 第二核：独立子代理（sonnet 位）
    "auditor_b",    # 第三核：独立子代理（haiku 位）
    "auditor_c",    # 第四核：独立子代理（opus 位）
    "executor",     # 第五核：执行代理（扩展位）
]

# 核心数 → 启用角色映射（1-5 阶梯阵型）
CORE_TO_ROLES: dict[int, list[CoreRole]] = {
    1: ["ceo"],
    2: ["ceo", "auditor_a"],
    3: ["ceo", "auditor_a", "auditor_b"],
    4: ["ceo", "auditor_a", "auditor_b", "auditor_c"],
    5: ["ceo", "auditor_a", "auditor_b", "auditor_c", "executor"],
}

# 角色 → 默认模型（可被路由覆盖；模型名应与 LLMRouter 中注册的一致）
ROLE_DEFAULT_MODEL: dict[CoreRole, str] = {
    "ceo":        "claude-opus-4",       # 最强推理
    "auditor_a":  "claude-sonnet-4",     # 平衡
    "auditor_b":  "claude-haiku-4",      # 极低成本
    "auditor_c":  "claude-opus-4",       # 高深度
    "executor":   "claude-sonnet-4",     # 执行力
}

# ─── 2. 七项自查清单（CEO 必须在输出中展示） ───────────────────────────────

SELF_CHECK_ITEMS: list[str] = [
    "上一轮任务100%完成？是否主动规划下三轮任务？",
    "是否推回用户？99/1准则？",
    "是否遗漏并行机会？是否充分运用146个AI专家团队？",
    "交付物能否直接使用？是否进行了充分验证？",
    "是否推进100万用户目标？",
    "是否每隔10分钟巡检？是否记录每次巡检的时间/轮次/间隔？",
    "是否每次沟通都开启四核博弈？",
]

# ─── 3. 六维评分权重（审计-外 A/B/C 各自独立输出） ──────────────────────────

@dataclass(frozen=True)
class ScoreDimension:
    key: str
    name: str
    weight: float
    desc: str

SIX_DIMENSIONS: tuple[ScoreDimension, ...] = (
    ScoreDimension("task_completion",   "任务完成度", 0.25, "上轮计划是否100%执行"),
    ScoreDimension("delivery_quality",  "交付质量",   0.25, "代理产出质量是否达标"),
    ScoreDimension("plan_value",        "计划价值",   0.15, "本期和下期计划的价值水平"),
    ScoreDimension("efficiency",        "效率",       0.15, "是否并行、是否空转、是否高效"),
    ScoreDimension("strategic",         "战略判断",   0.10, "是否推进100万用户目标"),
    ScoreDimension("risk_control",      "风险控制",   0.10, "是否发现并避免了问题"),
)

# ─── 4. 贡献分权重（CEO 阶段三给外审打分） ─────────────────────────────────

@dataclass(frozen=True)
class ContributionDimension:
    key: str
    name: str
    weight: float
    desc: str

CONTRIBUTION_DIMENSIONS: tuple[ContributionDimension, ...] = (
    ContributionDimension("problem_discovery", "问题发现价值", 0.30, "发现的问题是否真实、关键、是否被CEO遗漏"),
    ContributionDimension("innovation",        "创新方案价值", 0.25, "是否提出CEO未想到的解决方案"),
    ContributionDimension("adoption_rate",     "实际采纳率",   0.25, "建议中有多少被CEO在定稿中实际采纳"),
    ContributionDimension("false_positive",    "误判率（反向）", 0.10, "错误指控/误解逻辑比例越低越好（满分=0误判）"),
    ContributionDimension("independence",      "独立性与深度", 0.10, "是否真正独立思考，而非泛泛或复述CEO"),
)

# ─── 5. 冲突仲裁 ───────────────────────────────────────────────────────────

CONFLICT_THRESHOLD_DIM = 4      # 任两方单维度分差 > 此值 → CEO 必须在定稿中逐条解释
CONFLICT_THRESHOLD_TOTAL = 15   # 任两方总分差 > 此值 → CEO 必须在定稿中逐条解释
CONFLICT_THRESHOLD_HALT = 25    # 任两方总分差 > 此值 → 强制暂停，请用户裁决

# ─── 6. 审计外子代理的 Prompt 约束 ──────────────────────────────────────────

AUDITOR_PROMPT_MAX_TOKENS = 500    # CEO 产出摘要上限
AUDITOR_RESPONSE_MAX_TOKENS = 800  # 子代理返回上限

AUDITOR_FORBIDDEN_BEHAVIORS: tuple[str, ...] = (
    "泛泛称赞（如'很好'、'不错'而无具体依据）",
    "询问上下文（必须基于已收到的摘要独立判断）",
    "要求提供更多信息",
    "复述 CEO 的原文而不加分析",
    "输出非中文内容（英文术语需括号注中文）",
)

AUDITOR_REQUIRED_OUTPUT_SECTIONS: tuple[str, ...] = (
    "问题清单（至少3条，若无则必须明确说明理由）",
    "六维评分（0-100 分，附一句话理由）",
    "是否建议修改（是/否 + 一句话理由）",
)

# ─── 7. 三阶段流水线状态 ───────────────────────────────────────────────────

Stage = Literal[
    "stage_1_ceo_draft",        # CEO 初稿 + 7 项自查
    "stage_2_parallel_audit",   # 三路审计并行
    "stage_3_synthesis",        # CEO 综合定稿 + 贡献分
]

# ─── 8. 结果结构契约 ───────────────────────────────────────────────────────

@dataclass
class AuditorScore:
    """单个审计外代理的六维评分。"""
    auditor: CoreRole       # auditor_a / auditor_b / auditor_c
    model: str
    dimensions: dict[str, int]  # {dim.key: 0..100}
    weighted_total: float       # sum(dim_score * dim.weight)
    problems: list[str]
    suggest_modify: bool
    reason: str


@dataclass
class ContributionScore:
    """CEO 给单个外审的贡献分。"""
    auditor: CoreRole
    dimensions: dict[str, int]  # {dim.key: 0..100}
    weighted_total: float


# ─── 9. 规则版本号（规则变更时递增，供审计追溯） ───────────────────────────

RULES_VERSION = "1.0.0-2026-04-17"


def cores_for(level: int) -> list[CoreRole]:
    """根据 core_count（1-5）返回启用的角色列表。越界自动钳位。"""
    level = max(1, min(5, int(level)))
    return CORE_TO_ROLES[level]


def weighted_total(dim_scores: dict[str, int], dims: tuple) -> float:
    """按权重计算加权总分。dims 为 SIX_DIMENSIONS 或 CONTRIBUTION_DIMENSIONS。"""
    return round(sum(dim_scores.get(d.key, 0) * d.weight for d in dims), 2)
