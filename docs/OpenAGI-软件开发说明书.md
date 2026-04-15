# OpenAGI 软件开发说明书

> 版本：v0.1.0 | 日期：2026-04-14 | 状态：正式版
> 配套文档：MVP核心架构图、骨架树思维导图、页面示意图

---

## 一、项目概述

### 1.1 产品定义

**OpenAGI** 是一个开源的AGI（通用人工智能）框架，核心特性包括：
- 可配置1-4核多AI治理引擎（执行CEO + 审计A/B/C）
- 永远记忆系统（四层记忆 + 三阶段梦境蒸馏）
- 心绪引擎（双轴情绪驱动全系统自适应）
- AI团队群聊（多AI成员@协作 + 讨论/工作模式切换）
- 巡检AI（定时+事件智能触发）
- 162位专家AI人格库（全中文）
- 免API浏览器搜索（CDP控制Chrome，36平台103命令）
- 数字伴侣系统（五感拟人化 + 5种亲密沟通模式）
- 技能自进化（闭合学习循环：记忆→技能→改进→闭环）

### 1.2 目标用户

普通用户（Web-First），增长靠SEO + 口碑 + 社交分享。

### 1.3 开源策略

完全开源（Apache-2.0），对标Supabase/PostHog模式——核心引擎全部开源，靠托管服务和企业版盈利。

### 1.4 技术栈

| 层级 | 技术 | 版本要求 |
|------|------|---------|
| 语言 | Python | ≥ 3.12 |
| Web框架 | FastAPI | ≥ 0.115 |
| LLM接入 | litellm | ≥ 1.50 |
| 数据验证 | Pydantic | ≥ 2.10 |
| 调度 | APScheduler | ≥ 3.10 |
| 向量DB | ChromaDB（MVP）→ pgvector | — |
| 数据库 | SQLite（MVP）→ PostgreSQL | — |
| 前端 | Next.js 15 + React 19 | Phase 4 |
| 容器 | Docker Compose | — |
| 包管理 | uv / pip | — |

---

## 二、目录结构规范

```
openagi/
├── openagi/                        # Python包根目录
│   ├── __init__.py                 # 版本号定义
│   │
│   ├── cortex/                     # Layer 2: Agent核心引擎
│   │   ├── __init__.py
│   │   ├── trinity/                # 多核治理引擎
│   │   │   ├── __init__.py
│   │   │   ├── types.py            # 类型定义（角色/阶段/任务/权限）
│   │   │   ├── engine.py           # 纯函数式引擎（任务生命周期+流水线）
│   │   │   ├── orchestrator.py     # LLM编排器（Prompt构建+多核调度）
│   │   │   └── prompts.py          # 角色Prompt模板库
│   │   ├── heart/                  # 心绪引擎
│   │   │   ├── __init__.py
│   │   │   └── entropy.py          # 双轴情绪系统（熵+效价）
│   │   ├── commander/              # 巡检AI
│   │   │   ├── __init__.py
│   │   │   ├── scheduler.py        # 定时+事件触发调度
│   │   │   └── inspector.py        # 巡检逻辑（信息收集+总结+指令生成）
│   │   ├── loop/                   # 执行循环
│   │   │   ├── __init__.py
│   │   │   ├── react.py            # ReAct+Plan执行循环
│   │   │   └── evolution.py        # 自主进化循环
│   │   └── llm/                    # LLM大脑层
│   │       ├── __init__.py
│   │       ├── router.py           # 多模型路由器
│   │       ├── relay.py            # 中转站管理（添加/测试/故障转移）
│   │       └── pool.py             # API池（主模型+回退链）
│   │
│   ├── memory/                     # Layer 3: 记忆系统
│   │   ├── __init__.py
│   │   ├── working.py              # L0 热记忆（当前对话上下文）
│   │   ├── recent.py               # L1 温记忆（向量DB + 时间衰退）
│   │   ├── archive.py              # L2 冷记忆（SQLite持久化）
│   │   ├── core_dna.py             # L3 核心DNA（永不衰减）
│   │   ├── distill/                # 三阶段梦境蒸馏
│   │   │   ├── __init__.py
│   │   │   ├── light_sleep.py      # 轻睡眠（每2h，概念提取）
│   │   │   ├── rem_sleep.py        # REM（每6h，关联发现）
│   │   │   └── deep_dreaming.py    # 深度梦境（每24h，综合蒸馏）
│   │   ├── search.py               # 混合检索（BM25+向量+MMR）
│   │   └── governance/             # 治理账本
│   │       ├── __init__.py
│   │       ├── ledger.py
│   │       ├── scoring.py
│   │       └── persistence.py
│   │
│   ├── ghost/                      # Layer 4: 永生与分布式
│   │   ├── __init__.py
│   │   ├── heartbeat.py            # 心跳调度器（熵驱动自适应）
│   │   ├── state_sync.py           # 状态持久化+恢复
│   │   └── health.py               # 健康检查+崩溃恢复
│   │
│   ├── tools/                      # Layer 5: 工具与扩展
│   │   ├── __init__.py
│   │   ├── registry.py             # 动态工具注册表
│   │   ├── executor.py             # 沙盒代码执行器
│   │   ├── browser/                # 免API浏览器搜索
│   │   │   ├── __init__.py
│   │   │   ├── cdp.py              # Chrome DevTools Protocol控制
│   │   │   └── platforms.py        # 36平台103命令
│   │   ├── hooks/                  # Hook系统
│   │   │   ├── __init__.py
│   │   │   ├── manager.py          # Hook管理器
│   │   │   └── builtin.py          # 内置Hook
│   │   ├── mcp/                    # MCP集成
│   │   │   ├── __init__.py
│   │   │   └── client.py           # MCP客户端
│   │   └── plugins/                # 插件目录
│   │       ├── __init__.py
│   │       └── economy/            # 经济插件（未来）
│   │
│   ├── social/                     # Layer 5基础: 治理+权限
│   │   ├── __init__.py
│   │   ├── constitution/
│   │   │   └── core.py             # 宪法系统（L0-L4权限规则）
│   │   ├── permissions/
│   │   │   └── fuse.py             # 权限熔断矩阵
│   │   └── persona/                # 人格系统
│   │       ├── __init__.py
│   │       ├── engine.py           # 人格管理器
│   │       ├── presets.py          # 6种预设人格
│   │       └── experts.py          # 162位专家模板
│   │
│   ├── companion/                  # 数字伴侣系统
│   │   ├── __init__.py
│   │   ├── tts.py                  # 文字转语音（Piper/Coqui）
│   │   ├── stt.py                  # 语音识别（Whisper.cpp）
│   │   ├── avatar.py               # 形象管理
│   │   ├── selfie.py               # AI自拍系统
│   │   └── relationship.py         # 亲密沟通模式
│   │
│   ├── chat/                       # 聊天系统
│   │   ├── __init__.py
│   │   ├── session.py              # 会话管理
│   │   ├── deep.py                 # 深度聊天模式
│   │   ├── group/                  # AI团队群聊
│   │   │   ├── __init__.py
│   │   │   ├── room.py             # 群聊房间
│   │   │   ├── mention.py          # @机制
│   │   │   └── mode.py             # 讨论↔工作模式切换
│   │   └── skills/                 # 技能系统
│   │       ├── __init__.py
│   │       ├── engine.py           # 技能引擎
│   │       ├── market.py           # 技能市场（OpenClaw镜像/CocoLoop）
│   │       └── learning.py         # 闭合学习循环
│   │
│   ├── api/                        # API层
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI入口
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── trinity.py          # 多核治理API
│   │   │   ├── chat.py             # 聊天API
│   │   │   ├── memory.py           # 记忆API
│   │   │   ├── settings.py         # 设置API
│   │   │   ├── skills.py           # 技能API
│   │   │   └── health.py           # 健康检查API
│   │   ├── ws/
│   │   │   └── chat.py             # WebSocket聊天
│   │   └── middleware/
│   │       ├── __init__.py
│   │       └── auth.py             # 认证中间件
│   │
│   └── comms/                      # 通信适配
│       ├── __init__.py
│       ├── telegram.py             # Telegram Bot
│       └── gateway.py              # 统一消息网关
│
├── tests/                          # 测试
│   ├── __init__.py
│   ├── cortex/                     # 核心引擎测试
│   │   ├── test_engine.py          # Trinity引擎测试（已有13个通过）
│   │   ├── test_orchestrator.py
│   │   ├── test_heart.py
│   │   └── test_commander.py
│   ├── memory/                     # 记忆系统测试
│   │   ├── test_working.py
│   │   ├── test_recent.py
│   │   ├── test_distill.py
│   │   └── test_search.py
│   ├── tools/                      # 工具测试
│   ├── social/                     # 治理测试
│   └── api/                        # API测试
│
├── docs/                           # 文档
│   ├── MVP_CORE_ARCHITECTURE.md    # 架构图（20章）
│   ├── OpenAGI-软件开发说明书.md    # 本文件
│   └── openagi骨架树/              # 示意图和骨架树
│
├── data/                           # 运行时数据（.gitignore）
│   ├── memory.db                   # SQLite记忆库
│   ├── chroma/                     # 向量DB
│   └── state/                      # 状态快照
│
├── pyproject.toml                  # 项目配置
├── Dockerfile                      # 容器配置
├── docker-compose.yml              # 编排配置
├── README.md                       # 项目说明
├── LICENSE                         # Apache-2.0
└── .gitignore
```

---

## 三、编码规范

### 3.1 Python风格

- **版本**：Python 3.12+，使用最新语法特性
- **类型注解**：所有公开函数和方法必须有类型注解
- **Docstring**：所有模块、类、公开函数必须有中文Docstring
- **格式化**：ruff format（行宽120）
- **Lint**：ruff check
- **Import排序**：isort规则（标准库/第三方/本地）

```python
"""模块级Docstring：一句话说明模块功能。"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from openagi.cortex.trinity.types import TrinityRole


@dataclass
class Example:
    """类Docstring：说明类的用途。"""
    
    name: str
    value: int = 0

    def process(self, data: dict[str, Any]) -> str:
        """方法Docstring：说明方法功能、参数和返回值。"""
        ...
```

### 3.2 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 模块 | snake_case | `light_sleep.py` |
| 类 | PascalCase | `TrinityEngine` |
| 函数 | snake_case | `run_proposal_phase()` |
| 常量 | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| 私有 | 前缀下划线 | `_internal_helper()` |
| 数据类 | PascalCase + @dataclass | `@dataclass class TrinityTask` |
| 枚举 | PascalCase + StrEnum | `class TrinityRole(StrEnum)` |

### 3.3 面向中国用户的命名

UI层和用户可见文本使用中国化命名：

| 英文代号 | 中文显示名 | 代码变量名 |
|---------|-----------|-----------|
| Core-0 Executor | 执行CEO | `EXECUTOR_CEO` |
| Core-1 Auditor A | 审计A | `AUDITOR_A` |
| Core-2 Auditor B | 审计B | `AUDITOR_B` |
| Core-3 Auditor C | 审计C | `AUDITOR_C` |
| Commander | 巡检CEO | `COMMANDER_CEO` |
| Working Memory | 热记忆 | `working_memory` |
| Recent Memory | 温记忆 | `recent_memory` |
| Archive Memory | 冷记忆 | `archive_memory` |
| Core DNA | 核心DNA | `core_dna` |

### 3.4 错误处理

```python
# 使用自定义异常层级
class OpenAGIError(Exception):
    """OpenAGI基础异常。"""

class LLMError(OpenAGIError):
    """LLM调用相关异常。"""

class PermissionDeniedError(OpenAGIError):
    """权限不足异常。"""

class MemoryError(OpenAGIError):
    """记忆系统异常。"""

# 永远不要吞掉异常，至少要记录
try:
    result = await llm_call(...)
except LLMError as e:
    logger.error(f"LLM调用失败: {e}")
    heart_engine.record_event("llm_call_failed")
    raise
```

### 3.5 日志规范

```python
import logging

logger = logging.getLogger(__name__)

# 级别使用规范
logger.debug("内部调试信息")           # 开发调试用
logger.info("正常操作记录")             # 关键操作节点
logger.warning("需要关注但不影响运行")    # 异常但可恢复
logger.error("错误，影响功能")           # 需要处理的错误
logger.critical("严重错误，系统可能崩溃") # 紧急情况
```

---

## 四、核心模块开发规范

### 4.1 多核治理引擎

**设计原则**：纯函数式，所有状态通过参数传入和返回值传出，无副作用。

```python
# 正确：纯函数，输入→输出
def advance_task_phase(task: TrinityTask) -> TrinityTask:
    return replace(task, phase=next_phase, status=next_status)

# 错误：有副作用
def advance_task_phase(task: TrinityTask) -> None:
    task.phase = next_phase  # 修改了输入参数
    db.save(task)            # 产生了副作用
```

**核心数配置**：
```python
@dataclass
class MultiCoreConfig:
    """多核治理配置。"""
    
    core_count: int = 2  # 1-4
    executor: CoreConfig = field(default_factory=lambda: CoreConfig(
        role="执行CEO", model="claude-sonnet-4", temperature=0.7
    ))
    auditors: list[CoreConfig] = field(default_factory=list)
    commander: CoreConfig | None = None  # 巡检CEO
    auto_escalate: bool = True  # 权限自动升核
```

### 4.2 记忆系统

**四层隔离**：每层有独立的存储后端和访问模式。

```python
class MemoryManager:
    """统一记忆管理器，协调四层记忆。"""
    
    def __init__(self):
        self.working = WorkingMemory()      # L0: 内存dict
        self.recent = RecentMemory()        # L1: ChromaDB向量
        self.archive = ArchiveMemory()      # L2: SQLite
        self.core_dna = CoreDNA()           # L3: JSON文件
    
    async def recall(self, query: str, layers: list[str] = None) -> list[Memory]:
        """跨层检索记忆。"""
        ...
    
    async def store(self, content: str, layer: str = "working") -> str:
        """存储新记忆到指定层。"""
        ...
```

**蒸馏调度**：由心跳调度器触发，不在主线程执行。

### 4.3 心绪引擎

**事件驱动**：所有子系统通过事件影响熵值。

```python
class HeartEngine:
    """双轴情绪引擎。"""
    
    ENTROPY_EVENTS = {
        "llm_call_success": -0.02,
        "llm_call_failed": +0.05,
        "task_completed": -0.03,
        "task_failed": +0.08,
        "user_praise": -0.05,
        "system_idle": -0.04,
        "crisis_detected": +0.15,
    }
    
    def record_event(self, event: str) -> None:
        """记录事件，更新熵值和效价。"""
        delta = self.ENTROPY_EVENTS.get(event, 0)
        self.entropy = max(0, min(1, self.entropy + delta))
    
    @property
    def level(self) -> str:
        if self.entropy <= 0.20: return "calm"
        if self.entropy <= 0.55: return "focused"
        if self.entropy <= 0.80: return "anxious"
        return "crisis"
```

### 4.4 API设计规范

**RESTful + WebSocket并用**：

```python
# RESTful端点
POST   /api/v1/chat/send          # 发送消息
GET    /api/v1/chat/history/{id}   # 获取历史
POST   /api/v1/trinity/run         # 运行多核治理
GET    /api/v1/memory/search       # 搜索记忆
GET    /api/v1/settings             # 获取设置
PUT    /api/v1/settings             # 更新设置
GET    /api/v1/health               # 健康检查

# WebSocket端点
WS     /ws/chat                    # 实时聊天
WS     /ws/status                  # 状态推送（心绪/巡检/蒸馏）
```

**统一响应格式**：
```python
class APIResponse(BaseModel):
    success: bool
    data: Any = None
    error: str | None = None
    timestamp: str
```

---

## 五、测试规范

### 5.1 测试结构

每个模块对应一个测试文件，测试函数以 `test_` 开头。

```python
# tests/cortex/test_engine.py
def test_create_task():
    """测试任务创建。"""
    task = create_task("Test", "Description")
    assert task.phase == TrinityPhase.PROPOSAL

def test_full_pipeline_happy_path():
    """端到端测试：完整的proposal→audit→approval流程。"""
    ...
```

### 5.2 覆盖率要求

| 模块 | 最低覆盖率 |
|------|-----------|
| cortex/trinity/ | 90% |
| memory/ | 80% |
| social/constitution/ | 90% |
| api/ | 70% |
| 其他 | 60% |

### 5.3 运行测试

```bash
# 运行全部测试
python -m pytest tests/ -v

# 运行特定模块
python -m pytest tests/cortex/ -v

# 带覆盖率报告
python -m pytest tests/ --cov=openagi --cov-report=html
```

---

## 六、部署规范

### 6.1 Docker

```yaml
# docker-compose.yml
services:
  openagi:
    build: .
    ports:
      - "8888:8888"
    volumes:
      - ./data:/app/data
    environment:
      - OPENAGI_LOG_LEVEL=INFO
    restart: unless-stopped
```

### 6.2 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENAGI_PORT` | API端口 | 8888 |
| `OPENAGI_LOG_LEVEL` | 日志级别 | INFO |
| `OPENAGI_DATA_DIR` | 数据目录 | ~/.openagi |
| `OPENAGI_DEFAULT_MODEL` | 默认LLM模型 | — |
| `ANTHROPIC_API_KEY` | Claude API Key | — |
| `OPENAI_API_KEY` | OpenAI API Key | — |

### 6.3 启动方式

```bash
# 开发模式
uvicorn openagi.api.main:app --reload --port 8888

# 生产模式
docker compose up -d

# 一键安装（未来）
curl -fsSL https://openagi.dev/install.sh | bash
```

---

## 七、Git规范

### 7.1 分支策略

| 分支 | 用途 |
|------|------|
| `main` | 稳定发布版 |
| `develop` | 开发集成 |
| `feature/xxx` | 功能分支 |
| `fix/xxx` | 修复分支 |

### 7.2 Commit格式

```
<type>(<scope>): <description>

类型: feat / fix / docs / style / refactor / test / chore
范围: trinity / memory / heart / api / ui / ...

示例:
feat(trinity): 添加可配置多核治理引擎
fix(memory): 修复温记忆时间衰退计算错误
docs(readme): 更新安装指南
```

---

## 八、可复用资产索引

### 8.1 直接复用（Python，无需移植）

| 模块 | 来源 | 路径 | 行数 |
|------|------|------|------|
| 心绪引擎 | openagi_m2 | heart/entropy.py | 248 |
| 永久记忆 | openagi_m2 | cortex/memory_manager.py | 328 |
| 持久化存储 | openagi_m2 | cortex/persistent_memory.py | 391 |
| 因果追踪 | openagi_m2 | cortex/causal_tracker.py | 203 |
| 进化追踪 | openagi_m2 | cortex/evolution_tracker.py | 231 |
| 能量系统 | openagi_m2 | cortex/energy_system.py | 123 |
| 共鸣指数 | openagi_m2 | cortex/resonance_meter.py | 233 |
| 调度器 | openagi_m2 | ghost/scheduler.py | 216 |
| 代码执行 | openagi_m2 | soul/action_executor.py | 245 |
| 屏幕截图 | openagi_m2 | flesh/visual.py | 245 |
| Telegram | openagi_m2 | soul/comms.py | 649 |

### 8.2 需移植（TypeScript → Python）

| 模块 | 来源 | 路径 | 行数 | 优先级 |
|------|------|------|------|--------|
| Trinity引擎 | NewClaw v6 | engine.ts | 336 | P0 |
| Trinity编排器 | NewClaw v6 | trinity-orchestrator.ts | 254 | P0 |
| 宪法系统 | NewClaw v6 | constitution.ts | 143 | P0 |
| 熔断矩阵 | NewClaw v6 | fuse-matrix.ts | 258 | P0 |
| 经济引擎 | NewClaw v6 | economy.ts | 449 | P1（插件） |
| 治理账本 | NewClaw v6 | ledger.ts | 279 | P1 |
| 治理评分 | NewClaw v6 | governance-scoring.ts | 339 | P1 |
| 短期提升算法 | OpenClaw | short-term-promotion.ts | 1598 | P1 |
| 梦境蒸馏 | OpenClaw | dreaming*.ts | 2277 | P1 |
| 混合搜索 | OpenClaw | hybrid.ts + mmr.ts | 403 | P1 |
| 时间衰退 | OpenClaw | temporal-decay.ts | 167 | P1 |
| 概念提取 | OpenClaw | concept-vocabulary.ts | 471 | P2 |

### 8.3 参考设计（不直接移植，参考架构）

| 能力 | 来源 | 参考点 |
|------|------|--------|
| 闭合学习循环 | Hermes Agent | 技能自创建+自改进机制 |
| 23种工具标准 | Claude Code | sdk-tools.d.ts接口定义 |
| Hook系统 | Claude Code/OpenClaw | 事件钩子框架 |
| MCP集成 | Claude Code | 标准化工具协议 |
| CDP浏览器 | bb-browser | Chrome控制+eval注入 |
| 群聊协作 | OpenTeams | @机制+模式切换 |
| 五感系统 | AIRI | Live2D/VRM+语音 |
| AI自拍 | Clawra | 触发条件+模式（免费化） |
| 专家人格 | Agency Agents | 162位专家定义 |

---

## 九、开发优先级与里程碑

### MVP（v0.1.0）必须完成

| 优先级 | 模块 | 交付标准 |
|--------|------|---------|
| P0 | 多核治理引擎 | 1-4核可配置，权限自动升核，13+测试通过 |
| P0 | LLM路由器 | 中转站管理，主模型+回退链，故障转移 |
| P0 | 心绪引擎 | 双轴情绪，17种事件，4级状态 |
| P0 | 四层记忆 | 热/温/冷/DNA，基础CRUD |
| P0 | FastAPI | 核心API端点，WebSocket聊天 |
| P1 | 巡检AI | 定时+事件触发，智能等待，草稿/自动模式 |
| P1 | 人格系统 | 6预设+162专家+自定义 |
| P1 | 三阶段蒸馏 | Light/REM/Deep，梦境日记 |
| P1 | 混合检索 | BM25+向量+MMR+时间衰退 |
| P2 | 群聊系统 | @机制，讨论/工作模式 |
| P2 | 技能系统 | 市场浏览，安装/卸载 |
| P2 | 浏览器引擎 | CDP控制，核心搜索命令 |
| P2 | 永生层 | 心跳+持久化+崩溃恢复 |
| P3 | 数字伴侣 | 基础TTS/STT+5种沟通模式 |
| P3 | 消息网关 | Telegram集成 |

### v0.2.0 增强版

- 经济系统（插件）
- Web前端（Next.js）
- 更多消息平台
- 技能自进化
- AI自拍

---

## 十、安全规范

### 10.1 绝对禁止（L4）

- 绕过权限约束
- 删除治理账本
- 修改宪法核心规则（需人工确认）
- 访问银行/支付密码页面

### 10.2 需人工确认（L3）

- 真实钱包操作
- 外部合约签署
- 删除用户数据
- 修改系统配置

### 10.3 敏感信息检测

自动扫描以下模式，检测到则阻止操作：
- AWS/GCP/Azure密钥
- GitHub/GitLab Token
- 私钥文件内容
- 数据库连接字符串
- 用户密码明文

---

*本文档随项目迭代持续更新。最新版本始终在 `docs/OpenAGI-软件开发说明书.md`。*
