# M1-B2: Economy 仪表盘交互原型

> 界面设计师出品 | 2026-04-10 | 供前端工程师直接实施
> 技术栈: React 19 + TypeScript + Shadcn UI + Tailwind CSS + Zustand + Lucide React

---

## 一、页面定位与数据源

### 1.1 页面职责

Economy 仪表盘是 OpenAGI v6.0 **经济系统的中枢可视化页面**，负责展示:

| 模块 | 数据来源 | 核心指标 |
|------|---------|---------|
| New.B 余额 | `electron/newb/index.ts` → `NewBLedger` | balance, totalEarned, totalSpent, totalStaked |
| PoO Priority Score | `electron/poo/index.ts` → `PoOVerifier` | priorityScore, scoreComponents, 验证统计 |
| 交易记录 | `NewBTransaction[]` | type, amount, balance, timestamp |
| 减半进度 | `MiningConfig` | halvingEpoch, currentRewardRate, rewardsIssuedThisEpoch, halvingInterval |

### 1.2 数据绑定 (IPC Channel → Store)

```
IPC Channel                    → Zustand Store Field
─────────────────────────────────────────────────────
economy:getLedger              → ledger: NewBLedger
economy:getTransactions        → transactions: NewBTransaction[]
economy:getMiningConfig        → miningConfig: MiningConfig
poo:getStats                   → pooStats: PoOStats
poo:listTasks                  → pooTasks: PoOTask[]
```

---

## 二、页面布局架构

### 2.1 整体结构 (移动端优先, max-w-6xl)

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 Header: "经济仪表盘" + 节点ID + 刷新按钮                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────── 余额主卡 ────────────────────┐           │
│  │  ⬡ 余额主展示区 (full-width glass-card)           │           │
│  │  ├─ 大字体余额: 87.50 New.B                       │           │
│  │  ├─ 减半进度条: 纪元 2 | 奖励 2.50/任务           │           │
│  │  └─ 快捷统计: 收入/支出/质押 三个内嵌小卡          │           │
│  └──────────────────────────────────────────────────┘           │
│                                                                 │
│  ┌──── Stats Grid (2col sm, 4col lg) ────────────────┐         │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐│         │
│  │  │PoO Score │ │已验证任务 │ │平均分数  │ │质押率  ││         │
│  │  │  ⚡ 92.5  │ │  ✅ 47   │ │ 📈 88.3  │ │ 🔒 15% ││         │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────┘│         │
│  └────────────────────────────────────────────────────┘         │
│                                                                 │
│  ┌──── PoO Priority Score 分解面板 ───────────────────┐         │
│  │  五维雷达图 (GoalFit / PoO_Outcome / Evidence /    │         │
│  │  Cost / DebtImpact) + 最近任务分数趋势             │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                 │
│  ┌──── 交易记录表格 ──────────────────────────────────┐         │
│  │  Tab: 全部 | 奖励 | 质押 | 支出 | 惩罚             │         │
│  │  ┌──────────────────────────────────────────────┐  │         │
│  │  │ 表格: 时间 | 类型Badge | 描述 | 金额 | 余额  │  │         │
│  │  └──────────────────────────────────────────────┘  │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                 │
│  ┌──── 减半进度面板 ──────────────────────────────────┐         │
│  │  当前纪元进度条 + 历史减半时间线                    │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 响应式断点策略

| 断点 | 余额主卡 | Stats Grid | PoO面板 | 交易表格 |
|------|---------|-----------|---------|---------|
| < 640px (mobile) | full-width | 1列 | full-width | 横向滚动 |
| 640-1023px (tablet) | full-width | 2列 | full-width | 横向滚动 |
| ≥ 1024px (desktop) | full-width | 4列 | full-width | 展开全部列 |

---

## 三、组件详细规格

### 3.1 余额主卡 (BalanceHeroCard)

**视觉设计**:
- 全宽 `glass-card-purple` 卡片, `rounded-xl p-6`
- 渐变背景装饰: 右上角半透明圆形 `bg-gradient-to-br from-yellow-500/10 to-purple-500/10`
- 左侧大字体余额 + 右侧减半进度

```
┌─────────────────────────────────────────────────────────────┐
│                                          ╭─ 渐变装饰 ─╮     │
│  New.B 余额                               │             │     │
│  87.50                                     ╰─────────────╯     │
│  ─────────────────────────────────────────────────────────   │
│                                                             │
│  ┌─ 减半进度 ───────────────────────────────────────────┐    │
│  │  纪元 2  │  ██████████░░░░░░░░░░  47/100  │ 2.50/任务│    │
│  └──────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │总收入     │  │总支出    │  │已质押     │                   │
│  │+120.50   │  │-33.00    │  │15.00     │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

**交互状态**:

| 状态 | 表现 |
|------|------|
| Loading | `<Skeleton className="h-40 w-full rounded-xl" />` 骨架屏 |
| 正常 | 显示余额数据, 金额以 `font-mono font-bold text-3xl` 渲染 |
| 余额为0 | 金额显示 `0.00`, 文字颜色变为 `text-foreground/40` |
| tamperDetected=true | 余额旁显示红色警告图标 + tooltip "账本完整性异常" |

**数据绑定**:
```typescript
interface BalanceHeroData {
  balance: number
  totalEarned: number
  totalSpent: number
  totalStaked: number
  tamperDetected?: boolean
  halvingEpoch: number
  currentRewardRate: number
  rewardsIssuedThisEpoch: number
  halvingInterval: number
}
```

**减半进度条规格**:
- 高度: `h-2.5` 圆角进度条
- 颜色: `bg-gradient-to-r from-yellow-500 to-amber-500`
- 背景: `bg-background/50`
- 进度计算: `(rewardsIssuedThisEpoch / halvingInterval) * 100%`
- 当进度 > 80%: 进度条颜色渐变为 `from-orange-500 to-red-500` (减半临近警告)
- 右侧文字: `当前奖励 {currentRewardRate} New.B/任务`

---

### 3.2 Stats Grid 四宫格

复用 Trinity 页面 `StatCard` 组件模式 (已有), 4个卡片:

| 位置 | 标题 | 图标 | 值 | sub | 颜色 |
|------|------|------|---|-----|------|
| 1 | PoO 执行分数 | `Zap` | 最新 task 的 priorityScore | `score >= 85 ? "可执行" : "低于阈值"` | `bg-yellow-500/20` |
| 2 | 已验证任务 | `CheckCircle2` | pooStats.verified | `{failed} 失败 \| {discarded} 已丢弃` | `bg-green-500/20` |
| 3 | 平均分数 | `TrendingUp` | pooStats.avgScore.toFixed(1) | `{totalTasks} 总任务` | `bg-purple-500/20` |
| 4 | 质押率 | `Lock` | `(totalStaked / totalEarned * 100).toFixed(0)%` | `{totalStaked.toFixed(1)} New.B` | `bg-blue-500/20` |

**StatCard 规格定义** (与现有 Trinity 一致):
```tsx
<div className="glass-card-purple rounded-xl p-5 flex items-start gap-4">
  <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', color)}>
    {icon}
  </div>
  <div className="min-w-0">
    <p className="text-sm text-foreground/50 font-medium">{label}</p>
    <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
    {sub && <p className="text-xs text-foreground/40 mt-1">{sub}</p>}
  </div>
</div>
```

---

### 3.3 PoO Priority Score 分解面板 (ScoreBreakdownPanel)

**视觉设计**:
- `glass-card-purple rounded-xl p-5`
- 左侧: 五维分数条形可视化
- 右侧: 最近5个任务的分数列表

```
┌─────────────────────────────────────────────────────────┐
│  PoO Priority Score 分解                                 │
│                                                          │
│  目标匹配 (35%)  ████████████████░░░  82                 │
│  结果验证 (35%)  ████████████████████  95                 │
│  证据等级 (20%)  ██████████████░░░░░░  75 [H3]           │
│  资源成本 (-)    ████████░░░░░░░░░░░░  35 (越低越好)      │
│  债务影响 (-)    ████░░░░░░░░░░░░░░░░  15 (越低越好)      │
│                                                          │
│  ── 计算公式 ──────────────────────────────────────────   │
│  Score = (82×0.35 + 95×0.35 + 75×0.2) / (35+15×0.1)     │
│        = 89.95 / 36.5 = 92.5  ✅ 可执行                  │
│                                                          │
│  ── 最近任务 ──────────────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐    │
│  │  POO-xxx1  92.5  ✅ verified    +10.00 New.B    │    │
│  │  POO-xxx2  88.1  ✅ verified    +10.00 New.B    │    │
│  │  POO-xxx3  76.3  ❌ discarded   0.00 New.B      │    │
│  │  POO-xxx4  95.0  ✅ verified    +10.00 New.B    │    │
│  │  POO-xxx5  91.2  ✅ verified    +10.00 New.B    │    │
│  └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**五维条形规格**:
- 每个维度一行, `flex items-center gap-3 mb-3`
- 标签宽度固定 `w-32 text-sm text-foreground/60`
- 进度条: `h-2.5 flex-1 bg-background/50 rounded-full overflow-hidden`
- 正向指标(GoalFit, PoO_Outcome, EvidenceLevel): 填充色 `bg-green-500`
- 反向指标(Cost, DebtImpact): 填充色 `bg-amber-500` (越短越好)
- 数值: `w-10 text-right text-sm font-mono font-bold`
- 权重标注: 标签后括号 `text-xs text-foreground/30`
- 证据等级映射: `H1=25, H2=50, H3=75, H4=100`

**分数阈值视觉**:
- score >= 85: 绿色 `text-green-400` + `✅`
- score >= 40 && < 85: 黄色 `text-yellow-400` + `⚠️`
- score < 40: 红色 `text-red-400` + `❌`

**交互**: 无需独立交互, 纯展示面板。可点击单个任务行展开详情 (future)。

---

### 3.4 交易记录表格 (TransactionTable)

**视觉设计**:
- `glass-card-purple rounded-xl overflow-hidden`
- 顶部 Tab 过滤器
- 表格带斑马纹

```
┌─────────────────────────────────────────────────────────┐
│  交易记录                                                 │
│  ┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐                    │
│  │全部  ││奖励  ││质押  ││支出  ││惩罚  │                    │
│  └─────┘└─────┘└─────┘└─────┘└─────┘                    │
│                                                          │
│  时间            类型          描述          金额      余额  │
│  ─────────────────────────────────────────────────────── │
│  04-10 15:32    mining        先知挖矿      +5.00   92.50  │
│  04-10 14:18    poo_reward    代码审计      +10.00  87.50  │
│  04-10 12:00    stake         知识市场上架   -5.00   77.50  │
│  04-09 18:45    penalty       欺诈惩罚       0.00   82.50  │
│  04-09 16:30    genesis       创世激活     +100.00  82.50  │
└─────────────────────────────────────────────────────────┘
```

**Tab 过滤器规格**:
- 使用 Shadcn `Tabs` 组件
- 5个 Tab: `全部 | 奖励 | 质押 | 支出 | 惩罚`
- Tab 映射:
  - 全部: 无过滤
  - 奖励: `type in ['genesis', 'mining', 'poo_reward', 'federated_bounty', 'auction_sale']`
  - 质押: `type in ['stake', 'unstake']`
  - 支出: `type in ['transfer_out', 'auction_buy']`
  - 惩罚: `type === 'penalty'`

**表格列规格**:

| 列 | 宽度 | 样式 | 说明 |
|----|------|------|------|
| 时间 | `w-32` | `text-xs font-mono text-foreground/60` | `new Date(tx.timestamp).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})` |
| 类型 | `w-24` | `<Badge variant="outline" className="text-xs">` | `tx.type.replace(/_/g, ' ')` |
| 描述 | flex-1 | `text-sm text-foreground/70 truncate` | `tx.description` |
| 金额 | `w-24` | `font-mono font-bold text-right` | 正数 `text-green-400`, 负数 `text-red-400`, 零 `text-foreground/40` |
| 余额 | `w-24` | `font-mono text-foreground/60 text-right` | `tx.balance.toFixed(2)` |

**金额格式**: `{tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(2)}`

**交易类型 Badge 颜色映射**:
- `genesis` / `mining` / `poo_reward`: `bg-green-500/15 text-green-400`
- `stake`: `bg-blue-500/15 text-blue-400`
- `unstake`: `bg-cyan-500/15 text-cyan-400`
- `transfer_out` / `auction_buy`: `bg-orange-500/15 text-orange-400`
- `penalty`: `bg-red-500/15 text-red-400`
- `transfer_in` / `federated_bounty` / `auction_sale`: `bg-emerald-500/15 text-emerald-400`

**交互**:
- Tab 切换即时过滤 (客户端过滤, 无需重新请求)
- 默认显示最近 50 条, 逆序排列 (最新在前)
- 空状态: 使用 `EmptyState` 组件, icon=`Receipt`, title="暂无交易记录"

---

### 3.5 减半进度面板 (HalvingProgressPanel)

**视觉设计**:
- `glass-card-purple rounded-xl p-5`
- 上方: 当前纪元大进度环 + 数值
- 下方: 历史减半时间线

```
┌─────────────────────────────────────────────────────────┐
│  减半进度                                                 │
│                                                          │
│     ┌─────────┐                                          │
│     │  纪元 2  │    当前奖励: 2.50 New.B/任务              │
│     │ 47/100  │    下次减半: 还需 53 次奖励                 │
│     │ ▓▓▓▓░░ │    减半后: 1.25 New.B/任务                  │
│     └─────────┘                                          │
│                                                          │
│  ── 减半历史 ──────────────────────────────────────────   │
│                                                          │
│  ●──────●──────●──────○                                  │
│  创世    纪元1   纪元2   纪元3                              │
│  10.00   5.00   2.50   (1.25)                             │
│                                                          │
│  总奖励已发行: 247 次 | 累计发放: 1,585.00 New.B           │
└─────────────────────────────────────────────────────────┘
```

**纪元进度条规格**:
- 宽度 `w-48 h-3` 圆角进度条
- 填充: `bg-gradient-to-r from-yellow-500 to-amber-500`
- 进度 > 80%: 颜色渐变为 `from-orange-500 to-red-500`
- 下方文字三行:
  1. `当前奖励: {currentRewardRate} New.B/任务`
  2. `下次减半: 还需 {halvingInterval - rewardsIssuedThisEpoch} 次奖励`
  3. `减半后: {(currentRewardRate / 2).toFixed(2)} New.B/任务`

**历史减半时间线**:
- 横向时间线, 每个纪元一个节点
- 已完成纪元: 实心圆 `●` + 绿色 `bg-green-500`
- 当前纪元: 空心圆 `○` + 黄色 `border-yellow-500`
- 未来纪元 (预估): 虚线圆 + 灰色 `text-foreground/30`
- 每个节点下方显示奖励率
- 最多显示当前纪元 + 2 个未来纪元

---

## 四、Zustand Store 定义

文件路径: `src/stores/economy.ts`

```typescript
import { create } from 'zustand'
import { hostApiFetch } from '@/lib/host-api'

interface NewBTransaction {
  id: string
  timestamp: string
  type: 'genesis' | 'mining' | 'poo_reward' | 'stake' | 'unstake' |
        'transfer_in' | 'transfer_out' | 'penalty' | 'federated_bounty' |
        'auction_sale' | 'auction_buy'
  amount: number
  balance: number
  description: string
  reference?: string
}

interface NewBLedger {
  version: number
  nodeId: string
  balance: number
  totalEarned: number
  totalSpent: number
  totalStaked: number
  halvingEpoch: number
  currentRewardRate: number
  transactions: NewBTransaction[]
  tamperDetected?: boolean
}

interface MiningConfig {
  baseReward: number
  halvingInterval: number
  minimumReward: number
  rewardsIssuedThisEpoch: number
  totalRewardsIssued: number
}

interface PoOStats {
  totalTasks: number
  verified: number
  failed: number
  discarded: number
  avgScore: number
  totalRewards: number
}

interface PoOTask {
  id: string
  title: string
  status: 'pending' | 'running' | 'verified' | 'failed' | 'discarded'
  priorityScore?: number
  scoreComponents?: {
    goalFit: number
    pooOutcome: number
    evidenceLevel: number
    cost: number
    debtImpact: number
  }
  newbReward: number
}

interface EconomyStore {
  ledger: NewBLedger | null
  miningConfig: MiningConfig | null
  pooStats: PoOStats | null
  pooTasks: PoOTask[]
  transactionFilter: 'all' | 'reward' | 'stake' | 'spend' | 'penalty'
  isLoading: boolean
  error: string | null

  fetchAll: () => Promise<void>
  setTransactionFilter: (filter: EconomyStore['transactionFilter']) => void
  getFilteredTransactions: () => NewBTransaction[]
  getLatestScore: () => { score: number; components?: PoOTask['scoreComponents'] } | null
}
```

**API 调用路径**:
```
GET /api/economy/ledger          → NewBLedger
GET /api/economy/mining-config   → MiningConfig
GET /api/poo/stats               → PoOStats
GET /api/poo/tasks               → PoOTask[]
```

---

## 五、i18n 翻译 Key

文件路径: `src/i18n/locales/zh/economy.json`

```json
{
  "title": "经济仪表盘",
  "balance": {
    "label": "New.B 余额",
    "unit": "New.B",
    "totalEarned": "总收入",
    "totalSpent": "总支出",
    "totalStaked": "已质押",
    "tamperWarning": "账本完整性异常"
  },
  "stats": {
    "pooScore": "PoO 执行分数",
    "verified": "已验证任务",
    "avgScore": "平均分数",
    "stakeRate": "质押率",
    "executable": "可执行",
    "belowThreshold": "低于阈值",
    "totalTasks": "{{count}} 总任务"
  },
  "poo": {
    "title": "PoO Priority Score 分解",
    "formula": "计算公式",
    "recentTasks": "最近任务",
    "goalFit": "目标匹配",
    "pooOutcome": "结果验证",
    "evidenceLevel": "证据等级",
    "cost": "资源成本",
    "debtImpact": "债务影响",
    "lowerBetter": "(越低越好)",
    "executable": "可执行",
    "belowThreshold": "低于阈值",
    "discarded": "已丢弃",
    "weightGoalFit": "35%",
    "weightPooOutcome": "35%",
    "weightEvidence": "20%",
    "noTasks": "暂无 PoO 任务"
  },
  "transactions": {
    "title": "交易记录",
    "filterAll": "全部",
    "filterReward": "奖励",
    "filterStake": "质押",
    "filterSpend": "支出",
    "filterPenalty": "惩罚",
    "emptyTitle": "暂无交易记录",
    "emptyDesc": "交易将在 PoO 验证通过或质押操作时产生",
    "columnTime": "时间",
    "columnType": "类型",
    "columnDesc": "描述",
    "columnAmount": "金额",
    "columnBalance": "余额"
  },
  "halving": {
    "title": "减半进度",
    "currentReward": "当前奖励: {{rate}} New.B/任务",
    "nextHalving": "下次减半: 还需 {{remaining}} 次奖励",
    "afterHalving": "减半后: {{rate}} New.B/任务",
    "epoch": "纪元 {{epoch}}",
    "progress": "{{issued}}/{{interval}}",
    "history": "减半历史",
    "totalIssued": "总奖励已发行: {{count}} 次",
    "totalDistributed": "累计发放: {{amount}} New.B",
    "genesis": "创世",
    "approachingWarning": "减半临近"
  }
}
```

---

## 六、交互状态汇总

### 6.1 Loading 状态

所有数据区块独立 loading, 使用骨架屏 (Skeleton):

| 区块 | 骨架屏 |
|------|--------|
| 余额主卡 | `<Skeleton className="h-40 w-full rounded-xl" />` |
| Stats Grid | 4x `<Skeleton className="h-24 rounded-xl" />` |
| PoO 面板 | `<Skeleton className="h-64 w-full rounded-xl" />` |
| 交易表格 | `<Skeleton className="h-48 w-full rounded-xl" />` |
| 减半面板 | `<Skeleton className="h-36 w-full rounded-xl" />` |

### 6.2 Error 状态

- 数据加载失败: 显示 `notifyError` + 区块内 "数据加载失败" 提示
- 重复失败: 区块内显示刷新按钮 `<Button variant="ghost" onClick={fetchAll}>重试</Button>`

### 6.3 空状态

| 条件 | 空状态 |
|------|--------|
| 未创世 (无 ledger) | 重定向到 Trinity 创世流程 |
| 无交易记录 | `EmptyState` icon=Receipt, title=暂无交易记录 |
| 无 PoO 任务 | `EmptyState` icon=ClipboardCheck, title=暂无 PoO 任务 |

### 6.4 实时更新

- 页面加载时调用 `fetchAll()` 获取全量数据
- 提供 `refresh` 按钮 (Header 右侧) 触发手动刷新
- Future: WebSocket 推送交易变化事件

---

## 七、页面入口与路由

### 7.1 路由注册

在 `src/App.tsx` 中添加:
```tsx
<Route path="/economy" element={<EconomyPage />} />
```

### 7.2 侧边栏导航

在 `src/components/layout/Sidebar.tsx` 中添加 Economy 导航项:
```
图标: Coins (lucide-react)
标签: "经济" (zh) / "Economy" (en)
路径: /economy
位置: Trinity 之后, Models 之前
```

---

## 八、组件文件结构

```
src/pages/Economy/
├── index.tsx                    # 页面主入口, 组装所有子组件
├── BalanceHeroCard.tsx          # 余额主卡
├── StatsGrid.tsx                # 四宫格统计卡片
├── ScoreBreakdownPanel.tsx      # PoO 分数分解面板
├── TransactionTable.tsx         # 交易记录表格 (含Tab过滤)
└── HalvingProgressPanel.tsx     # 减半进度面板
```

**依赖组件**:
- `@/components/ui/badge` — 类型 Badge
- `@/components/ui/button` — 刷新/重试按钮
- `@/components/ui/tabs` — 交易过滤 Tab
- `@/components/ui/progress` — 进度条
- `@/components/ui/skeleton` — 骨架屏
- `@/components/EmptyState` — 空状态组件 (来自 C1-UX 方案)
- `@/stores/economy` — Zustand Store
- `lucide-react` — 图标

---

## 九、无障碍 (WCAG AA)

| 要求 | 实现 |
|------|------|
| 颜色对比 | 金额文字满足 4.5:1 对比度; 不依赖颜色传达信息, 辅以 +/- 符号 |
| 键盘导航 | Tab 过滤器支持键盘切换; 表格行可聚焦 |
| 屏幕阅读器 | 进度条 `aria-valuenow` / `aria-valuemin` / `aria-valuemax`; 图标 `aria-hidden="true"` |
| 表格标记 | `<table>` 含 `<caption>` (sr-only); `<th scope="col">` |
| 动画 | 进度条动画遵循 `prefers-reduced-motion`, 可降级为无动画 |

---

## 十、性能考量

| 项 | 策略 |
|----|------|
| 交易列表 | 客户端过滤 (Tab 切换), 避免重复 API 调用 |
| 骨架屏 | 使用 Shadcn `<Skeleton>` 替代 Spinner, 感知加载更快 |
| 重渲染 | Store 按 section 拆分 selector, 避免无关更新 |
| 大列表 | 交易记录限制 50 条; Future: 虚拟滚动 |

---

*本原型文件可直接交由前端工程师实施。所有组件规格、交互状态、数据绑定、样式类名和 i18n 均已明确定义。*
