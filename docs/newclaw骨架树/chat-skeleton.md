# Chat 页面 — 骨架树（去叶留枝版）

```
/chat（路由：/）
│
├── 侧边栏（Sidebar — 跨页面持久存在，Chat 专属功能在此）
│   ├── 顶部区域
│   │   ├── Logo + "OpenAGI" 文字（展开状态）
│   │   └── [折叠/展开侧边栏按钮]（图标切换：PanelLeftClose / PanelLeft）
│   │
│   ├── 导航区
│   │   └── [新对话] 按钮 → 若当前有消息则创建新 session，导航到 /
│   │       （无消息时仅导航，不创建 session）
│   │
│   ├── 会话历史列表（侧边栏展开 + 有 sessions 时显示）
│   │   ├── 按时间分桶排列（降序）
│   │   │   ├── "今天"
│   │   │   ├── "昨天"
│   │   │   ├── "一周内"
│   │   │   ├── "两周内"
│   │   │   ├── "一个月内"
│   │   │   └── "一个月之前"
│   │   │
│   │   └── 每条会话条目
│   │       ├── Agent 标签徽章（显示 agent 名称）
│   │       ├── 会话标签（优先级：sessionLabels > label > displayName > key）
│   │       ├── [点击切换] → switchSession + 导航到 /
│   │       └── [删除图标]（悬停显示）→ 弹出删除确认对话框
│   │           └── 删除确认对话框
│   │               ├── 标题："确认"
│   │               ├── 消息："确定要删除对话 \"{{label}}\" 吗？"
│   │               ├── [删除] 按钮（危险样式）→ deleteSession + 若是当前 session 则导航到 /
│   │               └── [取消] 按钮
│   │
│   └── 底部
│       └── [设置] 导航项 → /settings
│
├── 工具栏区（ChatToolbar）
│   ├── 当前 Agent 标签（仅桌面宽度显示）
│   │   └── "当前对话对象：{{agent}}"
│   │
│   ├── [Trinity 双核博弈按钮]（Shield 图标）→ 切换 Trinity 面板
│   │   └── Trinity 面板（浮层，打开时显示）
│   │       ├── 标题："Trinity 双核博弈" + [关闭按钮]
│   │       │
│   │       ├── 模式选择器（三选一）
│   │       │   ├── [辩论模式]
│   │       │   ├── [竞争模式]
│   │       │   └── [精炼模式]
│   │       │
│   │       ├── [启动 Trinity 循环] → POST /api/trinity/cycle/run { mode }
│   │       │   └── 运行中状态："三体协商中..." + 禁用
│   │       │
│   │       ├── 结果展示（成功时）
│   │       │   ├── AI-1 扩张者 · 提案区
│   │       │   │   ├── 提案标题
│   │       │   │   └── 提案描述（截取前200字符）
│   │       │   │
│   │       │   ├── AI-2 风控员 · 审计区
│   │       │   │   ├── 风险等级徽章（low/medium/high）
│   │       │   │   ├── findings 列表：[严重度] 描述
│   │       │   │   └── "置信度: N% | 通过: 是/否"
│   │       │   │
│   │       │   └── AI-3 财务官 · 决策区
│   │       │       ├── 批准/否决 徽章
│   │       │       ├── 决策理由文本
│   │       │       ├── 优先分数徽章
│   │       │       ├── 执行结果徽章（"已执行" / "已丢弃"）
│   │       │       └── New.B 奖励徽章（奖励 > 0 时显示）："+ N New.B"
│   │       │
│   │       └── 错误状态
│   │           ├── "错误: {{message}}"
│   │           └── "请确认已完成 Genesis 创世并设置 AI 供应商。"
│   │
│   ├── [刷新按钮]（RefreshCw 图标）→ refresh()
│   │   └── Tooltip："刷新聊天"
│   │   └── 加载中状态：图标旋转 + 禁用
│   │
│   └── [思考过程切换按钮]（Brain 图标）→ toggleThinking()
│       ├── Tooltip（showThinking=true）："隐藏思考过程"
│       └── Tooltip（showThinking=false）："显示思考过程"
│
├── 消息区
│   │
│   ├── 空状态（无消息 + 未发送中）→ WelcomeScreen
│   │   ├── 大标题："我能为你做些什么？"
│   │   └── 快捷操作按钮组（无点击行为，仅提示）
│   │       ├── [处理任务]
│   │       ├── [持续执行]
│   │       └── [多智能体并行]
│   │
│   └── 消息列表（有消息时）
│       ├── 历史消息列表（从 chat.history 加载）
│       │   └── 每条消息 → ChatMessage 组件（见消息组件详情）
│       │
│       ├── 流式消息（sending=true + 有流内容时）→ ChatMessage（isStreaming=true）
│       │   └── 含 streamingTools 工具状态栏
│       │
│       ├── 活动指示器（sending=true + pendingFinal=true + 无流内容时）
│       │   └── Sparkles 头像 + Loader2 图标 + "Processing tool results…"
│       │
│       └── 打字指示器（sending=true + pendingFinal=false + 无流内容时）
│           └── Sparkles 头像 + 三点跳动动画
│
├── 错误条（error 不为空时显示）
│   ├── AlertCircle 图标 + 错误文本
│   └── [忽略] 按钮 → clearError()
│
├── 输入区（ChatInput）
│   │
│   ├── 附件预览区（有附件时显示）
│   │   └── 每个附件 → AttachmentPreview
│   │       ├── 图片：缩略图（正方形裁剪）
│   │       ├── 非图片：文件图标 + 文件名 + 文件大小
│   │       │   └── 文件图标映射：视频→Film / 音频→Music / 文本/JSON/XML/PDF→FileText
│   │       │                    压缩包→FileArchive / 其他→File
│   │       ├── 加载中遮罩（staging 状态）：Loader2 旋转
│   │       ├── 错误遮罩（error 状态）："Error"
│   │       └── [删除按钮]（悬停显示 X）→ removeAttachment()
│   │
│   ├── 输入框主体（支持拖放高亮边框）
│   │   ├── 选中 Agent 芯片（targetAgentId 已选时）
│   │   │   ├── 显示："@{{agent}}"
│   │   │   └── [X 按钮] → 清除 targetAgentId
│   │   │
│   │   ├── [附件按钮]（Paperclip 图标）→ pickFiles()（原生文件选择对话框）
│   │   │   └── 禁用条件：disabled 或 sending
│   │   │
│   │   ├── [Agent 选择按钮]（@ 图标，仅有可选 Agent 时显示）→ 切换 Agent 选择器
│   │   │   └── Agent 选择器弹出层
│   │   │       ├── 标题："将下一条消息直接发送给其他 Agent"（显示当前 Agent 名称）
│   │   │       └── Agent 列表（排除当前 Agent）
│   │   │           └── 每个 AgentPickerItem
│   │   │               ├── Agent 名称
│   │   │               ├── 模型显示名称
│   │   │               └── [点击] → 选中 targetAgentId + 关闭选择器 + 聚焦输入框
│   │   │
│   │   ├── 文本输入框（自动扩展，最高 200px）
│   │   │   ├── 占位符（disabled 时）："网关未连接..."
│   │   │   ├── Enter 发送（非 IME 输入法组合状态时）
│   │   │   ├── Shift+Enter 换行
│   │   │   ├── Backspace（无文字 + 有 targetAgentId 时）→ 清除 targetAgentId
│   │   │   ├── 粘贴文件（Ctrl/Cmd+V）→ stageBufferFiles()
│   │   │   └── 拖放文件 → stageBufferFiles()
│   │   │
│   │   └── [发送/停止按钮]
│   │       ├── 发送状态（sending=false）：SendHorizontal 图标
│   │       │   ├── 可发送（有文字或附件 + 附件全部 ready + 未禁用）→ handleSend()
│   │       │   └── 不可发送：半透明禁用样式
│   │       └── 停止状态（sending=true）：Square 图标 → handleStop() → abortRun()
│   │
│   └── 状态栏（输入框下方）
│       ├── 网关状态指示灯（绿色/红色圆点）
│       │   └── "gateway {{state}} | port: {{port}} {{pid}}"
│       │       └── state 已连接时显示："已连接"
│       └── [重试失败的附件]（有失败附件时显示）→ 清除失败附件 + 重新 pickFiles()
│
└── 加载覆盖层（minLoading=true + sending=false 时显示）
    └── 半透明背景 + LoadingSpinner（size="md"）
```

---

## 消息组件详情（ChatMessage）

```
ChatMessage（单条消息）
│
├── 角色判断
│   ├── toolresult 角色 → 不渲染（直接返回 null）
│   └── 空消息（无文字/思考/图片/工具/附件/流式工具状态）→ 不渲染
│
├── 用户消息（role=user，右对齐，蓝色气泡）
│   ├── 图片附件（来自 content blocks，位于文字上方）
│   │   └── ImageThumbnail → 点击放大 → ImageLightbox
│   ├── 文件附件（来自 _attachedFiles）
│   │   ├── 图片类（有 preview）→ ImageThumbnail → 点击放大 → ImageLightbox
│   │   ├── 图片类（无 preview）→ 占位框（File 图标）
│   │   └── 非图片类 → FileCard（可点击打开文件，若有 filePath）
│   ├── 文字气泡（有文字时）
│   │   └── 纯文本显示（whitespace-pre-wrap）
│   └── 时间戳（悬停时显示，相对时间格式）
│       └── 格式：just now / Nm ago / Nh ago / HH:MM
│
└── AI 助手消息（role=assistant，左对齐，带 Sparkles 头像）
    ├── 工具状态栏（isStreaming=true + 有 streamingTools 时）
    │   └── ToolStatusBar（每个工具一行）
    │       ├── 运行中（running）：Loader2 旋转 + Wrench + 工具名 + 耗时
    │       ├── 已完成（completed）：CheckCircle2 绿色 + Wrench + 工具名 + 耗时 + 摘要
    │       └── 错误（error）：AlertCircle 红色 + Wrench + 工具名
    │
    ├── 思考区块（showThinking=true + 有 thinking 内容时）→ ThinkingBlock
    │   ├── [展开/折叠按钮] + "Thinking" 文字
    │   └── 折叠内容：Markdown 渲染（半透明）
    │
    ├── 工具调用卡片列表（历史消息中的 tool_use 块）
    │   └── ToolCard（每个工具一张卡）
    │       ├── CheckCircle2 绿色 + Wrench + 工具名（等宽字体）+ [展开/折叠]
    │       └── 展开内容：工具输入参数（JSON 格式化，等宽字体）
    │
    ├── 文字气泡（有文字时）→ MessageBubble
    │   ├── Markdown 全量渲染（remarkGfm 插件）
    │   │   ├── 代码块：pre + code（等宽字体，横向滚动）
    │   │   ├── 行内代码：浅色背景圆角
    │   │   └── 链接：新标签页打开
    │   └── 流式光标（isStreaming=true 时）：闪烁竖线
    │
    ├── 图片附件（来自 content blocks，位于文字下方）
    │   └── ImagePreviewCard → 点击放大 → ImageLightbox
    │
    ├── 文件附件（来自 _attachedFiles，位于文字下方）
    │   ├── 图片类 → ImagePreviewCard → 点击放大 → ImageLightbox
    │   ├── 图片类（无 preview）→ 占位框（File 图标）
    │   └── 非图片类 → FileCard
    │
    └── 悬停操作栏（有文字时显示，AssistantHoverBar）
        ├── 时间戳（相对时间格式）
        └── [复制按钮]（Copy 图标）→ 复制全文到剪贴板
            └── 复制成功状态：Check 绿色图标（2秒后恢复）

ImageLightbox（图片灯箱，Portal 到 document.body）
├── 半透明黑色背景遮罩（点击关闭）
├── 图片（最大 90vw × 85vh，object-contain）
├── [在文件夹中显示按钮]（仅有 filePath 时）→ shell:showItemInFolder
├── [关闭按钮] → onClose()
└── Escape 键关闭
```

---

## 数据流骨架

```
会话管理
  → 网关运行时自动加载：loadSessions() → sessions.list（IPC gateway:rpc）
  → 加载历史：loadHistory() → chat.history { sessionKey, limit:1000 }（IPC gateway:rpc）
  → 后台为每个非 main session 拉取首条消息用于侧边栏标签显示
  → 新会话：本地生成 key = agent:{id}:session-{timestamp}，不调用 sessions.reset
  → 切换会话：本地状态切换 + 触发 loadHistory()
  → 删除会话：IPC session:delete（重命名 .jsonl → .deleted.jsonl）+ 本地状态更新

发送消息
  → sendMessage(text, attachments?, targetAgentId?)
  → 附件先通过 /api/files/stage-paths 或 /api/files/stage-buffer 暂存到磁盘
  → 消息通过 WebSocket RPC 发送至 OpenAGI Gateway
  → 流式响应：handleChatEvent() 处理 delta / tool_use / completed 事件
  → 流式内容更新：streamingMessage / streamingTools / pendingFinal
  → 错误恢复：延迟定时器（避免误判 Gateway 内部重试为错误）
  → 中止：abortRun() → Gateway RPC

实时推送
  → 聊天事件通过 IPC renderer→ handleChatEvent() 注入 store
  → 事件去重（30 秒 TTL，基于 runId/sessionKey/seq 组合键）
  → 工具调用历史轮询（静默窗口 2.5 秒后启动，间隔轮询）

Trinity 双核博弈
  → POST /api/trinity/cycle/run { mode: 'debate' | 'competition' | 'refinement' }
  → 本地状态管理：trinityRunning / trinityResult（不进入全局 store）

文件处理
  → 原生文件选择：IPC dialog:open → POST /api/files/stage-paths（发送文件路径数组）
  → 粘贴/拖放：读取 File 对象 → base64 → POST /api/files/stage-buffer
  → 两种方式均返回 { id, fileName, mimeType, fileSize, stagedPath, preview }
  → 发送时仅传 stagedPath（磁盘路径引用），不传 base64
```

---

## 特殊状态汇总

| 状态 | 触发条件 | 表现 |
|------|----------|------|
| 欢迎屏（空状态） | messages.length === 0 && !sending | 大标题 + 三个快捷按钮 |
| 打字指示器 | sending && !pendingFinal && 无流内容 | 三点跳动动画 |
| 工具处理指示器 | sending && pendingFinal && 无流内容 | Loader2 + "Processing tool results…" |
| 流式光标 | isStreaming=true（助手气泡） | 闪烁竖线 |
| 加载覆盖层 | minLoading && !sending | 半透明背景 + Spinner |
| 错误条 | error !== null | 红色警告栏 + 错误文本 + [忽略] |
| 输入框禁用 | disabled（网关未运行） | 占位符："网关未连接..." |
| 附件暂存中 | attachment.status === 'staging' | 深色遮罩 + 旋转 Loader2 |
| 附件暂存失败 | attachment.status === 'error' | 红色遮罩 + "Error" 文字 |
| 网关状态指示 | 始终显示（输入框下方） | 绿色点（已连接）/ 红色点（未连接）|
| 思考区块 | showThinking && 消息含 thinking 块 | 可折叠的 "Thinking" 块 |
| 工具调用卡片 | 消息含 tool_use 块 | 可折叠的工具名 + 参数 |
| 工具状态栏（流式） | isStreaming && streamingTools.length > 0 | 每个工具一行，含状态图标 + 耗时 |

---

## 开发者模式功能

Chat 页面本身不受开发者模式影响（无开发者专属开关）。Trinity 面板为固定可见功能。

---

## 特殊说明

1. **会话删除机制**：Gateway 无 sessions.delete RPC，删除操作通过 IPC `session:delete` 重命名 JSONL 文件实现（`.jsonl` → `.deleted.jsonl`），历史记录文件保留在磁盘。

2. **空会话清理**：导航离开 Chat 页面时，若当前 session 从未发送过消息（无历史、无活动时间、无标签），自动从侧边栏移除（`cleanupEmptySession`）。

3. **IME 输入法保护**：中文/日文等输入法组合状态（isComposing / keyCode 229）下，Enter 键不触发发送。

4. **流式消息时间戳**：流式消息的 timestamp 在 sending 开始时记录（Date.now() / 1000），用于事后在消息列表中显示准确时间。

5. **附件传输方式**：文件不以 base64 通过 WebSocket 传输，而是先暂存到磁盘，消息中仅携带磁盘路径引用（轻量级 stagedPath）。

6. **Trinity 面板**：是聊天页面内嵌的独立功能模块，调用后端的三角博弈 API，与对话 session 无关联，结果仅在本地组件状态中保存。
