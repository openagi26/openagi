# OpenAGI 软件开发说明书 v7.0

## 三核主权自治工程框架

---

### 文档信息

| 字段 | 值 |
|------|------|
| 版本 | 7.0 |
| 日期 | 2026-04-10 |
| 作者 | 多 AI 协作迭代（产品经理 / UX 架构师 / 系统架构师 / 技术文档工程师） |
| 适用对象 | OpenAGI 工程师、测试工程师、A/B 双团队成员 |
| 源文档 | v6.0 白皮书、v7 产品草案、v7 UX 草案、v7 架构草案、B 队资产清单 |
| 许可证 | 开源（OpenAGI 社区协议） |

**版本演进**: v6.0 定义了愿景与概念框架。v7.0 将其翻译为可验收的工程需求，对齐 B 队已完成的 88% 引擎实现（7 模块 / 188 测试），明确 A 队补齐身份、沙盒、AI 编排、IPC 四块缺口的具体交付物。

---

## 一、愿景与核心价值

### 1.1 一句话定位

OpenAGI 是一个让 AI 代理在治理框架内做正确的事、并证明它做到了的开源桌面平台。

### 1.2 核心差异

| 维度 | LangChain / AutoGPT / CrewAI | OpenAGI |
|------|------|------|
| 治理 | 无 / 角色分工但无制衡 | 三权分立（提案 / 审计 / 决策）+ 宪法约束 |
| 审计 | 无结构化日志 | 六本治理账本 + H1-H4 证据等级 + 判例法 |
| 安全 | 无沙盒 | Docker 隔离 + L0-L4 五级权限保险丝 + 人工双签 |
| 验证 | 无 | Oracle 预言机 + PoO 结果证明 + 自动结算 |
| 激励 | 无 | New.B 模拟货币 + 知识市场 + 质押惩罚 |
| 进化 | 无 | 五阶段晋升流水线（模拟 -> 联邦） |

### 1.3 v7.0 聚焦范围

本版本目标是**单节点全流程闭环**：用户从安装到完成第一个 Trinity 循环 < 5 分钟、零手动配置。多节点蜂群、真实代币经济、荷兰拍卖均列为 P3 后续版本。

### 1.4 三个已回答的问题

1. **"AI 做了什么决策？依据是什么？"** -- 六本治理账本 + 证据等级，每个决策可追溯可审计。
2. **"如何防止 AI 自嗨空转？"** -- PoO 结果验证 + PriorityScore >= 85 门槛，不达标则质押扣除。
3. **"AI 的经验如何积累和传递？"** -- Playbook 知识市场，成功经验定价交易，PoO 追踪买家使用结果。

---

## 二、产品需求

### 2.1 角色定义

| 角色 | 描述 | 核心诉求 |
|------|------|----------|
| 节点运营者 | 部署并运行 Trinity 节点的个人/团队 | 一键启动、可视化监控、收益可见 |
| 开发者 | 基于 OpenAGI 构建应用或扩展模块的工程师 | API 清晰、文档完整、可调试 |
| 宿主 | 提供算力资源并获取分红的基础设施提供者 | 成本透明、分红自动、风险可控 |

### 2.2 用户故事（含验收标准）

#### 节点运营者

| 编号 | 用户故事 | 验收标准 |
|------|----------|----------|
| U-01 | 一键生成节点身份密钥对 | AC1: 点击"创建节点"后 <2s 生成 Ed25519 密钥对。AC2: 公钥派生 DID 格式 `did:openagi:<hex32>`。AC3: 私钥仅存储在本地加密 keystore，不可导出明文 |
| U-02 | 查看 Trinity 三核引擎实时状态面板 | AC1: 三个代理卡片含状态（idle/thinking/blocked）、当前任务、累计完成数。AC2: 状态变更 <500ms 反映到 UI。AC3: 展开可查看全部输出历史 |
| U-03 | 创建任务并观看完整 Trinity 循环 | AC1: 输入标题描述后自动进入 proposal 阶段。AC2: 每阶段转换产生系统事件。AC3: 完成后自动生成 `OutcomeReport` 写入 Oracle |
| U-04 | 查看治理账本（六本账） | AC1: 六个标签页（证据/价值/债务/时效/判例/交易）。AC2: 支持按时间排序。AC3: 证据条目显示 H1-H4 等级并可按等级筛选 |
| U-05 | 查看节点晋升进度（Stage 0-4） | AC1: 四维进度条（outcomes/compliance/reconciliation/stability）。AC2: 显示门槛值与当前差距。AC3: 达标时显示"可晋升"按钮 |
| U-06 | 在知识市场浏览和购买 Playbook | AC1: 市场页列出在售 Playbook 含价格、分类、卖家信用分。AC2: 购买扣余额、生成双向账本记录。AC3: 余额不足显示错误 |
| U-07 | 高风险操作需人工确认 | AC1: L3 弹出确认对话框含操作描述和风险说明。AC2: L4 需人工+AI-3 双签。AC3: 未获批准状态为 denied |

#### 开发者

| 编号 | 用户故事 | 验收标准 |
|------|----------|----------|
| U-08 | 通过 TypeScript API 管理 Trinity 任务 | AC1: `@openagi/engine` 导出全部 7 模块公开函数。AC2: 每个函数含 JSDoc 注释。AC3: `import { createTask } from '@openagi/engine'` 编译通过 |
| U-09 | 在 Docker 沙盒中执行代码 | AC1: `SandboxExecutor.run()` 返回 stdout/stderr。AC2: 容器 CPU 1 核 / 内存 512MB / 超时 30s。AC3: 默认无网络无文件系统挂载 |
| U-10 | 通过 IPC Channel 与后端通信 | AC1: 至少 15 个 IPC Channel 覆盖核心操作。AC2: 请求/响应均有 TypeScript 类型。AC3: 本地操作 <100ms 返回 |
| U-11 | 运行全部测试验证修改 | AC1: `pnpm test` <30s 完成 188+ 测试。AC2: `pnpm test:coverage` 生成覆盖率报告。AC3: PR 合并要求通过率 100% |

#### 宿主

| 编号 | 用户故事 | 验收标准 |
|------|----------|----------|
| U-12 | 查看算力资源统计 | AC1: CPU 使用率/内存/磁盘/运行时长。AC2: 60s 自动刷新。AC3: 超阈值（CPU>80%/Mem>80%）显示告警 |
| U-13 | 设置约束边界 | AC1: 可编辑 CONSTRAINTS 列表。AC2: 新增约束即时生效无需重启。AC3: 命中约束时拦截并记录原因 |
| U-14 | 一键暂停/恢复节点 | AC1: 暂停后任务变 blocked。AC2: 暂停期不接受新任务。AC3: 恢复后自动继续 |

### 2.3 功能优先级矩阵

#### P0 -- 必须实现（MVP 阻塞项）

| 功能 | 对应故事 | 依赖 |
|------|----------|------|
| Trinity 三核引擎流水线 | U-03 | B 队 engine.ts（已完成） |
| 治理账本 CRUD 与展示 | U-04 | B 队 ledger.ts（已完成） |
| 节点身份生成 | U-01 | **A 队新建** identity 模块 |
| 权限保险丝拦截 | U-07 | B 队 fuse-matrix.ts（已完成） |
| IPC 接口层 | U-10 | **A 队新建** Tauri IPC |
| 任务创建与状态展示 | U-02, U-03 | B 队 store + UI（已完成） |

#### P1 -- 应该实现

| 功能 | 对应故事 | 依赖 |
|------|----------|------|
| Docker 沙盒执行 | U-09 | Docker 环境；无则降级子进程 |
| 节点晋升可视化 | U-05 | B 队 promotion.ts（已完成） |
| 知识市场交易 | U-06 | B 队 market.ts（已完成） |
| 宿主约束配置 | U-13 | B 队 constitution.ts 扩展 |
| Oracle 结果验证展示 | U-03 | B 队 oracle.ts（已完成） |

#### P2 -- 可以实现

资源监控仪表盘（U-12）、节点暂停/恢复（U-14）、国际化完善。

#### P3 -- 明确不在 v7.0 范围

| 功能 | 延期理由 | 重新评估条件 |
|------|----------|-------------|
| 双节点通信与蜂群扩展 | 单节点体验未验证 | 单节点稳定运行 30 天无 P0 bug |
| New.B 真实代币经济 | 需链上基础设施 | 社区 > 100 活跃节点 |
| 荷兰拍卖 / 先知挖矿 | 复杂度高 | 市场日均交易 > 50 笔 / PoO 覆盖 > 80% |
| 联邦债务清算 / 宿主分红 | 依赖多节点共识/真实代币 | 双节点 PoC 完成 / New.B 测试网上线 |

### 2.4 MVP 核心流程

```
步骤    用户动作                    系统行为                           模块
----    --------                    --------                           ----
[1]     pnpm install && pnpm dev    Tauri 窗口启动                     Tauri + Vite
[2]     系统检测无身份              弹出"创建节点"引导页               UI / router
[3]     点击"生成密钥对"            Ed25519 生成 -> 加密存储 -> DID     identity (A队)
                                    -> 初始化宪法/账本/余额/代理       constitution/ledger/market/engine
                                    -> Stage-0                         promotion
[4]     进入仪表盘                  三核面板(idle) + 空任务列表         DashboardView
[5]     填写标题描述，点击"创建"    draft -> proposal -> AI-1 thinking  store.createNewTask
[6]     (自动) AI-1 提案            proposal -> audit -> AI-2 thinking  engine.runProposalPhase
[7]     (自动) AI-2 审计            检查保险丝 -> audit -> approval     engine.runAuditPhase
[8]     (自动/人工) AI-3 审批       L3+需人工确认 -> execution          engine.runApprovalPhase
[9]     (自动) 沙盒执行             Docker/模拟 -> 执行结果             sandbox (A队)
[10]    (自动) 结算                 OutcomeReport -> 写入账本           oracle + ledger
                                    -> 更新晋升进度                    promotion
```

**MVP 成功标准**: 从 `pnpm dev` 到第一个任务 settled，全程 < 5 分钟，零手动编辑配置文件。

### 2.5 非功能需求

#### 性能指标

| 指标 | 目标值 | 优先级 |
|------|--------|--------|
| 冷启动时间 | < 3s（进程启动到主界面可交互） | P0 |
| IPC 调用响应 | < 100ms (p95) | P0 |
| 任务阶段推进延迟 | < 500ms（触发到 UI 更新） | P0 |
| 测试全量执行 | < 30s | P1 |
| 空闲内存 | < 200MB (RSS) | P1 |
| Docker 沙盒启动 | < 5s | P1 |
| 沙盒执行超时 | 30s（可配置） | P0 |

#### 安全要求

| 要求 | 验收标准 | 优先级 |
|------|----------|--------|
| 私钥保护 | 无明文私钥日志/序列化路径；keystore 使用 AES-256-GCM | P0 |
| 沙盒隔离 | `--network none`、无 volume mount（除输入/输出） | P0 |
| 权限分级 | L3/L4 无人工确认时被拦截，拦截写入判例账本 | P0 |
| 输入验证 | 标题 <200 字、描述 <5000 字；无 XSS 注入路径 | P1 |
| 数据完整性 | 账本写入 SHA-256 哈希链，启动时校验 | P1 |

#### 兼容性

| 平台 | 优先级 |
|------|--------|
| macOS 12+ | P0 |
| Windows 10+ | P1 |
| Ubuntu 22.04+ | P2 |
| 无 Docker 环境自动降级 | P0 |

---

## 三、系统架构

### 3.1 分层架构图

```
+===================================================================+
|                  用户界面层 (React + Zustand + Tailwind)            |
|  Dashboard | Market | Ledgers | Oracle | Permissions | NodeStatus  |
+===========================|=======================================+
                            | useV6Store (Zustand persist)
+===========================|=======================================+
|                  适配器层 (src/lib/v6/adapter.ts)                   |
|  fetchIdentity | fetchNewBBalance | fetchPooStats | syncBackend    |
+===========================|=======================================+
                            | IPC / HTTP localhost:13220 + Bearer
+===========================|=======================================+
|                  宿主 API (Electron Main / Tauri)                  |
|  Express Router: /api/trinity/*  (40+ 端点)                       |
+===========================|=======================================+
                            |
+------+-------+--------+--+----+----------+-----------+-----------+
| 宪法  | 引擎   | 账本    | 预言机 | 权限熔断  | 节点晋升   | 知识市场  |
+------+-------+--------+-------+----------+-----------+-----------+
| constitution | engine | ledger | oracle | fuse-matrix | promotion | market |
+==================================================================+
                            |
+===========================|=======================================+
|                  持久化层                                          |
|  localStorage(S0) | 文件JSON/JSONL(S1) | 链上哈希锚定(S2+)        |
+===========================|=======================================+
                            |
+===========================|=======================================+
|  Docker沙盒 | LLM API(Ollama/OpenAI) | 区块链(测试网) | 蜂群(P3)  |
+===================================================================+
```

### 3.2 模块清单与团队归属

| # | 模块 | 文件 | 行数 | 职责 | 实现方 | 状态 |
|---|------|------|------|------|--------|------|
| 1 | Constitution | constitution.ts | 143 | 目标/约束/权重/权限规则管理 | B 队 | 已完成，8 函数，全部通过测试 |
| 2 | Trinity Engine | engine.ts | 329 | 三 AI 编排流水线 | B 队 | 已完成，11 函数，全部通过测试 |
| 3 | Governance Ledger | ledger.ts | 279 | 六本账本 CRUD | B 队 | 已完成，14 函数（含 2 查询），全部通过测试 |
| 4 | Oracle/PoO | oracle.ts | 227 | OutcomeReport 生成/评估/结算 | B 队 | 已完成，6 函数，全部通过测试 |
| 5 | Fuse Matrix | fuse-matrix.ts | 258 | L0-L4 权限检查/审批/熔断 | B 队 | 已完成，10 函数，全部通过测试 |
| 6 | Promotion | promotion.ts | 315 | Stage 0-4 晋升评估 | B 队 | 已完成，7 函数，全部通过测试 |
| 7 | Market | market.ts | 285 | Playbook 上架/购买/执行 | B 队 | 已完成，9 函数，全部通过测试 |
| 8 | Identity | 待新建 | -- | 节点密钥生成/身份绑定/创世 | **A 队** | 未实现 |
| 9 | Sandbox | 待新建 | -- | Docker 沙盒执行 | **A 队** | 未实现 |
| 10 | AI Orchestrator | 待替换 | -- | 接入 LLM API 替换 setTimeout 模拟 | **A 队** | 未实现 |
| 11 | IPC Layer | 待新建 | -- | Tauri IPC 通道定义 | **A 队** | 未实现 |

### 3.3 数据流（任务全生命周期）

```
用户输入
    |
[1] createTask(title, desc)
    --> TrinityTask{phase:'proposal', status:'draft'}
    |
[2] runProposalPhase(task, content)
    AI-1 输出 TrinityOutput(type:'task-draft')
    --> phase:'audit', status:'pending-audit'
    |
[3] runAuditPhase(task, constitution, findings, riskLevel)
    AI-2 输出 TrinityOutput(type:'audit-opinion')
    getPermissionLevelForAction() --> PermissionLevel
    L4 或 critical --> blockTask，终止
    --> phase:'approval', status:'pending-approval'
    |
[4] runApprovalPhase(task, constitution, approved, budget)
    AI-3 输出 TrinityOutput(type:'task-charter')
    含 'human' --> 阻塞等待人类双签
    --> phase:'execution', status:'executing'
    |
[5] 沙盒执行 --> 结果 --> phase:'review'
    |
[6] generateOutcomeReport(task, result, method, grade)
    --> OutcomeReport{verdict:'pending-review'}
    |
[7] evaluateOutcome(outcome, rules, ledgers)
    --> verdict:'settleable'|'rejected'
    |
[8] settleOutcome(outcome)
    +-> addLocalLedgerEntry()    经济账
    +-> addEvidence()            证据链
    +-> calculatePromotionProgress()  晋升更新
    --> phase:'settled'
```

### 3.4 持久化策略

| 数据 | Stage 0（模拟） | Stage 1（测试网） | Stage 2+（真实） |
|------|-----------------|-------------------|------------------|
| V6SystemState | Zustand persist -> localStorage | 文件 JSON | 文件 + 链上哈希 |
| GovernanceLedgers | localStorage | 独立 .jsonl | 文件 + 区块链存证 |
| OutcomeReport[] | localStorage | OUTCOMES/ 目录 | 文件 + reconciliationHash 上链 |
| Constitution | localStorage | CONSTITUTION.json（版本化） | 文件 + 变更上链 |
| MarketState | localStorage | SQLite | 分布式市场合约 |
| Identity 密钥 | 内存模拟 UUID | keystore.enc (AES-256-GCM) | HSM 或加密文件 |

**关键规则**: (1) `backendConnected=true` 后禁用 localStorage 同步。(2) 账本 append-only，不可改历史。(3) 每 72h 熵减 GC，H1/H2 证据永久保留。

### 3.5 V6SystemState 根类型

```typescript
// src/types/v6.ts -- A/B 双方共享，变更需双方确认
interface V6SystemState {
  constitution: Constitution
  trinity: { ai1: TrinityAgent; ai2: TrinityAgent; ai3: TrinityAgent }
  tasks: TrinityTask[]
  ledgers: GovernanceLedgers
  outcomes: OutcomeReport[]
  oracleRules: OracleRule[]
  permissionMatrix: PermissionFuse[]
  permissionRequests: PermissionRequest[]
  nodeStatus: NodeStatus
}
```

---

## 四、用户体验与交互设计

### 4.1 信息架构

```
OpenAGI V7
|
+-- 仪表盘 (dashboard)        默认首页
|   +-- 统计卡片区 (6 列)
|   +-- 三核引擎面板 (AI-1/2/3)
|   +-- 创建任务表单
|   +-- 最近任务列表
|   +-- 事件流
|
+-- 知识市场 (market)          Playbook 交易
|   +-- 市场统计
|   +-- 可购买列表
|   +-- 订单历史
|
+-- 治理账本 (ledgers)         六类账本浏览
+-- 结果预言机 (oracle)        PoO 验证结果
+-- 权限矩阵 (permissions)    保险丝管理
+-- 节点晋升 (node-status)    晋升流水线
```

导航栏：顶部水平标签栏，`role="tablist"` + `role="tab"` + `aria-selected`，品牌标识含龙图标 + "OpenAGI V7" + 阶段徽章。

### 4.2 五条核心用户旅程

**旅程 1: 首次启动 -> 创建身份 -> 激活节点**

1. 启动应用 -> 检测 `isComplete`
2. `isComplete=false` -> 创世引导页
3. 步骤 1: 本地离线生成密钥 -> 显示公钥摘要前 12 位
4. 步骤 2: `POST /api/trinity/genesis` -> 显示节点 ID
5. 步骤 3: 注入初始 100 New.B -> 余额动画 0->100
6. 自动跳转仪表盘，Stage-0

**旅程 2: 创建任务 -> Trinity 流水线 -> 查看结果**

1. 仪表盘右侧表单输入标题 + 描述
2. 点击"运行三核流水线" -> 按钮变 disabled
3. AI-1 面板黄色脉冲 (300ms) -> 任务状态琥珀色
4. AI-2 面板黄色脉冲 (500ms 后) -> 任务状态紫色
5. AI-3 面板蓝色脉冲 (400ms 后)
6. 完成 (400ms 后) -> 任务绿色，统计 +1，表单清空

**旅程 3: 浏览市场 -> 购买 Playbook -> 执行验证**

1. 切换到知识市场标签 -> 加载可购买列表
2. 点击"购买并执行" -> 扣余额、创建订单、沙盒执行、PoO 验证
3. 订单状态更新为 completed，统计累加

**旅程 4: 查看权限矩阵 -> 审批 L3 请求**

1. FuseMatrix 网格（行: 操作类型，列: L0-L4）
2. L3 待审批请求列表 -> [批准] / [拒绝] 按钮
3. 批准后请求消失，矩阵更新，事件流记录

**旅程 5: 查看晋升进度 -> 达标 -> 晋升**

1. PromotionPipeline 显示 Stage-0 到 Stage-3
2. 各指标进度条: <50% 红 / 50-79% 琥珀 / >=80% 绿
3. 全部达标 -> "晋升"按钮可用 -> 点击执行阶段变更

### 4.3 设计规范摘要

**AI 角色色（永不混用）**

| 角色 | 主色 | 背景色 |
|------|------|--------|
| AI-1 扩张者 | `text-blue-400` #60a5fa | `bg-blue-950/40` |
| AI-2 审计者 | `text-amber-400` #fbbf24 | `bg-amber-950/40` |
| AI-3 治理者 | `text-emerald-400` #34d399 | `bg-emerald-950/40` |

**状态色**: 成功=green / 进行中=blue / 警告=amber / 错误=red / 特殊=purple / 过期=gray

**权限等级色**: L0=green / L1=blue / L2=amber / L3=red / L4=gray

**页面背景**: `bg-gray-950` (#030712)。卡片: `bg-white/5`。输入框: `bg-black/30`。

**排版**: 页面标题 14px/600。数据值 20px/600 + `font-mono`。正文 14px/400。辅助文字 12px/400。

**组件库**: 卡片 `rounded-lg bg-white/5 border border-white/10 p-4`。主按钮 `bg-purple-600`。危险按钮 `bg-red-600`。进度条含 `role="progressbar"` + `aria-valuenow`。

**响应式**: v7.0 以桌面端 >=1280px 为唯一交付目标。`max-w-6xl mx-auto`。

### 4.4 可用性原则（10 条）

| # | 原则 | 执行标准 |
|---|------|----------|
| U1 | 3 秒内看到核心数据 | 统计卡片 300ms 内渲染；后端未连接显示缓存 |
| U2 | 操作不超过 3 步 | 创建任务 2 步；购买 Playbook 2 步 |
| U3 | 零歧义状态指示 | 颜色 + 文字 + 状态点三位一体，禁止仅用颜色区分 |
| U4 | 操作过程可见 | 按钮显示"运行中..."，AI 面板状态灯实时切换 |
| U5 | 可撤销或可确认 | L2+ 显示确认对话框；购买前显示价格确认 |
| U6 | 渐进式信息展示 | 面板默认折叠仅显示角色名和状态，避免过载 |
| U7 | 一致性优于个性 | 严格使用组件库，禁止临时自定义样式 |
| U8 | 空状态有引导 | "暂无任务"等文字居中，`text-sm text-gray-400 py-12` |
| U9 | 数据格式统一 | 金额 `font-mono`；时间 `toLocaleString()`；哈希前 12 位 |
| U10 | 键盘完全可达 | `tabIndex={0}` + Enter 触发；导航支持左右箭头 |

### 4.5 无障碍要求（WCAG 2.1 AA）

| 要求 | 实现方式 | 验证方法 |
|------|----------|----------|
| 颜色不作为唯一信息载体 | 所有状态含文字标签或图标 | 灰度模式截图检查 |
| 文本对比度 >= 4.5:1 | `text-gray-300` on `bg-gray-950` = 12.7:1 | axe DevTools 扫描 |
| 导航使用 ARIA | `role="tablist"` + `aria-selected` | VoiceOver 测试 |
| 表格含隐藏标题 | `<caption class="sr-only">` | DOM 检查 |
| 可展开面板含状态 | `aria-expanded` + `aria-label` | VoiceOver 测试 |
| 动画可停止 | 遵循 `prefers-reduced-motion` | 系统"减少动态效果"测试 |
| 语言标注 | `<html lang="zh-CN">` | DOM 检查 |

---

## 五、Trinity 三核引擎规格

### 5.1 角色定义

| 角色 | 类型值 (`TrinityRole`) | 职责 | 输出类型 |
|------|------------------------|------|----------|
| AI-1 扩张者 | `'ai1-expander'` | 机会挖掘、战略制定、提案编写 | `task-draft`, `playbook`, `research-brief` |
| AI-2 审计员 | `'ai2-auditor'` | 代码安全审计、财务风险评估、合规检查 | `audit-opinion`, `risk-report` |
| AI-3 治理者 | `'ai3-governor'` | 最终决策、预算分配、知识市场签署 | `task-charter`, `budget-allocation`, `governance-directive` |

### 5.2 任务阶段 (`TrinityPhase`)

```
proposal -> audit -> approval -> execution -> review -> settled
```

| 阶段 | 执行者 | 输入 | 输出 | 退出条件 |
|------|--------|------|------|----------|
| proposal | AI-1 | 标题 + 描述 | `TrinityOutput(task-draft)` | AI-1 提交提案内容 |
| audit | AI-2 | 提案 + 宪法 | `TrinityOutput(audit-opinion)` + `PermissionLevel` | 审计完成；L4/critical 则 blockTask |
| approval | AI-3 | 审计结果 + 宪法 | `TrinityOutput(task-charter)` + 预算 | 审批通过；含 'human' 则等待双签 |
| execution | 沙盒 | 任务代码 | 执行结果 + evidenceGrade | 沙盒返回结果或超时 |
| review | Oracle | 执行结果 | `OutcomeReport` | evaluateOutcome 完成 |
| settled | 系统 | OutcomeReport | 账本条目 + 晋升更新 | settleOutcome 成功 |

### 5.3 任务状态 (`TaskStatus`, 9 种)

`draft` -> `pending-audit` -> `pending-approval` -> `approved` -> `executing` -> `completed` -> `settled`

异常分支: `blocked`（L4/critical 拦截）、`failed`（执行失败）、`cancelled`（用户取消）

### 5.4 代理状态 (`TrinityAgent['status']`)

`idle` | `thinking` | `executing` | `blocked` | `error`

### 5.5 PipelineResult 接口

```typescript
interface PipelineResult {
  task: TrinityTask       // 更新后的任务
  events: V6Event[]       // 本阶段产生的事件
  blocked: boolean        // 是否被阻塞
  reason?: string         // 阻塞原因
}
```

### 5.6 关键接口签名

```typescript
// src/lib/v6/engine.ts -- B 队已实现，A 队调用
function createTrinityAgents(): Record<'ai1'|'ai2'|'ai3', TrinityAgent>
function createTask(title: string, desc: string, createdBy?: TrinityRole, perm?: PermissionLevel): TrinityTask
function runProposalPhase(task: TrinityTask, content: string): PipelineResult
function runAuditPhase(task: TrinityTask, c: Constitution, findings: string, risk?: 'low'|'medium'|'high'|'critical'): PipelineResult
function runApprovalPhase(task: TrinityTask, c: Constitution, approved: boolean, budget?: number): PipelineResult
function advanceTaskPhase(task: TrinityTask): TrinityTask
function blockTask(task: TrinityTask, reason: string): TrinityTask
function failTask(task: TrinityTask, reason: string): TrinityTask
function updateAgentStatus(agent: TrinityAgent, status: TrinityAgent['status'], task?: string): TrinityAgent
```

---

## 六、治理账本系统

### 6.1 六本账概览

| 账本 | 类型 (`GovernanceLedgers` 字段) | 条目类型 | 核心字段 |
|------|------|------|------|
| 证据账 | `evidence: EvidenceEntry[]` | 结论 + 来源 + 等级 + 验证者 | `conclusion`, `source`, `grade: EvidenceGrade`, `verifiedBy`, `tags[]`, `expiresAt` |
| 价值账 | `value: ValueEntry[]` | 目标对齐 + 收入 + 成本 + 风险 | `goalAlignment`, `expectedRevenue`, `resourceCost`, `riskExposure`, `priorityScore` (自动计算) |
| 债务账 | `debt: DebtEntry[]` | 类别 + 影响 + 状态 | `category` (4 类), `impact` (low/medium/high/critical), `status` (open/resolved), `reviewDate` |
| 时效账 | `temporal: TemporalEntry[]` | 有效期 + 复核周期 + 依赖 | `effectiveAt`, `expiresAt`, `reviewCycle`, `dependencies[]`, `status` (active/expired) |
| 判例账 | `caseLaw: CaseLawEntry[]` | 分类 + 严重度 + 根因 + 教训 | `category` (5 类), `severity` (low-critical), `rootCause`, `resolution`, `lessons[]` |
| 交易账 | `localLedger: LocalLedgerEntry[]` | 类型 + 金额 + 货币 + 对手方 | `type` (mining/task-reward/market-sale/market-purchase/penalty/transfer), `amount`, `currency`, `counterparty` |

### 6.2 证据等级 (`EvidenceGrade`)

| 等级 | 含义 | 写入长期状态 | Oracle 结算要求 |
|------|------|-------------|----------------|
| H1 | 机器验证可重复 | 是 | 可直接结算到 mainnet |
| H2 | 人工验证确认 | 是 | 可结算到 testnet |
| H3 | 间接证据支持 | 是 | 可结算到 local |
| H4 | 未验证假设 | 否 | 不可结算 |

### 6.3 关键操作签名

```typescript
// src/lib/v6/ledger.ts -- B 队已实现
function createEmptyLedgers(): GovernanceLedgers
function addEvidence(l, conclusion, source, grade, verifier, taskId, tags?, expiresAt?): GovernanceLedgers
function getActiveEvidence(l): EvidenceEntry[]
function getEvidenceByGrade(l, minGrade): EvidenceEntry[]
function addValueAssessment(l, taskId, goalAlign, revenue, cost, risk): GovernanceLedgers
function getTopPriorityTasks(l, limit?): ValueEntry[]
function addDebt(l, category, desc, impact, from, reviewDate): GovernanceLedgers
function resolveDebt(l, debtId): GovernanceLedgers
function getOpenDebts(l): DebtEntry[]
function addCaseLaw(l, category, title, desc, severity, taskIds, rootCause?, resolution?, lessons?): GovernanceLedgers
function addLocalLedgerEntry(l, type, amount, currency, taskId, desc, counterparty?): GovernanceLedgers
function getBalance(l, currency): number
function getLedgerSummary(l): LedgerSummary
```

---

## 七、结果预言机（Outcome Oracle）

### 7.1 Oracle 规则体系

```typescript
interface OracleRule {
  id: string
  creditTarget: CreditTarget        // 'local' | 'testnet' | 'mainnet'
  minEvidenceGrade: EvidenceGrade    // 最低证据等级
  minVerifications: number           // 最少验证次数
  requiredFields: string[]           // 必填字段列表
}
```

默认规则集（`createDefaultOracleRules()`）：

| 信用目标 | 最低证据等级 | 最少验证次数 | 说明 |
|----------|-------------|-------------|------|
| mainnet | H1 | 3 | 最严格，可上链的结果 |
| testnet | H2 | 2 | 测试网级别 |
| local | H3 | 1 | 本地记录 |

### 7.2 结算流程

```
generateOutcomeReport(task, result, method, grade)
    --> OutcomeReport{verdict:'pending-review'}
    |
evaluateOutcome(outcome, rules, ledgers)
    按 creditTarget 降序遍历 OracleRule
    meetsRule: grade >= minGrade && verifications >= min && fields 齐全
    --> verdict:'settleable', creditTarget 对应等级
    或 verdict:'rejected'
    |
settleOutcome(outcome)
    settleable 才可调用（否则 throw）
    --> settledAt 写入时间戳
    |
disputeOutcome(outcome, reason)   // 可选争议路径
    --> verdict:'disputed'
```

### 7.3 PriorityScore 公式

```
PriorityScore = [(GoalFit * 0.35) + (PoO_Outcome * 0.35) + (EvidenceLevel * 0.2)]
                / [Cost + DebtImpact * 0.1]

Score >= 85 --> 执行并奖励 New.B
Score < 85  --> 丢弃 + 质押扣除
```

### 7.4 接口签名

```typescript
// src/lib/v6/oracle.ts -- B 队已实现
function createDefaultOracleRules(): OracleRule[]
function generateOutcomeReport(task, result, method, grade): OutcomeReport
function evaluateOutcome(outcome, rules, ledgers): OutcomeReport
function settleOutcome(outcome): OutcomeReport
function disputeOutcome(outcome, reason): OutcomeReport
function getOracleStats(outcomes): { total, settled, settleable, rejected, disputed, pending, byTarget }
```

---

## 八、权限保险丝矩阵

### 8.1 五级权限定义

| 等级 (`PermissionLevel`) | 名称 | 审批要求 | 自动执行 | 典型操作 |
|--------------------------|------|----------|----------|----------|
| L0 | 自主执行 | 无 | 是 | 写日志、更新草稿 |
| L1 | 审计即可 | ai2 | 否 | 只读 API、沙盒测试 |
| L2 | 双签审批 | ai2 + ai3 | 否 | 测试网转账、小额购买 |
| L3 | 人类签署 | ai2 + ai3 + human | 否 | 真实钱包、外部合约 |
| L4 | 永久禁止 | -- | 否(disabled) | 绕过约束、自我提权、删除账本 |

### 8.2 判定流程

```
action
  -> getPermissionLevelForAction(constitution, action)
     模式匹配 authority[].actionPattern -> PermissionLevel
  -> checkPermission(matrix, level)
     L4 -> 直接拒绝
     !enabled -> 拒绝
     autoExecute -> 放行
     else -> 返回所需审批人列表
  -> 收集 approvals -> isFullyApproved
     通过 -> resolveRequest(status:'approved')
     拒绝 -> resolveRequest(status:'denied')
```

### 8.3 接口签名

```typescript
// src/lib/v6/fuse-matrix.ts -- B 队已实现
function createDefaultFuseMatrix(): PermissionFuse[]
function checkPermission(matrix, level): { allowed: boolean; fuse: PermissionFuse; reason: string }
function canAutoExecute(matrix, level): boolean
function createPermissionRequest(taskId, role, level, action, desc): PermissionRequest
function addApproval(req, approver, decision, reason?): PermissionRequest
function isFullyApproved(req, matrix): boolean
function resolveRequest(req, matrix): PermissionRequest
```

---

## 九、节点晋升流水线

### 9.1 五阶段定义

| 阶段 (`NodeStage`) | 名称 | 描述 | 解锁能力 |
|---------------------|------|------|----------|
| stage-0 | 胚胎/模拟 | 本地模拟运行，SIM 货币 | 基本 Trinity 循环、本地账本 |
| stage-1 | 测试 | 测试网连接，keystore 加密 | Docker 沙盒、测试网交易 |
| stage-2 | 主网 | 真实环境执行 | 真实 API 调用、主网记录 |
| stage-3 | 蜂群 | 双节点对等通信 | 跨节点知识交易、联邦共识 |
| stage-4 | 联邦 | N 节点蜂群 | Federated Debt Clearing、联邦防御 |

### 9.2 晋升四维评分

| 维度 | 字段 | 门槛示例（stage-0 -> stage-1） |
|------|------|------|
| 结果达成 | `outcomesAchieved` | >= 5 个已结算 OutcomeReport |
| 合规评分 | `complianceScore` | >= 80 (0-100) |
| 对账率 | `reconciliationRate` | >= 70% |
| 稳定性 | `stabilityScore` | >= 60 (0-100) |

### 9.3 晋升流程

```
calculateNodeMetrics(outcomes, ledgers, requests, startTime, tasks?)
    --> NodeMetrics
    |
calculatePromotionProgress(nodeStatus, outcomes, ledgers, requests)
    --> PromotionProgress（四维当前值）
    |
checkPromotionEligibility(nodeStatus, outcomes, ledgers, requests)
    --> { eligible: boolean, reasons: string[] }
    |
promoteNode(nodeStatus)
    eligible=true 才可调用
    --> NodeStatus（stage 递增，记录 PromotionEvent）
```

### 9.4 接口签名

```typescript
// src/lib/v6/promotion.ts -- B 队已实现
function createInitialNodeStatus(): NodeStatus
function calculateNodeMetrics(outcomes, ledgers, requests, startTime, tasks?): NodeMetrics
function calculatePromotionProgress(ns, outcomes, ledgers, requests): PromotionProgress
function checkPromotionEligibility(ns, outcomes, ledgers, requests): { eligible: boolean; reasons: string[] }
function promoteNode(ns): NodeStatus
// 导出常量: STAGE_CONFIG -- 五阶段完整配置
```

---

## 十、知识市场

### 10.1 交易流程

```
[1] 上架: createPlaybookListing(task, content, price, category, tags)
         --> PlaybookListing{status:'listed'}
         listPlaybook(market, listing) --> MarketState 更新
    |
[2] 购买: purchasePlaybook(market, listingId, buyer)
         --> 校验余额、拦截自购
         --> MarketOrder{status:'executing'}
         --> 扣除买方余额
    |
[3] 执行: executePlaybook(market, orderId, result)
         --> 记录执行结果
    |
[4] 记账: recordMarketTransaction(ledgers, order, 'buyer')
         recordMarketTransaction(ledgers, order, 'seller')
         --> 双向 LocalLedgerEntry
```

### 10.2 市场状态

```typescript
interface MarketState {
  listings: PlaybookListing[]    // 全部上架商品
  orders: MarketOrder[]          // 全部订单
  nodeBalance: number            // 节点余额（SIM 模式初始 1000）
  totalVolume: number            // 累计成交额
}
```

### 10.3 未来规划（P3）

- **荷兰式拍卖**: 高价值 Playbook 从高价开始逐步降价。重新评估条件: 日均交易量 > 50 笔
- **PoO 追踪**: 买家执行 Playbook 后自动触发 PoO 验证，结果反馈卖家信用分
- **质押机制**: 卖家上架需质押 New.B，欺诈/无效则没收补偿买家

### 10.4 接口签名

```typescript
// src/lib/v6/market.ts -- B 队已实现
function createEmptyMarket(): MarketState
function createPlaybookListing(task, content, price, category, tags?): PlaybookListing
function listPlaybook(market, listing): MarketState
function delistPlaybook(market, listingId): MarketState
function purchasePlaybook(market, listingId, buyer): { market: MarketState; order: MarketOrder|null; error?: string }
function executePlaybook(market, orderId, result): MarketState
function recordMarketTransaction(ledgers, order, side): GovernanceLedgers
function createDemoMarket(): MarketState  // 含 3 个示范 Playbook
```

---

## 十一、A/B 双团队分工

### 11.1 职责矩阵

| 模块 | B 队（引擎层） | A 队（宿主层） | 接口契约 |
|------|----------------|----------------|----------|
| Constitution | 已完成 (143 行, 8 函数) | 调用 | `src/lib/v6/constitution.ts` |
| Trinity Engine | 已完成 (329 行, 11 函数) | 接入 LLM API 替换 setTimeout | `PipelineResult` 接口不变 |
| Governance Ledger | 已完成 (279 行, 14 函数) | 调用 + 持久化升级(S1) | `GovernanceLedgers` 类型不变 |
| Oracle | 已完成 (227 行, 6 函数) | 调用 | `OutcomeReport` 类型不变 |
| Fuse Matrix | 已完成 (258 行, 10 函数) | 调用 | `PermissionFuse[]` 类型不变 |
| Promotion | 已完成 (315 行, 7 函数) | 调用 | `NodeStatus` 类型不变 |
| Market | 已完成 (285 行, 9 函数) | 调用 | `MarketState` 类型不变 |
| **Identity** | -- | **新建**: Ed25519 密钥生成, DID 派生, keystore 加密 | 需定义 `HostIdentity` 接口 |
| **Sandbox** | -- | **新建**: Docker 沙盒执行 | 需定义 `SandboxConfig`, `SandboxResult` |
| **AI Orchestrator** | -- | **新建**: LLM API 接入 (Ollama/OpenAI) | 替换引擎内 setTimeout 模拟 |
| **IPC Layer** | -- | **新建**: Tauri IPC 通道 (>=15 个) | 需定义请求/响应 TypeScript 类型 |
| Zustand Store | 已完成 (482 行, 40+ actions) | 可能需扩展 | `useV6Store` 接口不变 |
| UI 组件 | 4 组件 (659 行) + 主页面 (446 行) | 可能需扩展 | Props 接口已定义 |
| 单元测试 | 188 测试 (2,806 行) | A 队新模块需自带测试 | 覆盖率不低于当前基线 |
| 国际化 | zh/v6.json (86 键) | 英文补全 | JSON 键值格式 |

### 11.2 A 队待交付清单

| 交付物 | 优先级 | 验收标准 |
|--------|--------|----------|
| identity 模块 | P0 | Ed25519 密钥对 <2s 生成；DID 格式正确；AES-256-GCM 加密存储 |
| IPC 通道定义 | P0 | >=15 个 Channel；请求/响应均有 TS 类型；<100ms 返回 |
| LLM API 接入 | P0 | 替换 setTimeout；支持 Ollama 本地 + OpenAI 远程；失败降级为模拟 |
| Docker 沙盒 | P1 | CPU 1 核 / 内存 512MB / 超时 30s；无网络(默认)；无 Docker 时降级子进程 |
| adapter.ts 实现 | P1 | 7 个 async 函数对接后端 API |

### 11.3 接口变更规则

1. `src/types/v6.ts` 是双方共享契约，**任何变更需双方确认**
2. B 队导出的函数签名为稳定 API，A 队调用时不应修改
3. A 队新增的类型（如 `SandboxConfig`）应先提 PR 到 v6.ts 并经 B 队审核

### 11.4 A 队新增接口定义（待实现）

```typescript
// 适配器层 -- src/lib/v6/adapter.ts
async function fetchIdentity(): Promise<{ nodeId: string; publicKey: string; createdAt: string }>
async function fetchGenesisStatus(): Promise<{ isComplete: boolean; hasIdentity: boolean; hasEconomy: boolean }>
async function fetchNewBBalance(): Promise<{ balance: number }>
async function fetchPooStats(): Promise<{ totalTasks: number; verified: number; rejected: number; pending: number; score: number }>
async function fetchDashboard(): Promise<V6SystemState>

// 沙盒 -- electron/sandbox/runner.ts
interface SandboxConfig {
  image: string
  networkMode: 'none' | 'restricted' | 'host'
  cpuLimit: number
  memoryLimitMB: number
  timeoutSeconds: number
  readonlyMounts: string[]
  env: Record<string, string>
}
interface SandboxResult {
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
  resourceUsage: { cpuPercent: number; memoryMB: number }
}
async function executeSandbox(config: SandboxConfig, script: string): Promise<SandboxResult>
```

---

## 十二、开发路线图

### 12.1 里程碑

| 阶段 | 时间 | 交付物 | 负责方 |
|------|------|--------|--------|
| M0: 引擎完成 | 已完成 | 7 核心模块 + 188 测试 + Store + UI | B 队 |
| M1: 接口对齐 | Week 1 | v6.ts 类型冻结 + IPC 通道定义 + adapter 桩 | A+B 联合 |
| M2: 身份与 IPC | Week 2 | identity 模块 + Tauri IPC 15+ 通道 | A 队 |
| M3: AI 接入 | Week 3 | LLM API 替换 setTimeout + 降级策略 | A 队 |
| M4: 沙盒集成 | Week 4 | Docker 沙盒 + 无 Docker 降级 | A 队 |
| M5: 端到端验证 | Week 5 | MVP 流程 <5min 完成 + 安全审计 | A+B 联合 |
| M6: 发布 | Week 6 | v7.0 打包发布（macOS 优先） | A+B 联合 |

### 12.2 单节点到蜂群扩展路径（长期）

| 阶段 | 拓扑 | 技术要求 | 时间框架 |
|------|------|----------|----------|
| Phase 1 (v7.0) | 单节点 | localStorage/文件, 模拟市场 | 当前 |
| Phase 2 | 双节点对等 | libp2p (mDNS/DHT), 签名/验签 | 单节点稳定 30 天后 |
| Phase 3 | N 节点蜂群 | 联邦共识, Federated Debt Clearing | 社区 > 100 节点 |

---

## 十三、风险矩阵

| # | 风险 | 影响 | 概率 | 缓解措施 |
|---|------|------|------|----------|
| R1 | A 队 identity 模块延期 | P0 功能阻塞 | 中 | M1 先用 UUID 模拟桩，真实密钥可后接入 |
| R2 | LLM API 调用成本/延迟 | 用户体验差 | 中 | 支持 Ollama 本地模型；setTimeout 降级保底 |
| R3 | Docker Desktop 未安装 | 沙盒不可用 | 高 | 自动检测并降级为子进程沙盒（P0 要求） |
| R4 | v6.ts 类型变更引发双方冲突 | 集成失败 | 中 | M1 冻结类型 + PR 审核流程 |
| R5 | 账本数据量增长导致 localStorage 溢出 | 数据丢失 | 低 | Stage 1 迁移到文件系统；熵减 GC 每 72h |
| R6 | AI 幻觉导致危险操作 | 安全事故 | 中 | H 等级证据 + AI-2 审计 + L3/L4 人工确认 |
| R7 | Tauri IPC 性能不达标 | 响应超 100ms | 低 | 批量操作合并；本地操作避免序列化大对象 |
| R8 | 测试覆盖率下降 | 回归 bug | 中 | PR 合并门禁: 覆盖率不低于基线 + 通过率 100% |
| R9 | 私钥泄露 | 身份被冒用 | 低 | AES-256-GCM 加密 + 无明文导出路径 + 静态分析 |
| R10 | 单人依赖（A 队或 B 队关键成员） | 进度停滞 | 中 | 文档完备 + 接口契约明确 + 模块解耦 |

---

## 附录 A: 最小文件清单

```
src/
  types/
    v6.ts                    # 402 行, 40+ 类型 -- 双方共享契约
  lib/v6/
    constitution.ts          # 143 行, 8 函数 -- 宪法管理
    engine.ts                # 329 行, 11 函数 -- 三核引擎
    ledger.ts                # 279 行, 14 函数 -- 治理账本
    oracle.ts                # 227 行, 6 函数 -- 结果预言机
    fuse-matrix.ts           # 258 行, 10 函数 -- 权限保险丝
    promotion.ts             # 315 行, 7 函数 -- 节点晋升
    market.ts                # 285 行, 9 函数 -- 知识市场
    adapter.ts               # 待实现 -- 前后端桥接 (A队)
    index.ts                 # 桶导出
  stores/
    v6.ts                    # 482 行, 40+ actions -- Zustand Store
  components/v6/
    TrinityPanel.tsx          # 133 行 -- AI 代理状态卡片
    LedgerTable.tsx           # 217 行 -- 六本账表格
    FuseMatrix.tsx            # 145 行 -- 权限矩阵可视化
    PromotionPipeline.tsx     # 164 行 -- 晋升流水线可视化
  pages/Trinity/
    index.tsx                # 446 行, 6 个视图 -- 主页面
  locales/
    zh/v6.json               # 86 个翻译键

tests/unit/
  v6-engine.test.ts          # 562 行, 46 测试 -- 三核引擎
  v6-functional.test.ts      # 575 行, 38 测试 -- 纯函数
  v6-integration.test.ts     # 1233 行, 72 测试 -- Store 集成
  v6-market.test.ts          # 436 行, 32 测试 -- 知识市场

electron/                    # A 队新建目录
  identity/                  # 节点身份模块
  sandbox/                   # Docker 沙盒模块
  ipc/                       # IPC 通道定义
```

---

## 附录 B: TypeScript 核心类型索引

以下类型均定义在 `src/types/v6.ts`，按架构层级排列。

**Layer 0 -- 宪法层**:
`Constitution`, `ConstitutionalGoal`, `Milestone`, `Constraint`, `ValuePriority`, `AuthorityRule`, `ApprovalRequirement`, `DoneCriteria`

**Layer 1 -- 三核 AI 层**:
`TrinityRole`, `TrinityAgent`, `AgentStats`, `TrinityOutput`, `TrinityOutputType` (11 种), `TrinityTask`, `TrinityPhase` (6 阶段), `TaskStatus` (9 种)

**Layer 2 -- 治理账本层**:
`GovernanceLedgers`, `EvidenceEntry`, `EvidenceGrade`, `ValueEntry`, `DebtEntry`, `TemporalEntry`, `CaseLawEntry`, `LocalLedgerEntry`

**Layer 3 -- 结果预言机层**:
`OutcomeReport`, `CreditTarget`, `OracleVerdict`, `OracleRule`

**Layer 4 -- 权限保险丝层**:
`PermissionLevel`, `PermissionFuse`, `PermissionRequest`, `PermissionApproval`

**Layer 5 -- 节点晋升层**:
`NodeStage`, `NodeStatus`, `PromotionProgress`, `PromotionEvent`, `NodeMetrics`

**系统与 UI**:
`V6SystemState`, `V6View`, `V6UIState`, `V6Event`, `V6EventType` (13 种)

**Store 导出**: `useV6Store` (Zustand, 40+ actions)

**引擎导出**: `PipelineResult` (engine.ts), `PlaybookListing` / `MarketOrder` / `MarketState` (market.ts), `LedgerSummary` (ledger.ts), `STAGE_CONFIG` (promotion.ts)

---

## 附录 C: 术语表

| 术语 | 定义 |
|------|------|
| Trinity | 三核治理单元: AI-1(扩张者) + AI-2(审计员) + AI-3(治理者) |
| PoO | Proof of Outcome，结果证明机制 |
| PriorityScore | 任务优先级得分，>= 85 可执行 |
| New.B | AI 原生模拟货币（v7.0 使用 SIM 模式，初始 1000） |
| SIM | Simulated，模拟模式标记。v7.0 中 New.B 使用 SIM 模式，非真实区块链代币 |
| Stage 0-4 | 节点晋升五阶段: 模拟 -> 测试 -> 主网 -> 蜂群 -> 联邦 |
| H1-H4 | 证据等级: H1(最高/机器验证可重复) -> H4(最低/未验证假设) |
| Playbook | 可交易的成功经验/策略包，存储在知识市场中 |
| CONSTRAINTS | 宪法层约束规则，定义 AI 行为的法律/系统/安全边界 |
| Oracle | 结果预言机，负责评估和结算 OutcomeReport |
| 保险丝矩阵 | L0-L4 五级权限检查机制，L4 为永久禁止 |
| DID | Decentralized Identifier，去中心化标识符，格式 `did:openagi:<hex32>` |
| 宿主 | 提供算力和容器的人类用户，与 AI 节点共生 |
| 熵减 GC | 定期压缩过期数据，保留 H1/H2 证据，每 72 小时执行 |
| 双签 | L3 级操作需 AI-3 + 人类同时批准 |
| 联邦债务清算 | 多节点共识自动生成还债任务（P3 未来版本） |
| IPC | Inter-Process Communication，前端与后端的进程间通信通道 |

---

**文档结束**
**版本**: v7.0 -- 三核主权自治工程框架
**总计**: ~660 行
**许可证**: 开源（OpenAGI 社区协议）
