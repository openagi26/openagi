# A/B 队视觉一致性评估报告

> 审查人: UX/UI 设计师 | 日期: 2026-04-10  
> 依据: B 队集成策略文档 `docs/ab-integration-strategy.md` 第三章设计语言规范  
> 对照基线: A 队 Trinity 原型 `docs/prototypes/trinity-management-wireframe.html` + A 队 `tailwind.config.js`

---

## 一、总体评估

**一致性评级: 85/100 — 高度一致，需 5 项对齐修正**

A 队（星空紫/glass-card）与 B 队（gray-950/purple-400）的视觉系统在品牌色调、组件结构、间距节奏上高度一致，均基于 Tailwind v3 + 深色模式 + 紫色品牌色。主要差异集中在 AI 角色色彩映射和卡片样式细节。

---

## 二、逐项对比

### 2.1 背景色 ✅ 一致

| 项目 | A 队 | B 队 | 差异 |
|------|------|------|------|
| 页面背景 | `#0c0a14` (深紫黑) | `gray-950` (#030712 纯黑) | 轻微色温差，合并后统一为 B 队的 `bg-gray-950` |
| 卡片背景 | `rgba(30,24,56,0.6)` + backdrop-blur | `rgba(255,255,255,0.05)` | **需对齐** |

**修正**: A 队 Identity/New.B 新页面卡片背景统一改为 `bg-white/5`，移除自定义 `rgba(30,24,56,0.6)`。

### 2.2 品牌色 ✅ 一致

| 项目 | A 队 | B 队 | 差异 |
|------|------|------|------|
| 品牌高亮 | `purple-400` (#c084fc) | `purple-400` (#c084fc) | 完全一致 |
| 按钮主色 | `purple-600` (#9333ea) | `purple-600` (#9333ea) | 完全一致 |
| 按钮悬停 | `purple-700` | `purple-700` | 完全一致 |

A 队的 `galaxy` 自定义色系（`tailwind.config.js`）与 B 队的 Tailwind 默认 `purple` 在 400/600/700 色阶上完全匹配，仅 `galaxy-950` (#2E1065) 等深色阶为 A 队独有，不影响一致性。

### 2.3 AI 角色色彩 ⚠️ 需对齐（关键差异）

| 角色 | A 队 Trinity 原型 | B 队规范 | 差异 |
|------|-----------------|---------|------|
| AI-1 扩张者 | **红色** `#f87171` (red-400) | **蓝色** `#60a5fa` (blue-400) | 颜色完全不同 |
| AI-2 风控员 | **青色** `#22d3ee` (cyan-400) | **琥珀色** `#fbbf24` (amber-400) | 颜色完全不同 |
| AI-3 财务官 | **琥珀色** `#fbbf24` (amber-400) | **翡翠绿** `#34d399` (emerald-400) | 颜色完全不同 |

**影响**: 这是最大的一致性风险。A 队 Trinity 原型使用了自研的红/青/琥珀三色系统，B 队使用了蓝/琥珀/翡翠三色系统。如果同一用户在不同页面看到不同的 AI 角色颜色，将造成严重认知混乱。

**修正方案（推荐）**: **A 队向 B 队对齐**
- AI-1: `red-400` → `blue-400`（扩张者 → 扩展者，语义匹配）
- AI-2: `cyan-400` → `amber-400`（风控员 → 审计者，语义匹配）
- AI-3: `amber-400` → `emerald-400`（财务官 → 治理者，语义匹配）

理由：B 队已实现完整 UI 且有更成熟的权限等级色彩系统（L0-L4），A 队新增模块数量少于 B 队，对齐成本更低。

### 2.4 卡片组件 ⚠️ 需微调

| 项目 | A 队 | B 队 | 差异 |
|------|------|------|------|
| 圆角 | `12px` (rounded-xl) | `8px` (rounded-lg) | A 队偏大 |
| 边框 | `rgba(139,92,246,0.15)` (紫色) | `rgba(255,255,255,0.10)` (白色) | A 队偏紫 |
| 内边距 | `16-20px` | `16px` (p-4) | 基本一致 |
| hover 效果 | 边框亮度+背景变化 | `bg-white/10` | 需统一 |

**修正**: A 队新页面卡片统一为 `rounded-lg bg-white/5 border border-white/10 p-4`，hover 为 `hover:bg-white/10`。

### 2.5 按钮样式 ✅ 基本一致

| 类型 | A 队 | B 队 | 差异 |
|------|------|------|------|
| 主要按钮 | `bg-purple-600 hover:bg-purple-700 rounded-md` | 同左 | 无 |
| 次要按钮 | `border border-border rounded-md` | `bg-white/5 border border-white/10 rounded-md` | 轻微差异 |
| 危险按钮 | 红色变体 | 未定义 | A 队独有，可保留 |

### 2.6 证据/权限等级色彩 ⚠️ 部分重叠

A 队 Trinity 原型中的证据等级（H1-H4）使用了红/黄/蓝/绿，与 B 队权限等级（L0-L4）的绿/蓝/琥珀/红/灰存在色阶交叉但不冲突（语义不同，不同页面）。

**建议**: 保持各自独立，但确保同一页面内不出现相同颜色表示不同含义的情况。

### 2.7 数据展示 ✅ 一致

| 项目 | A 队 | B 队 | 差异 |
|------|------|------|------|
| 数据值字体 | `font-mono` | `font-mono text-sm` | 一致 |
| 标签样式 | `text-xs rounded-full` | `text-xs px-2 py-0.5 rounded-full` | 一致 |

---

## 三、WCAG 合规评估

| 检查项 | A 队状态 | B 队要求 | 差距 |
|--------|---------|---------|------|
| 颜色非唯一状态指示 | 部分达标（AI状态有文字+圆点） | 必须 | 流程管道需补充文字 |
| 进度条 aria 属性 | 未实现 | `role="progressbar"` + aria-* | **需补充** |
| 表格 caption | 未使用 | `<caption class="sr-only">` | **需补充** |
| 导航标签 role | 未使用 | `role="tablist"/"tab"` + `aria-selected` | **需补充** |
| 文字对比度 | 大部分达标 (foreground on dark bg) | 4.5:1 | 需用工具逐色验证 |

---

## 四、执行清单

### 必须修正（阻塞合并）

| # | 项目 | 修正内容 | 影响范围 |
|---|------|---------|---------|
| M1 | AI 角色色彩 | A 队新页面 AI 角色颜色对齐为 `blue-400` / `amber-400` / `emerald-400` | Identity、New.B 页面 |
| M2 | 卡片样式 | `rounded-xl` → `rounded-lg`，边框 `purple/15` → `white/10` | 所有新页面卡片 |
| M3 | 卡片背景 | `rgba(30,24,56,0.6)` → `bg-white/5` | 所有新页面卡片 |
| M4 | WCAG aria | 进度条补充 `role="progressbar"` + aria 属性 | 所有进度条组件 |
| M5 | WCAG 表格 | 表格添加 `<caption class="sr-only">` | 所有数据表格 |

### 建议优化（非阻塞）

| # | 项目 | 内容 |
|---|------|------|
| S1 | 页面背景 | A 队全局背景统一为 `bg-gray-950`（当前 `#0c0a14` 有轻微紫调） |
| S2 | 次要按钮 | 统一为 `bg-white/5 hover:bg-white/10 border border-white/10` |
| S3 | hover 动效 | 统一为简单的 `bg-white/10` 过渡，移除 A 队的边框亮度变化效果 |
| S4 | 字体系统 | 确认双方使用相同的系统字体栈（`-apple-system, SF Pro...`） |

---

## 五、设计变量统一方案

建议在 `tailwind.config.js` 中新增以下统一变量，A/B 队共享：

```js
// tailwind.config.js → theme.extend
colors: {
  // 新增：A/B 统一设计 token
  'nc-bg':       'rgb(3 7 18)',      // gray-950
  'nc-card':     'rgb(255 255 255 / 0.05)',
  'nc-border':   'rgb(255 255 255 / 0.10)',
  'nc-ai1':      'rgb(96 165 250)',  // blue-400
  'nc-ai2':      'rgb(251 191 36)',  // amber-400
  'nc-ai3':      'rgb(52 211 153)',  // emerald-400
  'nc-brand':    'rgb(192 132 252)', // purple-400
  'nc-brand-btn':'rgb(147 51 234)',  // purple-600
}
```

这样 A 队新模块和 B 队现有 UI 通过统一的 `nc-*` token 引用色彩，确保未来修改时只需变更一处。

---

## 六、结论

A/B 队视觉系统**高度一致**，核心品牌色（purple-400/600/700）完全匹配。最大的修正项是 **AI 角色三色系统**的统一，建议 A 队向 B 队对齐。其余差异（卡片圆角、边框色调、WCAG 属性）均为细节级别，可在前端实现阶段一次性修正。

修正后 A 队 Identity 和 New.B 页面将与 B 队 Trinity UI 实现视觉无缝衔接。
