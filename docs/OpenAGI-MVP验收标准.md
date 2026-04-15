# OpenAGI MVP 核心骨架树 — 验收标准 v1.0

> **版本**：v1.0 | **日期**：2026-04-15 | **基于**：OpenAGI-MVP核心骨架树-思维导图.html
> **目标**：为 OpenAGI MVP 发布提供可执行的验收清单，明确每个模块的通过标准

---

## 状态标记说明

| 标记 | 含义 | 升级条件 |
|------|------|---------|
| ✅ 通过 | 功能实现 + 测试覆盖 + 可运行 | — |
| ⚠️ 部分通过 | 核心功能实现，边缘用例缺失 | 补齐缺失项后升 ✅ |
| ❌ 未通过 | 有代码但功能错误/测试失败 | 修复后重验 |
| 🔲 未开始 | 无实现代码 | 实现后从 ❌ 起步 |

**MVP 发布门槛**：所有「必须」项达到 ✅ 或 ⚠️，无 ❌，无阻塞性 🔲

---

## Part 1：后端模块验收表

### Layer 1：LLM 大脑层 ★★★

| 子模块 | 源文件 | 功能验收 | 测试验收 | 集成验收 | API验收 | MVP必须 | 缺失项 |
|--------|--------|----------|----------|----------|---------|---------|--------|
| 多模型路由器 | `cortex/llm/router.py` (416行) | ✅ | ✅ | ✅ | ⚠️ | 必须 | `/api/v1/models` 端点需连通 |
| 中转站管理 | `cortex/llm/router.py` | ✅ | ✅ | ✅ | ⚠️ | 必须 | `/api/v1/models/relays` 需补全 |
| API 池故障转移 | `cortex/llm/router.py` | ✅ | ✅ | ⚠️ | ⚠️ | 必须 | 真实多 Provider 联调未验证 |
| 情绪感知 Prompt | `cortex/heart/entropy.py` | ✅ | ✅ | ⚠️ | ⚠️ | 必须 | 温度参数注入 LLM 调用需验证 |
| Token 预算管理 | `cortex/llm/router.py` | ⚠️ | ⚠️ | 🔲 | 🔲 | 可选 | 危机模式自动压缩未实现 |

**Layer 1 小结**：路由核心 ✅，API 层对接 ⚠️，预算管理待补

---

### Layer 2：Agent 核心引擎 ★★★★

| 子模块 | 源文件 | 功能验收 | 测试验收 | 集成验收 | API验收 | MVP必须 | 缺失项 |
|--------|--------|----------|----------|----------|---------|---------|--------|
| 1-4核治理引擎 | `cortex/trinity/engine.py` (240行) | ✅ | ✅ | ✅ | ⚠️ | **必须** | API 路由桩需接真实逻辑 |
| Trinity Orchestrator | `cortex/trinity/orchestrator.py` (198行) | ✅ | ✅ | ✅ | ⚠️ | **必须** | 同上 |
| 心绪引擎 HeartEngine | `cortex/heart/entropy.py` (258行) | ✅ | ✅ | ⚠️ | ⚠️ | **必须** | 心绪→温度注入链路需端到端验证 |
| ReAct+Plan 执行循环 | `cortex/loop/` | 🔲 | 🔲 | 🔲 | 🔲 | **必须** | **⚠️ 最大阻塞项：目录为空，需实现** |
| 权限自动升核 | `social/constitution/core.py` (169行) | ⚠️ | 🔲 | 🔲 | 🔲 | **必须** | 升核逻辑存在但测试缺失 |
| 自主进化循环 | `chat/skills/learning.py` (429行) | ✅ | ✅ | ⚠️ | ⚠️ | 可选 | 与 DNA 更新链路未打通 |
| 上下文压缩引擎 | `memory/manager.py` | ⚠️ | ⚠️ | 🔲 | 🔲 | 可选 | 60-80% 压缩目标未验证 |

**Layer 2 小结**：Trinity 核心 ✅，**ReAct Loop ❌ 阻塞 MVP 发布**

---

### Layer 3：永远记忆系统 ★★★★

| 子模块 | 源文件 | 功能验收 | 测试验收 | 集成验收 | API验收 | MVP必须 | 缺失项 |
|--------|--------|----------|----------|----------|---------|---------|--------|
| L0 热记忆 | `memory/working.py` (93行) | ✅ | ✅ | ✅ | ✅ | **必须** | — |
| L1 温记忆 | `memory/recent.py` (344行) | ✅ | ✅ | ⚠️ | 🔲 | **必须** | ChromaDB 初始化性能需优化 |
| L2 冷记忆 | `memory/archive.py` (154行) | ✅ | ✅ | ✅ | ⚠️ | **必须** | search API 端点需补全 |
| L3 核心 DNA | `memory/core_dna.py` (166行) | ✅ | ✅ | ⚠️ | ⚠️ | **必须** | DNA→prompt 注入链需端到端验证 |
| 记忆统一管理器 | `memory/manager.py` (342行) | ✅ | ✅ | ⚠️ | ✅ | **必须** | 跨层流转测试不足 |
| 混合检索引擎 | `memory/search.py` (405行) | ✅ | ✅ | ⚠️ | ⚠️ | **必须** | BM25+向量+MMR 联合检索需压测 |
| Phase 1 轻睡蒸馏 | `memory/distill/light_sleep.py` (338行) | ✅ | ✅ | ⚠️ | 🔲 | **必须** | 调度触发链路未接入心跳 |
| Phase 2 REM 蒸馏 | `memory/distill/rem_sleep.py` (349行) | ✅ | ✅ | ⚠️ | 🔲 | 可选 | 可降级为 MVP 后迭代 |
| Phase 3 深度蒸馏 | `memory/distill/deep_dreaming.py` (495行) | ✅ | ✅ | ⚠️ | 🔲 | 可选 | 需 LLM API Key，MVP 可 Mock |
| 梦境日记 | `memory/distill/deep_dreaming.py` | ✅ | ✅ | 🔲 | 🔲 | 可选 | 每日生成未接调度器 |
| 记忆治理 | `memory/governance/` | 🔲 | 🔲 | 🔲 | 🔲 | 不阻塞 | Phase 2 实现 |

**Layer 3 小结**：四层记忆核心 ✅，三阶段蒸馏 ✅，调度集成 ⚠️

---

### Layer 4：永生与分布式层 ★★★

| 子模块 | 源文件 | 功能验收 | 测试验收 | 集成验收 | API验收 | MVP必须 | 缺失项 |
|--------|--------|----------|----------|----------|---------|---------|--------|
| 心跳调度器 | `ghost/heartbeat.py` (226行) | ✅ | ✅ | ⚠️ | 🔲 | **必须** | 蒸馏触发链路需验证 |
| 状态同步引擎 | `ghost/heartbeat.py` | ⚠️ | ⚠️ | 🔲 | 🔲 | **必须** | SQLite 持久化存在，Redis 同步待 Phase 2 |
| 部署编排器 | `docker-compose.yml` | ⚠️ | 🔲 | 🔲 | 🔲 | **必须** | Docker 构建未验证 |
| 崩溃恢复 | `ghost/heartbeat.py` | ⚠️ | ⚠️ | 🔲 | 🔲 | **必须** | 自动重启+状态恢复需集成测试 |
| 跨节点同步 | — | 🔲 | 🔲 | 🔲 | 🔲 | 不阻塞 | Phase 2：Redis+rsync |

**Layer 4 小结**：心跳核心 ✅，分布式同步 🔲（Phase 2）

---

### Layer 5：工具与扩展层 ★★★

| 子模块 | 源文件 | 功能验收 | 测试验收 | 集成验收 | API验收 | MVP必须 | 缺失项 |
|--------|--------|----------|----------|----------|---------|---------|--------|
| 动态工具注册表 | `tools/registry.py` (184行) | ✅ | ✅ | ✅ | 🔲 | **必须** | — |
| 沙盒代码执行器 | `tools/executor.py` (395行) | ✅ | ✅ | ✅ | 🔲 | **必须** | 危险命令检测需补充用例 |
| Hook 管理器 | `tools/hooks/manager.py` (420行) | ✅ | ✅ | ⚠️ | 🔲 | **必须** | 敏感信息检测已实现 |
| Hook 内置处理器 | `tools/hooks/builtin.py` (208行) | ✅ | ✅ | ⚠️ | 🔲 | **必须** | — |
| MCP 客户端 | `tools/mcp/client.py` (517行) | ✅ | ✅ | ⚠️ | 🔲 | 可选 | 真实 MCP Server 联调未验证 |
| CDP 浏览器驱动 | `tools/browser/cdp.py` (258行) | ✅ | ✅ | ⚠️ | 🔲 | 可选 | 需本地 Chrome 环境 |
| 36 平台搜索 | `tools/browser/platforms.py` (839行) | ✅ | ✅ | ⚠️ | 🔲 | 可选 | CDP+urllib 双通道需验证 |
| 插件管理器 | — | 🔲 | 🔲 | 🔲 | 🔲 | 不阻塞 | Phase 2 |

**Layer 5 小结**：工具核心 ✅，MCP/浏览器 ⚠️，插件管理器 🔲

---

### 巡检 AI（Commander Core）★★★

| 子模块 | 源文件 | 功能验收 | 测试验收 | 集成验收 | API验收 | MVP必须 | 缺失项 |
|--------|--------|----------|----------|----------|---------|---------|--------|
| 定时触发 | `cortex/commander/inspector.py` (286行) | ✅ | ✅ | ⚠️ | ✅ | **必须** | — |
| 事件触发（6 类） | `cortex/commander/inspector.py` | ✅ | ✅ | ⚠️ | ✅ | **必须** | entropy:crisis 联动需验证 |
| 草稿/自动执行模式 | `cortex/commander/inspector.py` | ✅ | ✅ | ⚠️ | ✅ | **必须** | — |
| 智能等待（不打断）| `cortex/commander/inspector.py` | ✅ | ⚠️ | ⚠️ | ✅ | **必须** | 并发任务检测需测试 |

**巡检 AI 小结**：全部 ✅/⚠️，集成测试需补充

---

### 人格系统（Persona Engine）★★★

| 子模块 | 源文件 | 功能验收 | 测试验收 | 集成验收 | API验收 | MVP必须 | 缺失项 |
|--------|--------|----------|----------|----------|---------|---------|--------|
| 6 种预设人格 | `social/persona/engine.py` (389行) | ✅ | ✅ | ✅ | ✅ | **必须** | — |
| 162 专家 AI 模板 | `social/persona/engine.py` | ✅ | ✅ | ✅ | ✅ | **必须** | 当前实现 ≥90 位，目标 162 位 |
| 自定义人格 | `social/persona/engine.py` | ✅ | ✅ | ✅ | ✅ | **必须** | JSON 持久化已实现 |
| 一键复制人格 | `social/persona/engine.py` | ✅ | ✅ | ⚠️ | ✅ | 可选 | 前端 UI 待实现 |

**人格系统小结**：后端全 ✅，专家数量需从 90+ 补充到 162

---

### 聊天系统 ★★★★

| 子模块 | 源文件 | 功能验收 | 测试验收 | 集成验收 | API验收 | MVP必须 | 缺失项 |
|--------|--------|----------|----------|----------|---------|---------|--------|
| 会话管理 | `chat/session.py` (286行) | ✅ | ✅ | ✅ | ⚠️ | **必须** | API 路由桩需接真实逻辑 |
| 深度聊天（1-4 核）| `chat/deep.py` (349行) | ✅ | ✅ | ✅ | ⚠️ | **必须** | API 路由桩 |
| 群聊房间 | `chat/group/room.py` (311行) | ✅ | ✅ | ⚠️ | 🔲 | **必须** | 缺独立 API 端点 |
| @ 机制 | `chat/group/mention.py` (261行) | ✅ | ✅ | ⚠️ | 🔲 | **必须** | — |
| 讨论↔工作模式 | `chat/group/mode.py` (376行) | ✅ | ✅ | ⚠️ | 🔲 | **必须** | — |
| DAG 任务调度 | `chat/group/mode.py` | ⚠️ | ⚠️ | 🔲 | 🔲 | 可选 | 并行 DAG 执行需专项测试 |

**聊天系统小结**：核心逻辑 ✅，API 层对接 ⚠️

---

### 技能系统（Skill Engine）★★★

| 子模块 | 源文件 | 功能验收 | 测试验收 | 集成验收 | API验收 | MVP必须 | 缺失项 |
|--------|--------|----------|----------|----------|---------|---------|--------|
| 技能引擎 | `chat/skills/engine.py` (353行) | ✅ | ✅ | ⚠️ | ⚠️ | **必须** | API 路由桩 |
| 技能市场（OpenClaw + CocoLoop）| `chat/skills/market.py` (347行) | ✅ | ✅ | ⚠️ | ⚠️ | 可选 | 真实 HTTP 源未验证 |
| 闭合学习循环（≥3 次触发）| `chat/skills/learning.py` (429行) | ✅ | ✅ | ⚠️ | 🔲 | 可选 | — |

**技能系统小结**：引擎 ✅，市场联网 ⚠️

---

### 免 API 浏览器搜索（Browser Engine）★★★

| 子模块 | 源文件 | 功能验收 | 测试验收 | 集成验收 | API验收 | MVP必须 | 缺失项 |
|--------|--------|----------|----------|----------|---------|---------|--------|
| CDP 驱动 | `tools/browser/cdp.py` (258行) | ✅ | ✅ | ⚠️ | 🔲 | 可选 | 需本地 Chrome 安装 |
| 36 平台 103 命令 | `tools/browser/platforms.py` (839行) | ✅ | ✅ | ⚠️ | 🔲 | 可选 | CDP 优先，urllib 降级 |
| 权限分级（L0-L4）| `tools/browser/platforms.py` | ✅ | ✅ | ⚠️ | 🔲 | 可选 | — |
| 结果写入温记忆 | — | 🔲 | 🔲 | 🔲 | 🔲 | 可选 | 与 memory/recent 联动未实现 |

**浏览器引擎小结**：CDP 核心 ✅，记忆联动 🔲

---

### 宪法与权限系统 ★★★

| 子模块 | 源文件 | 功能验收 | 测试验收 | 集成验收 | API验收 | MVP必须 | 缺失项 |
|--------|--------|----------|----------|----------|---------|---------|--------|
| L0-L4 权限规则 | `social/constitution/core.py` (169行) | ⚠️ | 🔲 | 🔲 | 🔲 | **必须** | 测试用例缺失，集成验证为零 |
| 宪法约束 6 条 | `social/constitution/core.py` | ⚠️ | 🔲 | 🔲 | 🔲 | **必须** | 同上 |
| 敏感信息检测 | `tools/hooks/builtin.py` | ✅ | ✅ | ⚠️ | 🔲 | **必须** | AWS Key/GitHub Token 检测已实现 |
| 熔断矩阵（fuse-matrix）| `social/permissions/` | 🔲 | 🔲 | 🔲 | 🔲 | **必须** | **目录为空，需实现** |

**宪法系统小结**：规则定义 ⚠️，熔断矩阵 🔲 阻塞安全验收

---

### 数字伴侣系统（Persona Embodiment）★★★

| 子模块 | 源文件 | 功能验收 | 测试验收 | 集成验收 | API验收 | MVP必须 | 缺失项 |
|--------|--------|----------|----------|----------|---------|---------|--------|
| TTS 语音合成（Mock）| `companion/tts.py` (499行) | ✅ | ✅ | ⚠️ | 🔲 | 可选 | Mock 可用，Piper/Coqui 待接入 |
| STT 语音识别（Mock）| `companion/stt.py` (536行) | ✅ | ✅ | ⚠️ | 🔲 | 可选 | Mock 可用，Whisper.cpp 待接入 |
| 虚拟形象管理 | `companion/avatar.py` (543行) | ✅ | ✅ | ⚠️ | 🔲 | 可选 | Live2D/VRM 待前端集成 |
| 亲密度系统（5 模式）| `companion/relationship.py` (513行) | ✅ | ✅ | ⚠️ | 🔲 | 可选 | — |
| AI 自拍系统 | — | 🔲 | 🔲 | 🔲 | 🔲 | 不阻塞 | Phase 2 |

**数字伴侣小结**：Mock 实现 ✅，真实引擎接入 ⚠️

---

### 用户触达层 ★★★

| 子模块 | 源文件 | 功能验收 | 测试验收 | 集成验收 | API验收 | MVP必须 | 缺失项 |
|--------|--------|----------|----------|----------|---------|---------|--------|
| FastAPI 主入口（14 端点）| `api/main.py` (404行) | ✅ | ✅ | ⚠️ | ✅ | **必须** | — |
| 聊天 API 路由 | `api/routes/chat.py` | ⚠️ | 🔲 | 🔲 | ⚠️ | **必须** | 路由桩需接真实逻辑 |
| 设置 API 路由 | `api/routes/settings.py` | ⚠️ | 🔲 | 🔲 | ⚠️ | **必须** | 路由桩需接真实逻辑 |
| 技能 API 路由 | `api/routes/skills.py` | ⚠️ | 🔲 | 🔲 | ⚠️ | **必须** | 路由桩需接真实逻辑 |
| WebSocket 实时聊天 | `api/main.py` | ✅ | ⚠️ | ⚠️ | ✅ | **必须** | WS 集成测试需补充 |
| Telegram Bot | `comms/telegram.py` (375行) | ✅ | ✅ | ⚠️ | ✅ | 可选 | 需真实 Bot Token |
| 消息网关（15+ 平台）| `comms/gateway.py` (466行) | ✅ | ✅ | ⚠️ | ✅ | 可选 | 仅 Telegram 适配器完整 |

**触达层小结**：主 API ✅，路由层桩代码 ⚠️ 需全部接通

---

## Part 2：前端 UI 验收表

> 当前状态：Next.js 应用骨架存在，所有组件均处于 🔲 状态（未与后端 API 联通）

| 页面 / 组件 | 文件 | 可渲染 | 可交互 | API 联通 | UI 验收 | MVP必须 |
|------------|------|--------|--------|---------|---------|---------|
| 首页（欢迎+状态面板）| `web/src/app/page.tsx` | 🔲 | 🔲 | 🔲 | 🔲 | **必须** |
| 深度聊天页 | `web/src/app/chat/page.tsx` | 🔲 | 🔲 | 🔲 | 🔲 | **必须** |
| AI 团队群聊页 | `web/src/app/group/page.tsx` | 🔲 | 🔲 | 🔲 | 🔲 | **必须** |
| 记忆宫殿页 | `web/src/app/memory/page.tsx` | 🔲 | 🔲 | 🔲 | 🔲 | **必须** |
| 设置页（22 子页）| `web/src/app/settings/page.tsx` | 🔲 | 🔲 | 🔲 | 🔲 | **必须** |
| 技能市场页 | `web/src/app/skills/page.tsx` | 🔲 | 🔲 | 🔲 | 🔲 | 可选 |
| 左侧边栏 | `web/src/components/Sidebar.tsx` | 🔲 | 🔲 | — | 🔲 | **必须** |
| 消息气泡 | `web/src/components/ChatBubble.tsx` | 🔲 | 🔲 | — | 🔲 | **必须** |
| 心绪状态指示 | `web/src/components/HeartStatus.tsx` | 🔲 | — | 🔲 | 🔲 | **必须** |
| 雷达动画 | `web/src/components/RadarAnimation.tsx` | 🔲 | — | — | 🔲 | **必须** |
| 发送框 | `web/src/components/SendBox.tsx` | 🔲 | 🔲 | 🔲 | 🔲 | **必须** |
| 多核治理面板 | 待创建 | 🔲 | 🔲 | 🔲 | 🔲 | **必须** |
| API 客户端层 | `web/src/lib/api.ts` | — | — | 🔲 | 🔲 | **必须** |
| 全局状态管理 | `web/src/lib/store.ts` | — | — | 🔲 | 🔲 | **必须** |

**前端小结**：骨架存在，全部待开发，是 MVP 最大缺口之一

---

## Part 3：集成链路验收表

> 以下 5 条端到端路径必须全部通过才能 MVP 发布

| 链路名称 | 经过的模块 | 当前状态 | 阻塞项 |
|---------|-----------|---------|--------|
| **① 用户发消息 → AI 回复** | `web/SendBox` → `api/routes/chat` → `chat/deep` → `cortex/trinity` → `llm/router` → 流式回显 | 🔲 | cortex/loop 空目录；API 路由桩未接通 |
| **② 记忆全链读写** | `chat` → `memory/manager` → `memory/working` → `light_sleep` → `memory/recent` → `search` → 召回注入 prompt | ⚠️ | 蒸馏触发调度未接心跳；ChromaDB 性能未压测 |
| **③ 工具调用链** | `trinity` → `tools/registry` → `executor` / `browser` → 结果返回 | ✅ | — |
| **④ 权限熔断链** | 任意操作 → `constitution/core` → L0-L4 判断 → 允许/阻止/升核 | ❌ | `social/permissions/` 为空；constitution 测试缺失 |
| **⑤ 心跳持久化链** | `ghost/heartbeat` → 触发 `light_sleep` → `memory/archive` → 崩溃恢复重载 | ⚠️ | 蒸馏触发链路未验证；Docker 崩溃恢复测试缺失 |

---

## Part 4：MVP 发布 Go/No-Go 检查单

### 🔴 必须 ✅（硬性门槛，任何 ❌/🔲 阻塞发布）

- [ ] `cortex/loop/` — ReAct 执行循环完整实现
- [ ] `social/permissions/` — 权限熔断矩阵实现
- [ ] `social/constitution/core.py` — 补充完整测试用例
- [ ] `api/routes/chat.py` — 路由桩全部接真实逻辑
- [ ] `api/routes/settings.py` — 路由桩全部接真实逻辑
- [ ] `api/routes/skills.py` — 路由桩全部接真实逻辑
- [ ] 集成链路 ① 用户消息→AI 回复 端到端通过
- [ ] 集成链路 ④ 权限熔断链路通过
- [ ] `python -m pytest tests/ -v` 全部通过（无 SKIP，无 ERROR）
- [ ] `docker-compose up` 构建成功，API 健康检查返回 200

### 🟡 可 ⚠️（允许部分通过，不阻塞发布）

- [ ] 前端 UI 最基础可用版（聊天页可收发消息即可）
- [ ] 记忆蒸馏（Light Sleep 调度触发即可，REM/Deep 可 Mock）
- [ ] TTS/STT（Mock 实现通过即可，真实引擎可延后）
- [ ] Telegram Bot（有 Bot Token 时可用即可）
- [ ] 技能市场（本地技能可用，HTTP 源可延后）

### 🟢 不阻塞 MVP（Phase 2 实现）

- [ ] `social/economy/` — 经济系统
- [ ] `memory/governance/` — 记忆治理
- [ ] 跨节点 Redis/rsync 同步
- [ ] AI 自拍系统
- [ ] DAG 并行任务调度
- [ ] 插件管理器

---

## Part 5：当前完成度统计

| 分类 | 后端模块数 | ✅ | ⚠️ | ❌ | 🔲 | 完成度 |
|------|-----------|----|----|----|----|--------|
| Layer 1 LLM大脑层 | 5 | 3 | 2 | 0 | 0 | 80% |
| Layer 2 核心引擎 | 7 | 3 | 1 | 0 | 3 | 43% |
| Layer 3 记忆系统 | 11 | 7 | 3 | 0 | 1 | 73% |
| Layer 4 永生层 | 5 | 1 | 3 | 0 | 1 | 40% |
| Layer 5 工具层 | 8 | 5 | 2 | 0 | 1 | 69% |
| 巡检AI | 4 | 3 | 1 | 0 | 0 | 88% |
| 人格系统 | 4 | 3 | 1 | 0 | 0 | 88% |
| 聊天系统 | 6 | 4 | 2 | 0 | 0 | 83% |
| 技能系统 | 3 | 2 | 1 | 0 | 0 | 83% |
| 浏览器引擎 | 4 | 2 | 1 | 0 | 1 | 63% |
| 宪法权限 | 4 | 1 | 1 | 0 | 2 | 25% |
| 数字伴侣 | 5 | 3 | 1 | 0 | 1 | 70% |
| 用户触达层 | 7 | 3 | 4 | 0 | 0 | 57% |
| **前端 UI** | **14** | **0** | **0** | **0** | **14** | **0%** |
| **合计** | **97** | **44** | **23** | **0** | **24** | **约 62%** |

**整体 MVP 完成度：约 62%**

---

## 关键风险与优先级

| 优先级 | 风险项 | 影响 | 建议 |
|--------|--------|------|------|
| P0 🔴 | `cortex/loop/` ReAct 循环为空 | 整个 Agent 执行引擎无法运行 | 立即实现，≈ 200-300 行 Python |
| P0 🔴 | `social/permissions/` 熔断矩阵为空 | 安全机制缺失，无法生产部署 | 基于 `fuse-matrix.ts` 移植 |
| P0 🔴 | API 路由层全部为桩代码 | 前后端无法联通 | 三个 routes 文件接真实逻辑 |
| P1 🟡 | 前端 UI 完成度 0% | 无用户界面 | 优先聊天页 + 发送框 |
| P1 🟡 | 集成测试覆盖率低 | 跨模块 Bug 会漏测 | 补充 5 条集成链路测试 |
| P2 🟢 | Docker 未验证 | 部署风险 | `docker-compose build` 验证一次 |

---

---

## 审核记录（v1.0）

**审核日期**：2026-04-15 | **审核方式**：2 个独立子代理并行审核

### 审核发现修正

1. **绿灯假象警告** ⚠️：`python -m pytest tests/` 当前 718 个测试全部通过，但 `cortex/loop/` 和 `social/permissions/` 因无代码也无测试——绿灯并不代表这两块完成了。

2. **前端状态修正**：`web/src/app/chat/`、`web/src/app/memory/`、`web/src/app/skills/` 目录**不存在**（比 🔲 更差）。`CorePanel.tsx` 已存在于 `web/src/components/`（非"待创建"）。

3. **MVP 前端门槛下调**：5 个前端页面标"必须"工作量过大。MVP 仅需聊天页可运行，其余降为 P1。

---

*本文档随代码迭代更新，每个 sprint 结束后更新状态标记。*

**验收命令（M2/M4 通用）：**
```bash
cd /Users/mc/AI/openagi
source .venv/bin/activate    # 必须先激活虚拟环境
python -m pytest tests/ -v --tb=short 2>&1 | tail -20
```

**⚠️ M2 上手注意**：
- ChromaDB 首次初始化需下载 ~1GB 嵌入模型，请勿中断
- 后端只能用 `make dev` 启动，禁止裸跑 `uvicorn --reload`（会导致 74GB 内存事故）
- 优先攻坚 `cortex/loop/` 和 `social/permissions/` 两个空目录
