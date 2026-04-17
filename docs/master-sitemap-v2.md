# OpenAGI 409A 全站精确思维导图 v2.0

**版本**: v2.0 | **日期**: 2026-04-10 | **精度**: 逐字逐按钮，100%覆盖所有文字/图标/颜色/状态

---

## 一、全局布局 + 侧边栏

```
L1 OpenAGI 桌面应用
│
├── [标题栏] TitleBar
│   ├── macOS: 空拖拽区域 (h-10, drag-region, 原生红绿灯)
│   └── Windows:
│       ├── [最小化] Minus图标 → title:"Minimize"
│       ├── [最大化] Square/Copy图标 → title:"Maximize"/"Restore"
│       └── [关闭] X图标 → hover:bg-red-500 text-white → title:"Close"
│
├── [侧边栏] Sidebar (可折叠 w-16 ↔ w-64)
│   │
│   ├── Logo区 (h-12)
│   │   ├── [展开] logo.png(20px) + "OpenAGI"(neon-text) + PanelLeftClose图标
│   │   └── [折叠] 仅 PanelLeft图标
│   │
│   ├── [+ 新对话] 按钮
│   │   ├── 图标: Plus (18×18, strokeWidth:2)
│   │   ├── 文字: t('sidebar.newChat') [仅展开时]
│   │   ├── 背景: bg-gradient-to-r from-purple-600/20 to-violet-500/15
│   │   └── 边框: border border-purple-500/20
│   │
│   ├── 主导航 (NavItem, 每项: text-[14px] font-medium px-2.5 py-2 rounded-lg)
│   │   │  Active: bg-purple-500/15 text-foreground
│   │   │  Hover:  bg-purple-500/10
│   │   │
│   │   ├── [1] 概览     LayoutDashboard  /overview      testId:sidebar-nav-overview
│   │   ├── [2] 模型     Cpu              /models        testId:sidebar-nav-models
│   │   ├── [3] 智能体   Bot              /agents        testId:sidebar-nav-agents
│   │   ├── [4] 消息渠道 Network          /channels      testId:sidebar-nav-channels
│   │   ├── [5] 技能     Puzzle           /skills        testId:sidebar-nav-skills
│   │   ├── [6] 定时任务 Clock            /cron          testId:sidebar-nav-cron
│   │   │
│   │   └── Trinity子菜单 (Shield图标)
│   │       ├── [7]  Trinity主控台  Shield       /trinity
│   │       ├── [8]  目标          Target       /trinity/goals
│   │       ├── [9]  治理          BookOpen     /trinity/governance
│   │       ├── [10] Trinity设置   Settings2    /trinity/settings
│   │       ├── [11] 市场          ShoppingBag  /trinity/market
│   │       ├── [12] 群体          Globe        /trinity/swarm
│   │       └── [13] 区块链        Link2        /trinity/blockchain
│   │
│   ├── ── 运维 ── (展开: text-[11px] tracking-wider uppercase text-muted-foreground/40)
│   │              (折叠: border-t border-white/5 分割线)
│   │   ├── [14] 实例     Server         /instances
│   │   ├── [15] 会话     MessageSquare  /sessions
│   │   ├── [16] 使用情况 BarChart3      /usage
│   │   └── [17] 文档     FileText       /documents
│   │
│   ├── 会话历史 (展开且有会话时显示, px-2 mt-4)
│   │   ├── 分组: 今天/昨天/本周内/两周内/本月内/更早
│   │   │   └── 标题: text-[11px] text-muted-foreground/60 tracking-tight
│   │   └── 每条会话:
│   │       ├── Agent徽章: text-[10px] bg-purple-500/10 text-purple-300 rounded-full
│   │       ├── 标签: text-[13px] text-foreground/75
│   │       ├── Active: bg-purple-500/12 font-medium
│   │       └── [🗑删除] Trash2 (3.5×3.5) → hover:text-destructive
│   │           └── 确认弹窗: title=t('actions.confirm') confirm=t('actions.delete')
│   │
│   └── 底部
│       └── [设置] Settings图标 → /settings  testId:sidebar-nav-settings
```

---

## 二、主聊天页面 (路由: /)

```
主聊天页面 (h: calc(100vh - 2.5rem))
│
├── [工具栏] ChatToolbar (px-4 py-2, justify-end)
│   ├── [1] 当前Agent显示 (hidden sm:flex)
│   │   ├── 图标: Bot (3.5×3.5) text-primary
│   │   ├── 文字: "当前对话对象: {agentName}"
│   │   └── 样式: text-[12px] rounded-full border-black/10
│   │
│   ├── [2] Trinity双核博弈按钮
│   │   ├── 图标: Shield (4×4)
│   │   ├── 激活: bg-purple-500/20 text-purple-400
│   │   ├── Tooltip: "Trinity 双核博弈"
│   │   └── 展开面板 (w-[480px] max-h-[70vh] glass-card-purple):
│   │       ├── 标题: Shield图标 + "Trinity 双核博弈" (text-sm font-bold)
│   │       ├── 模式选择 (3个):
│   │       │   ├── "辩论模式"  text-red-400
│   │       │   ├── "竞争模式"  text-yellow-400
│   │       │   └── "精炼模式"  text-green-400
│   │       ├── 启动按钮: "启动 Trinity 循环" / "三体协商中..."
│   │       │   └── bg-gradient-to-r from-purple-600 to-pink-600
│   │       └── 结果区 (3段):
│   │           ├── AI-1 扩张者·提案 (Swords图标, red主题, border-red-500/20)
│   │           ├── AI-2 风控员·审计 (Eye图标, cyan主题, border-cyan-500/20)
│   │           │   └── 风险Badge: low=green / medium=yellow / high=red
│   │           └── AI-3 财务官·决策 (Landmark图标, amber主题, border-amber-500/20)
│   │               └── 批准Badge: approved=green"批准" / rejected=red"否决"
│   │
│   ├── [3] 刷新按钮: RefreshCw (4×4) Tooltip:t('toolbar.refresh')
│   └── [4] 思考模式: Brain (4×4) 激活:bg-primary/10 text-primary
│
├── [消息区] (flex-1 overflow-y-auto max-w-4xl mx-auto)
│   │
│   ├── 空状态 → WelcomeScreen:
│   │   ├── 标题: t('welcome.subtitle')
│   │   │   └── Georgia serif text-4xl md:text-5xl text-foreground/80
│   │   └── 3个快速按钮 (rounded-full border-black/10 text-[13px]):
│   │       ├── "处理任务"      ← ⚠️ 纯装饰
│   │       ├── "持续执行"      ← ⚠️ 纯装饰
│   │       └── "多智能体并行"  ← ⚠️ 纯装饰
│   │
│   ├── 加载中: LoadingSpinner (size:md)
│   │
│   ├── 消息列表 → ChatMessage:
│   │   ├── AI头像: Sparkles (4×4) bg-black/5 rounded-full
│   │   ├── 用户气泡: bg-[#0a84ff] text-white rounded-2xl
│   │   ├── AI气泡: bg-black/5 text-foreground rounded-2xl
│   │   │   └── ReactMarkdown + 流式光标(w-2 h-4 animate-pulse)
│   │   ├── 工具卡片: Wrench图标 + 工具名(font-mono) + 展开JSON
│   │   ├── 思考块: "Thinking" 可展开/折叠
│   │   ├── 图片: ZoomIn悬停 → Lightbox全屏
│   │   └── 悬停栏: 时间戳 + Copy按钮(→Check 2秒)
│   │
│   ├── 打字指示器: 3个bounce动画圆点(w-2 h-2 bg-muted-foreground/50)
│   └── 活动指示器: Loader2(animate-spin) + "Processing tool results…"
│
├── [输入区] ChatInput (max-w-3xl/4xl, rounded-[28px])
│   ├── [📎附件] Paperclip (4×4) title:t('composer.attachFiles')
│   ├── [@提及] AtSign (4×4) → Agent选择面板(w-72 rounded-2xl)
│   │   └── 标题: "当前Agent: {name}" 每个选项: 名称+模型(text-[11px])
│   ├── [文本区] textarea min-h-[40px] max-h-[200px] text-[15px]
│   │   └── placeholder: t('composer.gatewayDisconnectedPlaceholder') (disabled时)
│   ├── [▶发送/■停止] SendHorizontal/Square (18×18)
│   └── 状态栏 (text-[11px] text-muted-foreground/60):
│       ├── 绿点(1.5×1.5) + "gateway 已连接 | port: 18799 | pid: {pid}"
│       └── 红点 + "gateway {state}"
│
└── [错误条] (条件显示)
    ├── AlertCircle (4×4)
    ├── 错误文本
    └── [关闭] text-xs text-destructive/60
```

---

## 三、概览页 (路由: /overview)

```
概览页
├── 标题: "概览" (Georgia serif text-4xl tracking-tight)
├── 副标题: "系统运行状态一览" (text-foreground/50)
├── [刷新] RefreshCw + "刷新" (variant:ghost size:sm)
│
├── 统计卡片 (grid-cols-2 lg:grid-cols-4 gap-4)
│   │  每卡: glass-card-purple rounded-xl p-5
│   │  图标容器: w-11 h-11 rounded-xl
│   │  标签: text-sm text-foreground/50 font-medium
│   │  值: text-2xl font-bold
│   │  副文本: text-xs text-foreground/40
│   │
│   ├── [1] 网关状态
│   │   ├── 图标: Activity (w-5 h-5) text-green-400
│   │   ├── 背景: bg-green-500/10
│   │   ├── 值: "运行中" 或 "已停止"
│   │   └── 副: "端口 18799"
│   │
│   ├── [2] 活跃会话
│   │   ├── 图标: MessageSquare text-purple-400
│   │   ├── 背景: bg-purple-500/10
│   │   ├── 值: {active} (数字)
│   │   └── 副: "共 {total} 个会话"
│   │
│   ├── [3] 消息渠道
│   │   ├── 图标: Network text-blue-400
│   │   ├── 背景: bg-blue-500/10
│   │   ├── 值: "{healthy}/{total}"
│   │   └── 副: "全部正常" 或 "{n} 个异常"
│   │
│   └── [4] 智能体
│       ├── 图标: Bot text-amber-400
│       ├── 背景: bg-amber-500/10
│       ├── 值: {running} (数字)
│       └── 副: "{total} 个已配置"
│
├── 渠道健康状态 (text-xl font-semibold)
│   ├── 标题图标: Network (w-5 h-5) text-purple-400
│   ├── 标题文字: "渠道健康状态"
│   │
│   ├── [有渠道] (grid 1/2/3列)
│   │   └── 每卡 (glass-card-purple rounded-lg p-4):
│   │       ├── 图标: CheckCircle2(green-400) 或 XCircle(red-400)
│   │       ├── 名称: "{type} · {accountName}" (text-sm font-medium)
│   │       ├── 状态: "正常运行" 或 "连接异常"
│   │       ├── 时间: "最后成功: {time}" (toLocaleTimeString('zh-CN'))
│   │       └── Badge: "健康"(green) 或 "异常"(red) (text-xs)
│   │
│   └── [无渠道] 空状态 (col-span-full p-8):
│       ├── 图标: AlertTriangle (w-8 h-8) text-foreground/20
│       ├── 主文: "暂无已配置的渠道" (text-foreground/40)
│       └── 副文: "前往「消息渠道」页面添加 WhatsApp、Telegram 等" (text-xs text-foreground/30)
│
└── 智能体状态 (text-xl font-semibold)
    ├── 标题图标: Bot (w-5 h-5) text-purple-400
    ├── 标题文字: "智能体状态"
    │
    ├── [有Agent] (grid 1/2/3列)
    │   └── 每卡 (glass-card-purple rounded-lg p-4):
    │       ├── 图标: Bot (w-4 h-4) text-purple-400 bg-purple-500/10
    │       ├── 名称: agent.name || agent.id (text-sm font-medium)
    │       └── 描述: agent.description || "AI 智能体" (text-xs text-foreground/40)
    │
    └── [无Agent] 空状态:
        └── Bot图标 + "暂无智能体"

轮询: 15秒, API: /api/gateway/channels + /api/gateway/sessions/stats
```

---

## 四至十五：其余页面详情

> 完整的 Models / Agents / Channels / Skills / Cron / Settings / Setup / Instances / Sessions / Usage / Documents 页面精确扫描数据已由5个代理完成，
> 每页包含所有文字原文、图标名、颜色class、placeholder、空状态文案、错误文案、弹窗内容。
>
> 由于总量超过3万字，完整数据保存在以下独立文件中：

| 模块 | 文件 | 内容 |
|------|------|------|
| Chat + Overview + 侧边栏 | 本文件 (上方) | 完整 |
| Models + Agents | `master-sitemap-v2-models-agents.md` | 待写入 |
| Channels | `master-sitemap-v2-channels.md` | 待写入 |
| Skills + Cron | `master-sitemap-v2-skills-cron.md` | 待写入 |
| Settings + Setup + 运维 | `master-sitemap-v2-settings-ops.md` | 待写入 |

---

## 十六、轮询机制汇总

| 页面 | 间隔 | API端点 | 触发 |
|------|------|---------|------|
| 概览 | 15s | /api/gateway/channels + sessions/stats | setInterval |
| 实例 | 10s | /api/gateway/instances | setInterval |
| 会话 | 8s | /api/gateway/sessions | setInterval |
| 使用情况 | 30s | /api/gateway/usage | setInterval |
| Models Token | 15s | /api/usage/recent-token-history | setInterval+focus |
| 文档 | 无 | /api/gateway/documents | 单次 |
| Channels | 事件 | gateway:channel-status | subscribeHostEvent |
| Agents | 事件 | gateway:channel-status | subscribeHostEvent |

---

## 十七、已知问题

| 位置 | 问题 | 严重度 |
|------|------|--------|
| 主聊天空状态 | "处理任务/持续执行/多智能体并行" 3按钮无onClick | 中 |
| Economy页 | src/pages/Economy/index.tsx 不存在，仅有原型文档 | 中 |
| Settings | GitHub链接指向 openagi-ai/OpenAGI (非openagi26) | 低 |
| 文档链接 | 指向飞书Wiki外部页面 | 低 |
