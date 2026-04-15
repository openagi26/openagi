"""技能API路由。"""

from __future__ import annotations

import json
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/v1/skills", tags=["技能"])

# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------

_SKILLS_PATH = Path.home() / ".openagi" / "data" / "skills.json"

_MARKET_SKILLS: list[dict] = [
    {
        "id": "code_execution",
        "name": "代码执行",
        "description": "在沙箱中安全执行 Python / JS 代码",
        "category": "开发工具",
        "version": "1.0.0",
        "author": "OpenAGI",
    },
    {
        "id": "web_search",
        "name": "网页搜索",
        "description": "调用搜索引擎检索最新信息",
        "category": "信息获取",
        "version": "1.2.0",
        "author": "OpenAGI",
    },
    {
        "id": "file_rw",
        "name": "文件读写",
        "description": "读取、写入、删除本地文件与目录",
        "category": "系统工具",
        "version": "1.0.0",
        "author": "OpenAGI",
    },
    {
        "id": "data_analysis",
        "name": "数据分析",
        "description": "对结构化数据进行统计分析与可视化",
        "category": "数据科学",
        "version": "0.9.0",
        "author": "OpenAGI",
    },
    {
        "id": "image_generation",
        "name": "图像生成",
        "description": "调用 Stable Diffusion / DALL-E 生成图片",
        "category": "创作工具",
        "version": "1.1.0",
        "author": "OpenAGI",
    },
    # ── 来自 OpenClaw 社区 ──────────────────────────────────────
    {
        "id": "baidu_scholar_search",
        "name": "百度学术搜索",
        "description": "搜索中英文学术文献（期刊/会议/论文/学位论文），支持摘要提取和分页",
        "category": "学术研究",
        "version": "1.0.0",
        "author": "quincygunter",
        "source": "github.com/quincygunter/quincy-baidu-scholar-search",
        "params": {"wd": "搜索关键词", "pageNum": "页码(默认0)", "enable_abstract": "是否返回摘要"},
    },
    {
        "id": "caveman_compress",
        "name": "Caveman Token压缩",
        "description": "原始人说话模式：平均节省65% token，代码不变只压缩自然语言。含文言文模式（80-90%字符压缩率）",
        "category": "效率工具",
        "version": "1.0.0",
        "author": "JuliusBrussee（32K★）",
        "source": "github.com/JuliusBrussee/caveman",
        "modes": {
            "lite": "删除填充词，保留语法（专业但精简）",
            "full": "去冠词+接受断句+短同义词（默认原始人模式）",
            "ultra": "缩写术语(DB/auth)+去连词+箭头因果(X→Y)",
            "wenyan_lite": "半文言——去填充保语法，古典语气",
            "wenyan_full": "全文言——80-90%字符压缩，动词前置/省主语/之乃為其",
            "wenyan_ultra": "极限文言缩写",
        },
        "safety": "安全警告和不可逆操作确认自动切回正常模式",
        "benchmark": {"avg_saving": "65%", "best_case": "87%", "code_protection": True},
        "sub_skills": ["caveman-commit（精简commit信息）", "caveman-review（单行PR评论）", "caveman-compress（压缩CLAUDE.md文件节省46%输入token）"],
    },
    {
        "id": "bb_browser",
        "name": "BB-Browser 登录态浏览器",
        "description": "坏孩子浏览器：复用已登录Chrome的Cookie和认证态，36个平台103条命令，无需API密钥直接获取私域信息",
        "category": "浏览器工具",
        "version": "1.0.0",
        "author": "epiral（4.6K★）",
        "source": "github.com/epiral/bb-browser",
        "platforms_36": {
            "搜索引擎": ["Google", "百度", "必应", "DuckDuckGo", "搜狗微信"],
            "社交媒体": ["Twitter/X", "Reddit", "微博", "小红书", "即刻", "LinkedIn", "虎扑"],
            "新闻资讯": ["BBC", "路透社", "36氪", "今日头条", "东方财富"],
            "技术开发": ["GitHub", "StackOverflow", "HackerNews", "CSDN", "npm", "PyPI", "arXiv"],
            "视频平台": ["YouTube", "B站"],
            "财经股票": ["东方财富", "雅虎财经"],
            "求职招聘": ["BOSS直聘"],
            "知识百科": ["维基百科", "知乎", "开放图书馆"],
        },
        "core_principle": "在真实浏览器中执行JS，复用登录态Cookie，返回结构化JSON",
        "mcp_support": True,
    },
    {
        "id": "agent_browser",
        "name": "Agent浏览器自动化",
        "description": "无头浏览器自动化工具：通过可访问性树快照+引用编码实现确定性网页交互，支持导航/点击/表单/截图/会话隔离/Cookie持久化",
        "category": "浏览器工具",
        "version": "1.0.0",
        "author": "matrixy（安全加固版: murdochwa）",
        "source": "github.com/jiajiawei994-ctrl/agent-browser-clawdbot",
        "capabilities": {
            "导航": ["打开URL", "返回/前进", "刷新", "关闭页面"],
            "交互": ["点击(@ref引用)", "悬停", "拖拽", "表单填充", "键盘输入", "滚动"],
            "信息获取": ["提取文本/HTML/属性", "截图/PDF", "元素可见性检查"],
            "高级": ["会话隔离(多实例)", "Cookie持久化", "网络请求拦截"],
        },
        "workflow": "快照→解析引用→交互→重新快照（确定性循环）",
        "security_notes": "需设置信任边界，避免对不可信网站执行风险自动化；敏感数据需脱敏处理",
    },
    {
        "id": "ai_selfie",
        "name": "AI自拍系统",
        "description": "基于Clawra设计：AI生成个性化自拍照片，支持镜像自拍和直拍两种模式，可跨平台分发",
        "category": "数字伴侣",
        "version": "1.0.0",
        "author": "SumeLabs（Clawra）",
        "source": "github.com/SumeLabs/clawra",
        "modes": {"mirror": "镜像自拍（全身/服装展示）", "direct": "直拍（近距离/表情/位置）"},
        "soul_injection": "通过灵魂注入模板定义AI伴侣人格、背景故事和交互风格",
    },
    {
        "id": "live2d_avatar",
        "name": "Live2D/VRM数字形象",
        "description": "基于AIRI设计：五感数字生命系统，支持Live2D和VRM模型动画、9种情绪表达、语音唇同步",
        "category": "数字伴侣",
        "version": "1.0.0",
        "author": "Moeru AI（Project AIRI）",
        "source": "github.com/moeru-ai/airi",
        "five_senses": {"ears": "语音识别(STT)", "mouth": "语音合成(TTS)", "body": "Live2D/VRM模型", "brain": "LLM对话", "eyes": "视觉感知"},
        "emotions": ["Happy", "Sad", "Angry", "Think", "Surprise", "Awkward", "Question", "Curious", "Neutral"],
        "animation": ["自动眨眼", "自动注视", "空闲眼动", "情绪动作", "唇同步"],
    },
    {
        "id": "ai_news_collector",
        "name": "AI新闻收集器",
        "description": "6维度分层搜索AI领域最新动态（周报/社区热度/产品发布/融资/研究/政策），输出15-25条热度排序新闻",
        "category": "信息获取",
        "version": "1.0.0",
        "author": "quincygunter",
        "source": "github.com/quincygunter/quincy-ai-news-collector",
        "dimensions": ["周报Newsletter", "社区热度", "产品与模型更新", "融资与商业", "研究突破", "监管与政策"],
        "news_sources": {
            "高价值周报": ["Last Week in AI", "Andrew Ng Weekly", "Ben's Bites", "TLDR AI"],
            "独立观点": ["Gary Marcus", "Simon Willison"],
            "主流媒体": ["TechCrunch", "The Verge", "MIT Tech Review", "机器之心", "量子位"],
            "社区信号": ["Hacker News", "r/LocalLLaMA", "Twitter/X"],
            "深度源": ["arXiv", "GitHub Trending", "OpenAI Blog", "Anthropic Blog"],
        },
    },
]


def _load_installed() -> list[dict]:
    if _SKILLS_PATH.exists():
        try:
            return json.loads(_SKILLS_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return []


def _save_installed(skills: list[dict]) -> None:
    os.makedirs(_SKILLS_PATH.parent, exist_ok=True)
    _SKILLS_PATH.write_text(json.dumps(skills, ensure_ascii=False, indent=2), encoding="utf-8")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/")
async def list_installed():
    """获取已安装技能列表。"""
    return {"success": True, "data": _load_installed()}


# Keep legacy path for backward compat
@router.get("/installed")
async def list_installed_legacy():
    """获取已安装技能列表（旧路径）。"""
    return {"success": True, "data": _load_installed()}


@router.get("/market")
async def skill_market(source: str = "openclaw", category: str | None = None, search: str | None = None):
    """技能市场浏览。"""
    skills = _MARKET_SKILLS
    if category:
        skills = [s for s in skills if s.get("category") == category]
    if search:
        q = search.lower()
        skills = [s for s in skills if q in s["name"].lower() or q in s["description"].lower()]
    return {
        "success": True,
        "data": {
            "source": source,
            "sources_available": [
                {"id": "openclaw", "name": "OpenClaw官方中文镜像", "url": "https://cn.clawhub-mirror.com/"},
                {"id": "cocoloop", "name": "CocoLoop技能市场", "url": "https://hub.cocoloop.cn/"},
            ],
            "skills": skills,
        },
    }


@router.post("/install")
async def install_skill(skill_id: str, source: str = "openclaw"):
    """安装技能。"""
    installed = _load_installed()
    # Check if already installed
    if any(s["id"] == skill_id for s in installed):
        return {"success": True, "data": {"skill_id": skill_id, "status": "already_installed"}}

    # Find in market catalogue or create minimal record
    market_record = next((s for s in _MARKET_SKILLS if s["id"] == skill_id), None)
    record = market_record.copy() if market_record else {
        "id": skill_id,
        "name": skill_id,
        "description": "",
        "category": "未知",
        "version": "0.0.1",
        "author": source,
    }
    record["status"] = "installed"
    installed.append(record)
    _save_installed(installed)
    return {"success": True, "data": {"skill_id": skill_id, "status": "installed"}}


@router.delete("/{skill_id}")
async def uninstall_skill(skill_id: str):
    """卸载技能。"""
    installed = _load_installed()
    new_list = [s for s in installed if s["id"] != skill_id]
    if len(new_list) == len(installed):
        raise HTTPException(status_code=404, detail=f"技能 {skill_id!r} 未安装")
    _save_installed(new_list)
    return {"success": True}
