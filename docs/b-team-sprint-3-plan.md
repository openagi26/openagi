# Sprint 3 计划：A/B 队集成对接

> 编制：B-team 架构师（Claude Opus 4.6）
> 日期：2026-04-10
> 状态：待评审
> 对齐基准：A-team project-plan-B.md 里程碑 M2-M4

---

## 一、Sprint 3 目标

将 B-team 已完成的 6 层 V6 引擎（宪法层、Trinity 引擎、治理账本、Oracle、熔断矩阵、晋级管线、知识市场）与 A-team 正在构建的核心模块进行集成对接，形成统一的 V6 系统运行时。

### 关键交付物

| 编号 | 交付物 | 验收标准 |
|------|--------|---------|
| S3-D1 | Identity 类型 + 适配层 | B-team TrinityAgent 能绑定 A-team 身份密钥 |
| S3-D2 | New.B 货币集成 | LocalLedger 使用真实 New.B 余额替代 SIM 模拟 |
| S3-D3 | Docker 沙盒适配器 | Trinity 任务执行通过沙盒隔离运行 |
| S3-D4 | PoO 引擎对接 | Oracle 层使用 A-team 的 Proof-of-Outcome 替代本地验证 |
| S3-D5 | Trinity 引擎 AI 真实调用 | 用 Gateway RPC 替代 setTimeout 模拟 |
| S3-D6 | 3 个新 UI 视图 | 身份管理、经济仪表盘、沙盒状态面板 |
| S3-D7 | 集成测试套件 | 覆盖全部 A/B 对接点，可在 A-team 模块未就绪时降级 |

### 对齐 A-team 时间线

```
A-team M2 (Day 8-14)  ←  B-team Sprint 3 Phase 1 启动
  - identity 模块完善
  - governance 模块完善

A-team M3 (Day 15-24) ←  B-team Sprint 3 Phase 2 集成
  - newb 货币模块
  - poo 验证引擎
  - trinity AI 执行器
  - Docker 沙盒

A-team M4 (Day 25-35) ←  B-team Sprint 3 Phase 3 收尾
  - 知识市场（荷兰拍卖）
  - 蜂群扩展（双节点通信）
```

---

## 二、集成任务清单

### 2.1 Identity 模块集成

**A-team 交付**：密钥生成、身份绑定、持久化（M2-A1）

**B-team 改动**：

| 文件 | 改动内容 |
|------|---------|
| `src/types/v6.ts` | 新增 `AgentIdentity`、`KeyPair`、`IdentityBinding` 类型 |
| `src/lib/v6/engine.ts` | `createTrinityAgents()` 接受 identity 参数，绑定密钥到每个 AI 角色 |
| `src/stores/v6.ts` | V6Store 新增 `identity` 字段和 `bindIdentity`、`verifySignature` 方法 |
| `src/lib/v6/identity-adapter.ts` | **新建** - A-team identity 模块的适配层 |

**接口契约**：

```typescript
// B-team 定义，A-team 实现
interface IdentityProvider {
  generateKeyPair(): Promise<KeyPair>
  bindIdentity(agentId: string, keyPair: KeyPair): Promise<IdentityBinding>
  signData(privateKey: string, data: Uint8Array): Promise<Uint8Array>
  verifySignature(publicKey: string, data: Uint8Array, signature: Uint8Array): Promise<boolean>
  persistIdentity(binding: IdentityBinding): Promise<void>
  loadIdentity(agentId: string): Promise<IdentityBinding | null>
}
```

**集成测试需求**：
- 为三个 Trinity 角色各生成独立密钥对
- 身份绑定后签名/验签往返测试
- 持久化写入后重启恢复测试
- 无效密钥/篡改签名的拒绝测试

**负责 Agent**：Agent #12（身份安全专员）+ Agent #45（密码学审计）

---

### 2.2 New.B 货币模块集成

**A-team 交付**：初始分配、余额查询、减半逻辑（M3-1）

**B-team 改动**：

| 文件 | 改动内容 |
|------|---------|
| `src/types/v6.ts` | 新增 `NewBBalance`、`HalvingSchedule`、`NewBTransaction` 类型 |
| `src/lib/v6/ledger.ts` | `addLocalLedgerEntry()` 支持 `'NEW.B'` 货币的真实余额校验 |
| `src/lib/v6/market.ts` | `PlaybookListing.currency` 扩展为包含 `'NEW.B'` |
| `src/stores/v6.ts` | 新增 `economy` 字段：余额、减半进度、交易历史 |
| `src/lib/v6/economy-adapter.ts` | **新建** - A-team newb 模块的适配层 |

**接口契约**：

```typescript
// B-team 定义，A-team 实现
interface NewBProvider {
  getBalance(agentId: string): Promise<NewBBalance>
  transfer(from: string, to: string, amount: number, reason: string): Promise<NewBTransaction>
  getHalvingSchedule(): Promise<HalvingSchedule>
  getCurrentEpoch(): Promise<{ epoch: number; blockReward: number; blocksRemaining: number }>
  getTransactionHistory(agentId: string, limit?: number): Promise<NewBTransaction[]>
}
```

**集成测试需求**：
- 初始分配后余额校验
- 任务完成结算触发 New.B 转账
- 知识市场交易扣款/收款一致性
- 减半事件触发后奖励衰减验证
- 余额不足时交易拒绝

**负责 Agent**：Agent #67（经济系统架构师）+ Agent #89（账本审计员）

---

### 2.3 Docker 沙盒集成

**A-team 交付**：Docker 沙盒 / 子进程执行环境（M3-4）

**B-team 改动**：

| 文件 | 改动内容 |
|------|---------|
| `src/types/v6.ts` | 新增 `SandboxConfig`、`ContainerStatus`、`ExecutionResult` 类型 |
| `src/lib/v6/engine.ts` | 任务执行阶段（`phase: 'execution'`）调用沙盒而非本地执行 |
| `src/stores/v6.ts` | 新增 `sandbox` 字段：容器状态列表、执行日志 |
| `src/lib/v6/sandbox-adapter.ts` | **新建** - A-team Docker 沙盒的适配层 |

**接口契约**：

```typescript
// B-team 定义，A-team 实现
interface SandboxProvider {
  createContainer(config: SandboxConfig): Promise<string>  // 返回 containerId
  executeInContainer(containerId: string, command: string, timeout?: number): Promise<ExecutionResult>
  getContainerStatus(containerId: string): Promise<ContainerStatus>
  destroyContainer(containerId: string): Promise<void>
  listContainers(): Promise<ContainerStatus[]>
  getContainerLogs(containerId: string, lines?: number): Promise<string[]>
}
```

**集成测试需求**：
- 容器创建/销毁生命周期
- 任务执行超时处理
- 容器资源限制（CPU/Memory）验证
- 沙盒不可用时降级到子进程方案
- 并发容器隔离性

**负责 Agent**：Agent #23（基础设施工程师）+ Agent #101（安全沙盒专员）

---

### 2.4 PoO 验证引擎集成

**A-team 交付**：PoO 验证、Priority Score 计算（M3-2）

**B-team 改动**：

| 文件 | 改动内容 |
|------|---------|
| `src/types/v6.ts` | 新增 `PoOProof`、`PriorityScore`、`PoOVerification` 类型 |
| `src/lib/v6/oracle.ts` | `evaluateOutcome()` 集成 PoO 验证替代本地规则引擎 |
| `src/lib/v6/promotion.ts` | `calculatePromotionProgress()` 使用真实 Priority Score |
| `src/stores/v6.ts` | outcomes 的 `oracleVerdict` 由 PoO 引擎决定 |
| `src/lib/v6/poo-adapter.ts` | **新建** - A-team PoO 引擎的适配层 |

**接口契约**：

```typescript
// B-team 定义，A-team 实现
interface PoOProvider {
  submitOutcome(taskId: string, result: string, evidence: EvidenceEntry[]): Promise<PoOProof>
  verifyProof(proof: PoOProof): Promise<PoOVerification>
  calculatePriorityScore(agentId: string, outcomes: OutcomeReport[]): Promise<PriorityScore>
  getVerificationHistory(taskId: string): Promise<PoOVerification[]>
}
```

**集成测试需求**：
- 任务完成后自动生成 PoO 证明
- 证明验证通过/失败对 Oracle 裁决的影响
- Priority Score 计算与 Node 晋级的联动
- 伪造证明被拒绝

**负责 Agent**：Agent #34（Oracle 工程师）+ Agent #56（验证系统专员）

---

### 2.5 双节点通信集成

**A-team 交付**：双节点通信 PoC（M4-3）

**B-team 改动**：

| 文件 | 改动内容 |
|------|---------|
| `src/types/v6.ts` | 新增 `SwarmNode`、`SwarmMessage`、`PeerConnection` 类型 |
| `src/lib/v6/market.ts` | 知识市场支持跨节点交易 |
| `src/lib/v6/swarm-adapter.ts` | **新建** - A-team 蜂群通信的适配层 |

**接口契约**：

```typescript
// B-team 定义，A-team 实现
interface SwarmProvider {
  discoverPeers(): Promise<SwarmNode[]>
  connectPeer(nodeId: string): Promise<PeerConnection>
  sendMessage(peerId: string, message: SwarmMessage): Promise<void>
  onMessage(handler: (peerId: string, message: SwarmMessage) => void): () => void
  broadcastPlaybook(listing: PlaybookListing): Promise<void>
}
```

**集成测试需求**：
- 双节点发现与握手
- 知识市场跨节点 listing 同步
- 消息往返延迟 < 500ms
- 断线重连

**负责 Agent**：Agent #78（分布式系统专员）+ Agent #110（网络协议工程师）

---

### 2.6 知识市场升级（荷兰拍卖）

**A-team 交付**：荷兰式拍卖 MVP（M4-1）

**B-team 改动**：

| 文件 | 改动内容 |
|------|---------|
| `src/lib/v6/market.ts` | 新增 `DutchAuction` 类型和拍卖逻辑 |
| `src/types/v6.ts` | 扩展 market 相关事件类型 |
| `src/stores/v6.ts` | market 状态新增拍卖列表和竞价状态 |

**负责 Agent**：Agent #67（经济系统架构师）+ Agent #135（拍卖机制设计师）

---

## 三、类型扩展方案

以下类型定义扩展 `src/types/v6.ts`，在现有 403 行之后追加。

### 3.1 Identity 类型

```typescript
// ---------------------------------------------------------------------------
// Layer 7: Identity & Cryptography (A-team Integration)
// ---------------------------------------------------------------------------

export interface KeyPair {
  publicKey: string    // hex encoded
  privateKey: string   // hex encoded, encrypted at rest
  algorithm: 'ed25519' | 'secp256k1'
  createdAt: string
}

export interface IdentityBinding {
  agentId: string
  role: TrinityRole
  publicKey: string
  nodeFingerprint: string  // SHA-256(publicKey + role + nodeId)
  boundAt: string
  expiresAt?: string
  status: 'active' | 'revoked' | 'expired'
}

export interface SignedPayload<T = unknown> {
  data: T
  signature: string   // hex encoded
  signer: string      // publicKey of signer
  timestamp: string
}

export interface IdentityState {
  bindings: Record<TrinityRole, IdentityBinding | null>
  nodeId: string
  initialized: boolean
}
```

### 3.2 New.B 货币类型

```typescript
// ---------------------------------------------------------------------------
// Layer 8: New.B Economy (A-team Integration)
// ---------------------------------------------------------------------------

export interface NewBBalance {
  agentId: string
  available: number      // 可用余额
  locked: number         // 锁定余额（进行中的交易）
  total: number          // available + locked
  lastUpdated: string
}

export interface NewBTransaction {
  id: string
  from: string           // agentId
  to: string             // agentId
  amount: number
  fee: number
  reason: string
  taskId?: string
  outcomeId?: string
  status: 'pending' | 'confirmed' | 'failed' | 'reversed'
  timestamp: string
  blockHeight?: number
}

export interface HalvingSchedule {
  currentEpoch: number
  currentBlockReward: number
  blocksPerEpoch: number
  blocksInCurrentEpoch: number
  nextHalvingBlock: number
  halvingHistory: HalvingEvent[]
}

export interface HalvingEvent {
  epoch: number
  blockHeight: number
  previousReward: number
  newReward: number
  timestamp: string
}

export interface PoOScore {
  agentId: string
  score: number          // 0-1000
  rank: number
  components: {
    taskCompletionRate: number    // 0-100
    evidenceQuality: number      // 0-100
    settlementRate: number       // 0-100
    peerReviewScore: number      // 0-100
    uptimeScore: number          // 0-100
  }
  calculatedAt: string
}
```

### 3.3 Docker 沙盒类型

```typescript
// ---------------------------------------------------------------------------
// Layer 9: Execution Sandbox (A-team Integration)
// ---------------------------------------------------------------------------

export interface SandboxConfig {
  image: string            // Docker image name
  memoryLimitMb: number    // Memory limit
  cpuShares: number        // CPU shares (relative weight)
  timeoutSeconds: number   // Execution timeout
  networkEnabled: boolean  // Whether container has network access
  volumes?: VolumeMount[]
  envVars?: Record<string, string>
}

export interface VolumeMount {
  hostPath: string
  containerPath: string
  readOnly: boolean
}

export interface ContainerStatus {
  containerId: string
  taskId: string
  status: 'creating' | 'running' | 'paused' | 'exiting' | 'stopped' | 'error'
  image: string
  createdAt: string
  startedAt?: string
  stoppedAt?: string
  exitCode?: number
  memoryUsageMb?: number
  cpuPercent?: number
  error?: string
}

export interface ExecutionResult {
  containerId: string
  taskId: string
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
  resourceUsage: {
    peakMemoryMb: number
    avgCpuPercent: number
  }
  success: boolean
  error?: string
}

export interface SandboxState {
  containers: ContainerStatus[]
  available: boolean        // Docker daemon reachable
  fallbackMode: boolean     // Using subprocess instead of Docker
  totalExecutions: number
  failedExecutions: number
}
```

### 3.4 PoO 验证类型

```typescript
// ---------------------------------------------------------------------------
// Layer 10: Proof-of-Outcome Verification (A-team Integration)
// ---------------------------------------------------------------------------

export interface PoOProof {
  id: string
  taskId: string
  outcomeId: string
  proofData: string        // serialized proof
  hash: string             // SHA-256 of proofData
  submittedBy: string      // agentId
  timestamp: string
}

export interface PoOVerification {
  proofId: string
  verified: boolean
  verifierId: string       // agentId of verifier
  confidence: number       // 0-100
  reason: string
  timestamp: string
}

export interface PriorityScore {
  agentId: string
  score: number            // composite score 0-1000
  breakdown: {
    outcomeQuality: number
    verificationRate: number
    economicContribution: number
    uptime: number
  }
  rank: number
  percentile: number       // 0-100
  calculatedAt: string
}
```

### 3.5 蜂群通信类型

```typescript
// ---------------------------------------------------------------------------
// Layer 11: Swarm Communication (A-team Integration)
// ---------------------------------------------------------------------------

export interface SwarmNode {
  nodeId: string
  publicKey: string
  address: string          // host:port
  status: 'online' | 'offline' | 'syncing'
  lastSeen: string
  capabilities: string[]   // e.g., ['market', 'execution', 'oracle']
  nodeStage: NodeStage
}

export interface SwarmMessage {
  id: string
  type: 'playbook-broadcast' | 'peer-request' | 'outcome-share' | 'heartbeat'
  sender: string           // nodeId
  recipient: string        // nodeId or 'broadcast'
  payload: unknown
  signature: string
  timestamp: string
}

export interface PeerConnection {
  peerId: string
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  latencyMs: number
  connectedAt?: string
  lastMessageAt?: string
}
```

### 3.6 扩展 V6SystemState

```typescript
// 更新 V6SystemState，新增集成模块状态
export interface V6SystemStateExtended extends V6SystemState {
  identity: IdentityState
  economy: {
    balances: Record<string, NewBBalance>
    halving: HalvingSchedule
    transactions: NewBTransaction[]
    pooScores: Record<string, PoOScore>
  }
  sandbox: SandboxState
  swarm: {
    localNode: SwarmNode | null
    peers: SwarmNode[]
    connections: PeerConnection[]
  }
}

// 扩展 V6View，新增 UI 视图
export type V6ViewExtended = V6View
  | 'identity'          // 身份管理
  | 'economy'           // 经济仪表盘
  | 'sandbox'           // 沙盒状态
  | 'swarm'             // 蜂群网络

// 扩展事件类型
export type V6EventTypeExtended = V6EventType
  | 'identity:bound'
  | 'identity:revoked'
  | 'economy:transfer'
  | 'economy:halving'
  | 'sandbox:created'
  | 'sandbox:completed'
  | 'sandbox:failed'
  | 'poo:submitted'
  | 'poo:verified'
  | 'swarm:peer-connected'
  | 'swarm:peer-disconnected'
  | 'swarm:message-received'
```

---

## 四、Trinity 引擎升级

### 4.1 现状分析

当前 Trinity 引擎 (`src/lib/v6/engine.ts`) 使用纯函数式管线处理：
- `runProposalPhase()` - AI-1 提案（同步调用，内容由参数传入）
- `runAuditPhase()` - AI-2 审计（同步调用，结果由参数传入）
- `runApprovalPhase()` - AI-3 审批（同步调用，决策由参数传入）

所有"AI 思考"都是调用者提供结果的传递函数，没有真实 AI 调用。

### 4.2 升级方案：Gateway RPC 适配器

B-team 已有完整的 Gateway RPC 系统 (`src/lib/gateway-client.ts`)，支持 WebSocket 连接、JSON-RPC 调用、Provider 管理。

新建适配器文件：`src/lib/v6/trinity-gateway-adapter.ts`

```typescript
// 适配器接口定义
interface TrinityGatewayAdapter {
  // 通过 Gateway RPC 调用真实 AI provider
  invokeAI(
    role: TrinityRole,
    prompt: string,
    context: TrinityTaskContext
  ): Promise<AIResponse>

  // 流式调用（用于 UI 实时显示 AI 思考过程）
  invokeAIStream(
    role: TrinityRole,
    prompt: string,
    context: TrinityTaskContext,
    onChunk: (chunk: string) => void
  ): Promise<AIResponse>

  // 检查 Gateway 连接状态
  isConnected(): boolean

  // 降级：Gateway 不可用时使用模拟
  getFallbackMode(): boolean
}

interface TrinityTaskContext {
  task: TrinityTask
  constitution: Constitution
  recentEvidence: EvidenceEntry[]
  permissionLevel: PermissionLevel
  ledgerSummary: LedgerSummary
}

interface AIResponse {
  content: string
  model: string
  tokensUsed: number
  latencyMs: number
  metadata: Record<string, unknown>
}

// 每个 Trinity 角色映射到不同的 system prompt + provider
interface RoleProviderMapping {
  'ai1-expander': {
    providerId: string       // 指向 Gateway 中配置的 provider
    systemPrompt: string     // 扩张者角色定义
    temperature: number      // 创造性较高
    maxTokens: number
  }
  'ai2-auditor': {
    providerId: string
    systemPrompt: string     // 审计者角色定义
    temperature: number      // 精确性较高
    maxTokens: number
  }
  'ai3-governor': {
    providerId: string
    systemPrompt: string     // 治理者角色定义
    temperature: number      // 平衡
    maxTokens: number
  }
}
```

### 4.3 集成步骤

**Phase 1：适配层（不改现有引擎）**

```
src/lib/v6/trinity-gateway-adapter.ts  -- 新建
  |
  +--> 导入 GatewayBrowserClient from '@/lib/gateway-client'
  +--> 导入 RoleProviderMapping 配置
  +--> 实现 invokeAI() 方法：
       1. 从 RoleProviderMapping 获取角色配置
       2. 调用 gateway.rpc('chat.completions', { provider, messages, ... })
       3. 解析响应，包装为 AIResponse
       4. 失败时返回 fallback 模拟结果
```

**Phase 2：引擎调用替换**

修改 `src/stores/v6.ts` 中的三个方法：

```
submitProposal(taskId, content)   -->  submitProposal(taskId)
  现状：content 由调用者传入          目标：调用 adapter.invokeAI('ai1-expander', ...)

submitAudit(taskId, findings)     -->  submitAudit(taskId)
  现状：findings 由调用者传入         目标：调用 adapter.invokeAI('ai2-auditor', ...)

submitApproval(taskId, approved)  -->  submitApproval(taskId)
  现状：approved 由调用者传入         目标：调用 adapter.invokeAI('ai3-governor', ...)
```

**Phase 3：流式 UI 集成**

修改 `src/components/v6/TrinityPanel.tsx`，添加流式输出显示：
- AI 思考时展示打字机效果
- 实时显示 token 消耗
- 超时/错误降级提示

### 4.4 降级策略

```
Gateway 可用且 Provider 配置完成  -->  真实 AI 调用
Gateway 可用但无 Provider         -->  显示配置引导
Gateway 不可用                    -->  回退到参数传入模式（当前行为）
```

---

## 五、UI 扩展计划

### 5.1 身份管理视图

**文件**：`src/pages/Identity/Identity.tsx`（新建）

**功能**：
- 显示三个 Trinity 角色的身份绑定状态
- 密钥指纹展示（截断显示，点击复制完整公钥）
- 身份绑定/吊销操作按钮
- 签名验证测试工具

**组件依赖**：
- `src/components/v6/IdentityCard.tsx`（新建）- 单个角色的身份卡片
- `src/components/v6/KeyFingerprint.tsx`（新建）- 密钥指纹展示组件

**Store 扩展**：`useV6Store` 新增 `identity` slice

### 5.2 经济仪表盘

**文件**：`src/pages/Economy/Economy.tsx`（新建，替代 A-team 的空 Economy 目录）

**功能**：
- New.B 余额卡片（可用/锁定/总计）
- PoO Score 仪表盘（雷达图展示 5 个评分维度）
- 减半进度条（当前 epoch、下次减半倒计时、历史减半事件时间线）
- 最近交易列表（按时间倒序）
- 经济概览统计（总发行量、流通量、销毁量）

**组件依赖**：
- `src/components/v6/BalanceCard.tsx`（新建）
- `src/components/v6/PoORadar.tsx`（新建）- Priority Score 雷达图
- `src/components/v6/HalvingProgress.tsx`（新建）- 减半进度组件
- `src/components/v6/TransactionList.tsx`（新建）

**Store 扩展**：`useV6Store` 新增 `economy` slice

### 5.3 沙盒状态面板

**文件**：`src/pages/Sandbox/Sandbox.tsx`（新建）

**功能**：
- Docker daemon 连接状态指示
- 运行中容器列表（ID、任务、状态、资源占用）
- 执行历史（成功/失败/超时统计）
- 降级模式指示（Docker/子进程）
- 容器日志查看器

**组件依赖**：
- `src/components/v6/ContainerCard.tsx`（新建）
- `src/components/v6/SandboxHealthBar.tsx`（新建）
- `src/components/v6/ExecutionLog.tsx`（新建）

**Store 扩展**：`useV6Store` 新增 `sandbox` slice

### 5.4 导航更新

修改 `src/App.tsx` 路由表和 `src/components/layout/` 导航组件，新增三个页面入口：
- Identity（身份）- 图标：钥匙
- Economy（经济）- 图标：货币
- Sandbox（沙盒）- 图标：容器

---

## 六、测试策略

### 6.1 分层测试架构

```
tests/
  unit/
    v6-identity-adapter.test.ts      -- Identity 适配层单元测试
    v6-economy-adapter.test.ts       -- Economy 适配层单元测试
    v6-sandbox-adapter.test.ts       -- Sandbox 适配层单元测试
    v6-poo-adapter.test.ts           -- PoO 适配层单元测试
    v6-swarm-adapter.test.ts         -- Swarm 适配层单元测试
    v6-trinity-gateway.test.ts       -- Trinity Gateway 适配器测试
    v6-type-extensions.test.ts       -- 类型扩展兼容性测试
  integration/
    v6-identity-engine.test.ts       -- Identity + Engine 集成
    v6-economy-ledger.test.ts        -- Economy + Ledger 集成
    v6-sandbox-engine.test.ts        -- Sandbox + Engine 集成
    v6-poo-oracle.test.ts            -- PoO + Oracle 集成
    v6-fullchain.test.ts             -- 全链路集成测试
  e2e/
    v6-identity-ui.spec.ts           -- 身份管理 UI 端到端
    v6-economy-ui.spec.ts            -- 经济仪表盘 UI 端到端
    v6-sandbox-ui.spec.ts            -- 沙盒面板 UI 端到端
```

### 6.2 Mock 策略（A-team 模块未就绪时）

为每个 Provider 接口创建对应的 Mock 实现：

```
src/lib/v6/mocks/
  mock-identity-provider.ts          -- 使用 crypto.subtle 模拟密钥
  mock-newb-provider.ts              -- 内存余额账本模拟
  mock-sandbox-provider.ts           -- 子进程模拟 Docker
  mock-poo-provider.ts               -- 基于规则的本地验证
  mock-swarm-provider.ts             -- EventEmitter 模拟点对点
```

**Mock 实现原则**：
1. Mock 接口与真实接口完全一致（同一个 TypeScript interface）
2. Mock 保持有状态——跨测试调用能体现副作用
3. Mock 包含可配置的失败注入（`failRate`、`latencyMs`）
4. 通过 DI（依赖注入）切换 Mock/真实实现，无需改业务代码

### 6.3 测试覆盖目标

| 测试层 | 现有 | Sprint 3 新增 | 目标总计 |
|--------|------|-------------|---------|
| 单元测试 | ~70 | +40 | ~110 |
| 集成测试 | ~7 | +15 | ~22 |
| E2E 测试 | 6 | +3 | 9 |
| **合计** | **~83** | **+58** | **~141** |

### 6.4 CI 集成

```yaml
# 新增 GitHub Actions step
- name: V6 Integration Tests
  run: |
    pnpm test -- --grep "v6-" --reporter=verbose
    pnpm test:integration -- --grep "v6-"
  env:
    V6_USE_MOCKS: true
    V6_MOCK_FAIL_RATE: 0
```

---

## 七、时间线

### Phase 1：类型与接口（Day 8-11，与 A-team M2 并行）

| 天数 | B-team 任务 | A-team 对应 | 产出 |
|------|------------|------------|------|
| Day 8 | 定义全部 Provider 接口和新增类型 | M2-A1 identity 开发中 | `v6.ts` 类型扩展 |
| Day 9 | 创建 5 个 Adapter 文件和 5 个 Mock 文件 | M2-A1 继续 | adapter + mock 文件 |
| Day 10 | 编写适配层单元测试（使用 Mock） | M2-A2 governance | 40 个新单元测试 |
| Day 11 | Identity adapter 与 A-team M2-A1 产出对接 | M2-A1 交付 | 首个真实集成 |

### Phase 2：引擎集成（Day 12-20，与 A-team M3 并行）

| 天数 | B-team 任务 | A-team 对应 | 产出 |
|------|------------|------------|------|
| Day 12-13 | Trinity Gateway 适配器开发 | M3-3 trinity AI | 真实 AI 调用管线 |
| Day 14-15 | Economy 集成（Ledger + Market） | M3-1 newb 模块 | New.B 余额实时同步 |
| Day 16-17 | Sandbox 集成（Engine execution） | M3-4 Docker 沙盒 | 任务在容器中执行 |
| Day 18-19 | PoO 集成（Oracle + Promotion） | M3-2 poo 引擎 | 真实 PoO 验证 |
| Day 20 | 集成测试 + 全链路验证 | M3-7 集成测试 | 15 个集成测试通过 |

### Phase 3：UI + 收尾（Day 21-26）

| 天数 | B-team 任务 | A-team 对应 | 产出 |
|------|------------|------------|------|
| Day 21-22 | Identity + Economy UI 页面 | M3-5 经济前端 | 两个新页面上线 |
| Day 23-24 | Sandbox UI + 导航更新 | M3-6 Trinity 面板 | 第三个页面 + 路由 |
| Day 25 | 蜂群通信适配（如 A-team M4-3 就绪） | M4-3 双节点 PoC | 跨节点市场 |
| Day 26 | E2E 测试 + 文档 | M4-6 E2E 测试 | Sprint 3 交付 |

### 关键里程碑

```
Day 11  -- 首次真实集成验证（Identity adapter + A-team identity 模块）
Day 15  -- 经济系统打通（New.B 余额在 UI 可见）
Day 20  -- 全链路集成测试通过（Mock 或真实）
Day 26  -- Sprint 3 交付评审
```

---

## 八、风险与降级方案

### 8.1 风险矩阵

| 风险 | 概率 | 影响 | 降级方案 |
|------|------|------|---------|
| A-team Identity 模块延迟 | 中 | 高 | 使用 `mock-identity-provider.ts`（crypto.subtle 本地密钥） |
| A-team Docker 沙盒不可用 | 高 | 中 | 使用子进程方案（`child_process.spawn`），`SandboxState.fallbackMode = true` |
| A-team New.B 模块延迟 | 中 | 中 | 继续使用 `SIM` 模拟货币，Mock 提供减半逻辑 |
| A-team PoO 引擎延迟 | 低 | 高 | 保留现有 `evaluateOutcome()` 本地规则引擎 |
| Gateway 不可用导致 Trinity 真实调用失败 | 中 | 高 | 自动降级到参数传入模式，UI 显示降级指示 |
| 双节点通信 PoC 未完成 | 高 | 低 | 知识市场保持单节点运行，Swarm 类型预定义但不实现 |
| 接口契约 A/B 队不一致 | 中 | 高 | 每周五 Demo 对齐接口，适配层做中间翻译 |

### 8.2 Stub 实现清单

当 A-team 模块不可用时，B-team 使用以下 Stub：

```
src/lib/v6/stubs/
  stub-identity.ts
    - generateKeyPair(): 返回 crypto.subtle.generateKey(Ed25519) 生成的密钥对
    - bindIdentity(): 存入 localStorage
    - signData/verifySignature(): 使用 Web Crypto API

  stub-newb.ts
    - getBalance(): 返回初始分配 1000 NEW.B
    - transfer(): 内存扣款/收款，不持久化
    - getHalvingSchedule(): 硬编码 4 epoch 减半表

  stub-sandbox.ts
    - createContainer(): 返回 uuid，不真正启动 Docker
    - executeInContainer(): child_process.spawn 执行命令
    - getContainerStatus(): 返回模拟状态
    - destroyContainer(): no-op

  stub-poo.ts
    - submitOutcome(): 基于 EvidenceGrade 生成 proof hash
    - verifyProof(): H1/H2 通过，H3/H4 需人工审查
    - calculatePriorityScore(): 基于现有 NodeMetrics 计算
```

### 8.3 切换机制

```typescript
// src/lib/v6/provider-registry.ts (新建)
import type { IdentityProvider } from './identity-adapter'
import type { NewBProvider } from './economy-adapter'
import type { SandboxProvider } from './sandbox-adapter'
import type { PoOProvider } from './poo-adapter'

interface V6ProviderRegistry {
  identity: IdentityProvider
  economy: NewBProvider
  sandbox: SandboxProvider
  poo: PoOProvider
}

// 环境变量控制：V6_USE_STUBS=true 使用 stub，否则使用真实 A-team 模块
function createProviderRegistry(): V6ProviderRegistry {
  const useStubs = import.meta.env.VITE_V6_USE_STUBS === 'true'

  return {
    identity: useStubs ? new StubIdentity() : new ATeamIdentity(),
    economy: useStubs ? new StubNewB() : new ATeamNewB(),
    sandbox: useStubs ? new StubSandbox() : new ATeamSandbox(),
    poo: useStubs ? new StubPoO() : new ATeamPoO(),
  }
}
```

---

## 附录 A：文件变更清单

### 修改文件

| 文件 | 改动范围 |
|------|---------|
| `src/types/v6.ts` | 追加 ~200 行类型定义（Layer 7-11 + 扩展类型） |
| `src/lib/v6/engine.ts` | 执行阶段调用 sandbox，agent 绑定 identity |
| `src/lib/v6/ledger.ts` | LocalLedgerEntry 支持 NEW.B 真实余额校验 |
| `src/lib/v6/oracle.ts` | evaluateOutcome() 集成 PoO 验证 |
| `src/lib/v6/promotion.ts` | 使用真实 PriorityScore |
| `src/lib/v6/market.ts` | 支持 NEW.B 货币 + 荷兰拍卖 + 跨节点 |
| `src/lib/v6/index.ts` | 导出新模块 |
| `src/stores/v6.ts` | 新增 identity/economy/sandbox slice |
| `src/App.tsx` | 新增三个路由 |

### 新建文件

| 文件 | 用途 |
|------|------|
| `src/lib/v6/identity-adapter.ts` | Identity Provider 适配层 |
| `src/lib/v6/economy-adapter.ts` | New.B Provider 适配层 |
| `src/lib/v6/sandbox-adapter.ts` | Sandbox Provider 适配层 |
| `src/lib/v6/poo-adapter.ts` | PoO Provider 适配层 |
| `src/lib/v6/swarm-adapter.ts` | Swarm Provider 适配层 |
| `src/lib/v6/trinity-gateway-adapter.ts` | Trinity Gateway RPC 适配器 |
| `src/lib/v6/provider-registry.ts` | Provider 注册与切换 |
| `src/lib/v6/stubs/stub-identity.ts` | Identity Stub |
| `src/lib/v6/stubs/stub-newb.ts` | New.B Stub |
| `src/lib/v6/stubs/stub-sandbox.ts` | Sandbox Stub |
| `src/lib/v6/stubs/stub-poo.ts` | PoO Stub |
| `src/lib/v6/mocks/mock-identity-provider.ts` | 测试用 Mock |
| `src/lib/v6/mocks/mock-newb-provider.ts` | 测试用 Mock |
| `src/lib/v6/mocks/mock-sandbox-provider.ts` | 测试用 Mock |
| `src/lib/v6/mocks/mock-poo-provider.ts` | 测试用 Mock |
| `src/lib/v6/mocks/mock-swarm-provider.ts` | 测试用 Mock |
| `src/pages/Identity/Identity.tsx` | 身份管理页面 |
| `src/pages/Economy/Economy.tsx` | 经济仪表盘页面 |
| `src/pages/Sandbox/Sandbox.tsx` | 沙盒状态页面 |
| `src/components/v6/IdentityCard.tsx` | 身份卡片组件 |
| `src/components/v6/KeyFingerprint.tsx` | 密钥指纹组件 |
| `src/components/v6/BalanceCard.tsx` | 余额卡片组件 |
| `src/components/v6/PoORadar.tsx` | PoO 雷达图组件 |
| `src/components/v6/HalvingProgress.tsx` | 减半进度组件 |
| `src/components/v6/TransactionList.tsx` | 交易列表组件 |
| `src/components/v6/ContainerCard.tsx` | 容器卡片组件 |
| `src/components/v6/SandboxHealthBar.tsx` | 沙盒健康指示 |
| `src/components/v6/ExecutionLog.tsx` | 执行日志组件 |

### 新建测试文件

| 文件 | 测试内容 |
|------|---------|
| `tests/unit/v6-identity-adapter.test.ts` | Identity 适配层 |
| `tests/unit/v6-economy-adapter.test.ts` | Economy 适配层 |
| `tests/unit/v6-sandbox-adapter.test.ts` | Sandbox 适配层 |
| `tests/unit/v6-poo-adapter.test.ts` | PoO 适配层 |
| `tests/unit/v6-swarm-adapter.test.ts` | Swarm 适配层 |
| `tests/unit/v6-trinity-gateway.test.ts` | Gateway 适配器 |
| `tests/unit/v6-type-extensions.test.ts` | 类型兼容性 |
| `tests/integration/v6-identity-engine.test.ts` | Identity + Engine |
| `tests/integration/v6-economy-ledger.test.ts` | Economy + Ledger |
| `tests/integration/v6-sandbox-engine.test.ts` | Sandbox + Engine |
| `tests/integration/v6-poo-oracle.test.ts` | PoO + Oracle |
| `tests/integration/v6-fullchain.test.ts` | 全链路 |
| `tests/e2e/v6-identity-ui.spec.ts` | 身份 UI |
| `tests/e2e/v6-economy-ui.spec.ts` | 经济 UI |
| `tests/e2e/v6-sandbox-ui.spec.ts` | 沙盒 UI |

---

## 附录 B：Agent 分工汇总

| Agent 编号 | 专长 | 负责模块 |
|-----------|------|---------|
| #12 | 身份安全专员 | Identity 适配层 + Stub |
| #23 | 基础设施工程师 | Sandbox 适配层 + Stub |
| #34 | Oracle 工程师 | PoO 适配层 + Stub |
| #45 | 密码学审计 | Identity 类型设计 + 安全审查 |
| #56 | 验证系统专员 | PoO 类型设计 + 验证逻辑 |
| #67 | 经济系统架构师 | Economy 适配层 + 类型 + 荷兰拍卖 |
| #78 | 分布式系统专员 | Swarm 适配层 |
| #89 | 账本审计员 | Economy Ledger 集成测试 |
| #101 | 安全沙盒专员 | Sandbox 安全测试 |
| #110 | 网络协议工程师 | Swarm 通信测试 |
| #120 | 前端架构师 | 三个新 UI 页面 |
| #135 | 拍卖机制设计师 | 荷兰拍卖 UI + 逻辑 |
| #142 | 集成测试工程师 | 全链路集成测试 |
| #156 | 文档工程师 | 接口文档 + API 参考 |
