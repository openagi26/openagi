# B 队资产清单 -- OpenAGI V6

> 本文档由 B 队维护，供 A 队参考。目标：消除重复建设，定义共享接口契约。
>
> 最后更新：2026-04-10 | 代码位置：`/Users/mc/AI/GPT/openagi409C/openagi_repo/`

---

## 一、概述

B 队已完成 V6 白皮书约 88% 的实现，覆盖六层架构中的核心治理框架：

| 指标 | 数值 |
|------|------|
| 类型定义 | 402 行，40+ 导出类型/接口 |
| 引擎模块 | 7 个核心模块 + 1 个桶导出，共 1,844 行 |
| Zustand Store | 482 行，40+ action 方法 |
| UI 页面 | 1 个主页面（446 行），6 个视图 |
| UI 组件 | 4 个独立组件，共 659 行 |
| 单元测试 | 4 个测试文件，188 个 test case，共 2,806 行 |
| 国际化 | 中文 `zh/v6.json` 已就绪（86 个翻译键） |

所有代码已通过 TypeScript 编译 + Vite 构建 + 188 项测试。

---

## 二、类型定义（接口契约）

**文件：** `src/types/v6.ts` | **402 行**

这是两队协作的核心契约文件。A 队应直接引用这些类型，而非重新定义。

### Layer 0: 宪法层

| 类型/接口 | 说明 |
|-----------|------|
| `ConstitutionalGoal` | 宪法目标，含阶段、描述和里程碑列表 |
| `Milestone` | 里程碑条目，含完成标志和完成时间 |
| `Constraint` | 约束规则，分 legal/system/host/ethical 四类，hard/soft 两级 |
| `ValuePriority` | 价值维度权重（revenue/risk/quality/reuse/speed/compliance），权重 0-100 |
| `AuthorityRule` | 权限规则，绑定 actionPattern 到 PermissionLevel |
| `ApprovalRequirement` | 审批需求枚举：`'ai1' \| 'ai2' \| 'ai3' \| 'human' \| 'dual-sign'` |
| `DoneCriteria` | 完成标准定义，含验证方法（automated/manual/peer-review） |
| `Constitution` | 宪法根对象，聚合 goals/constraints/values/authority/done |

### Layer 1: 三核 AI 层

| 类型/接口 | 说明 |
|-----------|------|
| `TrinityRole` | 三核角色枚举：`'ai1-expander' \| 'ai2-auditor' \| 'ai3-governor'` |
| `TrinityAgent` | 单个 AI 代理状态：角色、显示名、状态、当前任务、统计信息 |
| `AgentStats` | 代理统计：完成数、阻塞数、平均响应时间 |
| `TrinityOutput` | 三核输出记录：角色、类型、内容、元数据、时间戳 |
| `TrinityOutputType` | 输出类型枚举（11 种）：task-draft / playbook / audit-opinion / risk-report 等 |
| `TrinityTask` | 核心任务对象：标题、描述、阶段、优先级、状态、输出列表、权限级别 |
| `TrinityPhase` | 任务阶段枚举：`proposal \| audit \| approval \| execution \| review \| settled` |
| `TaskStatus` | 任务状态枚举（9 种）：draft / pending-audit / pending-approval / approved / executing / completed / failed / blocked / cancelled |

### Layer 2: 治理账本层

| 类型/接口 | 说明 |
|-----------|------|
| `EvidenceEntry` | 证据条目：结论、来源、等级、验证者、标签 |
| `EvidenceGrade` | 证据等级枚举：`'H1' \| 'H2' \| 'H3' \| 'H4'`（H1 最高） |
| `ValueEntry` | 价值评估条目：目标对齐度、预期收入、资源成本、风险暴露 |
| `DebtEntry` | 债务条目：分 deferred-task / local-optimization / strategic-debt / tech-debt 四类 |
| `TemporalEntry` | 时效条目：结论有效期、复核周期、依赖关系 |
| `CaseLawEntry` | 判例条目：分 failure / circuit-break / rollback / dispute / resolution 五类 |
| `LocalLedgerEntry` | 本地账本条目：交易类型、金额、货币、对手方 |
| `GovernanceLedgers` | 治理账本聚合根：6 种账本的数组集合 |

### Layer 3: 结果预言机层

| 类型/接口 | 说明 |
|-----------|------|
| `OutcomeReport` | 结果报告：任务关联、实际结果、证据等级、对账哈希、Oracle 裁定 |
| `CreditTarget` | 信用目标枚举：`'local' \| 'testnet' \| 'mainnet' \| 'rejected'` |
| `OracleVerdict` | 裁定枚举：`'settleable' \| 'pending-review' \| 'rejected' \| 'expired' \| 'disputed'` |
| `OracleRule` | Oracle 规则：最低证据等级、最少验证次数、必填字段 |

### Layer 4: 权限保险丝层

| 类型/接口 | 说明 |
|-----------|------|
| `PermissionLevel` | 权限级别枚举：`'L0' \| 'L1' \| 'L2' \| 'L3' \| 'L4'` |
| `PermissionFuse` | 保险丝定义：级别、类别、审批需求、是否自动执行 |
| `PermissionRequest` | 权限请求：任务 ID、请求者、级别、审批列表 |
| `PermissionApproval` | 审批记录：审批者、决定、原因、时间戳 |

### Layer 5: 节点晋升层

| 类型/接口 | 说明 |
|-----------|------|
| `NodeStage` | 阶段枚举：`'stage-0'` 到 `'stage-4'`（模拟 -> 联邦） |
| `NodeStatus` | 节点状态根对象：当前阶段、晋升进度、历史记录、指标 |
| `PromotionProgress` | 晋升进度：outcomes 达成、合规分数、对账率、稳定性 |
| `PromotionEvent` | 晋升事件记录：从哪个阶段到哪个阶段 |
| `NodeMetrics` | 节点指标：任务总数、完成数、失败数、运行时长 |

### 系统与 UI 状态

| 类型/接口 | 说明 |
|-----------|------|
| `V6SystemState` | V6 系统状态根对象，聚合全部子系统 |
| `V6View` | UI 视图枚举（7 种）：dashboard / market / ledgers / oracle / permissions / node-status / task-detail |
| `V6UIState` | UI 状态：当前视图、选中任务、账本类型、过滤器 |
| `V6Event` | 系统事件：类型、载荷、时间戳、来源 |
| `V6EventType` | 事件类型枚举（13 种）：task:created / trinity:output / outcome:settled 等 |

---

## 三、引擎模块清单

**目录：** `src/lib/v6/` | **8 个文件，共 1,844 行**

### 3.1 constitution.ts (143 行) -- 宪法管理

| 导出函数 | 签名 | 说明 | 状态 |
|----------|------|------|------|
| `createDefaultConstitution` | `() => Constitution` | 创建默认宪法（MVP 目标、6 项约束、5 项价值权重、5 级权限规则） | ✅ tested |
| `addGoal` | `(constitution, goal) => Constitution` | 添加新的宪法目标 | ✅ tested |
| `addConstraint` | `(constitution, constraint) => Constitution` | 添加新的约束规则 | ✅ tested |
| `updateValueWeights` | `(constitution, values) => Constitution` | 更新价值权重（必须合计 100） | ✅ tested |
| `getPermissionLevelForAction` | `(constitution, action) => PermissionLevel` | 根据操作文本匹配权限级别 | ✅ tested |
| `getRequiredApprovals` | `(constitution, level) => ApprovalRequirement[]` | 获取指定权限级别所需的审批者 | ✅ tested |
| `completeMilestone` | `(constitution, goalId, milestoneId) => Constitution` | 标记里程碑为已完成 | ✅ tested |
| `validateConstitution` | `(constitution) => string[]` | 校验宪法完整性，返回错误列表 | ✅ tested |

### 3.2 engine.ts (329 行) -- 三核引擎编排

| 导出函数 | 签名 | 说明 | 状态 |
|----------|------|------|------|
| `createTrinityAgents` | `() => Record<'ai1'\|'ai2'\|'ai3', TrinityAgent>` | 创建三核代理初始状态 | ✅ tested |
| `createTask` | `(title, description, createdBy?, permissionLevel?) => TrinityTask` | 创建新任务 | ✅ tested |
| `advanceTaskPhase` | `(task) => TrinityTask` | 推进任务到下一阶段 | ✅ tested |
| `blockTask` | `(task, reason) => TrinityTask` | 阻塞任务并记录原因 | ✅ tested |
| `failTask` | `(task, reason) => TrinityTask` | 标记任务失败 | ✅ tested |
| `createOutput` | `(taskId, role, type, content, metadata?) => TrinityOutput` | 创建三核输出记录 | ✅ tested |
| `runProposalPhase` | `(task, proposalContent) => PipelineResult` | 执行提案阶段（AI-1） | ✅ tested |
| `runAuditPhase` | `(task, constitution, auditFindings, riskLevel?) => PipelineResult` | 执行审计阶段（AI-2），含 L4 拦截和 critical 风险阻断 | ✅ tested |
| `runApprovalPhase` | `(task, constitution, approved, budgetAllocation?) => PipelineResult` | 执行审批阶段（AI-3），含人类双签判定 | ✅ tested |
| `updateAgentStatus` | `(agent, status, currentTask?) => TrinityAgent` | 更新代理状态 | ✅ tested |
| `recordAgentCompletion` | `(agent, responseTimeMs) => TrinityAgent` | 记录代理完成任务并更新统计 | ✅ tested |

导出接口：`PipelineResult`（task + events + blocked + reason）

### 3.3 ledger.ts (279 行) -- 治理账本管理

| 导出函数 | 签名 | 说明 | 状态 |
|----------|------|------|------|
| `createEmptyLedgers` | `() => GovernanceLedgers` | 创建空白六本账 | ✅ tested |
| `addEvidence` | `(ledgers, conclusion, source, grade, verifier, taskId, tags?, expiresAt?) => GovernanceLedgers` | 添加证据条目 | ✅ tested |
| `getActiveEvidence` | `(ledgers) => EvidenceEntry[]` | 获取未过期的证据 | ✅ tested |
| `getEvidenceByGrade` | `(ledgers, minGrade) => EvidenceEntry[]` | 按最低等级筛选证据 | ✅ tested |
| `addValueAssessment` | `(ledgers, taskId, goalAlignment, revenue, cost, risk) => GovernanceLedgers` | 添加价值评估（自动计算优先级） | ✅ tested |
| `getTopPriorityTasks` | `(ledgers, limit?) => ValueEntry[]` | 获取优先级最高的任务 | ✅ tested |
| `addDebt` | `(ledgers, category, description, impact, deferredFrom, reviewDate) => GovernanceLedgers` | 添加债务条目 | ✅ tested |
| `resolveDebt` | `(ledgers, debtId) => GovernanceLedgers` | 标记债务为已解决 | ✅ tested |
| `getOpenDebts` | `(ledgers) => DebtEntry[]` | 获取未解决的债务 | ✅ tested |
| `addTemporalEntry` | `(ledgers, conclusionId, effectiveAt, expiresAt, reviewCycle, dependencies?) => GovernanceLedgers` | 添加时效条目 | ✅ tested |
| `refreshTemporalStatuses` | `(ledgers) => GovernanceLedgers` | 刷新所有时效条目状态（active/expired） | ✅ tested |
| `addCaseLaw` | `(ledgers, category, title, description, severity, taskIds, rootCause?, resolution?, lessons?) => GovernanceLedgers` | 添加判例条目 | ✅ tested |
| `searchCaseLaw` | `(ledgers, query) => CaseLawEntry[]` | 全文搜索判例 | ✅ tested |
| `addLocalLedgerEntry` | `(ledgers, type, amount, currency, taskId, description, counterparty?, outcomeId?) => GovernanceLedgers` | 添加本地账本条目 | ✅ tested |
| `getBalance` | `(ledgers, currency) => number` | 查询指定货币余额 | ✅ tested |
| `getLedgerSummary` | `(ledgers) => {...}` | 获取账本汇总统计 | ✅ tested |

### 3.4 oracle.ts (227 行) -- 结果预言机

| 导出函数 | 签名 | 说明 | 状态 |
|----------|------|------|------|
| `createDefaultOracleRules` | `() => OracleRule[]` | 创建默认 Oracle 规则（local/testnet/mainnet 三级） | ✅ tested |
| `generateOutcomeReport` | `(task, actualResult, verificationMethod, evidenceGrade) => OutcomeReport` | 从已完成任务生成结果报告 | ✅ tested |
| `evaluateOutcome` | `(outcome, rules, ledgers) => OutcomeReport` | 根据规则评估结果可结算性 | ✅ tested |
| `settleOutcome` | `(outcome) => OutcomeReport` | 结算可结算的结果 | ✅ tested |
| `disputeOutcome` | `(outcome, reason) => OutcomeReport` | 对结果提出争议 | ✅ tested |
| `getOracleStats` | `(outcomes) => {...}` | 获取 Oracle 统计（总数/已结算/按信用目标分组） | ✅ tested |

### 3.5 fuse-matrix.ts (258 行) -- 权限保险丝

| 导出函数 | 签名 | 说明 | 状态 |
|----------|------|------|------|
| `createDefaultFuseMatrix` | `() => PermissionFuse[]` | 创建默认 L0-L4 保险丝矩阵 | ✅ tested |
| `checkPermission` | `(matrix, level) => { allowed, fuse, reason }` | 检查权限级别是否允许 | ✅ tested |
| `canAutoExecute` | `(matrix, level) => boolean` | 判断是否可自动执行 | ✅ tested |
| `createPermissionRequest` | `(taskId, role, level, action, description) => PermissionRequest` | 创建权限请求 | ✅ tested |
| `addApproval` | `(request, approver, decision, reason?) => PermissionRequest` | 添加审批意见 | ✅ tested |
| `isFullyApproved` | `(request, matrix) => boolean` | 判断是否已获得全部所需审批 | ✅ tested |
| `resolveRequest` | `(request, matrix) => PermissionRequest` | 解析请求最终状态 | ✅ tested |
| `getPermissionStats` | `(requests) => {...}` | 获取权限请求统计 | ✅ tested |
| `getLevelLabel` | `(level) => string` | 获取权限级别的英文标签 | ✅ tested |
| `getLevelColor` | `(level) => string` | 获取权限级别的颜色值 | ✅ tested |

### 3.6 promotion.ts (315 行) -- 节点晋升流水线

| 导出函数 | 签名 | 说明 | 状态 |
|----------|------|------|------|
| `createInitialNodeStatus` | `() => NodeStatus` | 创建 Stage-0 初始节点状态 | ✅ tested |
| `calculateNodeMetrics` | `(outcomes, ledgers, permissionRequests, startTime, tasks?) => NodeMetrics` | 计算节点运行指标 | ✅ tested |
| `calculatePromotionProgress` | `(nodeStatus, outcomes, ledgers, permissionRequests) => PromotionProgress` | 计算晋升进度（四维评分） | ✅ tested |
| `checkPromotionEligibility` | `(nodeStatus, outcomes, ledgers, permissionRequests) => { eligible, reasons }` | 检查是否满足晋升条件 | ✅ tested |
| `promoteNode` | `(nodeStatus) => NodeStatus` | 执行节点晋升 | ✅ tested |
| `getStageNumber` | `(stage) => number` | 从阶段字符串提取阶段编号 | ✅ tested |
| `getStageColor` | `(stage) => string` | 获取阶段颜色值 | ✅ tested |

导出常量：`STAGE_CONFIG` -- 五阶段完整配置（标签、描述、晋升门槛）

### 3.7 market.ts (285 行) -- 知识市场

| 导出函数 | 签名 | 说明 | 状态 |
|----------|------|------|------|
| `createEmptyMarket` | `() => MarketState` | 创建空白市场（初始 1000 SIM） | ✅ tested |
| `createPlaybookListing` | `(task, content, price, category, tags?) => PlaybookListing` | 从已完成任务创建剧本上架 | ✅ tested |
| `listPlaybook` | `(market, listing) => MarketState` | 将剧本上架到市场 | ✅ tested |
| `delistPlaybook` | `(market, listingId) => MarketState` | 下架剧本 | ✅ tested |
| `purchasePlaybook` | `(market, listingId, buyer) => { market, order, error? }` | 购买剧本（含余额校验、自购拦截） | ✅ tested |
| `executePlaybook` | `(market, orderId, result) => MarketState` | 记录剧本执行结果 | ✅ tested |
| `recordMarketTransaction` | `(ledgers, order, perspective) => GovernanceLedgers` | 将市场交易写入本地账本（买方/卖方双向） | ✅ tested |
| `getMarketStats` | `(market) => {...}` | 获取市场统计 | ✅ tested |
| `createDemoMarket` | `() => MarketState` | 创建含 3 个示范剧本的演示市场 | ✅ tested |

导出接口：`PlaybookListing` / `MarketOrder` / `MarketState`

### 3.8 index.ts (8 行) -- 桶导出

统一 re-export 以上 7 个模块的全部导出。

---

## 四、Zustand Store 接口

**文件：** `src/stores/v6.ts` | **482 行**

Store 名称：`useV6Store`，使用 `zustand/persist` 持久化到 localStorage。

### 初始化与重置

| action 方法 | 说明 |
|------------|------|
| `initialize()` | 初始化系统（幂等） |
| `reset()` | 重置全部状态到默认值 |

### UI 操作（5 个）

| action 方法 | 说明 |
|------------|------|
| `setActiveView(view)` | 切换主视图 |
| `selectTask(taskId?)` | 选中/取消选中任务 |
| `setLedgerType(type)` | 切换账本标签页 |
| `setTaskFilter(filter)` | 设置任务状态过滤器 |
| `toggleTrinityPanel(role)` | 展开/折叠三核面板 |

### 任务操作（5 个）

| action 方法 | 说明 |
|------------|------|
| `createNewTask(title, description, permissionLevel?)` | 创建任务并触发 AI-1 思考 |
| `submitProposal(taskId, content)` | AI-1 提交提案 -> 推进到审计阶段 |
| `submitAudit(taskId, findings, riskLevel?)` | AI-2 提交审计意见 -> 推进到审批阶段 |
| `submitApproval(taskId, approved, budget?)` | AI-3 提交审批决定 -> 推进到执行阶段 |
| `completeTask(taskId, result, evidenceGrade)` | 完成任务 -> 生成 OutcomeReport -> 自动结算 |
| `failTaskById(taskId, reason)` | 标记任务失败并写入判例 |

### 账本操作（6 个）

| action 方法 | 说明 |
|------------|------|
| `addEvidenceEntry(...)` | 添加证据 |
| `addValueEntry(...)` | 添加价值评估 |
| `addDebtEntry(...)` | 添加债务 |
| `resolveDebtEntry(debtId)` | 解决债务 |
| `addCaseLawEntry(...)` | 添加判例 |
| `addLedgerEntry(...)` | 添加本地账本条目 |

### 权限操作（3 个）

| action 方法 | 说明 |
|------------|------|
| `requestPermission(taskId, role, level, action)` | 发起权限请求 |
| `approvePermission(requestId, approver, reason?)` | 批准权限请求 |
| `denyPermission(requestId, approver, reason?)` | 拒绝权限请求 |

### 节点操作（3 个）

| action 方法 | 说明 |
|------------|------|
| `checkPromotion()` | 检查晋升资格 -> 返回 { eligible, reasons } |
| `promote()` | 执行晋升 -> 返回 boolean |
| `refreshMetrics()` | 刷新节点指标和时效状态 |

### 市场操作（4 个）

| action 方法 | 说明 |
|------------|------|
| `listPlaybookFromTask(taskId, price, category)` | 从已完成任务上架剧本 |
| `buyPlaybook(listingId)` | 购买剧本（双向记账） |
| `executeMarketPlaybook(orderId, result)` | 记录执行结果 |
| `getMarketStats()` | 获取市场统计 |

### 宪法操作（1 个）

| action 方法 | 说明 |
|------------|------|
| `completeMilestoneById(goalId, milestoneId)` | 标记里程碑完成 |

### 计算属性（3 个）

| 方法 | 说明 |
|------|------|
| `getFilteredTasks()` | 根据当前过滤器返回任务列表 |
| `getLedgerSummary()` | 返回账本汇总统计 |
| `getOracleStats()` | 返回 Oracle 统计 |
| `getPermissionStats()` | 返回权限请求统计 |

---

## 五、UI 组件清单

**目录：** `src/components/v6/` | **4 个组件，共 659 行**

| 组件 | 文件 | 行数 | Props 接口 | 功能 |
|------|------|------|-----------|------|
| `TrinityPanel` | TrinityPanel.tsx | 133 | `{ agent: TrinityAgent, tasks: TrinityTask[], expanded: boolean, onToggle: () => void, onAction?: (taskId, action) => void }` | 显示单个 AI 代理状态卡片：角色信息、当前状态（含动态脉冲指示器）、统计数据、关联任务列表 |
| `LedgerTable` | LedgerTable.tsx | 217 | `{ ledgers: GovernanceLedgers, selectedType: keyof GovernanceLedgers, onTypeChange: (type) => void }` | 六本账的标签切换表格：证据/价值/债务/时效/判例/本地账本，每种账本独立列配置 |
| `FuseMatrix` | FuseMatrix.tsx | 145 | `{ matrix: PermissionFuse[], requests: PermissionRequest[], onApprove?: (requestId) => void, onDeny?: (requestId) => void }` | L0-L4 保险丝矩阵可视化 + 待审批请求列表 + 人工批准/拒绝按钮 |
| `PromotionPipeline` | PromotionPipeline.tsx | 164 | `{ nodeStatus: NodeStatus }` | 五阶段晋升流水线可视化：阶段进度条、四维评分仪表盘、晋升条件清单 |

**主页面：** `src/pages/Trinity/index.tsx` | **446 行 / 6 个视图**

| 视图 | 说明 |
|------|------|
| `DashboardView` | 仪表盘：统计卡片 + 三核引擎面板 + 任务创建表单 + 事件流 |
| `MarketView` | 知识市场：市场统计 + 可购买剧本列表 + 订单历史 |
| `LedgersView` | 治理账本：委托给 `LedgerTable` 组件 |
| `OracleView` | 结果预言机：统计卡片 + 信用目标分布 + 结果报告表格 |
| `PermissionsView` | 权限矩阵：委托给 `FuseMatrix` 组件 |
| `NodeStatusView` | 节点晋升：委托给 `PromotionPipeline` 组件 |

---

## 六、测试资产

**目录：** `tests/unit/` | **4 个测试文件，共 188 个 test case，2,806 行**

| 测试文件 | 行数 | 用例数 | 覆盖范围 |
|----------|------|--------|----------|
| `v6-engine.test.ts` | 562 | 46 | 三核引擎（代理创建、任务生命周期、阶段推进、阻塞/失败处理） |
| `v6-functional.test.ts` | 575 | 38 | 纯函数测试（宪法校验、账本操作、Oracle 评估、保险丝逻辑） |
| `v6-integration.test.ts` | 1,233 | 72 | Store 集成测试（完整流水线、多任务并发、状态持久化、BUG 修复回归） |
| `v6-runtime-sim.test.ts` | 436 | 32 | 运行时模拟（晋升流程、市场交易、债务管理、指标计算） |

---

## 七、A 队可直接复用的资产

以下文件 A 队可以直接复制或以 git submodule / npm package 方式引用：

### 必须复用（共享契约）

| 文件 | 路径 | 说明 |
|------|------|------|
| **类型定义** | `src/types/v6.ts` | 两队共享的接口契约，A 队应在此基础上扩展而非重写 |

### 建议复用（已验证的引擎逻辑）

| 文件 | 路径 | 说明 |
|------|------|------|
| 宪法引擎 | `src/lib/v6/constitution.ts` | 宪法 CRUD + 校验 + 权限映射 |
| 三核引擎 | `src/lib/v6/engine.ts` | 三核编排流水线（proposal -> audit -> approval -> execution） |
| 账本引擎 | `src/lib/v6/ledger.ts` | 六本账完整 CRUD + 查询 + 汇总 |
| Oracle 引擎 | `src/lib/v6/oracle.ts` | 结果生成 + 规则评估 + 结算 |
| 保险丝引擎 | `src/lib/v6/fuse-matrix.ts` | L0-L4 权限检查 + 审批流 |
| 晋升引擎 | `src/lib/v6/promotion.ts` | 五阶段晋升逻辑 + 指标计算 |
| 市场引擎 | `src/lib/v6/market.ts` | 知识市场 CRUD + 交易 + 记账桥接 |
| 桶导出 | `src/lib/v6/index.ts` | 统一导出入口 |
| 测试套件 | `tests/unit/v6-*.test.ts` | 全部 188 个测试可直接运行 |
| 中文国际化 | `src/i18n/locales/zh/v6.json` | 86 个中文翻译键 |

### 可选复用（UI 层）

| 文件 | 路径 | 说明 |
|------|------|------|
| 组件套件 | `src/components/v6/*` | 4 个 React 组件，A 队可按需采纳或重写 UI |
| 主页面 | `src/pages/Trinity/index.tsx` | 完整治理仪表盘，含 6 个视图 |
| Zustand Store | `src/stores/v6.ts` | 完整状态管理，A 队可部分采纳 |

---

## 八、A 队需要新建的模块（B 队未实现）

以下六个模块属于白皮书范围但 B 队未实现。每个模块标注了与 B 队已有类型系统的扩展接口。

### 8.1 Identity / 密钥管理

**说明：** 节点身份系统，含密钥对生成、DID 绑定、身份验证。

**建议扩展的 B 队类型：**
- 扩展 `TrinityAgent`：添加 `identity?: NodeIdentity` 字段
- 新建 `NodeIdentity` 接口：`{ did: string, publicKey: string, createdAt: string }`
- 扩展 `V6SystemState`：添加 `identity: NodeIdentity` 字段

### 8.2 Docker 沙盒执行

**说明：** 将当前 `setTimeout` 模拟替换为真实的 Docker 容器内代码执行。

**建议扩展的 B 队类型：**
- 扩展 `TrinityTask`：添加 `sandbox?: SandboxConfig` 字段
- 新建 `SandboxConfig` 接口：`{ image: string, timeout: number, resources: ResourceLimits }`
- 扩展 `TrinityOutput`：添加 `sandboxResult?: SandboxResult` 字段

### 8.3 New.B 货币系统

**说明：** 真实代币经济系统，含铸造、转账、质押。

**建议扩展的 B 队类型：**
- `LocalLedgerEntry.currency` 已预留 `'NEW.B'` 值（无需修改类型）
- 新建 `NewBWallet` 接口：`{ address: string, balance: number, stakedAmount: number }`
- 扩展 `V6SystemState`：添加 `wallet: NewBWallet` 字段

### 8.4 PoO 验证引擎（Proof of Outcome）

**说明：** 链上结果证明，替换当前的本地 hash 验证。

**建议扩展的 B 队类型：**
- 扩展 `OutcomeReport`：添加 `pooProof?: PoOProof` 字段
- 新建 `PoOProof` 接口：`{ txHash: string, blockHeight: number, merkleRoot: string, verified: boolean }`
- 扩展 `OracleRule`：添加 `requiresPoO: boolean` 字段

### 8.5 双节点通信

**说明：** 节点间消息传递、状态同步、共识协议。

**建议扩展的 B 队类型：**
- 新建 `NodePeer` 接口：`{ nodeId: string, endpoint: string, stage: NodeStage, lastSeen: string }`
- 扩展 `V6SystemState`：添加 `peers: NodePeer[]` 字段
- 扩展 `V6EventType`：添加 `'peer:connected' | 'peer:message' | 'peer:sync'`

### 8.6 荷兰拍卖（Dutch Auction）

**说明：** 知识剧本的荷兰拍卖定价机制。

**建议扩展的 B 队类型：**
- 扩展 `PlaybookListing`（market.ts 中导出）：添加 `auctionConfig?: DutchAuctionConfig` 字段
- 新建 `DutchAuctionConfig` 接口：`{ startPrice: number, endPrice: number, decayRate: number, duration: number }`
- 扩展 `MarketOrder`：添加 `auctionPrice?: number` 字段

---

## 九、集成接口约定

以下是 A 队模块与 B 队模块的对接点。每个对接点定义了修改位置、方向和约束。

### 9.1 Identity -> TrinityAgent（代理身份绑定）

```
修改位置：src/types/v6.ts :: TrinityAgent
方向：A 队新增字段，B 队消费

TrinityAgent {
  ...现有字段...
  identity?: {           // A 队新增
    did: string          // 去中心化标识符
    publicKey: string    // 公钥（hex）
    verified: boolean    // 是否已链上验证
  }
}

约束：
- identity 字段必须是可选的（?），以兼容 B 队现有未绑定身份的代理
- B 队的 createTrinityAgents() 将返回 identity 为 undefined 的代理
- A 队负责在初始化时调用 bindIdentity() 填充此字段
```

### 9.2 New.B -> LocalLedgerEntry.currency（货币扩展）

```
修改位置：src/types/v6.ts :: LocalLedgerEntry.currency
方向：无修改需要，'NEW.B' 已在联合类型中

LocalLedgerEntry.currency: 'SIM' | 'TEST' | 'REAL' | 'NEW.B'
                                                       ^^^^^^^
                                                       已预留

约束：
- A 队可直接使用 addLocalLedgerEntry() 传入 currency='NEW.B'
- B 队的 getBalance(ledgers, 'NEW.B') 已可正常工作
- A 队需确保 New.B 交易走 L2+ 权限级别
```

### 9.3 PoO -> OutcomeReport（结果证明扩展）

```
修改位置：src/types/v6.ts :: OutcomeReport
方向：A 队新增字段，B 队 Oracle 引擎需感知

OutcomeReport {
  ...现有字段...
  pooProof?: {              // A 队新增
    txHash: string          // 链上交易哈希
    blockHeight: number     // 区块高度
    merkleRoot: string      // Merkle 根
    verified: boolean       // 链上验证状态
  }
}

约束：
- B 队的 evaluateOutcome() 可在规则中增加 PoO 校验分支
- 现有 reconciliationHash 字段继续保留（本地快速校验）
- PoO 验证失败不应覆盖本地已结算的结果
```

### 9.4 Docker Sandbox -> TrinityTask 执行（替换模拟）

```
修改位置：src/stores/v6.ts :: completeTask action
方向：A 队提供 SandboxExecutor，B 队 Store 调用

当前实现（B 队）：
  setTimeout(() => completeTask(task.id, result, 'H3'), 1600)

目标实现（A 队接入后）：
  const result = await sandboxExecutor.run(task, config)
  completeTask(task.id, result.output, result.evidenceGrade)

约束：
- SandboxExecutor 必须返回 { output: string, evidenceGrade: EvidenceGrade }
- 超时/失败时必须调用 failTaskById(taskId, reason)
- 沙盒执行结果的 evidenceGrade 由沙盒环境决定（非硬编码 H3）
```

---

> 文档结束。如有疑问请联系 B 队。建议两队先统一 `src/types/v6.ts` 的 git 分支，再各自开发上层模块。
