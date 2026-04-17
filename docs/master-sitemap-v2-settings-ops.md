# Settings + Setup + 运维 精确思维导图

> 修改本文件中的任何文字即可精确定位代码修改位置。

---

## Settings 页面 (/settings)

**文件**: `src/pages/Settings/index.tsx` + `src/components/settings/CodeEngineSettings.tsx`

```
Settings 页面
├── Tab导航:
│   ├── [通用设置] Settings2图标 — 激活:bg-purple-600/20 text-purple-300 ring-purple-500/30
│   └── [AI 引擎] Brain图标
│
├── ═══ 通用设置Tab ═══
│   │
│   ├── 外观:
│   │   ├── 主题: [☀️浅色] [🌙深色] [🖥️系统]
│   │   └── 语言: 动态按钮组 (SUPPORTED_LANGUAGES)
│   │
│   ├── 启动行为:
│   │   ├── "开机自启动" + Switch
│   │   └── 遥测: "发送诊断数据" + Switch
│   │
│   ├── 网关:
│   │   ├── 状态: running=green / error=red + 端口
│   │   ├── [重启网关] [查看日志] [打开日志文件夹]
│   │   └── 自动启动 + Switch
│   │
│   ├── 代理设置:
│   │   ├── 启用代理 Switch
│   │   ├── SOCKS5 / HTTP / HTTPS / 全局代理 Input
│   │   ├── 绕过规则 Textarea placeholder:"localhost,127.0.0.1"
│   │   └── [保存代理设置] (disabled: !dirty || saving)
│   │
│   ├── 更新:
│   │   ├── 当前版本: {version}
│   │   └── 自动检查 / 自动下载 Switch
│   │
│   ├── 开发者工具:
│   │   ├── 遥测: 统计表格(事件名|次数|错误|慢|耗时|时间)
│   │   │   └── [复制遥测数据] [清除遥测数据]
│   │   ├── WS诊断 Switch
│   │   ├── Doctor: [诊断] [修复] → 输出 + [复制输出]
│   │   └── CLI: 命令显示 + [复制命令]
│   │
│   └── 应用信息:
│       ├── 版本 + 官网链接(openagi.app)
│       ├── GitHub链接(github.com/openagi-ai/OpenAGI)
│       └── 文档链接(飞书Wiki)
│
└── ═══ AI引擎Tab (CodeEngineSettings) ═══
    │
    ├── 引擎状态 (glass-card-purple):
    │   ├── 🧠图标 + "AI 代码引擎"
    │   ├── 状态灯:
    │   │   ├── stopped:  灰 "已停止"
    │   │   ├── starting: 黄pulse "启动中..."
    │   │   ├── ready:    绿 "就绪"
    │   │   ├── busy:     紫pulse "忙碌中..."
    │   │   └── error:    红 "错误"
    │   ├── 启用 Switch
    │   └── "Claude Code 引擎赋予 OpenAGI 代码编写、文件操作、终端命令执行等能力..."
    │
    ├── ⚡ AI 模型 (2列网格):
    │   ├── Claude Sonnet 4.6 | "均衡性能（推荐）"
    │   ├── Claude Opus 4     | "最强推理能力"
    │   ├── Claude Haiku 3.5  | "超快速度"
    │   └── Claude Sonnet 4.5 | "深度思考"
    │   └── 选中: ring-2 ring-purple-500 bg-purple-500/20 + CheckCircle2
    │
    ├── 🔑 API 密钥:
    │   ├── "Anthropic API Key（用于Claude模型）"
    │   ├── Input: type=password, placeholder="sk-ant-api03-..." + Eye/EyeOff
    │   └── "密钥仅保存在本地，不会上传到任何服务器。"
    │
    ├── 📂 工作目录:
    │   ├── Input: placeholder="/Users/yourname/projects"
    │   └── "AI 引擎执行命令和操作文件的默认目录。"
    │
    ├── 🔄 高级参数:
    │   ├── 最大回合数: number min=1 max=100
    │   │   └── "AI 单次对话最多执行的步骤数"
    │   └── 最大输出Token: number min=256 max=65536 step=256
    │       └── "AI 每次回复的最大长度"
    │
    ├── 🛠️ 工具能力 (2列网格):
    │   ├── Badge: "{n}/{14} 已启用" purple-500/20
    │   └── 14项 (每项: emoji + 中文名 + 描述 + 开关):
    │       ├── 💻 终端命令 (bash)       | 执行 shell 命令
    │       ├── 📖 读取文件 (read_file)   | 读取本地文件内容
    │       ├── ✏️ 写入文件 (write_file)  | 创建或覆盖文件
    │       ├── 🔧 编辑文件 (edit_file)   | 精准替换文件内容
    │       ├── 🔍 文件搜索 (glob)        | 按模式查找文件
    │       ├── 🔎 内容搜索 (grep)        | 搜索文件中的文本
    │       ├── 📁 目录列表 (list_dir)    | 列出目录内容
    │       ├── 🌐 网页搜索 (web_search)  | 搜索互联网
    │       ├── 📥 网页抓取 (web_fetch)   | 获取网页内容
    │       ├── 📓 笔记本编辑 (notebook)  | 编辑 Jupyter 笔记本
    │       ├── ✅ 任务管理 (todo_write)  | 管理待办事项
    │       ├── 🤖 子代理 (agent)         | 启动子任务代理
    │       ├── 🔌 MCP工具 (mcp_tools)    | 外部 MCP 服务器工具
    │       └── 🖥️ 计算机操作 (computer)  | 屏幕截图和操作
    │       └── 启用: CheckCircle2 bg-purple-500/15 ring-purple-500/30
    │       └── 禁用: XCircle opacity-50
    │
    └── [💾 保存 AI 引擎配置]
        └── sticky bottom, bg-purple-600 hover:bg-purple-500 h-12 rounded-xl
```

---

## Setup 向导 (/setup)

**文件**: `src/pages/Setup/index.tsx`

```
Setup 向导 (5步)
├── Step 0 欢迎:
│   ├── t('welcome.title') + t('welcome.description')
│   ├── 语言选择 (按钮组/下拉)
│   └── [下一步] ChevronRight bg-blue-600
│
├── Step 1 运行时:
│   ├── t('runtime.title/description')
│   ├── 检查项: Gateway/Python/Node.js
│   │   └── CheckCircle2(绿) / Loader2(蓝spin) / AlertCircle(红)
│   ├── 日志区 + [打开日志目录]
│   └── [重新检查] RefreshCw / [上一步] / [下一步]
│
├── Step 2 AI提供商:
│   ├── t('provider.title/description')
│   ├── 提供商下拉 (OpenAI/Anthropic/Google/...)
│   ├── 认证: [OAuth] / [API Key]
│   ├── API Key Input + Eye/EyeOff
│   ├── Base URL / Model ID (条件)
│   ├── [测试连接] → ✓"连接成功" / ✗错误信息
│   └── [上一步] / [保存]
│
├── Step 3 安装技能:
│   ├── 默认技能清单 (checkbox)
│   ├── 进度: Loader2 + 当前名称 + 百分比
│   │   └── 每项: ⏳pending → 🔄installing → ✓succeeded / ✗failed
│   └── [完成] / [跳过]
│
└── Step 4 完成:
    ├── CheckCircle2绿 + "设置完成！"
    └── [开始使用] → navigate('/') + markSetupComplete()
```

---

## 运维页面

### 实例 (/instances) — 10秒轮询

```
实例管理
├── 标题: "实例管理" + "查看和管理运行中的服务实例" + [刷新]
├── 实例卡片 (glass-card-purple rounded-xl p-5):
│   ├── 图标: Server text-purple-400 bg-purple-500/10 (12×12 容器)
│   ├── 名称 + 状态Badge:
│   │   ├── "运行中"  bg-green-500/10 text-green-400
│   │   ├── "已停止"  bg-gray-500/10 text-gray-400
│   │   └── "错误"    bg-red-500/10 text-red-400
│   └── 详情: 🔌端口 | ⏱️启动时间 (locale)
├── 默认2实例: "OpenAGI 网关" + "Claude Code 引擎"
└── 空: AlertTriangle + "暂无运行中的实例"
```

### 会话 (/sessions) — 8秒轮询

```
会话管理
├── 标题: "会话管理" + "查看和管理所有会话 · {n} 个会话" + [刷新]
├── 搜索: placeholder="搜索会话（智能体名、渠道类型、会话 ID...）" Search pl-9
├── 会话卡片 (glass-card-purple rounded-lg p-4):
│   ├── MessageSquare (5×5) text-purple-400
│   ├── 名称: displayName || key
│   ├── 状态Badge:
│   │   ├── "活跃"  bg-green-500/10 text-green-400
│   │   ├── "空闲"  bg-yellow-500/10 text-yellow-400
│   │   └── "已完成" bg-gray-500/10 text-gray-400
│   ├── 详情: 🤖agent | 👤channel | 💬{n}条消息 | 🕐时间
│   └── [终止] XCircle text-red-400 (仅active)
│       └── 确认: "确定要终止会话「{name}」吗？这将立即中断正在进行的对话。"
│       └── toast: "会话 {name} 已终止" / "终止失败: {error}"
├── 空: "暂无会话记录" / "没有匹配的会话"
```

### 使用情况 (/usage) — 30秒轮询

```
使用统计
├── 标题: "使用情况" + "Token 用量、API 调用和费用统计" + [刷新]
├── 统计卡片 (grid 2/4列):
│   ├── ⚡ Zap text-purple-400 | "总 Token" | {formatTokens} | ⬆️输入 ⬇️输出
│   ├── 📈 TrendingUp text-blue-400 | "API 调用" | {n} | "累计请求次数"
│   ├── 💵 DollarSign text-green-400 | "预估费用" | "${n}" | "基于 Token 估算"
│   └── 📊 BarChart3 text-amber-400 | "模型数" | {n} | "已使用的模型"
├── 模型用量明细:
│   └── 每条: 模型名 + 供应商Badge + Token数 + 进度条 + 调用次数 + 占比%
└── 空: "暂无使用数据" + "开始使用 AI 对话后，这里会显示用量统计"
```

### 文档 (/documents) — 单次加载

```
文档管理
├── 标题: "文档" + "知识库文档与配置文件 · {n} 个文件" + [刷新]
├── 搜索: placeholder="搜索文档名称或描述..." Search pl-9
├── 过滤: [全部] [技能({n})] [智能体({n})] [配置({n})]
│   └── 激活: bg-purple-600/20 text-purple-300 ring-purple-500/30
├── 文档卡片 (glass-card-purple rounded-lg p-4):
│   ├── 类型图标 (10×10 bg-purple-500/10):
│   │   ├── skill:  Code   text-purple-400
│   │   ├── agent:  BookOpen text-purple-400
│   │   ├── config: File   text-purple-400
│   │   └── other:  FileText text-purple-400
│   ├── 名称: text-sm font-medium
│   ├── 类型Badge:
│   │   ├── "技能文件" purple-500/10
│   │   ├── "智能体"  blue-500/10
│   │   ├── "配置文件" amber-500/10
│   │   └── "其他"    gray-500/10
│   └── 详情: 📁path | 📏formatSize | 🕐修改日期(locale)
└── 空: "暂无文档" + "文档会在配置智能体和技能后自动出现"
      / "没有匹配的文档"
```
