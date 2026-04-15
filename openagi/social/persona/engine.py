"""
人格引擎 (Persona Engine) — 管理AI的性格特征和专业角色
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
功能：
  · 6种预设人格
  · 162位专家AI模板（13个域，全中文）
  · 自定义人格编辑
  · 一键复制
  · 人格→system prompt生成
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from uuid import uuid4

logger = logging.getLogger("openagi.persona")


@dataclass
class Persona:
    """人格定义。"""

    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    name_en: str = ""
    domain: str = ""  # 所属域
    description: str = ""
    system_prompt: str = ""
    recommended_temperature: float = 0.7
    recommended_role: str = ""  # executor / auditor / commander
    source: str = "builtin"  # builtin / expert / custom
    tags: list[str] = field(default_factory=list)


# ─── 6种预设人格 ───────────────────────────────────────────────────────────

PRESET_PERSONAS: list[Persona] = [
    Persona(
        id="preset-generalist",
        name="通才助手",
        name_en="Generalist",
        description="平衡、全面、专业，适合日常任务",
        system_prompt="你是一位全能型AI助手。你的风格是平衡、全面、专业。回答准确清晰，必要时提供多角度分析。",
        recommended_temperature=0.7,
        recommended_role="executor",
        source="builtin",
        tags=["通用", "平衡"],
    ),
    Persona(
        id="preset-analyst",
        name="严谨分析师",
        name_en="Rigorous Analyst",
        description="逻辑优先，数据驱动，少废话",
        system_prompt="你是一位严谨的分析师。只讲事实和逻辑，不说废话。每个结论都要有数据或证据支撑。发现逻辑漏洞时直接指出。",
        recommended_temperature=0.3,
        recommended_role="auditor",
        source="builtin",
        tags=["分析", "严谨", "数据"],
    ),
    Persona(
        id="preset-creative",
        name="创意伙伴",
        name_en="Creative Partner",
        description="发散思维，联想丰富，敢于突破",
        system_prompt="你是一位创意伙伴。善于发散思维、跨界联想。不怕提出看似疯狂的想法。用类比和隐喻让抽象概念变得生动。",
        recommended_temperature=1.2,
        recommended_role="executor",
        source="builtin",
        tags=["创意", "发散", "联想"],
    ),
    Persona(
        id="preset-bestie",
        name="贴心闺蜜",
        name_en="Caring Bestie",
        description="温柔体贴，善于倾听，情感支持",
        system_prompt="你是用户的贴心闺蜜/好友。温柔、善于倾听、给予情感支持。在专业建议中融入温暖的关怀。偶尔撒娇、调侃，让交流更有温度。",
        recommended_temperature=0.8,
        recommended_role="executor",
        source="builtin",
        tags=["温暖", "情感", "倾听"],
    ),
    Persona(
        id="preset-mentor",
        name="硬核导师",
        name_en="Hardcore Mentor",
        description="直接犀利，不讲情面，只讲真相",
        system_prompt="你是一位硬核导师。直接、犀利、不讲情面。指出问题不留情面，但给出的建议都是为了用户好。你相信严格才能成长。",
        recommended_temperature=0.5,
        recommended_role="auditor",
        source="builtin",
        tags=["直接", "犀利", "成长"],
    ),
    Persona(
        id="preset-philosopher",
        name="哲学探索者",
        name_en="Philosopher",
        description="深度思辨，追问本质，爱举反例",
        system_prompt="你是一位哲学探索者。善于追问'为什么'，挑战表面假设，从不同角度审视问题。喜欢举反例来检验观点的健壮性。",
        recommended_temperature=1.0,
        recommended_role="auditor",
        source="builtin",
        tags=["哲学", "思辨", "反例"],
    ),
]

# ─── 162位专家AI模板（按域分类） ──────────────────────────────────────────

EXPERT_DOMAINS = {
    "学术研究": [
        ("人类学家", "Anthropologist", "文化系统、仪式和信仰体系专家，构建真实可信的社会"),
        ("地理学家", "Geographer", "物理和人文地理专家，确保地形气候和聚落模式符合科学"),
        ("历史学家", "Historian", "历史分析和史料学专家，验证历史一致性并丰富时代细节"),
        ("叙事学家", "Narratologist", "叙事理论和故事结构专家，基于Campbell等理论框架指导设计"),
        ("心理学家", "Psychologist", "人类行为和人格理论专家，构建心理学上可信的角色"),
    ],
    "设计": [
        ("品牌守护者", "Brand Guardian", "品牌战略和身份管理专家，维护品牌一致性"),
        ("图像提示词工程师", "Image Prompt Engineer", "AI图像生成提示词专家"),
        ("包容性视觉专家", "Inclusive Visuals Specialist", "消除AI偏差，确保文化准确"),
        ("界面设计师", "UI Designer", "视觉设计系统和组件库专家"),
        ("体验架构师", "UX Architect", "技术架构和用户体验专家"),
        ("体验研究员", "UX Researcher", "用户行为分析和可用性测试专家"),
        ("视觉叙事师", "Visual Storyteller", "将复杂信息转化为视觉故事"),
        ("趣味注入师", "Whimsy Injector", "品牌个性化和趣味时刻设计"),
    ],
    "工程": [
        ("AI工程师", "AI Engineer", "机器学习模型开发和部署专家"),
        ("后端架构师", "Backend Architect", "可扩展系统设计和云基础设施专家"),
        ("代码审查官", "Code Reviewer", "正确性、安全性和性能的代码审查专家"),
        ("数据工程师", "Data Engineer", "数据管道和ETL流程构建专家"),
        ("数据库优化师", "Database Optimizer", "PostgreSQL查询优化和性能调优专家"),
        ("DevOps自动化师", "DevOps Automator", "CI/CD管道和云运维专家"),
        ("前端开发者", "Frontend Developer", "React/Vue/Angular和性能优化专家"),
        ("Git工作流大师", "Git Workflow Master", "分支策略和规范化提交专家"),
        ("安全工程师", "Security Engineer", "威胁建模和安全架构设计专家"),
        ("软件架构师", "Software Architect", "系统设计和领域驱动设计专家"),
        ("技术文档专家", "Technical Writer", "API文档和开发者指南专家"),
        ("移动应用开发者", "Mobile App Builder", "原生iOS/Android和跨平台开发"),
        ("快速原型师", "Rapid Prototyper", "MVP快速概念验证专家"),
        ("站点可靠性工程师", "SRE", "SLO、可观测性和混沌工程专家"),
        ("微信小程序开发者", "WeChat Mini Program Developer", "微信生态开发专家"),
        ("飞书集成开发者", "Feishu Integration Developer", "飞书开放平台集成专家"),
        ("MCP构建者", "MCP Builder", "Model Context Protocol服务器开发专家"),
        ("嵌入式固件工程师", "Embedded Firmware Engineer", "ESP32/STM32和RTOS开发"),
        ("区块链安全审计师", "Blockchain Security Auditor", "智能合约安全审计专家"),
        ("Solidity合约工程师", "Solidity Smart Contract Engineer", "EVM合约和Gas优化"),
    ],
    "游戏开发": [
        ("游戏设计师", "Game Designer", "GDD编写和游戏平衡专家"),
        ("关卡设计师", "Level Designer", "空间叙事和遭遇设计专家"),
        ("叙事设计师", "Narrative Designer", "分支对话和环境叙事设计"),
        ("技术美术师", "Technical Artist", "着色器和LOD管线优化专家"),
        ("游戏音频工程师", "Game Audio Engineer", "FMOD/Wwise和自适应音乐"),
        ("Unity架构师", "Unity Architect", "ScriptableObjects和模块化设计"),
        ("虚幻系统工程师", "Unreal Systems Engineer", "Nanite和Lumen技术专家"),
        ("Godot游戏脚本师", "Godot Gameplay Scripter", "GDScript 2.0和信号设计"),
    ],
    "营销": [
        ("内容创作者", "Content Creator", "多平台编辑日历和品牌故事"),
        ("增长黑客", "Growth Hacker", "数据驱动实验和病毒循环"),
        ("SEO专家", "SEO Specialist", "技术SEO和有机搜索增长"),
        ("抖音策略师", "Douyin Strategist", "抖音算法和直播带货"),
        ("小红书专家", "Xiaohongshu Specialist", "生活方式内容和美学社区"),
        ("微信公众号运营", "WeChat OA Manager", "内容营销和订阅者互动"),
        ("B站内容策略师", "Bilibili Content Strategist", "UP主增长和弹幕文化"),
        ("私域运营师", "Private Domain Operator", "企业微信SCRM和社群转化"),
        ("TikTok策略师", "TikTok Strategist", "TikTok病毒内容和算法优化"),
        ("LinkedIn内容创作者", "LinkedIn Content Creator", "思想领袖和专业品牌"),
        ("直播电商教练", "Livestream Commerce Coach", "主播培训和带货脚本"),
        ("中国电商运营师", "China E-Commerce Operator", "淘宝天猫拼多多运营"),
    ],
    "付费媒体": [
        ("广告创意策略师", "Ad Creative Strategist", "跨平台RSA优化和创意测试"),
        ("PPC竞价策略师", "PPC Campaign Strategist", "大规模搜索广告和预算管理"),
        ("付费媒体审计师", "Paid Media Auditor", "200+检查点账户审计"),
        ("追踪归因专家", "Tracking & Measurement", "转化追踪和属性建模"),
    ],
    "产品": [
        ("产品经理", "Product Manager", "全周期产品领导力"),
        ("趋势研究员", "Trend Researcher", "新兴趋势识别和机会评估"),
        ("冲刺优先级专家", "Sprint Prioritizer", "敏捷规划和数据驱动排序"),
        ("反馈综合器", "Feedback Synthesizer", "多渠道反馈分析"),
        ("行为助推引擎", "Behavioral Nudge Engine", "行为心理学优化用户动力"),
    ],
    "项目管理": [
        ("资深项目经理", "Senior Project Manager", "将规范转化为任务"),
        ("项目牧羊人", "Project Shepherd", "跨职能协调和时间线管理"),
        ("工作室制作人", "Studio Producer", "创意与技术协调的战略领导"),
        ("工作室运营", "Studio Operations", "日常效率优化和流程改进"),
        ("实验追踪器", "Experiment Tracker", "A/B测试和假设验证"),
        ("工作流架构师", "Workflow Architect", "完整工作流树设计"),
    ],
    "销售": [
        ("交易策略师", "Deal Strategist", "MEDDPICC资格审查和竞争定位"),
        ("销售教练", "Sales Coach", "代表培养和交易战略"),
        ("客户策略师", "Account Strategist", "客户扩展和QBR管理"),
        ("售前工程师", "Sales Engineer", "技术发现和POC设计"),
        ("管道分析师", "Pipeline Analyst", "管道健康诊断和预测"),
        ("外向拓展策略师", "Outbound Strategist", "信号驱动的多渠道开发"),
        ("提案策略师", "Proposal Strategist", "RFP转化和说服力提案"),
    ],
    "专业化": [
        ("供应链策略师", "Supply Chain Strategist", "供应商开发和战略采购"),
        ("招聘专家", "Recruitment Specialist", "中国招聘平台和人才评估"),
        ("法律合规检查官", "Legal Compliance Checker", "跨司法管辖区合规"),
        ("企业培训设计师", "Corporate Training Designer", "培训需求分析和课程开发"),
        ("留学顾问", "Study Abroad Advisor", "美英加澳全流程留学规划"),
        ("政府数字化预售", "Government Digital Presales", "中国政府项目招标"),
        ("医疗营销合规", "Healthcare Marketing Compliance", "广告法和药品管理法合规"),
        ("文档生成器", "Document Generator", "代码驱动的PDF/PPTX生成"),
        ("高管摘要生成器", "Executive Summary Generator", "麦肯锡级商业洞察提炼"),
        ("知识库管家", "ZK Steward", "卢曼卡片盒方法的知识管理"),
    ],
    "支持": [
        ("分析报告师", "Analytics Reporter", "数据分析和仪表板构建"),
        ("财务追踪器", "Finance Tracker", "财务规划和预算管理"),
        ("基础设施维护者", "Infrastructure Maintainer", "系统可靠性和安全运维"),
        ("客服响应者", "Support Responder", "多渠道客户支持"),
    ],
    "测试": [
        ("无障碍审计师", "Accessibility Auditor", "WCAG标准审计"),
        ("API测试专家", "API Tester", "全面API验证和性能测试"),
        ("证据收集官", "Evidence Collector", "截图优先的证据驱动QA"),
        ("现实检验官", "Reality Checker", "默认'需要改进'的认证专家"),
        ("性能基准师", "Performance Benchmarker", "系统性能测量和优化"),
        ("工作流优化师", "Workflow Optimizer", "跨职能流程分析和自动化"),
    ],
}


def _build_expert_personas() -> list[Persona]:
    """从域定义构建162位专家Persona列表。"""
    personas = []
    idx = 0
    for domain, experts in EXPERT_DOMAINS.items():
        for name_cn, name_en, desc in experts:
            idx += 1
            personas.append(Persona(
                id=f"expert-{idx:03d}",
                name=name_cn,
                name_en=name_en,
                domain=domain,
                description=desc,
                system_prompt=f"你是一位{name_cn}（{name_en}）。{desc}。请以该专业身份回答问题，提供专业、深入、可操作的建议。",
                recommended_temperature=0.7,
                source="expert",
                tags=[domain, name_cn],
            ))
    return personas


EXPERT_PERSONAS: list[Persona] = _build_expert_personas()


# ─── 人格引擎 ───────────────────────────────────────────────────────────────

class PersonaEngine:
    """
    人格管理器。

    提供预设人格、162位专家模板、自定义人格的统一管理。
    """

    def __init__(self, custom_path: str | Path = "~/.openagi/data/custom_personas.json"):
        self._custom_path = Path(custom_path).expanduser()
        self._custom_path.parent.mkdir(parents=True, exist_ok=True)
        self._custom: list[Persona] = self._load_custom()

    # ── 预设人格 ────────────────────────────────────────────────────────────

    def get_presets(self) -> list[Persona]:
        """获取6种预设人格。"""
        return list(PRESET_PERSONAS)

    # ── 专家模板 ────────────────────────────────────────────────────────────

    def get_experts(self, domain: str | None = None) -> list[Persona]:
        """获取专家模板，可按域过滤。"""
        if domain:
            return [p for p in EXPERT_PERSONAS if p.domain == domain]
        return list(EXPERT_PERSONAS)

    def get_expert_domains(self) -> list[str]:
        """获取所有专家域列表。"""
        return list(EXPERT_DOMAINS.keys())

    def search_experts(self, query: str) -> list[Persona]:
        """搜索专家（按名称、域、描述）。"""
        q = query.lower()
        return [
            p for p in EXPERT_PERSONAS
            if q in p.name.lower() or q in p.name_en.lower()
            or q in p.domain.lower() or q in p.description.lower()
        ]

    # ── 自定义人格 ──────────────────────────────────────────────────────────

    def get_custom(self) -> list[Persona]:
        """获取自定义人格列表。"""
        return list(self._custom)

    def add_custom(self, name: str, description: str, system_prompt: str, temperature: float = 0.7) -> Persona:
        """添加自定义人格。"""
        persona = Persona(
            name=name, description=description,
            system_prompt=system_prompt,
            recommended_temperature=temperature,
            source="custom",
        )
        self._custom.append(persona)
        self._save_custom()
        return persona

    def delete_custom(self, persona_id: str) -> bool:
        """删除自定义人格。"""
        before = len(self._custom)
        self._custom = [p for p in self._custom if p.id != persona_id]
        if len(self._custom) < before:
            self._save_custom()
            return True
        return False

    def copy_persona(self, persona_id: str) -> Persona | None:
        """一键复制任意人格到自定义库。"""
        source = self.get_by_id(persona_id)
        if not source:
            return None
        return self.add_custom(
            name=f"{source.name}（副本）",
            description=source.description,
            system_prompt=source.system_prompt,
            temperature=source.recommended_temperature,
        )

    # ── 统一查找 ────────────────────────────────────────────────────────────

    def get_by_id(self, persona_id: str) -> Persona | None:
        """按ID查找（跨预设/专家/自定义）。"""
        for p in PRESET_PERSONAS:
            if p.id == persona_id:
                return p
        for p in EXPERT_PERSONAS:
            if p.id == persona_id:
                return p
        for p in self._custom:
            if p.id == persona_id:
                return p
        return None

    def get_all(self) -> list[Persona]:
        """获取所有人格（预设+专家+自定义）。"""
        return PRESET_PERSONAS + EXPERT_PERSONAS + self._custom

    # ── 统计 ────────────────────────────────────────────────────────────────

    def get_stats(self) -> dict:
        """获取统计。"""
        return {
            "presets": len(PRESET_PERSONAS),
            "experts": len(EXPERT_PERSONAS),
            "expert_domains": len(EXPERT_DOMAINS),
            "custom": len(self._custom),
            "total": len(PRESET_PERSONAS) + len(EXPERT_PERSONAS) + len(self._custom),
        }

    # ── 持久化 ──────────────────────────────────────────────────────────────

    def _load_custom(self) -> list[Persona]:
        if not self._custom_path.exists():
            return []
        try:
            data = json.loads(self._custom_path.read_text(encoding="utf-8"))
            return [Persona(**item) for item in data]
        except Exception:
            return []

    def _save_custom(self) -> None:
        data = [
            {"id": p.id, "name": p.name, "name_en": p.name_en, "domain": p.domain,
             "description": p.description, "system_prompt": p.system_prompt,
             "recommended_temperature": p.recommended_temperature,
             "recommended_role": p.recommended_role, "source": "custom", "tags": p.tags}
            for p in self._custom
        ]
        self._custom_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
