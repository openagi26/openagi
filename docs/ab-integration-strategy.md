# A/B 双团队集成策略

> 版本: 1.0 | 日期: 2026-04-10 | 状态: Accepted

本文档回应 A 队高级项目经理提出的三项集成风险，并给出可执行的解决方案。

---

## 一、代码合并方向

### 1.1 现状分析

| 维度 | A 队仓库 (409A) | B 队仓库 (409C) |
|------|----------------|----------------|
| 路径 | `openagi409A/openagi/` | `openagi409C/openagi_repo/` |
| 后端 | `electron/trinity/` 含 13 个子模块 | 无后端模块 |
| 前端引擎 | 无 v6 引擎 | `src/lib/v6/` 含 8 个引擎文件 |
| 前端 UI | 无 Trinity 页面 | `src/pages/Trinity/` + `src/components/v6/` |
| 状态管理 | 无 v6 store | `src/stores/v6.ts` (Zustand) |
| 类型系统 | 自有类型 | `src/types/v6.ts` (400+ 行完整类型) |
| API 层 | `electron/api/routes/trinity.ts` (40+ 端点) | 无 HTTP API 调用 |

A 队修改的文件集: `electron/` 目录下的后端模块。
B 队修改的文件集: `src/lib/v6/`, `src/pages/Trinity/`, `src/components/v6/`, `src/stores/v6.ts`, `src/types/v6.ts`。

**两队文件无重叠，冲突风险为零。**

### 1.2 推荐方案: 独立仓库 + 文件级合并

```
合并方向（单向复制，非 git merge）:

  A 队仓库                          统一仓库
  electron/trinity/*       ───>     electron/trinity/*
  electron/api/routes/trinity.ts    electron/api/routes/trinity.ts
  electron/identity/*      ───>     electron/identity/*
  electron/newb/*          ───>     electron/newb/*
  electron/poo/*           ───>     electron/poo/*

  B 队仓库                          统一仓库
  src/lib/v6/*             ───>     src/lib/v6/*
  src/pages/Trinity/*      ───>     src/pages/Trinity/*
  src/components/v6/*      ───>     src/components/v6/*
  src/stores/v6.ts         ───>     src/stores/v6.ts
  src/types/v6.ts          ───>     src/types/v6.ts
```

### 1.3 合并规则

1. **禁止 git merge** -- 两仓库历史不共享，使用 `cp -r` 文件级复制
2. **合并时机由用户决定** -- A/B 队不自行合并，向用户提供合并脚本
3. **共享接口契约** -- `src/types/v6.ts` 作为唯一共享类型定义，双方不得单方面修改其导出接口
4. **接口变更流程** -- 任何对 `V6SystemState`、`TrinityTask`、`GovernanceLedgers` 的字段增删，必须双方同步确认

### 1.4 合并脚本模板

```bash
#!/bin/bash
# merge-ab.sh -- 用户执行的合并脚本
set -e

UNIFIED="./openagi-unified"
A_REPO="./openagi409A/openagi"
B_REPO="./openagi409C/openagi_repo"

# 以 A 队仓库为基础（因其含完整 Electron 壳）
cp -r "$A_REPO" "$UNIFIED"

# 覆盖 B 队前端模块
cp -r "$B_REPO/src/lib/v6"        "$UNIFIED/src/lib/v6"
cp -r "$B_REPO/src/pages/Trinity"  "$UNIFIED/src/pages/Trinity"
cp -r "$B_REPO/src/components/v6"  "$UNIFIED/src/components/v6"
cp    "$B_REPO/src/stores/v6.ts"   "$UNIFIED/src/stores/v6.ts"
cp    "$B_REPO/src/types/v6.ts"    "$UNIFIED/src/types/v6.ts"

echo "合并完成: $UNIFIED"
```

---

## 二、API 接口兼容性

### 2.1 架构差异

```
A 队架构:
  Electron Main Process
    └─ TrinityEngine (singleton)
        ├─ identity.getIdentity()
        ├─ economy.getBalance()
        ├─ verifier.getStats()       (PoO)
        ├─ governance.getEvidence()
        └─ ... 13 个子模块
    └─ Host API HTTP Server (127.0.0.1:13220)
        └─ /api/trinity/*  (40+ 端点)

B 队架构:
  React Renderer Process
    └─ useV6Store (Zustand + localStorage)
        ├─ constitution, trinity, tasks, ledgers
        ├─ outcomes, oracleRules, permissionMatrix
        ├─ nodeStatus, market
        └─ 纯前端状态，零 HTTP 调用
```

**核心问题**: B 队 UI 当前是纯前端模拟（Zustand + localStorage），不调用任何后端 API。
集成后需要将真实数据从 A 队后端注入。

### 2.2 集成路径: 适配器层

在 B 队 store 中添加 async actions，通过 A 队 Host API 获取真实数据。
不替换现有 Zustand store 结构，而是**扩展**它。

### 2.3 适配器接口定义

```typescript
// src/lib/v6/adapter.ts -- B 队新增文件

const API_BASE = 'http://127.0.0.1:13220/api/trinity'

/**
 * 从 Electron preload 层获取 Host API 认证令牌。
 * A 队 server.ts 使用 Bearer token 认证（randomBytes(32)），
 * 该 token 通过 IPC 传递到 renderer。
 */
function getAuthHeaders(): HeadersInit {
  const token = (window as any).__HOST_API_TOKEN__ ?? ''
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...getAuthHeaders(), ...options?.headers },
  })
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`)
  return res.json()
}

// ─── 对接点 1: Identity ───────────────────────────────────

export interface HostIdentity {
  nodeId: string
  publicKey: string
  createdAt: string
}

/** GET /api/trinity/identity */
export async function fetchIdentity(): Promise<HostIdentity> {
  return apiFetch('/identity')
}

/** GET /api/trinity/genesis/status */
export async function fetchGenesisStatus(): Promise<{
  isComplete: boolean
  hasIdentity: boolean
  hasEconomy: boolean
}> {
  return apiFetch('/genesis/status')
}

// ─── 对接点 2: New.B 经济系统 ─────────────────────────────

export interface EconomyBalance {
  balance: number
}

/** GET /api/trinity/economy/balance */
export async function fetchNewBBalance(): Promise<EconomyBalance> {
  return apiFetch('/economy/balance')
}

/** GET /api/trinity/economy/transactions?limit=N */
export async function fetchTransactions(limit = 50): Promise<any[]> {
  return apiFetch(`/economy/transactions?limit=${limit}`)
}

// ─── 对接点 3: PoO 验证 ──────────────────────────────────

export interface PooStats {
  totalTasks: number
  verified: number
  rejected: number
  pending: number
  score: number
}

/** GET /api/trinity/poo/stats */
export async function fetchPooStats(): Promise<PooStats> {
  return apiFetch('/poo/stats')
}

// ─── 对接点 4: 治理数据 ──────────────────────────────────

/** GET /api/trinity/governance/evidence */
export async function fetchEvidence(level?: string): Promise<any[]> {
  const q = level ? `?level=${level}` : ''
  return apiFetch(`/governance/evidence${q}`)
}

/** GET /api/trinity/governance/debts */
export async function fetchDebts(status?: string): Promise<any[]> {
  const q = status ? `?status=${status}` : ''
  return apiFetch(`/governance/debts${q}`)
}

// ─── 对接点 5: Dashboard 汇总 ─────────────────────────────

/** GET /api/trinity/dashboard -- 一次性获取全局状态 */
export async function fetchDashboard(): Promise<any> {
  return apiFetch('/dashboard')
}

// ─── 对接点 6: 知识市场 ──────────────────────────────────

/** GET /api/trinity/governance/playbooks */
export async function fetchPlaybooks(): Promise<any[]> {
  return apiFetch('/governance/playbooks')
}

// ─── 对接点 7: 蜂群状态 ──────────────────────────────────

/** GET /api/trinity/swarm/peers */
export async function fetchSwarmPeers(): Promise<any[]> {
  return apiFetch('/swarm/peers')
}
```

### 2.4 Store 扩展方案

```typescript
// 在 src/stores/v6.ts 中新增的 actions（不修改现有接口）

export interface V6Store extends V6SystemState {
  // ... 现有接口保持不变 ...

  // === 新增: 后端同步 Actions ===
  backendConnected: boolean
  backendError: string | null
  syncBackend: () => Promise<void>
  loadIdentity: () => Promise<void>
  loadNewBBalance: () => Promise<void>
  loadPooStats: () => Promise<void>
  loadGovernanceData: () => Promise<void>
}
```

### 2.5 端点映射表

| B 队 Store Action | A 队 HTTP 端点 | 方法 | 数据流向 |
|-------------------|---------------|------|---------|
| `syncBackend()` | `/api/trinity/dashboard` | GET | A->B 全量同步 |
| `loadIdentity()` | `/api/trinity/identity` | GET | A->B 身份数据 |
| `loadNewBBalance()` | `/api/trinity/economy/balance` | GET | A->B 余额 |
| `loadPooStats()` | `/api/trinity/poo/stats` | GET | A->B PoO 统计 |
| `loadGovernanceData()` | `/api/trinity/governance/evidence` | GET | A->B 证据链 |
| `createNewTask()` | `/api/trinity/runner/run-once` | POST | B->A 任务执行 |
| `addDebtEntry()` | `/api/trinity/governance/debts` | POST | B->A 新增债务 |
| `buyPlaybook()` | `/api/trinity/governance/playbooks` | GET | A->B 剧本列表 |
| `listPlaybookFromTask()` | `/api/trinity/governance/playbooks` | POST | B->A 发布剧本 |

### 2.6 认证机制

A 队 Host API 使用 `randomBytes(32)` 生成的会话令牌，通过 `Authorization: Bearer <token>` 或 `?token=<token>` 传递。B 队适配器需要通过 Electron IPC preload 层获取该令牌。

```typescript
// electron/preload/index.ts 中已暴露或需暴露:
contextBridge.exposeInMainWorld('__HOST_API_TOKEN__', hostApiToken)
```

---

## 三、设计语言一致性

### 3.1 B 队设计规范（权威定义）

B 队 Trinity UI 已实现的设计系统:

```
主题:      深色模式 (bg-gray-950)
品牌色:    紫色系 (purple-400 高亮 / purple-900 背景)
```

#### AI 角色色彩

| 角色 | Tailwind 类 | 用途 |
|------|------------|------|
| AI-1 扩展者 | `text-blue-400`, `bg-blue-400/10`, `border-blue-400/30` | 任务提案、执行 |
| AI-2 审计者 | `text-amber-400`, `bg-amber-400/10`, `border-amber-400/30` | 审计、风险评估 |
| AI-3 治理者 | `text-emerald-400`, `bg-emerald-400/10`, `border-emerald-400/30` | 审批、预算 |

#### 权限等级色彩

| 等级 | 颜色 | Tailwind 类 |
|------|------|------------|
| L0 自主执行 | 绿色 | `text-green-400`, `bg-green-400/10` |
| L1 通知即可 | 蓝色 | `text-blue-400`, `bg-blue-400/10` |
| L2 需审批 | 琥珀色 | `text-amber-400`, `bg-amber-400/10` |
| L3 双签名 | 红色 | `text-red-400`, `bg-red-400/10` |
| L4 人工必须 | 深灰色 | `text-gray-400`, `bg-gray-400/10` |

#### 组件规范

| 元素 | 规范 |
|------|------|
| 卡片 | `rounded-lg bg-white/5 border border-white/10 p-4` |
| 表格行 | `px-3 py-2 text-sm` |
| 按钮(主) | `bg-purple-600 hover:bg-purple-700 rounded-md px-4 py-2` |
| 按钮(次) | `bg-white/5 hover:bg-white/10 border border-white/10 rounded-md` |
| 标签 | `text-xs px-2 py-0.5 rounded-full` |
| 数据值 | `font-mono text-sm` |
| 进度条 | `role="progressbar" aria-valuenow aria-valuemin aria-valuemax` |
| 表格 | `<caption class="sr-only">` 隐藏标题 |
| 导航 | `role="tablist"` + `role="tab"` + `aria-selected` |

### 3.2 CSS 变量映射表

A 队如果使用自定义 CSS 变量，需映射到以下值:

```css
:root {
  /* 背景层次 */
  --nc-bg-primary:    theme('colors.gray.950');    /* #030712 */
  --nc-bg-card:       rgba(255, 255, 255, 0.05);   /* bg-white/5 */
  --nc-bg-hover:      rgba(255, 255, 255, 0.10);   /* bg-white/10 */

  /* 品牌色 */
  --nc-brand:         theme('colors.purple.400');   /* #c084fc */
  --nc-brand-bg:      theme('colors.purple.900');   /* #581c87 */
  --nc-brand-btn:     theme('colors.purple.600');   /* #9333ea */

  /* AI 角色 */
  --nc-ai1:           theme('colors.blue.400');     /* #60a5fa */
  --nc-ai2:           theme('colors.amber.400');    /* #fbbf24 */
  --nc-ai3:           theme('colors.emerald.400');  /* #34d399 */

  /* 权限等级 */
  --nc-perm-l0:       theme('colors.green.400');    /* #4ade80 */
  --nc-perm-l1:       theme('colors.blue.400');     /* #60a5fa */
  --nc-perm-l2:       theme('colors.amber.400');    /* #fbbf24 */
  --nc-perm-l3:       theme('colors.red.400');      /* #f87171 */
  --nc-perm-l4:       theme('colors.gray.400');     /* #9ca3af */

  /* 边框 */
  --nc-border:        rgba(255, 255, 255, 0.10);
  --nc-border-focus:  rgba(255, 255, 255, 0.20);

  /* 文本 */
  --nc-text-primary:  theme('colors.gray.100');     /* #f3f4f6 */
  --nc-text-muted:    theme('colors.gray.400');     /* #9ca3af */
  --nc-text-dim:      theme('colors.gray.500');     /* #6b7280 */

  /* 间距基准 */
  --nc-spacing-card:  theme('spacing.4');           /* 16px */
  --nc-spacing-row:   theme('spacing.2');           /* 8px */
  --nc-radius:        theme('borderRadius.lg');     /* 8px */
}
```

### 3.3 无障碍 (Accessibility) 要求

B 队已实现 WCAG 2.1 AA 级合规，A 队新增 UI 必须遵守:

1. **状态指示**: 不得仅用颜色区分状态，必须同时包含文字或图标
2. **进度条**: 必须包含 `role="progressbar"` + `aria-valuenow` + `aria-valuemin` + `aria-valuemax`
3. **表格**: 必须包含 `<caption class="sr-only">` 描述表格用途
4. **导航标签**: 使用 `role="tablist"` / `role="tab"` / `aria-selected`
5. **对比度**: 文本色与背景色对比度不低于 4.5:1

### 3.4 A 队执行清单

- [ ] `tailwind.config.js` 中确认使用相同的 `gray` 色阶（默认 Tailwind v3 灰色）
- [ ] 新 UI 组件统一使用 `bg-gray-950` 作为页面背景
- [ ] AI 角色图标/标签使用上述三色映射
- [ ] 表单控件使用 `rounded-md`，卡片容器使用 `rounded-lg`
- [ ] 数据展示列使用 `font-mono`

---

## 四、时间线对齐

### 4.1 里程碑矩阵

| 阶段 | 时间 | A 队产出 | B 队产出 | 对接动作 |
|------|------|---------|---------|---------|
| M1 | Day 4-7 | Alpha 轨道完成: Identity + Economy + PoO 后端 | Sprint 2 已完成: 六层引擎 + Trinity UI | A 队接收 `src/types/v6.ts` 作为接口契约 |
| M2 | Day 8-14 | Identity 加固 + Governance 完善 | Sprint 3: 编写 `adapter.ts` + Store 扩展 | 双方执行 API 端点对齐验证 |
| M3 | Day 15-24 | New.B + PoO + Trinity AI + Docker Sandbox | Sprint 3 续: 集成测试 + E2E 对接 | 联调测试（用模拟 HTTP 服务） |
| M4 | Day 25-35 | 蜂群 + Prophet Mining + 发布准备 | Sprint 4: 最终集成 + 性能优化 | 合并 + 全链路 E2E |

### 4.2 关键同步点

| 日期 | 事件 | 责任方 | 交付物 |
|------|------|--------|--------|
| Day 7 | 接口冻结 | 双方 | `v6.ts` 签核版本 + API 端点列表 |
| Day 10 | 适配器初版 | B 队 | `adapter.ts` 可调用 A 队 3 个核心端点 |
| Day 14 | 模拟联调 | 双方 | 使用 MSW 模拟 A 队 API 的 B 队 E2E 通过 |
| Day 20 | 真实联调 | 双方 | B 队 UI 连接 A 队真实后端，核心流程跑通 |
| Day 28 | 合并就绪 | 双方 | 提供合并脚本 + 冲突零报告 |

---

## 五、冲突解决机制

### 5.1 文件归属制 (CODEOWNERS)

```
# 文件归属表 -- 每个文件有且仅有一个归属团队

# A 队独占
electron/                          @team-a
electron/trinity/                  @team-a
electron/api/routes/trinity.ts     @team-a
electron/identity/                 @team-a
electron/newb/                     @team-a
electron/poo/                      @team-a

# B 队独占
src/lib/v6/                        @team-b
src/pages/Trinity/                 @team-b
src/components/v6/                 @team-b
src/stores/v6.ts                   @team-b

# 共享区域（变更需双方确认）
src/types/v6.ts                    @team-a @team-b
```

### 5.2 决策升级路径

```
Level 0: 自治
  各队在自有文件区域内自由决策，无需知会对方。

Level 1: 通知
  修改共享类型 (v6.ts) 中的已有字段名或删除字段时，
  必须通知对方团队并等待 24 小时确认。

Level 2: 协商
  涉及 API 端点路径或请求/响应格式变更时，
  双方技术负责人协商，48 小时内达成一致。

Level 3: 用户裁定
  在双方无法达成一致的架构或设计决策上，
  由用户（项目所有者）做最终裁定。
```

### 5.3 接口变更协议

对 `src/types/v6.ts` 的变更规则:

| 操作类型 | 是否需对方确认 | 说明 |
|---------|-------------|------|
| 新增可选字段 | 否 | `field?: Type` 不影响现有代码 |
| 新增必选字段 | 是 | 需确认对方已处理该字段 |
| 修改字段类型 | 是 | 破坏性变更 |
| 删除字段 | 是 | 破坏性变更 |
| 新增独立 `interface` | 否 | 不影响现有接口 |
| 修改 `V6SystemState` | 是 | 根类型变更影响全局 |

### 5.4 通信协议

- **日常同步**: 异步文档（本文档 + 各自 AGENTS.md 更新）
- **接口变更**: 在共享 `v6.ts` 文件头部添加变更注释
- **紧急问题**: 用户转达（A/B 队不直接通信）
- **联调**: 各自提供 mock 数据集，在合并前独立验证

---

## 六、风险清单与缓解措施

| # | 风险 | 概率 | 影响 | 缓解措施 |
|---|------|------|------|---------|
| R1 | A 队 API 端点格式与适配器不匹配 | 中 | 高 | M2 阶段端点对齐验证 + MSW mock |
| R2 | Host API token 认证在 renderer 中不可用 | 低 | 高 | 确认 preload 层暴露 token 的 IPC 通道 |
| R3 | Zustand 持久化数据与后端数据冲突 | 中 | 中 | 添加 `backendConnected` 标志位，连接后端时禁用 localStorage 同步 |
| R4 | Tailwind 版本不一致导致类名差异 | 低 | 低 | 双方锁定 Tailwind v3.x，共享 `tailwind.config.js` |
| R5 | 合并时遗漏依赖（npm packages） | 中 | 中 | 合并脚本中加入 `package.json` 依赖合并步骤 |
| R6 | 类型定义 drift（双方独立演化 v6.ts） | 中 | 高 | Day 7 接口冻结后，任何变更走变更协议 |

---

## 附录 A: A 队 Trinity API 端点目录

基于 `electron/api/routes/trinity.ts` 实际代码提取:

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/trinity/dashboard` | GET | 全局 Dashboard 数据 |
| `/api/trinity/genesis` | POST | 执行 Genesis 初始化 |
| `/api/trinity/genesis/status` | GET | Genesis 完成状态 |
| `/api/trinity/identity` | GET | 节点身份信息 |
| `/api/trinity/identity/unlock` | POST | 解锁身份 |
| `/api/trinity/identity/lock` | POST | 锁定身份 |
| `/api/trinity/economy` | GET | 经济账本 |
| `/api/trinity/economy/balance` | GET | New.B 余额 |
| `/api/trinity/economy/transactions` | GET | 交易历史 |
| `/api/trinity/economy/mining-config` | GET | 挖矿配置 |
| `/api/trinity/state` | GET | Trinity 引擎状态 |
| `/api/trinity/history` | GET | 历史记录 |
| `/api/trinity/roles` | GET | 角色提示词 |
| `/api/trinity/game-mode` | PUT | 切换博弈模式 |
| `/api/trinity/goal` | GET/POST | 目标管理 |
| `/api/trinity/constraints` | GET/POST | 约束管理 |
| `/api/trinity/runner/state` | GET | Auto-Runner 状态 |
| `/api/trinity/runner/start` | POST | 启动 Auto-Runner |
| `/api/trinity/runner/stop` | POST | 停止 Auto-Runner |
| `/api/trinity/runner/run-once` | POST | 单次执行 |
| `/api/trinity/governance/evidence` | GET | 证据链 |
| `/api/trinity/governance/value` | GET | 价值数据 |
| `/api/trinity/governance/debts` | GET/POST | 债务管理 |
| `/api/trinity/governance/playbooks` | GET/POST | 剧本/知识市场 |
| `/api/trinity/poo/stats` | GET | PoO 统计 |
| `/api/trinity/poo/tasks` | GET | PoO 任务列表 |
| `/api/trinity/poo/config` | GET/PUT | PoO 配置 |
| `/api/trinity/prophet/predictions` | GET | 预测列表 |
| `/api/trinity/prophet/stats` | GET | 预测统计 |
| `/api/trinity/prophet/predict` | POST | 提交预测 |

## 附录 B: B 队 V6 Store Actions 目录

基于 `src/stores/v6.ts` 实际代码提取:

| Action | 类型 | 说明 |
|--------|------|------|
| `initialize()` | sync | 初始化系统 |
| `reset()` | sync | 重置全部状态 |
| `setActiveView()` | sync | 切换 UI 视图 |
| `createNewTask()` | sync | 创建任务 |
| `submitProposal()` | sync | 提交提案 (AI-1) |
| `submitAudit()` | sync | 提交审计 (AI-2) |
| `submitApproval()` | sync | 提交审批 (AI-3) |
| `completeTask()` | sync | 完成任务 |
| `addEvidenceEntry()` | sync | 添加证据 |
| `addDebtEntry()` | sync | 添加债务 |
| `requestPermission()` | sync | 请求权限 |
| `checkPromotion()` | sync | 检查晋升资格 |
| `listPlaybookFromTask()` | sync | 发布剧本到市场 |
| `buyPlaybook()` | sync | 购买剧本 |

> 注: 当前所有 actions 均为同步操作。集成后需新增 async 版本调用 A 队 API。
