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
    # ── 排行榜Top20精选 + 用户推荐 ─────────────────────────────
    {
        "id": "evermemos_memory",
        "name": "EverMemOS 长效记忆系统",
        "description": "自进化长期记忆OS：HyperMem超图索引(93%准确率碾压Mem0的78%)、Agentic多轮检索、5种记忆类型",
        "category": "记忆增强",
        "version": "1.0.0",
        "author": "EverMind-AI（4K★）",
        "source": "github.com/EverMind-AI/EverMemOS",
        "hypermem": {
            "三层结构": "Topic(主题)→Episode(事件)→Fact(事实)",
            "超边传播": "节点→超边→节点双向传播，融合多元关系信息",
            "双索引": "BM25稀疏(关键词3x权重)+FAISS密集(超边增强向量)",
        },
        "memory_types": ["EpisodeMemory(情节)", "AtomicFact(原子事实)", "Foresight(前景预测)", "AgentCase(代理案例)", "AgentSkill(代理技能)"],
        "retrieval_4modes": ["KEYWORD(jieba+ES)", "VECTOR(嵌入+Milvus)", "HYBRID(混合+重排)", "AGENTIC(LLM充分性判断+多轮精化)"],
        "benchmark": {"LoCoMo": "93.05%", "vs_Mem0": "+15%", "vs_Zep": "+21%"},
        "openagi_value": "超图索引可增强我们的L1温记忆检索；Agentic检索可用于build_system_context智能注入",
    },
    {
        "id": "voice_skills",
        "name": "语音对话+声音克隆+视频翻译",
        "description": "全功能语音技能包：实时语音对话、声音克隆（几秒音频即可复刻）、视频多语言翻译配音、实时新闻语音播报",
        "category": "语音交互",
        "version": "1.0.0",
        "author": "NoizAl（OpenClaw技能市场）",
        "source": "clawhub-mirror.com/NoizAl/skills",
        "capabilities": {
            "语音对话": "实时STT→LLM→TTS全链路语音交互",
            "声音克隆": "几秒音频样本即可复刻目标音色，支持多语言",
            "视频翻译": "提取视频语音→翻译→用克隆声音重新配音",
            "新闻播报": "聚合实时新闻→AI摘要→语音自动播报",
        },
        "openagi_integration": "增强数字伴侣(companion/)的语音能力，与TTS/STT模块对接",
    },
    {
        "id": "trading_agents",
        "name": "TradingAgents 多代理金融分析",
        "description": "模拟真实交易公司：4分析师+牛熊辩论+3风控辩论者+投资组合经理，多维度协作决策",
        "category": "金融分析",
        "version": "1.0.0",
        "author": "TauricResearch（50K★）",
        "source": "github.com/TauricResearch/TradingAgents",
        "agent_roles": {
            "分析师团队": ["基本面分析师", "情感分析师", "新闻分析师", "技术分析师"],
            "研究员团队": ["牛方(看涨)研究员", "熊方(看跌)研究员"],
            "风控团队": ["激进辩论者", "保守辩论者", "中立辩论者"],
            "决策层": ["交易员", "投资组合经理"],
        },
        "debate_mechanism": "牛熊结构化辩论：多轮交锋，各自维护独立论点历史，基于四维数据（基本面/情感/新闻/技术）",
        "risk_debate": "三方风控辩论：激进vs保守vs中立，对抗式论证寻找最优风险回报比",
        "decision_flow": "分析师→研究员辩论→交易员→风控辩论→投资组合经理审批",
        "openagi_value": "牛熊辩论模式可增强我们的三核审计对抗性：审计-外A=挑战者(熊) / 审计-外B=支持者(牛) / 审计-外C=中立评判",
    },
    {
        "id": "gsd_context_engineering",
        "name": "GSD上下文工程系统",
        "description": "解决'上下文腐烂'：任务原子化拆分+独立窗口隔离+8文档持久化+波形并行+XML验证",
        "category": "效率工具",
        "version": "1.0.0",
        "author": "gsd-build（53K★）",
        "source": "github.com/gsd-build/get-shit-done",
        "task_hierarchy": ["里程碑(Milestone)", "阶段(Phase)", "计划(Plan)", "原子任务(Atomic Task)"],
        "eight_docs": ["PROJECT.md", "REQUIREMENTS.md", "ROADMAP.md", "STATE.md", "research/", "PLAN.md", "SUMMARY.md", "CONTEXT.md"],
        "wave_execution": "依赖分析→同波并行→跨波串行，每任务独占200K窗口",
        "verify": "每个任务含<verify>标签，执行后自动检查",
        "commands": ["/gsd-new-project", "/gsd-plan-phase", "/gsd-execute-phase", "/gsd-verify-work", "/gsd-ship", "/gsd-quick", "/gsd-fast"],
    },
    {
        "id": "simplemem",
        "name": "SimpleMem 多模态长效记忆",
        "description": "三阶段管道（语义压缩→在线合成→意图检索），三层混合检索（向量+BM25+元数据），仅550 token达成43% F1",
        "category": "记忆增强",
        "version": "1.0.0",
        "author": "aiming-lab（3.2K★）",
        "source": "github.com/aiming-lab/SimpleMem",
        "pipeline": ["语义结构化压缩（过滤冗余）", "在线语义合成（合并相关记忆）", "意图感知检索规划（多视角并行）"],
        "retrieval": {"dense": "FAISS 1024维向量", "sparse": "BM25关键词", "symbolic": "时间/实体/人物元数据"},
        "benchmark": {"f1": "43.24%", "vs_mem0": "+26%", "build_time": "92.6s", "tokens_used": 550},
        "mcp_support": True,
    },
    {
        "id": "auto_research",
        "name": "AutoResearch 全自主研究",
        "description": "从想法到论文23阶段管道：范围界定→文献发现→知识合成→实验设计→执行→分析→论文撰写→最终化",
        "category": "学术研究",
        "version": "0.4.0",
        "author": "aiming-lab（11K★）",
        "source": "github.com/aiming-lab/AutoResearchClaw",
        "stages_8": ["A范围界定", "B文献发现", "C知识合成", "D实验设计", "E执行", "F分析决策", "G论文撰写", "H最终化"],
        "self_evolution": ["自我修复代码（10轮迭代）", "PIVOT/REFINE动态决策", "MetaClaw跨运行知识迁移（鲁棒+18.3%）"],
        "citation_verify": "四层引文验证（arXiv ID+DOI+Semantic Scholar+LLM评分）",
    },
    {
        "id": "oh_my_codex",
        "name": "Oh My Codex 团队编排",
        "description": "Agent团队并行协调：tmux持久工作树+HUD监控+分层Hook+角色关键字+深度访谈→计划→执行流程",
        "category": "开发工具",
        "version": "1.0.0",
        "author": "Yeachan-Heo（23K★）",
        "source": "github.com/Yeachan-Heo/oh-my-codex",
        "workflow": ["$deep-interview（需求澄清）", "$ralplan（计划生成）", "$ralph（单人执行）", "$team N:role（并行团队）"],
        "hud": "omx hud --watch 实时监控",
    },
    {
        "id": "magika_file_detect",
        "name": "Magika AI文件类型检测",
        "description": "Google开发：AI文件类型检测，5ms识别200+文件类型，准确率99%，仅几MB。已用于Gmail/Drive/安全浏览",
        "category": "系统工具",
        "version": "1.0.0",
        "author": "Google（github.com/google/magika）",
        "source": "github.com/google/magika",
        "performance": {"speed": "5ms/文件", "accuracy": "99%", "file_types": "200+", "model_size": "几MB"},
        "use_cases": ["上传文件类型验证", "安全扫描前置检测", "自动选择处理工具"],
    },
    {
        "id": "rtk_token_proxy",
        "name": "RTK Token代理",
        "description": "CLI代理减少LLM token消耗60-90%：单Rust二进制+零依赖，拦截开发命令输出并压缩后传给LLM",
        "category": "效率工具",
        "version": "1.0.0",
        "author": "rtk-ai（27K★）",
        "source": "github.com/rtk-ai/rtk",
        "saving": "60-90%",
        "tech": "Rust单二进制，零依赖",
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
