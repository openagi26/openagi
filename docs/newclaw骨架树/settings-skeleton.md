# Settings 页面 — 骨架树（去叶留枝版）

```
/settings
│
├── 页面头部
│   ├── 标题："设置"
│   └── 副标题："配置您的 OpenAGI 体验"
│
├── 顶部标签页导航
│   ├── [通用设置]（默认激活）
│   └── [AI 引擎]
│
│
├── ══════ 标签页 A：通用设置 ══════
│
│   ├── 区块一：通用（外观与启动）
│   │   ├── 区块标题："通用"
│   │   │
│   │   ├── 主题选择
│   │   │   ├── 标签："主题"
│   │   │   ├── [浅色]（选中高亮）
│   │   │   ├── [深色]（选中高亮）
│   │   │   └── [跟随系统]（选中高亮）
│   │   │
│   │   ├── 语言选择
│   │   │   ├── 标签："语言"
│   │   │   └── 动态渲染 SUPPORTED_LANGUAGES 列表（每个语言一个按钮，选中高亮）
│   │   │
│   │   └── 开机自动启动
│   │       ├── 标签："开机自动启动"
│   │       ├── 描述："登录系统后自动启动 OpenAGI"
│   │       └── 开关（Switch）
│   │
│   ├── ── 分割线 ──
│   │
│   ├── 区块二：网关
│   │   ├── 区块标题："网关"
│   │   │
│   │   ├── 网关状态行
│   │   │   ├── 标签："状态"
│   │   │   ├── 说明："端口: {port}"
│   │   │   ├── 状态徽章（圆点 + 文字）
│   │   │   │   ├── running → 绿色 "running"
│   │   │   │   ├── error   → 红色 "error"
│   │   │   │   └── 其他    → 灰色 "{state}"
│   │   │   ├── [重启] 按钮
│   │   │   └── [日志] 按钮 → 展开日志面板
│   │   │
│   │   ├── 日志面板（点击"日志"后展开）
│   │   │   ├── 标题："应用日志"
│   │   │   ├── [打开文件夹]（ExternalLink 链接）
│   │   │   ├── [关闭]
│   │   │   └── 日志内容（等宽预览框，最多100行，无内容时显示 "暂无日志"）
│   │   │
│   │   ├── 自动启动网关
│   │   │   ├── 标签："自动启动网关"
│   │   │   ├── 描述："OpenAGI 启动时自动启动网关"
│   │   │   └── 开关（Switch）
│   │   │
│   │   ├── 开发者模式
│   │   │   ├── 标签："开发者模式"
│   │   │   ├── 描述："显示开发者工具和快捷方式"
│   │   │   └── 开关（Switch，testid=settings-dev-mode-switch）
│   │   │
│   │   └── 匿名使用数据
│   │       ├── 标签："匿名使用数据"
│   │       ├── 描述："允许提供匿名的基础使用数据，用于改进 OpenAGI"
│   │       └── 开关（Switch）
│   │
│   ├── ── 分割线（仅开发者模式时） ──
│   │
│   ├── 区块三：开发者（仅 devModeUnlocked=true 时渲染）
│   │   ├── 区块标题："开发者"
│   │   │
│   │   ├── 子区块 3-1：Gateway Proxy（代理）
│   │   │   ├── 标签："Gateway Proxy"
│   │   │   ├── 描述："让 Electron 和 Gateway 的网络请求都走本地代理客户端。"
│   │   │   ├── 开关（Switch，testid=settings-proxy-toggle）
│   │   │   ├── [保存]（保存中：旋转图标 + "保存中..."，脏数据时才可点击，testid=settings-proxy-save-button）
│   │   │   └── 说明："保存后会立即重新应用 Electron 网络代理，并自动重启 Gateway…"
│   │   │
│   │   │   └── 代理字段展开区（仅代理开关=开时显示）
│   │   │       ├── 代理服务器输入框（placeholder: http://127.0.0.1:7890）
│   │   │       │   └── 帮助文字："所有请求默认使用的代理…"
│   │   │       ├── HTTP 代理输入框
│   │   │       │   └── 帮助文字："HTTP 请求的高级覆盖项…"
│   │   │       ├── HTTPS 代理输入框
│   │   │       │   └── 帮助文字："HTTPS 请求的高级覆盖项…"
│   │   │       ├── ALL_PROXY / SOCKS 输入框（placeholder: socks5://127.0.0.1:7891）
│   │   │       │   └── 帮助文字："支持 SOCKS 的客户端和 Telegram 等协议的高级兜底代理…"
│   │   │       └── 绕过规则输入框（placeholder: <local>;localhost;127.0.0.1;::1）
│   │   │           └── 帮助文字："使用分号、逗号或换行分隔需要直连的主机。"
│   │   │
│   │   ├── 子区块 3-2：网关令牌
│   │   │   ├── 标签："网关令牌"
│   │   │   ├── 描述："如果需要，将此粘贴到控制台设置中"
│   │   │   ├── 只读输入框（显示 token，placeholder: "令牌不可用"，testid=settings-developer-gateway-token）
│   │   │   ├── [加载]（RefreshCw 图标 + 刷新令牌）
│   │   │   └── [复制]（无令牌时禁用）→ Toast "网关令牌已复制"
│   │   │
│   │   ├── 子区块 3-3：OpenAGI CLI（仅 showCliTools=true 时显示）
│   │   │   ├── 标签："OpenAGI CLI"
│   │   │   ├── 描述："复制命令以运行 OpenAGI，无需修改 PATH。"
│   │   │   ├── （Windows 提示："PowerShell 命令。"）
│   │   │   ├── 只读输入框（显示 CLI 命令，placeholder: 错误信息 / "命令不可用"）
│   │   │   └── [复制]（无命令时禁用）→ Toast "CLI 命令已复制"
│   │   │
│   │   ├── 子区块 3-4：OpenAGI Doctor 诊断
│   │   │   ├── 标签："OpenAGI Doctor 诊断"
│   │   │   ├── 描述："运行 `openagi doctor` 并查看原始诊断输出。"
│   │   │   ├── [运行 Doctor]（运行中: 旋转图标 + "运行中..."，互斥禁用）→ Toast 成功/失败
│   │   │   ├── [运行 Doctor 并修复]（运行中: 旋转图标 + "运行中..."，互斥禁用）→ Toast 成功/失败
│   │   │   └── [复制]（无结果时禁用）→ Toast "诊断输出已复制"
│   │   │
│   │   │   └── 诊断结果面板（有结果时显示）
│   │   │       ├── 模式徽章：diagnose→"正常"/"发现问题"；fix→"已修复"/"修复失败"
│   │   │       ├── 退出码徽章："退出码: {n}"
│   │   │       ├── 耗时徽章："耗时: {n}ms"
│   │   │       ├── 元信息："命令: {cmd}  工作目录: {cwd}  错误: {err}"
│   │   │       ├── 标准输出（等宽预览框，空时显示"（空）"）
│   │   │       └── 标准错误（等宽预览框，空时显示"（空）"）
│   │   │
│   │   ├── 子区块 3-5：WS 诊断模式
│   │   │   ├── 标签："WS 诊断模式"
│   │   │   ├── 描述："临时启用 WS/HTTP 回退链，用于网关 RPC 调试。"
│   │   │   └── 开关（Switch）→ Toast "已启用 WS 诊断模式" / "已关闭 WS 诊断模式"
│   │   │
│   │   └── 子区块 3-6：埋点查看器
│   │       ├── 标签："埋点查看器"
│   │       ├── 描述："仅本地 UX/性能埋点，显示最近 200 条。"
│   │       └── [显示] / [隐藏]（切换展开）
│   │
│   │           └── 埋点面板（展开时显示）
│   │               ├── 统计徽章："总数: N"  "错误: N"（有错时红色）  "慢请求（>=800ms）: N"
│   │               ├── [复制]（全量 JSON）→ Toast "埋点已复制"
│   │               ├── [清空] → Toast "埋点已清空"
│   │               ├── 事件聚合表（最多 12 行，有数据时显示）
│   │               │   └── 每行：事件名 · n=N · avg=Nms · slow=N · err=N
│   │               └── 原始埋点列表（倒序，最多 200 条）
│   │                   ├── 每条：事件名 + 时间戳 + JSON payload
│   │                   └── 空状态："暂无埋点"
│   │
│   ├── ── 分割线 ──
│   │
│   ├── 区块四：更新
│   │   ├── 区块标题："更新"
│   │   │
│   │   ├── UpdateSettings 子组件
│   │   │   ├── 加载中状态："加载中..."（isInitialized=false 时）
│   │   │   │
│   │   │   ├── 当前版本行
│   │   │   │   ├── 标签："当前版本"
│   │   │   │   ├── 版本号大字："v{currentVersion}"
│   │   │   │   └── 状态图标（旋转=checking/downloading，下载箭头=available，火箭=downloaded，刷新=error，灰刷新=其他）
│   │   │   │
│   │   │   ├── 状态栏（上下边框）
│   │   │   │   ├── 状态文本
│   │   │   │   │   ├── "正在检查更新..."（checking）
│   │   │   │   │   ├── "正在下载更新..."（downloading）
│   │   │   │   │   ├── "可用更新：v{version}"（available）
│   │   │   │   │   ├── "准备安装：v{version}"（downloaded，无倒计时）
│   │   │   │   │   ├── "将在 {N} 秒后重启并安装更新..."（downloaded+倒计时）
│   │   │   │   │   ├── "您已拥有最新版本"（not-available）
│   │   │   │   │   ├── "{errorMsg}"（error，开发版："当前为开发版本，自动更新不可用"）
│   │   │   │   │   └── "检查更新以获取最新功能"（idle）
│   │   │   │   └── 操作按钮（与状态对应）
│   │   │   │       ├── [检查中...]（disabled，checking）
│   │   │   │       ├── [下载中...]（disabled，downloading）
│   │   │   │       ├── [下载更新]（available）
│   │   │   │       ├── [安装并重启]（downloaded，无倒计时）
│   │   │   │       ├── [取消]（downloaded+倒计时）
│   │   │   │       ├── [重试]（error）
│   │   │   │       └── [检查更新]（idle/not-available）
│   │   │   │
│   │   │   ├── 下载进度条（status=downloading 且有进度数据时）
│   │   │   │   ├── "已传输 / 总大小"（格式化为 B/KB/MB）
│   │   │   │   ├── "{速度}/s"
│   │   │   │   ├── 进度条
│   │   │   │   └── "{N}% complete"
│   │   │   │
│   │   │   ├── 更新信息卡（status=available 或 downloaded，且有 updateInfo 时）
│   │   │   │   ├── "Version {version}"
│   │   │   │   ├── 发布日期（如有）
│   │   │   │   └── "更新内容：{releaseNotes}"（如有）
│   │   │   │
│   │   │   ├── 错误详情卡（status=error，非 dev-mode 无关错误时）
│   │   │   │   ├── "错误详情："
│   │   │   │   └── 错误消息
│   │   │   │
│   │   │   └── 帮助文字："开启自动更新后，更新将自动下载并安装。"
│   │   │
│   │   ├── 自动检查更新
│   │   │   ├── 标签："自动检查更新"
│   │   │   ├── 描述："启动时检查更新"
│   │   │   └── 开关（Switch）
│   │   │
│   │   └── 自动更新
│   │       ├── 标签："自动更新"
│   │       ├── 描述："自动下载并安装更新"
│   │       └── 开关（Switch）
│   │
│   ├── ── 分割线 ──
│   │
│   └── 区块五：关于
│       ├── 区块标题："关于"
│       ├── "OpenAGI - 图形化 AI 助手"
│       ├── "基于 OpenAGI"
│       ├── "版本 {currentVersion}"
│       ├── [官网]（外链 https://openagi.app）
│       ├── [GitHub]（外链 https://github.com/openagi-ai/OpenAGI）
│       └── [常见问题]（外链 飞书文档）
│
│
└── ══════ 标签页 B：AI 引擎 ══════（CodeEngineSettings 子组件）
    │
    ├── 区块一：AI 代码引擎状态卡
    │   ├── 标题："AI 代码引擎"
    │   ├── 引擎状态指示
    │   │   ├── stopped   → 灰点 "已停止"
    │   │   ├── starting  → 黄点闪烁 "启动中..."
    │   │   ├── ready     → 绿点 "就绪"
    │   │   ├── busy      → 紫点闪烁 "忙碌中..."
    │   │   └── error     → 红点 "错误"
    │   ├── 开关（启用/禁用引擎，Switch）
    │   └── 描述："Claude Code 引擎赋予 OpenAGI 代码编写、文件操作、终端命令执行等能力…"
    │
    ├── ── 分割线 ──
    │
    ├── 区块二：AI 模型选择
    │   ├── 标题："AI 模型"
    │   └── 模型卡片网格（2 列，选中高亮 + 勾选图标）
    │       ├── Claude Sonnet 4.6 — "均衡性能（推荐）"
    │       ├── Claude Opus 4    — "最强推理能力"
    │       ├── Claude Haiku 3.5 — "超快速度"
    │       └── Claude Sonnet 4.5 — "深度思考"
    │
    ├── ── 分割线 ──
    │
    ├── 区块三：API 密钥
    │   ├── 标题："API 密钥"
    │   ├── 标签："Anthropic API Key（用于 Claude 模型）"
    │   ├── 密码输入框（placeholder: sk-ant-api03-...）+ 显示/隐藏切换按钮
    │   └── 提示："密钥仅保存在本地，不会上传到任何服务器。"
    │
    ├── ── 分割线 ──
    │
    ├── 区块四：工作目录
    │   ├── 标题："工作目录"
    │   ├── 路径输入框（placeholder: /Users/yourname/projects）
    │   └── 提示："AI 引擎执行命令和操作文件的默认目录。"
    │
    ├── ── 分割线 ──
    │
    ├── 区块五：高级参数
    │   ├── 标题："高级参数"
    │   ├── 最大回合数（数字输入框，范围 1-100）
    │   │   └── 描述："AI 单次对话最多执行的步骤数"
    │   └── 最大输出 Token（数字输入框，范围 256-65536，步进 256）
    │       └── 描述："AI 每次回复的最大长度"
    │
    ├── ── 分割线 ──
    │
    ├── 区块六：工具能力
    │   ├── 标题："工具能力"
    │   ├── 徽章："{N}/14 已启用"
    │   └── 工具卡片网格（2 列，点击切换启用/禁用，启用=高亮+勾，禁用=半透明+叉）
    │       ├── 终端命令（bash）
    │       ├── 读取文件（read_file）
    │       ├── 写入文件（write_file）
    │       ├── 编辑文件（edit_file）
    │       ├── 文件搜索（glob）
    │       ├── 内容搜索（grep）
    │       ├── 目录列表（list_dir）
    │       ├── 网页搜索（web_search）
    │       ├── 网页抓取（web_fetch）
    │       ├── 笔记本编辑（notebook_edit）
    │       ├── 任务管理（todo_write）
    │       ├── 子代理（agent）
    │       ├── MCP 工具（mcp_tools）
    │       └── 计算机操作（computer_use）
    │
    └── 保存按钮（底部固定）
        └── [保存 AI 引擎配置]（保存中: "保存中..."，禁用）→ Toast "AI 引擎配置已保存" / "保存失败: {err}"
```

## Toast 消息汇总（共 20 种）

```
通用设置页
├── "代理设置已保存"
├── "保存代理设置失败: {err}"
├── "网关令牌已复制"
├── "CLI 命令已复制"
├── "OpenAGI doctor 已完成"           （diagnose 成功）
├── "OpenAGI doctor 检测到问题"        （diagnose 失败）
├── "运行 OpenAGI doctor 失败"         （diagnose 异常）
├── "OpenAGI doctor 修复已完成"        （fix 成功）
├── "OpenAGI doctor 修复后仍有问题"    （fix 失败）
├── "运行 OpenAGI doctor 修复失败"     （fix 异常）
├── "诊断输出已复制"
├── "已启用 WS 诊断模式"
├── "已关闭 WS 诊断模式"
├── "埋点已复制"
└── "埋点已清空"

AI 引擎标签页
├── "AI 引擎配置已保存"
└── "保存失败: {err}"

系统事件（IPC 监听）
└── "openagi CLI installed at {path}"
```

## 状态机骨架

```
开发者模式开关
  → 关闭（默认）：隐藏"开发者"区块、隐藏 CLI/Doctor/埋点/代理
  → 开启：显示完整开发者区块，加载 CLI 命令 + telemetry 订阅

代理设置状态
  → 初始：从 store 同步 draft 值
  → proxyEnabledDraft=false：隐藏代理字段
  → proxyEnabledDraft=true ：显示4个代理地址输入框 + 绕过规则
  → proxySettingsDirty=true：[保存] 按钮可点击
  → 保存成功：同步到 store + Toast

更新状态机
  idle → checking → available → downloading → downloaded → (安装倒计时) → 重启
         checking → not-available（已是最新）
         checking → error（失败）
         downloaded → 用户取消倒计时 → 等待手动安装

AI 引擎配置
  → 加载：从 IPC 拉取 code-engine:config
  → 修改任意字段（模型/key/目录/参数/工具）→ 本地 state 暂存
  → [保存]：IPC code-engine:update-config → Toast
```

## 数据来源

```
useSettingsStore   → 主题 / 语言 / 开机启动 / 网关自启 / 代理配置 / 开发者模式 / 匿名遥测 / 自动更新
useGatewayStore    → 网关状态（state/port）/ restart()
useUpdateStore     → 版本 / 更新状态 / 进度 / 错误 / 倒计时
useCodeEngineStore → 引擎运行状态（stopped/starting/ready/busy/error）
IPC: code-engine:config         → AI 引擎当前配置
IPC: code-engine:update-config  → 保存 AI 引擎配置
IPC: openclaw:getCliCommand     → CLI 命令字符串
IPC: shell:showItemInFolder     → 打开日志文件夹
hostApiFetch /api/logs          → 应用日志内容（最近 100 行）
hostApiFetch /api/logs/dir      → 日志目录路径
hostApiFetch /api/gateway/control-ui → 网关令牌 + URL + 端口
hostApiFetch /api/app/openclaw-doctor → 诊断/修复结果
```
