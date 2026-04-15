"""
技能市场 (Skills Market) — 技能浏览、搜索与来源管理
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
功能：
  · OpenClaw镜像标签（cn.clawhub-mirror.com）
  · CocoLoop标签（hub.cocoloop.cn）
  · 搜索/分类浏览
  · 技能包定义与安装预览
  · 纯函数，无I/O副作用
"""

from __future__ import annotations

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


# ---------------------------------------------------------------------------
# 市场来源定义
# ---------------------------------------------------------------------------

class MarketSource(str, Enum):
    OPENCLAW = "openclaw"       # OpenClaw镜像 (cn.clawhub-mirror.com)
    COCOLOOP = "cocoloop"       # CocoLoop (hub.cocoloop.cn)
    COMMUNITY = "community"     # 社区贡献


# 来源注册表（URL前缀映射）
SOURCE_REGISTRY: dict[MarketSource, dict] = {
    MarketSource.OPENCLAW: {
        "name": "OpenClaw 镜像",
        "url": "https://cn.clawhub-mirror.com",
        "description": "OpenClaw官方技能镜像，中国加速节点",
        "badge": "🔴",
        "trusted": True,
    },
    MarketSource.COCOLOOP: {
        "name": "CocoLoop Hub",
        "url": "https://hub.cocoloop.cn",
        "description": "CocoLoop社区技能中心，国产原创技能集合",
        "badge": "🟢",
        "trusted": True,
    },
    MarketSource.COMMUNITY: {
        "name": "社区贡献",
        "url": "https://community.openagi.dev",
        "description": "开发者社区贡献的技能包",
        "badge": "🔵",
        "trusted": False,
    },
}


# ---------------------------------------------------------------------------
# 市场技能包（Skill Package）
# ---------------------------------------------------------------------------

@dataclass
class SkillPackage:
    """市场中的技能包（可能含多个技能）。"""
    id: str = field(default_factory=_uuid)
    package_name: str = ""           # 包名（如 "web-search-pro"）
    display_name: str = ""           # 显示名称
    description: str = ""
    author: str = ""
    version: str = "1.0.0"
    source: MarketSource = MarketSource.OPENCLAW
    source_url: str = ""             # 包的完整URL
    category: SkillCategory = SkillCategory.TOOL
    tags: list[str] = field(default_factory=list)
    skills_count: int = 0            # 包含的技能数量
    skills_preview: list[str] = field(default_factory=list)  # 技能名称预览
    # 统计
    downloads: int = 0
    rating: float = 0.0              # 0-5分
    rating_count: int = 0
    # 兼容性
    min_version: str = "0.1.0"       # 要求的最低框架版本
    published_at: datetime = field(default_factory=_now)
    updated_at: datetime = field(default_factory=_now)
    # 价格（0 = 免费）
    price: float = 0.0
    currency: str = "CNY"


@dataclass
class MarketCatalog:
    """技能市场目录（内存缓存）。"""
    packages: dict[str, SkillPackage] = field(default_factory=dict)  # package_name -> SkillPackage
    last_synced: datetime | None = None
    total_count: int = 0


# ---------------------------------------------------------------------------
# 内置市场目录（预定义示例包）
# ---------------------------------------------------------------------------

OPENCLAW_PACKAGES: list[SkillPackage] = [
    SkillPackage(
        package_name="web-search",
        display_name="网页搜索",
        description="集成Bing/百度/Google搜索，支持实时检索网络信息",
        author="OpenClaw Team",
        source=MarketSource.OPENCLAW,
        source_url="https://cn.clawhub-mirror.com/skills/web-search",
        category=SkillCategory.TOOL,
        tags=["搜索", "网络", "实时"],
        skills_count=3,
        skills_preview=["bing_search", "baidu_search", "google_search"],
        downloads=12450,
        rating=4.8,
        rating_count=320,
    ),
    SkillPackage(
        package_name="code-executor",
        display_name="代码执行器",
        description="沙箱执行Python/JavaScript代码片段，返回结果",
        author="OpenClaw Team",
        source=MarketSource.OPENCLAW,
        source_url="https://cn.clawhub-mirror.com/skills/code-executor",
        category=SkillCategory.TOOL,
        tags=["代码", "执行", "Python", "JavaScript"],
        skills_count=2,
        skills_preview=["run_python", "run_javascript"],
        downloads=8930,
        rating=4.6,
        rating_count=218,
    ),
    SkillPackage(
        package_name="document-reader",
        display_name="文档解析器",
        description="解析PDF、Word、Excel文档内容，提取结构化信息",
        author="OpenClaw Team",
        source=MarketSource.OPENCLAW,
        source_url="https://cn.clawhub-mirror.com/skills/document-reader",
        category=SkillCategory.TOOL,
        tags=["文档", "PDF", "Word", "Excel", "解析"],
        skills_count=4,
        skills_preview=["read_pdf", "read_docx", "read_xlsx", "read_text"],
        downloads=6720,
        rating=4.5,
        rating_count=156,
    ),
    SkillPackage(
        package_name="image-analysis",
        display_name="图像分析",
        description="分析图片内容、识别文字（OCR）、生成描述",
        author="OpenClaw Labs",
        source=MarketSource.OPENCLAW,
        source_url="https://cn.clawhub-mirror.com/skills/image-analysis",
        category=SkillCategory.TOOL,
        tags=["图像", "OCR", "视觉", "识别"],
        skills_count=3,
        skills_preview=["analyze_image", "ocr_text", "describe_image"],
        downloads=5100,
        rating=4.7,
        rating_count=189,
    ),
]

COCOLOOP_PACKAGES: list[SkillPackage] = [
    SkillPackage(
        package_name="chinese-nlp",
        display_name="中文NLP工具箱",
        description="中文分词、命名实体识别、情感分析、关键词提取",
        author="CocoLoop NLP",
        source=MarketSource.COCOLOOP,
        source_url="https://hub.cocoloop.cn/skills/chinese-nlp",
        category=SkillCategory.KNOWLEDGE,
        tags=["中文", "NLP", "分词", "情感分析"],
        skills_count=5,
        skills_preview=["segment_text", "extract_entities", "sentiment_analysis", "extract_keywords", "pos_tagging"],
        downloads=9200,
        rating=4.9,
        rating_count=410,
    ),
    SkillPackage(
        package_name="wechat-workflow",
        display_name="微信工作流",
        description="微信公众号内容生成、朋友圈文案、小红书风格转换",
        author="CocoLoop Content",
        source=MarketSource.COCOLOOP,
        source_url="https://hub.cocoloop.cn/skills/wechat-workflow",
        category=SkillCategory.WORKFLOW,
        tags=["微信", "内容", "营销", "公众号"],
        skills_count=4,
        skills_preview=["gen_wechat_article", "gen_moments_post", "gen_xiaohongshu", "gen_douyin_script"],
        downloads=7850,
        rating=4.7,
        rating_count=295,
    ),
    SkillPackage(
        package_name="data-viz",
        display_name="数据可视化",
        description="生成ECharts图表配置、CSV数据分析、数据摘要报告",
        author="CocoLoop Data",
        source=MarketSource.COCOLOOP,
        source_url="https://hub.cocoloop.cn/skills/data-viz",
        category=SkillCategory.TOOL,
        tags=["数据", "可视化", "ECharts", "图表"],
        skills_count=3,
        skills_preview=["gen_echarts_config", "analyze_csv", "gen_data_report"],
        downloads=4300,
        rating=4.4,
        rating_count=132,
    ),
    SkillPackage(
        package_name="edu-assistant",
        display_name="教育辅助套件",
        description="出题、批改、知识点讲解、学习路径规划",
        author="CocoLoop Edu",
        source=MarketSource.COCOLOOP,
        source_url="https://hub.cocoloop.cn/skills/edu-assistant",
        category=SkillCategory.KNOWLEDGE,
        tags=["教育", "出题", "批改", "学习"],
        skills_count=5,
        skills_preview=["generate_quiz", "grade_answer", "explain_concept", "plan_learning_path", "create_exercise"],
        downloads=3600,
        rating=4.6,
        rating_count=98,
    ),
]


# ---------------------------------------------------------------------------
# 目录操作
# ---------------------------------------------------------------------------

def create_catalog_from_builtins() -> MarketCatalog:
    """用内置包列表初始化目录。"""
    packages: dict[str, SkillPackage] = {}
    for pkg in OPENCLAW_PACKAGES + COCOLOOP_PACKAGES:
        packages[pkg.package_name] = pkg
    return MarketCatalog(
        packages=packages,
        last_synced=_now(),
        total_count=len(packages),
    )


def search_packages(
    catalog: MarketCatalog,
    query: str,
    source: MarketSource | None = None,
    category: SkillCategory | None = None,
) -> list[SkillPackage]:
    """
    搜索技能包。
    支持按名称/描述/标签搜索，可按来源和分类过滤。
    结果按下载量倒序排列。
    """
    q = query.strip().lower()
    result = list(catalog.packages.values())

    # 来源过滤
    if source:
        result = [p for p in result if p.source == source]

    # 分类过滤
    if category:
        result = [p for p in result if p.category == category]

    # 关键词过滤
    if q:
        result = [
            p for p in result
            if q in p.package_name.lower()
            or q in p.display_name.lower()
            or q in p.description.lower()
            or any(q in tag.lower() for tag in p.tags)
        ]

    return sorted(result, key=lambda p: p.downloads, reverse=True)


def browse_by_category(
    catalog: MarketCatalog,
    category: SkillCategory,
    source: MarketSource | None = None,
) -> list[SkillPackage]:
    """按分类浏览技能包，可选过滤来源。"""
    result = [p for p in catalog.packages.values() if p.category == category]
    if source:
        result = [p for p in result if p.source == source]
    return sorted(result, key=lambda p: (p.rating * p.rating_count), reverse=True)


def get_package(catalog: MarketCatalog, package_name: str) -> SkillPackage | None:
    """按包名获取技能包详情。"""
    return catalog.packages.get(package_name)


def get_top_packages(
    catalog: MarketCatalog,
    limit: int = 10,
    source: MarketSource | None = None,
) -> list[SkillPackage]:
    """获取下载量最高的技能包。"""
    pkgs = list(catalog.packages.values())
    if source:
        pkgs = [p for p in pkgs if p.source == source]
    return sorted(pkgs, key=lambda p: p.downloads, reverse=True)[:limit]


def get_source_info(source: MarketSource) -> dict:
    """获取来源信息。"""
    return SOURCE_REGISTRY.get(source, {})


def list_all_sources() -> list[dict]:
    """列出所有来源信息。"""
    return [
        {"source": source.value, **info}
        for source, info in SOURCE_REGISTRY.items()
    ]


def catalog_summary(catalog: MarketCatalog) -> dict:
    """返回目录摘要。"""
    by_source: dict[str, int] = {}
    by_category: dict[str, int] = {}
    for pkg in catalog.packages.values():
        by_source[pkg.source.value] = by_source.get(pkg.source.value, 0) + 1
        by_category[pkg.category.value] = by_category.get(pkg.category.value, 0) + 1

    return {
        "total_packages": len(catalog.packages),
        "last_synced": catalog.last_synced.isoformat() if catalog.last_synced else None,
        "by_source": by_source,
        "by_category": by_category,
    }
