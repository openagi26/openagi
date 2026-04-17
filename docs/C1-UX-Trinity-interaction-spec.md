# C1-UX: OpenAGI Trinity 交互优化方案

> 用户体验架构师出品 | 2026-04-10 | 供前端工程师直接实施

## 一、现状审查摘要

| 维度 | 现状 | 严重级别 |
|------|------|---------|
| 错误处理 | 6个页面全部 `catch { /* ignore */ }` 静默吞错 | P1 |
| 操作反馈 | 30+按钮中仅2个有loading态(genesis/settings) | P1 |
| 空状态 | 已有基础空文本，但缺少引导性设计 | P1 |
| 表单验证 | 有disabled逻辑，但无验证错误提示文案 | P2 |
| 破坏性操作 | abandon goal等无确认对话框，且为纯图标按钮 | P2 |

**技术栈**: Shadcn UI + Tailwind CSS + Lucide React，**无现有Toast库**。

---

## 二、P1-1: 统一Toast错误提示规范

### 2.1 推荐方案: 引入 sonner

```bash
npm install sonner
```

### 2.2 全局挂载

在 `App.tsx` 或布局根组件中添加:

```tsx
import { Toaster } from 'sonner'

// 在 return 中添加
<Toaster
  position="top-right"
  toastOptions={{
    className: 'glass-card-purple border border-border text-foreground',
    duration: 4000,
  }}
  theme="system"
  richColors
/>
```

### 2.3 封装统一通知工具

新建 `src/lib/notify.ts`:

```ts
import { toast } from 'sonner'

/** 操作成功 */
export function notifySuccess(message: string) {
  toast.success(message, { duration: 3000 })
}

/** 操作失败 — 用于catch块 */
export function notifyError(message: string, detail?: string) {
  toast.error(message, {
    description: detail,
    duration: 5000,
  })
}

/** 加载中 — 返回id用于后续更新 */
export function notifyLoading(message: string) {
  return toast.loading(message)
}

/** 更新已有toast状态 */
export function notifyUpdate(id: string | number, opts: { type: 'success' | 'error'; message: string }) {
  if (opts.type === 'success') {
    toast.success(opts.message, { id, duration: 3000 })
  } else {
    toast.error(opts.message, { id, duration: 5000 })
  }
}

/** 信息提示 */
export function notifyInfo(message: string) {
  toast.info(message, { duration: 3000 })
}
```

### 2.4 替换所有静默catch

**改造模式** — 以 `SettingsPage.tsx:57` 为例:

```tsx
// 改造前
catch { /* ignore */ }

// 改造后
catch (err) {
  console.error('Failed to load config:', err)
  notifyError(t('error.loadFailed'), t('error.tryRefresh'))
}
```

**6个文件需改造的位置**:

| 文件 | 行号 | 函数 | 错误提示key |
|------|------|------|------------|
| `SettingsPage.tsx` | ~57 | `loadConfig()` | `error.settingsLoadFailed` |
| `SwarmPage.tsx` | ~59 | `loadData()` | `error.swarmLoadFailed` |
| `MarketPage.tsx` | ~99 | `loadData()` | `error.marketLoadFailed` |
| `GovernancePage.tsx` | ~48 | `loadData()` | `error.governanceLoadFailed` |
| `GoalPage.tsx` | ~51 | `loadAll()` | `error.goalLoadFailed` |
| `BlockchainPage.tsx` | ~112 | `loadData()` | `error.blockchainLoadFailed` |

### 2.5 i18n错误文案补充

在对应i18n文件中添加:

```json
{
  "error.loadFailed": "数据加载失败",
  "error.tryRefresh": "请稍后刷新重试",
  "error.settingsLoadFailed": "配置加载失败",
  "error.swarmLoadFailed": "Swarm数据加载失败",
  "error.marketLoadFailed": "市场数据加载失败",
  "error.governanceLoadFailed": "治理数据加载失败",
  "error.goalLoadFailed": "目标数据加载失败",
  "error.blockchainLoadFailed": "区块链数据加载失败",
  "error.operationFailed": "操作失败，请重试",
  "success.operationDone": "操作成功"
}
```

---

## 三、P1-2: 统一操作反馈模式

### 3.1 设计原则

- **即时反馈**: 点击后立即进入loading态，禁用按钮防止重复提交
- **结果反馈**: 成功/失败均通过Toast通知
- **状态恢复**: 无论成功失败，按钮恢复可交互状态

### 3.2 封装异步操作Hook

新建 `src/hooks/useAsyncAction.ts`:

```ts
import { useState, useCallback } from 'react'
import { notifySuccess, notifyError } from '@/lib/notify'

interface UseAsyncActionOptions {
  onSuccess?: () => void | Promise<void>
  successMessage?: string
  errorMessage?: string
}

export function useAsyncAction(
  action: () => Promise<void>,
  options: UseAsyncActionOptions = {}
) {
  const [loading, setLoading] = useState(false)

  const execute = useCallback(async () => {
    if (loading) return
    setLoading(true)
    try {
      await action()
      if (options.successMessage) notifySuccess(options.successMessage)
      await options.onSuccess?.()
    } catch (err) {
      console.error(err)
      notifyError(options.errorMessage ?? '操作失败')
    } finally {
      setLoading(false)
    }
  }, [action, loading, options])

  return { execute, loading }
}
```

### 3.3 按钮改造示例

**SwarmPage — 启动/停止Swarm**:

```tsx
// 改造前
<Button size="sm" onClick={stopSwarm} className="bg-red-500/80 hover:bg-red-600 text-white">
  <WifiOff className="w-4 h-4 mr-1" /> {t('swarm.stopSwarm')}
</Button>

// 改造后
const { execute: execStopSwarm, loading: stoppingSwarm } = useAsyncAction(
  () => hostApiFetch('/api/trinity/swarm/stop', { method: 'POST' }),
  { successMessage: t('swarm.stopSuccess'), errorMessage: t('swarm.stopFailed'), onSuccess: loadData }
)

<Button size="sm" onClick={execStopSwarm} disabled={stoppingSwarm}
  className="bg-red-500/80 hover:bg-red-600 text-white">
  {stoppingSwarm
    ? <Loader2 className="w-4 h-4 mr-1 animate-spin" />
    : <WifiOff className="w-4 h-4 mr-1" />}
  {t('swarm.stopSwarm')}
</Button>
```

### 3.4 需改造的按钮清单

| 文件 | 操作 | 当前状态 | 改造要求 |
|------|------|---------|---------|
| `index.tsx` | Dashboard刷新 | 无loading | 加loading+旋转图标 |
| `SwarmPage.tsx` | 启动Swarm | 无反馈 | loading+成功Toast |
| `SwarmPage.tsx` | 停止Swarm | 无反馈 | loading+成功Toast |
| `SwarmPage.tsx` | 连接Peer | 无反馈 | loading+成功Toast+清空表单 |
| `SwarmPage.tsx` | 举报节点 | 无反馈 | loading+成功Toast+清空表单 |
| `MarketPage.tsx` | 创建预测 | 无反馈 | loading+成功Toast+收起表单 |
| `MarketPage.tsx` | 购买列表项 | 无反馈 | loading+成功Toast |
| `MarketPage.tsx` | 创建拍卖 | 无反馈 | loading+成功Toast+清空 |
| `GovernancePage.tsx` | 解决债务 | 无反馈 | loading+成功Toast |
| `GoalPage.tsx` | 创建目标 | 无反馈 | loading+成功Toast+收起表单 |
| `GoalPage.tsx` | 添加子目标 | 无反馈 | loading+清空输入 |
| `GoalPage.tsx` | 运行一次 | 无反馈 | loading+结果Toast |
| `GoalPage.tsx` | 启停Runner | 无反馈 | loading+状态Toast |
| `GoalPage.tsx` | 完成目标 | 无反馈 | 需确认弹窗(见P2-2) |
| `GoalPage.tsx` | 放弃目标 | 无反馈 | 需确认弹窗(见P2-2) |
| `BlockchainPage.tsx` | 初始化链 | 无反馈 | loading+成功Toast |
| `BlockchainPage.tsx` | 重算Oracle | 无反馈 | loading+结果Toast |
| `BlockchainPage.tsx` | 处理分红 | 无反馈 | loading+成功Toast |
| `SettingsPage.tsx` | 保存设置 | 已有saved态 | 改为Toast统一风格 |

---

## 四、P1-3: 空状态引导设计

### 4.1 空状态组件

新建 `src/components/EmptyState.tsx`:

```tsx
import { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-purple-400/50" />
      </div>
      <h3 className="text-base font-medium text-foreground/60 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-foreground/40 text-center max-w-xs mb-4">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button
          size="sm"
          onClick={onAction}
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
```

### 4.2 各页面空状态改造

| 页面 | 位置 | 图标 | 引导文案 | 引导操作 |
|------|------|------|---------|---------|
| SwarmPage | peers列表 | `Users` | "暂无连接节点，添加第一个Peer开始组网" | 滚动到连接表单 |
| MarketPage | predictions列表 | `TrendingUp` | "暂无预测，创建第一个预言开始挖矿" | 打开创建表单 |
| MarketPage | listings列表 | `ShoppingCart` | "暂无拍卖列表" | 无 |
| GovernancePage | evidence列表 | `FileSearch` | "暂无证据记录" | 无 |
| GovernancePage | debts列表 | `Scale` | "暂无技术债务，保持良好状态" | 无 |
| GovernancePage | playbooks列表 | `BookOpen` | "暂无Playbook" | 无 |
| GovernancePage | poo tasks列表 | `ClipboardCheck` | "暂无PoO任务" | 无 |
| GoalPage | 无当前目标 | `Target` | 已有，保持现状(设计良好) | 已有 |
| GoalPage | 历史记录 | `History` | "暂无历史目标" | 无 |
| BlockchainPage | blocks列表 | `Blocks` | "暂无区块数据，初始化链开始" | 初始化链 |
| BlockchainPage | dividend记录 | `Coins` | "暂无分红记录" | 无 |

改造模式:

```tsx
// 改造前
{peers.length === 0 ? (
  <p className="text-foreground/40 text-center py-8">{t('swarm.noPeers')}</p>
) : ( ... )}

// 改造后
{peers.length === 0 ? (
  <EmptyState
    icon={Users}
    title={t('swarm.noPeers')}
    description={t('swarm.noPeersHint')}
    actionLabel={t('swarm.connectPeer.connect')}
    onAction={() => document.getElementById('connect-peer-form')?.scrollIntoView({ behavior: 'smooth' })}
  />
) : ( ... )}
```

---

## 五、P2-1: 表单验证错误提示

### 5.1 设计规范

- 验证时机: **onBlur + onSubmit** (非实时onChange，减少干扰)
- 错误样式: 输入框边框变红 + 下方红色小字提示
- 清除时机: 用户修改输入后立即清除对应错误

### 5.2 验证提示样式

```tsx
// 输入框wrapper模式
<div>
  <input
    className={cn(
      "w-full px-3 py-2 rounded-md bg-background/50 border text-foreground placeholder:text-foreground/30 focus:outline-none",
      error ? "border-red-500 focus:border-red-500" : "border-border focus:border-purple-500"
    )}
    onBlur={() => { if (!value) setError(t('validation.required')) }}
    onChange={(e) => { setValue(e.target.value); if (error) setError('') }}
  />
  {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
</div>
```

### 5.3 需要添加验证提示的表单

| 文件 | 表单 | 字段 | 验证规则 |
|------|------|------|---------|
| `index.tsx` | Genesis | passphrase | 最少8位 + 两次一致 |
| `SwarmPage.tsx` | 连接Peer | address, port | 非空 + port为数字 |
| `SwarmPage.tsx` | 举报节点 | nodeId, reason | 非空 |
| `MarketPage.tsx` | 创建预测 | claim, targetMetric | 非空 |
| `MarketPage.tsx` | 创建拍卖 | knowledgeId, price | 非空 + price>0 |
| `GoalPage.tsx` | 创建目标 | title, description | 非空 |

---

## 六、P2-2: 破坏性操作确认对话框

### 6.1 确认对话框组件

新建 `src/components/ConfirmDialog.tsx`:

```tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description: string
  confirmLabel?: string
  variant?: 'danger' | 'warning'
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, description,
  confirmLabel = '确认', variant = 'danger'
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
      onClose()
    } catch {
      // useAsyncAction已处理错误
    } finally {
      setLoading(false)
    }
  }

  const btnClass = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-yellow-600 hover:bg-yellow-700 text-white'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card-purple rounded-xl p-6 max-w-sm mx-4 border border-border">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className={`w-6 h-6 flex-shrink-0 ${variant === 'danger' ? 'text-red-400' : 'text-yellow-400'}`} />
          <div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-foreground/60 mt-1">{description}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button size="sm" className={btnClass} onClick={handleConfirm} disabled={loading}>
            {loading ? '处理中...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

### 6.2 需添加确认的操作

| 文件 | 操作 | 确认文案 | variant |
|------|------|---------|---------|
| `GoalPage.tsx` | 放弃目标 | "确定放弃当前目标？此操作不可撤销。" | danger |
| `GoalPage.tsx` | 完成目标 | "确认将目标标记为已完成？" | warning |
| `SwarmPage.tsx` | 停止Swarm | "确定停止Swarm网络？所有连接将断开。" | danger |
| `SwarmPage.tsx` | 举报节点 | "确认举报该节点？" | warning |
| `GovernancePage.tsx` | 解决债务 | "确认标记此技术债务为已解决？" | warning |
| `BlockchainPage.tsx` | 处理分红 | "确认执行分红处理？" | warning |

改造示例 — `GoalPage.tsx` 放弃目标:

```tsx
// 添加state
const [confirmAbandon, setConfirmAbandon] = useState(false)

// 按钮改为打开确认
<Button size="sm" variant="ghost" onClick={() => setConfirmAbandon(true)}>
  <XCircle className="w-4 h-4 text-red-400" />
</Button>

// 对话框
<ConfirmDialog
  open={confirmAbandon}
  onClose={() => setConfirmAbandon(false)}
  onConfirm={async () => {
    await hostApiFetch('/api/trinity/goal/abandon', { method: 'POST' })
    loadAll()
  }}
  title={t('goal.abandonConfirmTitle')}
  description={t('goal.abandonConfirmDesc')}
  confirmLabel={t('goal.abandon')}
  variant="danger"
/>
```

---

## 七、实施优先级与依赖

```
阶段1 (基础设施):
  ├── 安装sonner
  ├── 创建 src/lib/notify.ts
  ├── 创建 src/hooks/useAsyncAction.ts
  ├── 创建 src/components/EmptyState.tsx
  ├── 创建 src/components/ConfirmDialog.tsx
  └── App.tsx 挂载 <Toaster />

阶段2 (P1修复):
  ├── 替换6个文件的catch块 → notifyError
  ├── 改造按钮加loading态 (用useAsyncAction)
  └── 替换空状态文本 → EmptyState组件

阶段3 (P2修复):
  ├── 表单加验证错误提示
  └── 破坏性操作加ConfirmDialog

阶段4 (i18n):
  └── 补充所有新增的翻译key
```

---

## 八、新增文件清单

| 文件路径 | 用途 |
|---------|------|
| `src/lib/notify.ts` | 统一通知工具 |
| `src/hooks/useAsyncAction.ts` | 异步操作封装Hook |
| `src/components/EmptyState.tsx` | 空状态引导组件 |
| `src/components/ConfirmDialog.tsx` | 确认对话框组件 |

**改动文件**: `App.tsx` + Trinity下全部6个页面文件 + i18n文件

---

*本方案可由前端工程师直接按阶段实施，每阶段独立可交付。*
