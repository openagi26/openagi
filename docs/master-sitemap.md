# OpenAGI 409A 全站思维导图（Master Sitemap）

**版本**: v1.0 | **日期**: 2026-04-10 | **来源**: 5个代理并行深度扫描源码

---

## 一、全局结构 + 路由 + 侧边栏

```
L1 OpenAGI 桌面应用 (Electron 40 + React 19 + Vite + Tailwind)
│
├── [标题栏] TitleBar — macOS 玻璃效果，可拖拽
│
├── [侧边栏] Sidebar (可折叠 w-16 ↔ w-64)
│   │
│   ├── Logo "OpenAGI" + [折叠/展开] 按钮
│   │
│   ├── [+ 新对话] → 创建会话 → 导航到 /
│   │
│   ├── 主导航菜单
│   │   ├── 概览      → /overview   → Overview     (LayoutDashboard 图标)
│   │   ├── 模型      → /models     → Models       (Cpu 图标)
│   │   ├── 智能体    → /agents     → Agents       (Bot 图标)
│   │   ├── 消息渠道  → /channels   → Channels     (Network 图标)
│   │   ├── 技能      → /skills     → Skills       (Puzzle 图标)
│   │   └── 定时任务  → /cron       → Cron         (Clock 图标)
│   │
│   ├── Trinity 治理系统 (Shield 图标，子菜单)
│   │   ├── Trinity 主控台   → /trinity              → TrinityPage
│   │   ├── 目标             → /trinity/goals         → GoalPage
│   │   ├── 治理             → /trinity/governance    → GovernancePage
│   │   ├── Trinity 设置     → /trinity/settings      → TrinitySettingsPage
│   │   ├── 市场             → /trinity/market        → MarketPage
│   │   ├── Swarm 群集       → /trinity/swarm         → SwarmPage
│   │   └── 区块链           → /trinity/blockchain    → BlockchainPage
│   │
│   ├── ── 运维 ── (灰色分隔符)
│   │   ├── 实例      → /instances  → Instances    (Server 图标)
│   │   ├── 会话      → /sessions   → Sessions     (MessageSquare 图标)
│   │   ├── 使用情况  → /usage      → Usage        (BarChart3 图标)
│   │   └── 文档      → /documents  → Documents    (FileText 图标)
│   │
│   ├── 会话历史列表 (展开时显示)
│   │   ├── 今天
│   │   ├── 昨天
│   │   ├── 本周
│   │   ├── 两周内
│   │   ├── 本月
│   │   └── 更早
│   │   └── 每条: Agent名 + 标签 | 可切换 | [🗑删除] → 确认弹窗
│   │
│   └── 底部
│       └── 设置 → /settings/* → Settings (Settings 图标)
│
├── [Setup 向导] → /setup/* (首次启动)
│   └── 步骤 0-3: 欢迎 → 运行时检测 → AI提供商配置 → 技能安装 → 完成
│
└── [主聊天] → / → Chat (默认路由)
```

---

## 二、主聊天页面 (路由: /)

```
主聊天页面
├── 顶部工具栏 ChatToolbar
│   ├── "当前对话对象: {Agent名}" 标签
│   ├── [刷新] 按钮
│   └── [ℹ] 信息按钮
│
├── 空会话状态
│   ├── "我能为你做些什么？"
│   ├── [处理任务]      ← ⚠️ 纯装饰按钮，无 onClick
│   ├── [持续执行]      ← ⚠️ 纯装饰按钮，无 onClick
│   └── [多智能体并行]  ← ⚠️ 纯装饰按钮，无 onClick
│
├── 有会话: 消息流
│   ├── Markdown 渲染
│   ├── 工具卡片 (CodeEngine 工具调用展示)
│   └── 图片附件
│
├── 输入区
│   ├── [📎 附件] 按钮
│   ├── [@ 提及] 按钮
│   ├── 输入框 (多行)
│   └── [▶ 发送 / ■ 停止] 按钮
│
└── 底部状态栏
    └── "● gateway 已连接 | port: 18799 | pid: 85456"
```

---

## 三、Trinity 治理系统 (路由: /trinity/*)

```
Trinity 主控台 (/trinity)
├── 节点身份卡片
│   ├── 节点 DID / 公钥 / 地址
│   └── 锁定状态
├── 三体 AI 状态 (AI-1 扩张者 / AI-2 审计者 / AI-3 治理者)
├── PoO 统计
├── 治理概览
└── Genesis 初始化 (首次)

目标页 (/trinity/goals)
├── 目标列表 (GoalFit 评分)
├── 新建目标表单
└── 目标详情

治理页 (/trinity/governance)
├── 治理账本 (6类: 证据/价值/债务/时效/判例/本地)
├── 治理决策历史
└── 信用体系

市场页 (/trinity/market)
├── Playbook 交易所
├── 余额显示
└── 购买/上架流程

Swarm 群集页 (/trinity/swarm)
├── 节点发现
├── 联邦状态
└── 跨节点通信

区块链页 (/trinity/blockchain)
├── 链上记录
├── 交易历史
└── 智能合约交互

Trinity 设置页 (/trinity/settings)
├── 引擎配置
├── 权限矩阵
└── 节点晋升设置
```

---

## 四、模型管理页 (路由: /models)

```
模型管理
├── AI Providers 部分 (ProvidersSettings 组件)
│   ├── 已配置提供商列表
│   ├── [+ 添加提供商] → 弹窗 (11个供应商)
│   │   ├── Anthropic | OpenAI | Google
│   │   ├── OpenRouter | MiniMax(CN) | Moonshot(CN)
│   │   ├── SiliconFlow(CN) | MiniMax(Global) | ByteDance Ark
│   │   └── Ollama | 自定义
│   └── 配置表单
│       ├── 显示名称 / API 密钥 (👁显示/隐藏) / 基础 URL
│       ├── 模型 ID
│       └── 协议: [OpenAI Completions] [OpenAI Responses] [Anthropic兼容]
│
└── Token 使用历史部分
    ├── 分组切换: [按模型] / [按时间]
    ├── 时间窗口: [7天] / [30天] / [全部]
    ├── 堆积条形图 (输入Token蓝 / 输出Token紫 / 缓存Token琥珀)
    └── 分页记录列表 (5条/页)
        └── 每条: 模型名 | 总Token | 输入/输出/缓存明细 | 时间戳
```

---

## 五、智能体管理页 (路由: /agents)

```
智能体管理
├── Agent 卡片列表
│   └── 每个 Agent 卡片
│       ├── Bot 图标 + 名称 + [默认] 标签
│       ├── Model 信息 (含"继承"标记)
│       ├── 已绑定通道列表
│       ├── [⚙ 设置] → AgentSettingsModal
│       └── [🗑 删除] → 确认弹窗 (仅非默认)
│
├── [+ 添加智能体] → AddAgentDialog
│   ├── 名称输入
│   ├── 继承工作区开关
│   └── [保存] / [取消]
│
├── AgentSettingsModal (编辑)
│   ├── 名称编辑 (非默认时可改)
│   ├── Agent ID (只读)
│   ├── 模型选择 → AgentModelModal
│   │   ├── 提供商下拉选择
│   │   ├── 模型 ID 输入
│   │   ├── 预览: {providerKey}/{modelId}
│   │   └── [使用默认] / [保存]
│   └── 通道绑定列表 (只读)
│
└── 网关离线警告横幅
```

---

## 六、消息渠道页 (路由: /channels)

```
消息渠道
├── 已配置渠道部分
│   └── 每个渠道组
│       ├── 渠道 Logo + 名称 + 类型 + 状态指示灯 (🟢🟡🔴⚫)
│       ├── [+ 添加账户] → ChannelConfigModal
│       ├── [🗑 删除] → 确认弹窗
│       └── 账户列表
│           └── 每个账户
│               ├── 账户名 + 错误信息
│               ├── 绑定智能体下拉框
│               ├── [编辑] → ChannelConfigModal
│               └── [🗑 删除] → 确认弹窗
│
├── 支持的渠道部分 (网格, 未配置的)
│   └── 8个平台卡片
│       ├── Telegram | Discord | WhatsApp | WeChat
│       ├── 钉钉 | 飞书 | 企微 | QQ
│       └── 点击 → 配置弹窗
│
└── ChannelConfigModal
    ├── 通道类型选择 (首次)
    ├── 扫码连接模式 (QR Code)
    │   ├── 二维码图像 (264x264)
    │   └── [刷新二维码]
    └── 令牌连接模式
        ├── 说明文档 + 步骤指引
        ├── 动态配置表单 (密钥/Token/频道ID等)
        ├── [验证凭证] → POST /api/channels/credentials/validate
        └── [保存并连接] → POST /api/channels/config
```

---

## 七、技能管理页 (路由: /skills)

```
技能管理
├── 搜索栏 + 过滤标签
│   ├── [全部] / [内置] / [市场]
│   └── 快速操作: [启用可见] / [禁用可见] / [安装技能] / [刷新]
│
├── 技能列表
│   └── 每个技能卡片
│       ├── 图标 (emoji) + 名称 + 🔒核心 / 🧩内置标签
│       ├── 描述 (单行截断)
│       ├── 来源标签 (Bundled/Managed/Workspace/Personal/Project)
│       ├── 版本号
│       └── 启用/禁用开关 (核心技能不可禁用)
│
├── [安装技能] → 右侧抽屉 (Sheet)
│   ├── 搜索 ClawHub 市场
│   └── 搜索结果: [Install] / [卸载]
│
└── 技能详情抽屉 (点击技能卡片)
    ├── 图标 + 名称 + 版本 + 类型标签
    ├── 源信息 (路径 + 复制 + 打开文件夹)
    ├── API Key 配置 (密码输入)
    ├── 环境变量配置 (key-value 列表 + 增删)
    ├── 外部链接 (ClawHub / 手动编辑)
    └── [保存配置] / [卸载/禁用]
```

---

## 八、定时任务页 (路由: /cron)

```
定时任务
├── 统计卡片 (4列)
│   ├── 总计 (Clock) | 活跃 (Play) | 暂停 (Pause) | 失败 (XCircle)
│
├── 任务卡片网格
│   └── 每个任务卡片
│       ├── 名称 + 状态指示灯 (绿/灰)
│       ├── 计划: parseCronSchedule() 中文易读
│       ├── 执行内容 (2行截断)
│       ├── 交付信息 (频道+账户, 可选)
│       ├── 最后运行 (时间 + ✓成功/✗失败)
│       ├── 下次运行时间
│       ├── 错误提示 (失败时红色)
│       ├── 启用/禁用开关
│       └── 悬停操作: [▶运行] / [🗑删除]
│
├── [+ 新建任务] → TaskDialog
│   ├── 任务名输入
│   ├── 执行内容 (TextArea)
│   ├── 计划设置
│   │   ├── 预设: [每天] [每周] [每月] [每小时] [自定义]
│   │   ├── 自定义 Cron 表达式输入
│   │   └── 下次运行预览
│   ├── 交付设置
│   │   ├── [无交付] / [通知]
│   │   └── 频道选择 → 账户选择 → 目标选择
│   ├── 立即启用开关
│   └── [保存] / [取消]
│
└── 删除确认弹窗
```

---

## 九、概览页 (路由: /overview)

```
系统概览
├── 统计卡片 (4列)
│   ├── 网关状态 (运行中/已停止, 端口号)
│   ├── 活跃会话 (数量, 总数)
│   ├── 消息渠道 (健康数/总数)
│   └── 智能体 (运行数, 已配置数)
│
├── 渠道健康状态 (网格)
│   └── 每个渠道: ✅/❌ + 类型 + 账户名 + 状态 + 最后成功时间
│
└── 智能体状态 (网格)
    └── 每个Agent: Bot图标 + 名称 + 描述

轮询: 每15秒, API: /api/gateway/channels + /api/gateway/sessions/stats
```

---

## 十、运维页面

### 实例管理 (/instances)
```
实例管理 (只读, 10秒轮询)
└── 实例列表
    └── 每个实例: 名称 + 状态Badge + 端口 + PID + 内存 + 启动时间
```

### 会话管理 (/sessions)
```
会话管理 (8秒轮询)
├── 搜索框 (多字段模糊匹配)
└── 会话列表
    └── 每条: 名称 + 状态(活跃/空闲/完成) + Agent + 渠道 + 消息数 + 最后活动
        └── [终止] (仅active) → 确认弹窗 → POST /api/gateway/sessions/${key}/kill
```

### 使用情况 (/usage)
```
使用统计 (30秒轮询)
├── 统计卡片: 总Token | API调用 | 预估费用 | 模型数
└── 模型用量明细 (按Token降序)
    └── 每条: 模型名 + 供应商Badge + Token数 + 占比条 + 调用次数
```

### 文档 (/documents)
```
文档管理 (只读, 单次加载)
├── 搜索 + 过滤: [全部] [技能] [智能体] [配置]
└── 文档列表
    └── 每条: 类型图标 + 名称 + 类型Badge + 路径 + 大小 + 修改日期
```

---

## 十一、设置页 (路由: /settings/*)

```
设置
├── [通用] Tab
│   ├── 外观: 主题 [亮色/深色/系统] + 语言选择
│   ├── 启动行为: 最小化启动 / 开机自启 / 遥测开关
│   ├── 网关设置
│   │   ├── 状态显示 (运行中/已停止) + [重启] + [查看日志]
│   │   ├── 自动启动开关 + 端口配置
│   │   └── 代理设置 (启用 / HTTP / HTTPS / 全局 / 绕过规则)
│   ├── 控制面板 (Gateway Token / CLI命令 / Doctor诊断修复)
│   ├── 遥测查看器 (展开: 事件统计 + WS诊断)
│   └── 应用信息 (版本 + 官网 + GitHub + 文档)
│
└── [AI 引擎] Tab → CodeEngineSettings
    ├── 引擎状态 (stopped/starting/ready/busy/error) + 启用开关
    ├── AI 模型选择 (4选项网格)
    │   ├── Claude Sonnet 4.6 (推荐)
    │   ├── Claude Opus 4
    │   ├── Claude Haiku 3.5
    │   └── Claude Sonnet 4.5
    ├── API 密钥 (Anthropic Key, 密码输入 + 显示/隐藏)
    ├── 工作目录配置
    ├── 高级参数 (最大回合数 1-100 / 最大输出Token 256-65536)
    └── 工具能力开关 (14项网格)
        ├── 💻终端命令 | 📖读取文件 | ✏️写入文件 | 🔧编辑文件
        ├── 🔍文件搜索 | 🔎内容搜索 | 📁目录列表 | 🌐网页搜索
        ├── 📥网页抓取 | 📓笔记本编辑 | ✅任务管理 | 🤖子代理
        └── 🔌MCP工具 | 🖥️计算机操作
```

---

## 十二、Setup 首次启动向导

```
Setup 向导
├── Step 0: 欢迎
│   ├── "欢迎使用 OpenAGI"
│   ├── 语言选择 (🇺🇸English / 🇨🇳中文 / ...)
│   └── 特性列表
│
├── Step 1: 运行时检测
│   ├── OpenClaw Gateway 检查 (状态 + 启动按钮)
│   ├── Python 检查 (版本)
│   ├── Node.js 检查
│   └── [重新检查] / [查看日志]
│
├── Step 2: AI 提供商配置
│   ├── 提供商下拉 (OpenAI / Anthropic / Google / ...)
│   ├── 认证方式: [OAuth] / [API Key]
│   ├── API Key 输入 + 验证
│   ├── Base URL / 模型 ID (可选)
│   └── [测试连接] / [保存]
│
└── Step 3: 技能安装
    ├── 默认技能清单 (勾选)
    ├── 安装进度 (逐个 ⏳→🔄→✓/✗)
    └── [完成] → markSetupComplete() → 跳转 /
```

---

## 十三、Electron 主进程架构

```
Electron 后端
├── electron/main/
│   ├── index.ts — 主进程入口 (窗口/托盘/菜单/单实例/更新)
│   ├── ipc-handlers.ts — IPC 事件处理
│   ├── window.ts / tray.ts / menu.ts — 窗口管理
│   ├── updater.ts — 版本更新
│   └── proxy.ts / launch-at-startup.ts — 系统设置
│
├── electron/gateway/ — Gateway 生命周期
│   ├── manager.ts — 启动/停止/重启
│   ├── connection-monitor.ts — WebSocket 心跳
│   ├── supervisor.ts — 内存/CPU 监控
│   └── clawhub.ts — ClawHub 集成
│
├── electron/api/ — Host API 服务器 (port 18799)
│   ├── server.ts — Express HTTP 服务
│   └── routes/ — 11个 API 路由
│       ├── app / gateway / sessions / agents
│       ├── channels / skills / providers
│       ├── settings / usage / logs / files / cron
│
├── electron/code-engine/ — Claude Code 引擎
│   └── manager.ts — 进程管理 + IPC
│
└── electron/services/providers/ — Provider CRUD + 同步
```

---

## 十四、数据轮询机制汇总

| 页面 | 轮询间隔 | API 端点 |
|------|---------|---------|
| 概览 | 15s | /api/gateway/channels + sessions/stats |
| 实例 | 10s | /api/gateway/instances |
| 会话 | 8s | /api/gateway/sessions |
| 使用情况 | 30s | /api/gateway/usage |
| 文档 | 无 (单次) | /api/gateway/documents |
| Models Token | 15s | /api/usage/recent-token-history |
| Channels | 事件驱动 | gateway:channel-status |
| Agents | 事件驱动 | gateway:channel-status |

---

## 十五、已知问题

| 位置 | 问题 | 严重度 |
|------|------|--------|
| 主聊天空状态 | [处理任务]/[持续执行]/[多智能体并行] 无 onClick | 中 |
| Trinity 子页 | GoalPage/SwarmPage/BlockchainPage 内容待充实 | 中 |
| 设置页 | GitHub链接指向 openagi-ai/OpenAGI (非 openagi26) | 低 |
| 文档链接 | 指向飞书 Wiki 外部页面 | 低 |

---

**总路由数**: 22条 | **侧边栏入口**: 16个 | **API路由**: 11个 | **源文件**: 100个 .ts/.tsx
