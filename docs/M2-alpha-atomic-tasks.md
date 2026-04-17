# OpenAGI 里程碑2 Alpha轨道 — 原子任务清单

> 编制：高级项目经理（GLM-5.1）
> 日期：2026-04-10
> 依据：M1全部交付 + B队v6.ts类型契约 + B队Sprint 3计划 + ab-integration-strategy.md + 计划B M2门控标准
> 目标：Identity/New.B/PoO/Sandbox四模块加固+测试覆盖，v6.ts类型兼容性对齐，5个Provider接口实现，adapter.ts桥接层

---

## 前置数据摘要

### M1交付基线
| 指标 | 结果 |
|------|------|
| typecheck | 0 错误 |
| lint | 0 errors |
| tests | 625/625 通过 |
| 冒烟验证 | 6/6 通过 |
| 架构审查 | 通过 |
| 沙盒降级 | 进程隔离已确认 |
| Identity IPC | Host API HTTP 模式已确认 |

### B队接口契约关键差异
| A队（我们的模块） | B队（v6.ts） | 差异类型 | 处理方式 |
|-------------------|-------------|---------|---------|
| `TrinityRole = 'AI-1' \| 'AI-2' \| 'AI-3'` | `TrinityRole = 'ai1-expander' \| 'ai2-auditor' \| 'ai3-governor'` | 命名差异 | 适配层映射 |
| `EvidenceLevel` enum | `EvidenceGrade` type | 名称差异，值相同(H1-H4) | 适配层映射 |
| `EvidenceLevel.H4` = 最高 | `EvidenceGrade.H1` = 最高（注释写"Reproducible"） | **排序反转** | 需确认B队注释是否正确 |
| `NodeIdentity` (我们的) | `IdentityState` (B队扩展) | 字段不同 | 实现IdentityProvider接口 |
| `NewBLedger` (我们的) | `NewBBalance`+`HalvingSchedule` (B队) | 结构不同 | 实现NewBProvider接口 |
| `PoOTask`/`SandboxResult` (我们的) | `PoOProof`/`ExecutionResult` (B队) | 结构不同 | 实现对应Provider接口 |
| Host API HTTP (99 API) | Provider接口模式 | 架构差异 | 适配层桥接 |

### B队定义的5个Provider接口（A队需实现）
1. **IdentityProvider** — generateKeyPair/bindIdentity/signData/verifySignature/persistIdentity/loadIdentity
2. **NewBProvider** — getBalance/transfer/getHalvingSchedule/getCurrentEpoch/getTransactionHistory
3. **SandboxProvider** — createContainer/executeInContainer/getContainerStatus/destroyContainer/listContainers/getContainerLogs
4. **PoOProvider** — submitOutcome/verifyProof/calculatePriorityScore/getVerificationHistory
5. **SwarmProvider**（M3范围） — discoverPeers/connectPeer/sendMessage/onMessage/broadcastPlaybook

---

## 任务清单

### M2-A1 v6.ts 类型兼容性验证与映射表

**负责人**：后端
**估算时间**：45 分钟
**优先级**：P0（所有后续任务的前置）

**描述**：对比 A队现有模块类型（`electron/identity/index.ts`、`electron/newb/index.ts`、`electron/poo/index.ts`、`electron/trinity/docker-sandbox.ts`）与 B队 `docs/v6-types-contract.ts` 的类型定义，产出完整的类型映射表文档，识别所有命名冲突、字段差异、排序差异。

**验收标准**：
- 产出 `docs/m2-type-mapping.md`，包含：
  - 所有重叠类型的逐一映射（A队类型 → B队类型）
  - 需要适配层的差异清单
  - `EvidenceGrade.H1` 排序问题的明确结论（B队注释说H1最高，但代码值与A队相同）
- 映射表经后端确认无遗漏

**涉及文件**：
- `docs/v6-types-contract.ts`（B队类型）
- `electron/identity/index.ts`（A队 NodeIdentity）
- `electron/governance/index.ts`（A队 EvidenceEntry）
- `electron/newb/index.ts`（A队 NewBLedger）
- `electron/poo/index.ts`（A队 PoOTask/SandboxResult）
- `electron/trinity/docker-sandbox.ts`（A队 SandboxExecution）

**依赖**：无

---

### M2-A2 命名适配层实现

**负责人**：后端
**估算时间**：45 分钟
**优先级**：P0（Provider接口依赖此适配层）

**描述**：基于 M2-A1 的映射表，创建适配层模块 `electron/v6-adapter.ts`，实现 A队类型 ↔ B队类型的双向转换函数。

核心映射函数：
1. `mapTrinityRole(aTeam: 'AI-1'|'AI-2'|'AI-3') → BTeamTrinityRole` — `'AI-1'↔'ai1-expander'`、`'AI-2'↔'ai2-auditor'`、`'AI-3'↔'ai3-governor'`
2. `mapEvidenceLevel(level: EvidenceLevel) → EvidenceGrade` — 值相同(H1-H4)，仅类型名不同
3. `mapNodeIdentity(identity: NodeIdentity) → IdentityState` — 字段映射
4. `mapNewBLedger(ledger: NewBLedger) → { balance: NewBBalance, halving: HalvingSchedule }`
5. `mapSandboxResult(result: SandboxExecution) → ExecutionResult`
6. `mapPoOTask(task: PoOTask) → PoOProof`（状态映射：verified→verified等）

**验收标准**：
- 适配层文件创建完成，所有映射函数有 JSDoc 注释
- `pnpm run typecheck` 通过
- `pnpm run lint` 无新增错误
- 每个映射函数有对应的单元测试（M2-A3 中覆盖）

**涉及文件**：
- `electron/v6-adapter.ts`（新建）
- `electron/v6-types.ts`（新建，从 `docs/v6-types-contract.ts` 复制或引用B队类型）

**依赖**：M2-A1

---

### M2-A3 适配层单元测试

**负责人**：质检
**估算时间**：45 分钟
**优先级**：P0

**描述**：为 M2-A2 的适配层编写单元测试，覆盖所有映射函数的正向和反向转换，特别关注边界情况。

测试要点：
1. TrinityRole 双向映射（6个case）
2. EvidenceLevel↔EvidenceGrade 映射（8个case：H1-H4 双向）
3. NodeIdentity→IdentityState 字段映射（完整/缺失字段）
4. NewBLedger→NewBBalance+HalvingSchedule 结构重组
5. SandboxExecution→ExecutionResult 字段映射（method=docker vs process）
6. PoOTask→PoOProof 状态映射（verified/failed/discarded）
7. 空值/null 输入的防御性处理

**验收标准**：
- 测试文件创建于 `tests/unit/v6-adapter.test.ts`
- 覆盖率 ≥ 90%
- `pnpm test` 全部通过（含现有625个测试）

**涉及文件**：
- `tests/unit/v6-adapter.test.ts`（新建）

**依赖**：M2-A2

---

### M2-A4 IdentityProvider 接口实现

**负责人**：后端
**估算时间**：60 分钟
**优先级**：P0

**描述**：基于现有 `electron/identity/index.ts` 的 `IdentityManager` 类，实现 B队定义的 `IdentityProvider` 接口。该接口被 B队的 `TrinityAgent` 消费，为三个 AI 角色绑定密钥身份。

需实现的接口方法：
```typescript
interface IdentityProvider {
  generateKeyPair(): Promise<KeyPair>
  bindIdentity(agentId: string, keyPair: KeyPair): Promise<IdentityBinding>
  signData(privateKey: string, data: Uint8Array): Promise<Uint8Array>
  verifySignature(publicKey: string, data: Uint8Array, signature: Uint8Array): Promise<boolean>
  persistIdentity(binding: IdentityBinding): Promise<void>
  loadIdentity(agentId: string): Promise<IdentityBinding | null>
}
```

实现策略：
- `generateKeyPair()` 包装 `IdentityManager.generateGenesis()`
- `signData()/verifySignature()` 包装 `IdentityManager.sign()` + Node.js crypto.verify
- `persistIdentity()/loadIdentity()` 包装 IdentityManager 的文件持久化
- 新建 `electron/v6-providers/identity-provider.ts`

**验收标准**：
- IdentityProvider 接口完整实现
- 通过 IdentityProvider 接口调用 generateKeyPair→bindIdentity→signData→verifySignature 全链路
- `pnpm run typecheck` 通过
- `pnpm run lint` 无新增错误

**涉及文件**：
- `electron/v6-providers/identity-provider.ts`（新建）
- `electron/identity/index.ts`（可能需微调导出）
- `docs/v6-types-contract.ts`（引用类型定义）

**依赖**：M2-A2

---

### M2-A5 NewBProvider 接口实现

**负责人**：后端
**估算时间**：60 分钟
**优先级**：P0

**描述**：基于现有 `electron/newb/index.ts` 的 `NewBEngine` 类，实现 B队定义的 `NewBProvider` 接口。

需实现的接口方法：
```typescript
interface NewBProvider {
  getBalance(agentId: string): Promise<NewBBalance>
  transfer(from: string, to: string, amount: number, reason: string): Promise<NewBTransaction>
  getHalvingSchedule(): Promise<HalvingSchedule>
  getCurrentEpoch(): Promise<{ epoch: number; blockReward: number; blocksRemaining: number }>
  getTransactionHistory(agentId: string, limit?: number): Promise<NewBTransaction[]>
}
```

实现策略：
- `getBalance()` 包装 `NewBEngine.getLedger()`，映射为 B队 `NewBBalance` 结构
- `transfer()` 包装 `NewBEngine.spend()`/`receive()`
- `getHalvingSchedule()` 包装 `NewBEngine.getMiningConfig()`
- `getTransactionHistory()` 包装 `NewBEngine.getTransactions()`
- 新建 `electron/v6-providers/newb-provider.ts`

**验收标准**：
- NewBProvider 接口完整实现
- B队 `LocalLedgerEntry.currency = 'NEW.B'` 可正常使用
- 减半逻辑计算正确（epoch递增、奖励递减）
- `pnpm run typecheck` 通过

**涉及文件**：
- `electron/v6-providers/newb-provider.ts`（新建）
- `electron/newb/index.ts`（可能需微调导出）

**依赖**：M2-A2

---

### M2-A6 SandboxProvider 接口实现

**负责人**：后端
**估算时间**：60 分钟
**优先级**：P1

**描述**：基于现有 `electron/trinity/docker-sandbox.ts` 的 `DockerSandbox` 类，实现 B队定义的 `SandboxProvider` 接口。当前环境 Docker 不可用，适配器需封装进程隔离降级路径。

需实现的接口方法：
```typescript
interface SandboxProvider {
  createContainer(config: SandboxConfig): Promise<string>
  executeInContainer(containerId: string, command: string, timeout?: number): Promise<ExecutionResult>
  getContainerStatus(containerId: string): Promise<ContainerStatus>
  destroyContainer(containerId: string): Promise<void>
  listContainers(): Promise<ContainerStatus[]>
  getContainerLogs(containerId: string, lines?: number): Promise<string[]>
}
```

实现策略：
- `createContainer()` 在进程隔离模式下返回虚拟 containerId
- `executeInContainer()` 包装 `DockerSandbox.execute()`
- `getContainerStatus()` 返回模拟状态（进程模式无持久容器）
- `fallbackMode` 标志设为 true（Docker不可用）
- 新建 `electron/v6-providers/sandbox-provider.ts`

**验收标准**：
- SandboxProvider 接口完整实现
- 进程隔离降级路径正常工作（S3探针已验证）
- `ContainerStatus.fallbackMode = true` 明确标识
- `pnpm run typecheck` 通过

**涉及文件**：
- `electron/v6-providers/sandbox-provider.ts`（新建）
- `electron/trinity/docker-sandbox.ts`（已有，包装调用）

**依赖**：M2-A2

---

### M2-A7 PoOProvider 接口实现

**负责人**：后端
**估算时间**：60 分钟
**优先级**：P1

**描述**：基于现有 `electron/poo/index.ts` 的 `PoOVerifier` 类，实现 B队定义的 `PoOProvider` 接口。将 A队的 Priority Score 计算与 B队的 Oracle 引擎对接。

需实现的接口方法：
```typescript
interface PoOProvider {
  submitOutcome(taskId: string, result: string, evidence: EvidenceEntry[]): Promise<PoOProof>
  verifyProof(proof: PoOProof): Promise<PoOVerification>
  calculatePriorityScore(agentId: string, outcomes: OutcomeReport[]): Promise<PriorityScore>
  getVerificationHistory(taskId: string): Promise<PoOVerification[]>
}
```

实现策略：
- `submitOutcome()` 包装 `PoOVerifier.submitTask()` + `verifySandbox()` + `finalizeTask()`
- `verifyProof()` 基于 `PoOTask.evidenceHash` 验证
- `calculatePriorityScore()` 包装 `PoOVerifier.calculateScore()`
- Priority Score 公式对齐：A队 `(GoalFit×0.35 + PoO×0.35 + Evidence×0.2) / (Cost + Debt×0.1)` vs B队四维（outcomeQuality/verificationRate/economicContribution/uptime）
- 新建 `electron/v6-providers/poo-provider.ts`

**验收标准**：
- PoOProvider 接口完整实现
- Priority Score 计算结果在0-1000范围内（B队规范）
- Score ≥ 85 自动 execute 的逻辑保留
- `pnpm run typecheck` 通过

**涉及文件**：
- `electron/v6-providers/poo-provider.ts`（新建）
- `electron/poo/index.ts`（已有，包装调用）

**依赖**：M2-A2

---

### M2-A8 Provider 注册与切换机制

**负责人**：后端
**估算时间**：30 分钟
**优先级**：P1

**描述**：创建 Provider 注册表，B队可通过此注册表获取 A队的真实实现或 Mock 实现。支持环境变量切换。

实现要点：
- 新建 `electron/v6-providers/provider-registry.ts`
- 导出 `createProviderRegistry(): V6ProviderRegistry` 函数
- 支持环境变量 `V6_USE_STUBS` 切换真实/Mock 模式
- 每个Provider的构造函数接受 dataDir 参数
- B队 Store 可通过 import 此注册表获取所有Provider实例

**验收标准**：
- Provider 注册表创建完成
- 通过注册表可获取 Identity/NewB/Sandbox/PoO 四个 Provider 实例
- `pnpm run typecheck` 通过
- `pnpm run lint` 无新增错误

**涉及文件**：
- `electron/v6-providers/provider-registry.ts`（新建）
- `electron/v6-providers/index.ts`（新建，桶导出）

**依赖**：M2-A4、M2-A5、M2-A6、M2-A7

---

### M2-A9 Identity + Governance 模块加固（生产化）

**负责人**：后端
**估算时间**：60 分钟
**优先级**：P1

**描述**：基于 M1-A5 架构审查的发现，加固 Identity 和 Governance 模块使其达到生产质量：
1. `identity/index.ts:142` 的 `require('node:crypto')` 改为顶层 import
2. Identity 模块添加 `sign()` 使用 Ed25519 签名而非 RSA（当前代码混用）
3. Governance 模块的 `EVIDENCE.jsonl` 读写添加错误恢复（损坏行跳过）
4. Identity 模块的 `sign()` 方法返回类型从 `string | null` 改为明确错误处理

**验收标准**：
- 所有 `require()` 调用替换为 `import`
- Identity sign/verify 使用一致的 Ed25519 算法
- Governance EVIDENCE.jsonl 损坏行不影响后续读写
- `pnpm test` 全部通过

**涉及文件**：
- `electron/identity/index.ts`（修改）
- `electron/governance/index.ts`（修改）

**依赖**：无（可与A1/A2并行）

---

### M2-A10 Identity + New.B + PoO 模块测试覆盖加固

**负责人**：质检
**估算时间**：60 分钟
**优先级**：P0

**描述**：为 Identity、New.B、PoO 三个模块补充测试，目标覆盖率 > 80%。参考 B队的 188 测试风格（纯函数测试+集成测试+运行时模拟）。

测试要点：
1. Identity：密钥生成→加密存储→解锁→签名→验签→信用评分更新→停用 全链路
2. New.B：创世分配→PoO奖励→减半触发→质押→惩罚→破产判定 全链路
3. PoO：提交任务→计算分数→沙盒验证→最终决策（execute/discard）全链路
4. HMAC 完整性验证（New.B ledger）
5. 边界：余额不足拒绝、重复创世拒绝、无效密钥拒绝

**验收标准**：
- `tests/unit/identity.test.ts` 覆盖率 > 80%
- `tests/unit/newb.test.ts` 覆盖率 > 80%
- `tests/unit/poo.test.ts` 覆盖率 > 80%
- `pnpm test` 全部通过（含现有测试）

**涉及文件**：
- `tests/unit/identity.test.ts`（新建或补充）
- `tests/unit/newb.test.ts`（新建或补充）
- `tests/unit/poo.test.ts`（新建或补充）

**依赖**：M2-A9（加固后再测）

---

### M2-A11 安全审查（密钥存储、加密强度、交易完整性）

**负责人**：代码审查
**估算时间**：60 分钟
**优先级**：P0

**描述**：对 Identity 和 New.B 模块进行安全审查，确保密钥管理和经济系统的安全性。

审查要点：
1. Identity：AES-256-GCM 加密强度、scrypt 参数（cost factor）、私钥内存清理时机
2. New.B：HMAC 完整性校验、余额溢出保护、并发写入安全性
3. PoO：Priority Score 防篡改、evidence hash 碰撞概率
4. 所有模块：文件权限（keystore.json 应 600）、时序攻击防护
5. 适配层：类型转换中是否有数据丢失或精度问题

**验收标准**：
- 输出安全审查报告
- Critical 问题 = 0（探针S5已验证加密可用）
- Warning 问题附修复建议

**涉及文件**：
- 全部 `electron/identity/`、`electron/newb/`、`electron/poo/`
- `electron/v6-adapter.ts`
- `electron/v6-providers/`

**依赖**：M2-A9（加固后审查）

---

### M2-A12 adapter.ts 桥接层实现（Store→HTTP映射）

**负责人**：前端
**估算时间**：45 分钟
**优先级**：P0（B队UI对接A队后端的关键桥梁）

**描述**：根据 `docs/ab-integration-strategy.md` 第2.3节的接口定义，实现 `src/lib/v6/adapter.ts` 文件。该文件是B队Zustand Store与A队Host API HTTP（127.0.0.1:13220）之间的桥接层。

需实现的函数：
1. `apiFetch<T>(path, options?)` — 通用HTTP请求封装，自动附加Bearer token认证
2. `getAuthHeaders()` — 从 `window.__HOST_API_TOKEN__` 获取认证令牌
3. `fetchIdentity()` — GET `/api/trinity/identity`
4. `fetchGenesisStatus()` — GET `/api/trinity/genesis/status`
5. `fetchNewBBalance()` — GET `/api/trinity/economy/balance`
6. `fetchTransactions(limit)` — GET `/api/trinity/economy/transactions?limit=N`
7. `fetchPooStats()` — GET `/api/trinity/poo/stats`
8. `fetchEvidence(level?)` — GET `/api/trinity/governance/evidence`
9. `fetchDebts(status?)` — GET `/api/trinity/governance/debts`
10. `fetchDashboard()` — GET `/api/trinity/dashboard`
11. `fetchPlaybooks()` — GET `/api/trinity/governance/playbooks`
12. `fetchSwarmPeers()` — GET `/api/trinity/swarm/peers`

**验收标准**：
- `src/lib/v6/adapter.ts` 创建完成，所有函数实现
- `pnpm run typecheck` 通过
- `pnpm run lint` 无新增错误
- Host API token 通过 preload `contextBridge.exposeInMainWorld` 暴露确认

**涉及文件**：
- `src/lib/v6/adapter.ts`（新建，参考ab-integration-strategy.md 2.3节定义）
- `electron/preload/index.ts`（确认或添加 `__HOST_API_TOKEN__` 暴露）

**依赖**：M2-A2（适配层的类型映射）

---

### M2-A13 Host API Token 认证通道确认

**负责人**：后端
**估算时间**：30 分钟
**优先级**：P0（adapter.ts依赖此通道）

**描述**：确认 A队 Host API 的认证令牌可通过 Electron preload 层传递到 renderer 进程，使 B队 adapter.ts 能获取 `window.__HOST_API_TOKEN__`。

检查项：
1. 确认 `electron/api/` 中 Host API server 启动时生成 `randomBytes(32)` token
2. 确认 `electron/preload/index.ts` 通过 `contextBridge.exposeInMainWorld('__HOST_API_TOKEN__', token)` 暴露
3. 如果上述通道不存在，添加 IPC handler 从 main 进程获取 token
4. 确认 renderer 进程中 `window.__HOST_API_TOKEN__` 可读

**验收标准**：
- preload 层确认暴露 `__HOST_API_TOKEN__`
- renderer 中 `console.log(window.__HOST_API_TOKEN__)` 输出有效 token
- `pnpm run typecheck` 通过

**涉及文件**：
- `electron/preload/index.ts`（可能需修改）
- `electron/api/` 目录下的 server 启动代码

**依赖**：无（可与A1并行）

---

### M2-A14 设计语言一致性审查

**负责人**：用户体验和界面设计师
**估算时间**：30 分钟
**优先级**：P1

**描述**：根据 `docs/ab-integration-strategy.md` 第三节的设计规范，审查 A队新增页面的视觉风格是否与 B队 Trinity UI 一致。

审查要点：
1. 确认 `tailwind.config.js` 使用相同 gray 色阶（Tailwind v3 默认）
2. 页面背景统一使用 `bg-gray-950`
3. AI角色色彩：AI-1=blue-400、AI-2=amber-400、AI-3=emerald-400
4. 卡片样式：`rounded-lg bg-white/5 border border-white/10 p-4`
5. 按钮：主按钮 `bg-purple-600`，次按钮 `bg-white/5 border border-white/10`
6. WCAG 2.1 AA 无障碍合规

**验收标准**：
- 产出设计规范审查报告
- 列出不一致项及修复方案
- 确认 Identity/New.B/PoO 页面设计语言与 B队 Trinity 页面一致

**涉及文件**：
- `tailwind.config.js`（确认配置）
- B队 `src/pages/Trinity/index.tsx`（参考基准）
- A队新增页面设计稿

**依赖**：无（可随时启动）

---

## 任务依赖关系

```
M2-A1 (类型映射) ──→ M2-A2 (适配层) ──┬──→ M2-A4 (Identity Provider)
                                        ├──→ M2-A5 (NewB Provider)
                                        ├──→ M2-A6 (Sandbox Provider)
                                        ├──→ M2-A7 (PoO Provider)
                                        └──→ M2-A12 (adapter.ts 桥接层)
                                                        │
                                        M2-A8 (注册表) ←─┘ (依赖A4-A7全部完成)

M2-A2 (适配层) ──→ M2-A3 (适配层测试) ──→ M2-A12 (adapter.ts)

M2-A9 (模块加固) ──→ M2-A10 (测试覆盖) ──→ M2-A11 (安全审查)

M2-A13 (Token认证通道) ──→ M2-A12 (adapter.ts依赖token)

M2-A14 (设计审查) ──→ 无依赖，可随时启动

并行分组：
  组1（后端主线）: A1→A2→A4→A5→A6→A7→A8
  组2（后端并行）: A9（可与A1并行）、A13（可与A1并行）
  组3（前端）: A12（依赖A2+A13）
  组4（质检）: A3（依赖A2）、A10（依赖A9）
  组5（代码审查）: A11（依赖A10）
  组6（设计）: A14（无依赖）
```

## M2 门控标准

| 指标 | 标准 | 当前状态 |
|------|------|---------|
| typecheck | 0 错误 | ✅ M1已达标 |
| lint | 0 errors | ✅ M1已达标 |
| Identity Provider | 接口实现并通过全链路测试 | ⏳ 待M2-A4 |
| NewB Provider | 接口实现并通过全链路测试 | ⏳ 待M2-A5 |
| Sandbox Provider | 接口实现，降级模式可用 | ⏳ 待M2-A6 |
| PoO Provider | 接口实现，Score计算对齐 | ⏳ 待M2-A7 |
| Provider Registry | 切换机制可用 | ⏳ 待M2-A8 |
| adapter.ts 桥接层 | 12个API函数实现 | ⏳ 待M2-A12 |
| Token认证通道 | preload暴露确认 | ⏳ 待M2-A13 |
| 设计一致性 | 审查报告通过 | ⏳ 待M2-A14 |
| 模块测试覆盖率 | > 80% | ⏳ 待M2-A10 |
| 安全审查 | 无 Critical 问题 | ⏳ 待M2-A11 |

## 资源分配建议

**后端**（A1→A2→A4→A5→A6→A7→A8 串行 + A9/A13并行）：预计总耗时 390 分钟（6.5 小时）
**前端**（等待A2+A13后做A12）：预计 45 分钟
**质检**（等待A2后做A3，等待A9后做A10）：预计 105 分钟
**代码审查**（等待A10后做A11）：预计 60 分钟
**UX设计师**（A14独立进行）：预计 30 分钟

**最短关键路径**：A1(45min)→A2(45min)→A4(60min)→A5(60min)→A6(60min)→A7(60min)→A8(30min) = **360 分钟**

**优化方案**：A4-A7 四个Provider可并行开发，则关键路径缩短为 A1→A2→max(A4,A5,A6,A7)→A8 = **240 分钟**

**A12 adapter.ts 关键路径**：A13(30min)‖A1(45min)→A2(45min)→A12(45min) = **135 分钟**（可与后端主线并行）

---

## 备注

1. **Swarm Provider 不在 M2 范围**——双节点通信 PoC 属于 M3，但类型定义已在 B队 Sprint 3 计划中预留
2. **EvidenceGrade.H1 排序问题**——B队注释说 H1 是"Reproducible, machine-verified"（最高），但 A队 H1 是"Hearsay"（最低）。这是命名约定差异不是值差异，需在适配层明确处理
3. **B队集成策略文档 `ab-integration-strategy.md` 已纳入**——新增A12(adapter.ts)、A13(Token通道)、A14(设计审查)三个任务
4. **核心架构**：B队UI是纯前端（Zustand+localStorage），通过 adapter.ts 调用 A队 Host API HTTP 获取真实数据。B队 Store 需新增 async actions（syncBackend/loadIdentity/loadNewBBalance等）
5. **认证机制**：A队 Host API 使用 `randomBytes(32)` token，通过 preload `contextBridge.exposeInMainWorld` 传递到 renderer（M2-A13 确认此通道）
6. **文件归属**：A队独占 `electron/`，B队独占 `src/lib/v6/`+`src/pages/`+`src/components/v6/`+`src/stores/`，共享 `src/types/v6.ts`（变更需双方确认）
7. **合并策略**：独立仓库+文件级复制（`cp -r`），非 git merge，合并时机由用户决定
8. **接口冻结日**：Day 7 接口冻结，之后 `v6.ts` 变更走变更协议（新增可选字段不需确认，修改/删除需24-48小时确认）
9. **M2-A9（模块加固）和 A13（Token通道）可与A1/A2并行**——不依赖类型映射，可立即启动
10. **adapter.ts 端点映射**：共12个函数映射到A队已有API端点（`/api/trinity/*`），所有端点在M1-B3草案中标记✅已实现
