# Chat 页面 — 骨架树（去叶留枝版 v2）

> 路由：`/`（根路径）
> 源文件：
> - `src/pages/Chat/index.tsx`
> - `src/pages/Chat/ChatInput.tsx`
> - `src/pages/Chat/ChatMessage.tsx`
> - `src/pages/Chat/ChatToolbar.tsx`
> - `src/pages/Chat/message-utils.ts`
> - `src/components/layout/Sidebar.tsx`（Chat 会话列表部分）
> - `src/components/chat/CodeOutput.tsx`
> - `src/stores/chat/types.ts`
> - `src/stores/chat/session-actions.ts`
> - `src/stores/chat/runtime-send-actions.ts`
> - `src/stores/chat/runtime-event-handlers.ts`
> - `src/i18n/locales/zh/chat.json`
> - `src/i18n/locales/zh/common.json`

---

## 一、页面整体结构

```
/ （Chat 页面，路由根路径）
├── [侧边栏 Sidebar]
│   ├── 顶部区域
│   │   ├── Logo 图片 + 文字 "OpenAGI"（展开态）
│   │   └── [按钮] 折叠/展开侧边栏（展开态：收起图标 | 折叠态：展开图标）
│   ├── 导航区
│   │   ├── [按钮] "新对话"（+ 图标，渐变背景，紫色边框）
│   │   │   └── (当 messages.length > 0 时：先 newSession()，再 navigate('/'))
│   │   │   └── (当 messages.length === 0 时：仅 navigate('/'))
│   │   ├── 导航项：概览 → /overview
│   │   ├── 导航项：模型 → /models
│   │   ├── 导航项：智能体 → /agents
│   │   ├── 导航项：消息渠道 → /channels
│   │   ├── 导航项：技能 → /skills
│   │   ├── 导航项：定时任务 → /cron
│   │   ├── 导航项：Trinity → /trinity
│   │   ├── 导航项：任务目标 → /trinity/goals
│   │   ├── 导航项：治理账本 → /trinity/governance
│   │   ├── 导航项：Trinity设置 → /trinity/settings
│   │   ├── 导航项：知识市场 → /trinity/market
│   │   ├── 导航项：蜂群网络 → /trinity/swarm
│   │   ├── 导航项：区块链 → /trinity/blockchain
│   │   ├── 分组标签："运维"（展开态才显示）
│   │   ├── 导航项：实例 → /instances
│   │   ├── 导航项：会话 → /sessions
│   │   ├── 导航项：使用情况 → /usage
│   │   └── 导航项：文档 → /documents
│   ├── 会话历史列表（仅展开态 + sessions.length > 0 时渲染）
│   │   ├── 分桶标签："今天"（条件：当天有活动）
│   │   ├── 分桶标签："昨天"（条件：昨天有活动）
│   │   ├── 分桶标签："一周内"（条件：7天内有活动）
│   │   ├── 分桶标签："两周内"（条件：14天内有活动）
│   │   ├── 分桶标签："一个月内"（条件：30天内有活动）
│   │   ├── 分桶标签："一个月之前"（条件：更早）
│   │   └── 每条会话行
│   │       ├── 标签：Agent 名称徽章（紫色圆角，取自 agentNameById[agentId]）
│   │       ├── 文字：会话标签（优先级：sessionLabels[key] → label → displayName → key）
│   │       ├── [按钮] 点击行 → switchSession(key) + navigate('/')
│   │       └── [按钮] 删除图标（悬停才显示）→ 触发删除确认弹窗
│   ├── 底部固定
│   │   └── 导航项：设置 → /settings
│   └── [对话框] 删除会话确认弹窗
│       ├── 标题："确认"
│       ├── 内容："确定要删除对话 "{{label}}" 吗？"
│       ├── [按钮] "删除"（destructive 变体）→ deleteSession(key) + navigate('/')
│       └── [按钮] "取消" → 关闭弹窗
│
└── 主内容区（flex 列，高度 calc(100vh - 2.5rem)）
    ├── 工具栏区 [ChatToolbar]（顶部固定，右对齐）
    ├── 消息区（可滚动，自动吸底）
    ├── 错误条（条件：error 存在）
    ├── 输入区 [ChatInput]（底部固定）
    └── 加载遮罩（条件：minLoading && !sending）
```

---

## 二、ChatToolbar（工具栏组件）

```
ChatToolbar
├── 当前 Agent 标签（仅 sm 及以上断点显示）
│   └── 文字："当前对话对象：{{agent}}"（取 currentAgentName）
├── [按钮] Trinity 双核博弈（盾牌图标）
│   ├── Tooltip："Trinity 双核博弈"
│   ├── 激活态（trinityOpen = true）：紫色背景
│   └── 点击 → toggleTrinityOpen
│       └── Trinity 面板（条件：trinityOpen = true）
│           ├── 标题："Trinity 双核博弈"（盾牌图标）
│           ├── [按钮] 关闭面板（X 图标）
│           ├── 模式选择器（3个按钮，互斥）
│           │   ├── [按钮] "辩论模式"（选中态：紫色背景 + 红色文字）
│           │   ├── [按钮] "竞争模式"（选中态：紫色背景 + 黄色文字）
│           │   └── [按钮] "精炼模式"（选中态：紫色背景 + 绿色文字）
│           ├── [按钮] 运行按钮（全宽，紫粉渐变）
│           │   ├── 空闲态："启动 Trinity 循环"
│           │   └── 运行态（trinityRunning = true）："三体协商中..."（disabled）
│           ├── 结果展示区（条件：trinityResult 存在 && !trinityResult.error）
│           │   ├── AI-1 扩张者卡片（红色边框）
│           │   │   ├── 标签："AI-1 扩张者 · 提案"（Swords 图标，红色）
│           │   │   ├── 文字：trinityResult.proposal.title
│           │   │   └── 文字：trinityResult.proposal.description（截断至200字）
│           │   ├── AI-2 风控员卡片（青色边框）
│           │   │   ├── 标签："AI-2 风控员 · 审计"（Eye 图标，青色）
│           │   │   ├── 风险徽章："风险: {{riskLevel}}"（低/中/高 = 绿/黄/红）
│           │   │   ├── 发现列表："[{severity}] {description}"（循环）
│           │   │   └── 文字："置信度: {{confidence}}% | 通过: 是/否"
│           │   └── AI-3 财务官卡片（琥珀色边框）
│           │       ├── 标签："AI-3 财务官 · 决策"（Landmark 图标，琥珀色）
│           │       ├── 决策徽章："批准" / "否决"（绿/红）
│           │       ├── 文字：trinityResult.decision.reasoning
│           │       ├── 徽章："分数: {{priorityScore}}"（紫色）
│           │       ├── 徽章："已执行" / "已丢弃"（绿/红，条件：outcome）
│           │       └── 徽章（条件：newbReward > 0）："+{{newbReward}} New.B"（黄色）
│           └── 错误展示区（条件：trinityResult.error 存在）
│               ├── 文字："错误: {{error}}"（红色）
│               └── 文字："请确认已完成 Genesis 创世并设置 AI 供应商。"
├── [按钮] 刷新（RefreshCw 图标）
│   ├── Tooltip："刷新聊天"
│   ├── 加载中（loading = true）：图标旋转动画
│   ├── 禁用条件：loading = true
│   └── 点击 → refresh()
└── [按钮] 思考过程开关（Brain 图标）
    ├── Tooltip（showThinking = false）："显示思考过程"
    ├── Tooltip（showThinking = true）："隐藏思考过程"
    ├── 激活态（showThinking = true）：主色背景
    └── 点击 → toggleThinking()
```

---

## 三、消息区状态枚举

```
消息区（滚动容器）
├── [状态A] 空状态（isEmpty = true：messages.length === 0 && !sending）
│   └── WelcomeScreen 欢迎屏幕
│       ├── 大标题："我能为你做些什么？"
│       └── 快捷动作按钮组（3个圆角胶囊按钮）
│           ├── [按钮] "处理任务"（无点击逻辑，仅展示）
│           ├── [按钮] "持续执行"
│           └── [按钮] "多智能体并行"
│
├── [状态B] 有消息（messages.length > 0 || sending）
│   ├── 消息列表（循环渲染 messages[]）
│   │   └── 每条 ChatMessage（见第四节）
│   ├── 流式消息（条件：shouldRenderStreaming = sending && 有任意流内容）
│   │   └── ChatMessage（isStreaming=true，streamingTools 传入）
│   ├── ActivityIndicator 活动指示器
│   │   └── 条件：sending && pendingFinal && !shouldRenderStreaming
│   │       └── 内容：Loader2 旋转图标 + 文字 "Processing tool results…"
│   └── TypingIndicator 打字指示器
│       └── 条件：sending && !pendingFinal && !hasAnyStreamContent
│           └── 内容：Sparkles 图标 + 三个弹跳圆点（延迟 0ms / 150ms / 300ms）
│
├── [状态C] 错误条（条件：error 存在）
│   ├── 错误图标（AlertCircle）+ 错误文字（error 内容）
│   └── [按钮] "忽略" → clearError()
│
└── [状态D] 加载遮罩（条件：minLoading && !sending）
    └── LoadingSpinner（居中，白色玻璃容器）
```

---

## 四、ChatMessage（消息气泡组件）

```
ChatMessage（props: message, showThinking, isStreaming?, streamingTools?）
│
├── 过滤规则（不渲染）
│   ├── role === 'toolresult' 或 'tool_result' → return null
│   └── 无文本 + 无思考 + 无图片 + 无工具 + 无附件 + 无流式工具状态 → return null
│
├── 布局方向
│   ├── 用户消息（role='user'）：右对齐（flex-row-reverse）
│   └── AI 消息（role='assistant'）：左对齐（flex-row）+ Sparkles 头像
│
├── 内容层（从上到下，按渲染顺序）
│   │
│   ├── ToolStatusBar 工具状态条（条件：isStreaming && !isUser && streamingTools.length > 0）
│   │   └── 每个工具状态行
│   │       ├── 运行态（status='running'）：Loader2 旋转 + 主色边框
│   │       ├── 完成态（status='completed'）：CheckCircle2 绿色图标 + 半透明边框
│   │       ├── 错误态（status='error'）：AlertCircle 红色图标 + 红色边框
│   │       ├── Wrench 图标（不透明度60%）
│   │       ├── 工具名称（等宽字体）
│   │       ├── 耗时（条件：durationMs 存在）
│   │       └── 摘要文字（条件：summary 存在）
│   │
│   ├── ThinkingBlock 思考块（条件：showThinking && thinking 内容存在）
│   │   ├── [按钮] 折叠头（ChevronRight/ChevronDown + "Thinking"）→ 切换展开状态
│   │   └── 内容区（条件：expanded = true）
│   │       └── Markdown 渲染（ReactMarkdown + remarkGfm，半透明）
│   │
│   ├── 工具调用卡片列表（条件：visibleTools.length > 0）
│   │   └── 每个 ToolCard
│   │       ├── [按钮] 折叠头
│   │       │   ├── CheckCircle2 绿色图标
│   │       │   ├── Wrench 图标
│   │       │   ├── 工具名称（等宽字体 xs）
│   │       │   └── ChevronRight/ChevronDown（自动右对齐）
│   │       └── 内容区（条件：expanded = true && input 存在）
│   │           └── <pre> JSON 或字符串形式的 input 参数
│   │
│   ├── 图片区（用户消息，content blocks 中的图片）
│   │   └── 条件：isUser && images.length > 0
│   │       └── ImageThumbnail（正方形裁剪，悬停显示 ZoomIn 图标）→ 点击开灯箱
│   │
│   ├── 附件区（用户消息文件附件）
│   │   └── 条件：isUser && attachedFiles.length > 0
│   │       ├── 图片附件（有 preview）→ ImageThumbnail → 点击开灯箱
│   │       ├── 图片附件（无 preview）→ 灰色占位框（File 图标）
│   │       └── 非图片附件 → FileCard
│   │           ├── 文件图标（按 mimeType 分类：视频/音频/文本/压缩/PDF/通用）
│   │           ├── 文件名（截断）
│   │           ├── 文件大小（格式化：B / KB / MB / GB）
│   │           └── 点击行为（条件：filePath 存在）→ shell:openPath
│   │
│   ├── MessageBubble 文字气泡（条件：hasText = true）
│   │   ├── 用户消息：蓝色气泡（#0a84ff）+ 纯文本（whitespace-pre-wrap）
│   │   └── AI 消息：半透明气泡 + ReactMarkdown 渲染
│   │       ├── 代码块：行内代码（浅色背景圆角）/ 块级代码（<pre> 滚动）
│   │       ├── 链接：_blank 新标签页打开
│   │       └── 流式光标（条件：isStreaming = true）：闪烁竖线
│   │
│   ├── 图片区（AI 消息，content blocks 中的图片）
│   │   └── 条件：!isUser && images.length > 0
│   │       └── ImagePreviewCard（自然宽度，悬停半透明遮罩 + ZoomIn）→ 点击开灯箱
│   │
│   ├── 附件区（AI 消息文件附件）
│   │   └── 条件：!isUser && attachedFiles.length > 0
│   │       ├── 图片附件（有 preview）→ ImagePreviewCard
│   │       ├── 图片附件（无 preview）→ 灰色占位框
│   │       └── 非图片附件 → FileCard
│   │
│   ├── 用户消息时间戳（条件：isUser && message.timestamp 存在）
│   │   └── 格式化时间文字（悬停才可见）
│   │
│   └── AssistantHoverBar 助手悬停操作栏（条件：!isUser && hasText）
│       ├── 时间戳文字（左侧，悬停才可见）
│       └── [按钮] 复制图标
│           ├── 默认态：Copy 图标
│           └── 已复制态（copied = true，持续2秒）：Check 绿色图标
│
└── ImageLightbox 图片灯箱（条件：lightboxImg 存在，Portal 挂载到 body）
    ├── 黑色半透明全屏遮罩 → 点击关闭
    ├── 图片（max-w-[90vw] max-h-[85vh]，object-contain）
    └── 操作按钮组
        ├── [按钮] 在文件夹中显示（条件：filePath 存在）→ shell:showItemInFolder（tooltip: "在文件夹中显示"）
        ├── [按钮] 关闭（X 图标，tooltip: "关闭"）→ setLightboxImg(null)
        └── 快捷键：ESC → 关闭
```

---

## 五、ChatInput（输入区组件）

```
ChatInput（props: onSend, onStop, disabled, sending, isEmpty）
│
├── 附件预览区（条件：attachments.length > 0）
│   └── 每个 AttachmentPreview
│       ├── 图片附件：正方形缩略图（16×16）
│       ├── 非图片附件：文件名 + 大小卡片
│       │   └── 文件图标（同 ChatMessage FileIcon 逻辑）
│       ├── 上传中遮罩（条件：status='staging'）：Loader2 旋转（黑色半透明）
│       ├── 错误遮罩（条件：status='error'）：红色半透明 + "Error"文字
│       └── [按钮] 删除附件（X 图标，悬停才显示，右上角）→ removeAttachment(id)
│
├── 输入框容器（玻璃形态，圆角28px，拖拽目标区域）
│   ├── 目标 Agent 标签（条件：selectedTarget 存在）
│   │   └── [按钮] "@{{agent}}" + X 图标（title: "清除目标 Agent"）→ setTargetAgentId(null)
│   │       └── 键盘：Backspace（input为空时）→ 清除目标 Agent
│   │
│   ├── [按钮] 添加附件（Paperclip 图标，圆形）
│   │   ├── title: "添加文件"
│   │   ├── 禁用条件：disabled || sending
│   │   └── 点击 → pickFiles()（IPC: dialog:open → /api/files/stage-paths）
│   │       支持：多选文件 | 粘贴文件（Ctrl/Cmd+V）| 拖放文件（drag & drop）
│   │
│   ├── [按钮] @ 提及 Agent（AtSign 图标，条件：showAgentPicker = mentionableAgents.length > 0）
│   │   ├── title: "选择 Agent"
│   │   ├── 禁用条件：disabled || sending
│   │   ├── 激活态（pickerOpen || selectedTarget）：主色背景
│   │   ├── 点击 → togglePickerOpen
│   │   └── Agent 选择器下拉面板（条件：pickerOpen = true）
│   │       ├── 标题："将下一条消息直接发送给其他 Agent"
│   │       └── Agent 列表（最大高度64，可滚动）
│   │           └── 每个 AgentPickerItem
│   │               ├── Agent 名称（14px, font-medium）
│   │               ├── 模型名称（11px，灰色，agent.modelDisplay）
│   │               ├── 选中态：主色浅色背景
│   │               └── 点击 → setTargetAgentId(agent.id) + 关闭选择器 + 聚焦输入框
│   │               （点击面板外部 → 关闭选择器）
│   │
│   ├── Textarea 文本输入框（自适应高度，最大200px）
│   │   ├── placeholder（disabled = true）："网关未连接..."
│   │   ├── placeholder（disabled = false）：空
│   │   ├── 禁用条件：disabled
│   │   ├── 键盘 Enter（非Shift, 非IME输入中）→ handleSend()
│   │   ├── 键盘 Shift+Enter → 换行
│   │   └── 粘贴含文件 → stageBufferFiles()（/api/files/stage-buffer）
│   │
│   └── [按钮] 发送/停止（圆形，右侧）
│       ├── 发送态（sending = false）
│       │   ├── 图标：SendHorizontal
│       │   ├── title: "发送"
│       │   ├── 启用条件：canSend（有内容 && 附件全部 ready && !disabled && !sending）
│       │   └── 点击 → handleSend()
│       └── 停止态（sending = true）
│           ├── 图标：Square（实心）
│           ├── title: "停止"
│           ├── 启用条件：canStop（sending && !disabled && onStop 存在）
│           └── 点击 → handleStop() → abortRun()
│
├── 状态栏（输入框下方，11px 灰色文字）
│   ├── 网关状态指示点
│   │   ├── 运行中：绿色圆点 + "gateway 已连接 | port: {{port}} {{pid}}"
│   │   └── 未运行：红色圆点 + "gateway {{state}} | port: {{port}} {{pid}}"
│   └── [按钮] "重试失败的附件"（条件：hasFailedAttachments = true）
│       └── 点击 → 清除失败附件 + pickFiles()
│
└── 拖放交互
    ├── 拖拽进入：边框变为主色 + 主色光圈
    └── 拖拽释放：stageBufferFiles(dataTransfer.files)
```

---

## 六、CodeOutput（工具调用代码输出组件）

```
CodeOutput（props: toolUses[]）
└── 条件：toolUses.length > 0 才渲染
    └── 每个 ToolUseBlock
        ├── 标题栏（可点击，切换展开）
        │   ├── 工具图标（emoji）
        │   ├── 中文工具名称（映射表：bash→"终端命令"、read_file→"读取文件" 等）
        │   ├── 状态文字
        │   │   ├── isError=true："失败"（红色）
        │   │   ├── isComplete=true："完成"（绿色）
        │   │   └── 默认："执行中..."（黄色）
        │   └── 展开/收起提示："收起 ▲" / "展开 ▼"
        └── 展开内容（条件：expanded = true）
            ├── 输入参数区
            │   ├── 标签："输入参数"（灰色小字）
            │   └── <pre> 格式化内容
            │       ├── bash → "$ {command}"
            │       ├── read_file/write_file → 文件路径
            │       ├── edit_file → "文件路径\n旧内容 → 新内容"
            │       ├── glob_search → "模式: {pattern}"
            │       ├── grep_search → "搜索: {pattern}"
            │       └── 其他 → JSON.stringify(input, null, 2)
            └── 输出结果区（条件：tool.output 存在）
                ├── 标签："错误信息"（isError=true）/ "执行结果"（isError=false）
                └── <pre> 输出内容（绿色/红色，最大高度64，超2000字符截断 + "... (内容过长，已截断)"）
```

---

## 七、数据流骨架

```
数据流
├── 读取（IPC 调用链）
│   ├── gateway:rpc → sessions.list → sessions[]
│   ├── gateway:rpc → chat.history → messages[]
│   └── fetchAgents() → agents[]（用于 currentAgentName + mentionableAgents）
│
├── 写入（发送消息）
│   ├── 有附件：IPC chat:sendWithMedia → { sessionKey, message, media[] }
│   ├── 无附件：gateway:rpc → chat.send → { sessionKey, message, idempotencyKey }
│   └── 文件暂存：hostApiFetch → /api/files/stage-paths（原生对话框）
│                             → /api/files/stage-buffer（粘贴/拖放）
│
├── 流式接收（Gateway 事件）
│   ├── event.state = 'started' → set { sending=true }
│   ├── event.state = 'delta' → set { streamingMessage, streamingTools }
│   ├── event.state = 'final' → 追加 messages[]，清空 streamingMessage
│   ├── event.state = 'error' → set { error }，15秒恢复窗口
│   └── event.state = 'aborted' → set { sending=false }
│
├── 中止
│   └── gateway:rpc → chat.abort → { sessionKey }
│
└── 会话管理
    ├── 新建：本地生成 key（agent:${prefix}:session-${Date.now()}）
    ├── 删除：IPC session:delete(key) → 软删除（.jsonl → .deleted.jsonl）
    └── 清理：离开页面时 cleanupEmptySession()（无消息+无活动的会话自动移除）
```

---

## 八、状态枚举（ChatState）

| 状态字段 | 类型 | 作用 |
|---|---|---|
| `messages` | RawMessage[] | 当前会话完整消息历史 |
| `loading` | boolean | 加载历史记录中（显示透明遮罩） |
| `sending` | boolean | 正在发送/等待 AI 回复中 |
| `error` | string \| null | 错误文字（显示错误条） |
| `streamingMessage` | unknown | 流式接收中的 AI 消息对象 |
| `streamingTools` | ToolStatus[] | 流式工具调用状态列表 |
| `pendingFinal` | boolean | 工具执行完、等待下一轮 AI 的间隙 |
| `showThinking` | boolean | 是否展示思考过程块 |
| `currentSessionKey` | string | 当前会话 key |
| `currentAgentId` | string | 当前 Agent ID |
| `sessions` | ChatSession[] | 所有会话列表（侧边栏）|
| `sessionLabels` | Record<string, string> | 会话显示名（首条消息截断50字）|
| `sessionLastActivity` | Record<string, number> | 各会话最后活动时间（ms）|

---

## 九、Toast 消息 / 内联错误

> 本页面不使用 Toast 组件，错误以内联形式展示。

| 触发场景 | 显示位置 | 文字来源 |
|---|---|---|
| 发送失败 | 错误条（消息区与输入区之间） | result.error 或 "Failed to send message" |
| 模型无响应（90秒超时） | 错误条 | "No response received from the model. The provider may be unavailable or the API key may have insufficient quota. Please check your provider settings." |
| 流式错误事件 | 错误条 | event.errorMessage 或 "An error occurred" |
| 附件暂存失败 | AttachmentPreview 红色遮罩 + "Error"文字 | String(err) |
| Trinity 调用失败 | Trinity 面板内错误区 | "错误: {{error}}" + "请确认已完成 Genesis 创世并设置 AI 供应商。" |
| 删除会话 | 确认弹窗（非错误提示） | — |

---

## 十、消息角色类型与渲染规则

| role | 渲染行为 |
|---|---|
| `user` | 右对齐蓝色气泡，可含附件/图片，显示时间戳 |
| `assistant` | 左对齐半透明气泡，含 Sparkles 头像，支持 Markdown，含复制按钮 |
| `system` | 同 assistant 渲染（无特殊处理） |
| `toolresult` / `tool_result` | 不渲染（return null） |
