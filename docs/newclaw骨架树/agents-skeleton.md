# Agents 页面 — 骨架树（去叶留枝版）

```
/agents
│
├── 页面级加载状态（首次加载，尚未完成初始拉取）
│   └── 全屏居中转圈动画（LoadingSpinner 大尺寸）
│
├── 页面头部
│   ├── 标题："Agents"
│   ├── 副标题："创建新的 Agent，可以将特定频道路由到不同的人格配置或工作区。"
│   ├── [刷新]（含旋转图标，刷新中时图标持续旋转）→ 触发 fetchAgents + fetchChannelAccounts
│   └── [添加 Agent]（含加号图标）→ 弹出「添加 Agent 对话框」
│
├── 警告横幅（Gateway 未运行时显示）
│   ├── 警告图标
│   └── "Gateway 服务未运行。Agent 或频道变更可能需要一点时间生效。"
│
├── 错误横幅（fetchAgents 失败时显示）
│   ├── 错误图标
│   └── 错误信息文本（来自 store error 字段）
│
├── Agent 卡片列表（每个 Agent 一行，静默刷新时保留旧数据）
│   └── 每张卡片
│       ├── Bot 图标
│       ├── Agent 名称
│       ├── "默认" 徽章（仅 isDefault=true 时显示，含勾号）
│       ├── 信息行1："Model: {modelDisplay}{（继承）}"（inheritedModel=true 时附加"（继承）"后缀）
│       ├── 信息行2："频道: {频道名称 · 账号名, ...}"（无绑定频道时显示"无"）
│       ├── [删除图标按钮]（仅 isDefault=false 时，悬停显示）→ 弹出「删除确认对话框」
│       └── [设置图标按钮]（isDefault 时始终显示，非默认时悬停显示）→ 弹出「Agent 设置弹窗」
│
├── 空状态（agents 列表为空且已完成初始加载）
│   └── （注：页面无显式空状态 UI，列表区域直接为空白）
│
├── ─── 弹窗/对话框 ───
│
├── 添加 Agent 对话框（showAddDialog=true 时显示）
│   ├── 标题："添加 Agent"
│   ├── 描述："输入名称即可创建新 Agent，可选择是否继承主 Agent 的工作区引导文件。"
│   ├── 表单
│   │   ├── 标签："Agent 名称"
│   │   ├── 输入框（占位符："Coding Helper"）
│   │   ├── 标签："继承主 Agent 工作区"
│   │   ├── 说明文字："从主 Agent 复制 SOUL.md、AGENTS.md 等引导文件"
│   │   └── 开关（Switch，默认关）→ 控制 inheritWorkspace 选项
│   └── 按钮区
│       ├── [取消] → 关闭对话框（不保存）
│       └── [保存]（名称为空时禁用；创建中时显示旋转图标 + "创建中..."）→ 调用 createAgent
│           ├── 成功 → 关闭对话框 + Toast "Agent 已创建"
│           └── 失败 → Toast "创建 Agent 失败：{error}"
│
├── 删除确认对话框（agentToDelete 不为空时显示）
│   ├── 标题："删除 Agent"
│   ├── 消息："确认从 OpenAGI 删除 "{name}"？这会永久删除该 Agent 及其由 OpenAGI 管理的工作区、运行时和会话文件。"
│   ├── [删除]（危险样式）→ 调用 deleteAgent
│   │   ├── 成功 → Toast "Agent 已删除"；若当前正在查看该 Agent 设置则关闭设置弹窗
│   │   └── 失败 → Toast "删除 Agent 失败：{error}"
│   └── [取消] → 关闭对话框
│
├── Agent 设置弹窗（activeAgent 不为空时显示）
│   ├── 标题："{agent.name} 设置"
│   ├── 描述："更新 Agent 名称，并管理哪些频道归属于这个 Agent。"
│   ├── [X 关闭按钮]
│   │   ├── 有未保存名称修改时 → 弹出「未保存修改确认对话框」
│   │   └── 无未保存修改时 → 直接关闭
│   │
│   ├── 基础信息区（两列网格）
│   │   ├── Agent 名称输入框
│   │   │   ├── （isDefault=true 时只读，无保存按钮）
│   │   │   └── （isDefault=false 时可编辑）
│   │   │       └── [保存按钮]（名称未改变或空时禁用；保存中显示旋转图标）→ 调用 updateAgent
│   │   │           ├── 成功 → Toast "Agent 已更新"
│   │   │           └── 失败 → Toast "更新 Agent 失败：{error}"
│   │   ├── Agent ID 信息块（只读）
│   │   │   ├── 标签："AGENT ID"
│   │   │   └── 文本：{agent.id}（等宽字体）
│   │   └── 模型信息块（可点击）→ 弹出「模型覆盖弹窗」
│   │       ├── 标签："MODEL"
│   │       ├── 文本：{agent.modelDisplay}{（继承）}
│   │       └── 副文本：{agent.modelRef 或 defaultModelRef 或 "-"}（等宽字体）
│   │
│   └── 频道区
│       ├── 区域标题："频道"
│       ├── 区域描述："该列表为只读。频道账号与绑定关系请在 Channels 页面管理。"
│       │
│       ├── 空状态（assignedChannels=[] 且 agent.channelTypes=[]）
│       │   └── "这个 Agent 还没有分配任何频道。"
│       │
│       ├── 频道卡片列表（assignedChannels 不为空时）
│       │   └── 每个频道卡片
│       │       ├── 频道 Logo（Telegram / Discord / WhatsApp / WeChat / DingTalk / Feishu / WeCom / QQ / 默认💬）
│       │       ├── 账号名称（主账号显示"主账号"）
│       │       ├── 频道类型名称 · 账号ID
│       │       └── 错误信息（lastError 不为空时，红色字体）
│       │
│       └── 仅有 channelTypes 但无 accountId 明细时
│           └── "该 Agent 绑定了频道类型，但具体账号绑定请在 Channels 页面查看。"
│
├── 模型覆盖弹窗（showModelModal=true 时显示，层级高于设置弹窗）
│   ├── 标题："Model"
│   ├── 描述："为该 Agent 选择 Provider 和模型 ID。"（含当前默认模型引用）
│   ├── [X 关闭按钮]
│   │   ├── 有未保存模型修改时 → 弹出「未保存修改确认对话框」
│   │   └── 无修改时 → 直接关闭
│   │
│   ├── Provider 选择下拉框
│   │   ├── 标签："Provider"
│   │   ├── 选项："选择 Provider"（占位）
│   │   ├── 选项列表：已启用且有有效凭证的账号（去重，按默认账号优先、更新时间倒序排列）
│   │   │   └── 格式："{账号标签} ({供应商名称})"
│   │   └── 空状态提示（无可用 Provider 时）
│   │       └── "尚未配置 Provider 账号。请先前往 设置 → AI Providers 添加。"（橙色警告文字）
│   │
│   ├── 模型 ID 输入框
│   │   ├── 标签："模型 ID"
│   │   └── 占位符：供应商配置的模型ID占位符 或 "model-id"
│   │
│   ├── 预览文本（nextModelRef 不为空时显示）
│   │   └── "预览: {provider}/{modelId}"（等宽字体）
│   │
│   └── 按钮区
│       ├── [使用默认模型]（无默认模型引用或已在使用默认模型时禁用）→ 将表单填入全局默认模型
│       ├── [取消] → 触发关闭流程
│       └── [保存]（未选 Provider / 模型ID为空 / 无修改时禁用；保存中显示旋转图标）→ 调用 updateAgentModel
│           ├── 成功（设置了覆盖）→ Toast "Agent 模型已更新" + 关闭弹窗
│           ├── 成功（重置为默认）→ Toast "Agent 模型已恢复为默认" + 关闭弹窗
│           └── 失败 → Toast "更新 Agent 模型失败：{error}"
│
└── 未保存修改确认对话框（两处共用：设置弹窗 + 模型覆盖弹窗）
    ├── 标题："未保存的修改"
    ├── 消息："你有未保存的修改。关闭后这些修改将被丢弃。"
    ├── [不保存并关闭]（确认）→ 丢弃修改，关闭上层弹窗
    └── [取消] → 回到上层弹窗继续编辑
```

---

## 数据流骨架

```
页面初始化
  → 并行执行：fetchAgents() + fetchChannelAccounts() + refreshProviderSnapshot()
  → 全部完成后设置 hasCompletedInitialLoad=true（期间显示全屏加载）
  → 若已有缓存数据（agents.length > 0）则 hasCompletedInitialLoad 初始值直接为 true（跳过全屏加载）

频道状态实时同步
  → 订阅 host 事件 'gateway:channel-status'
  → 事件触发时调用 fetchChannelAccounts()（自动更新卡片上的频道绑定信息）

Gateway 状态监听
  → 监听 gatewayStatus.state 变化
  → 从非 'running' 变为 'running' 时自动调用 fetchChannelAccounts()

刷新按钮
  → 并行执行：fetchAgents() + fetchChannelAccounts()
  → 刷新中时保留旧数据可见（isUsingStableValue=true 时刷新图标旋转）

Agent CRUD 操作
  → 创建：填写名称 + 可选继承工作区 → POST /api/agents → 返回最新快照 → 更新 store
  → 重命名：修改名称 → PUT /api/agents/{id} → 返回最新快照 → 更新 store
  → 更新模型：选择 Provider + 填写模型ID → PUT /api/agents/{id}/model → 更新 store
  → 删除：确认对话框 → DELETE /api/agents/{id} → 更新 store
  → 恢复默认模型：PUT /api/agents/{id}/model（modelRef=null）→ 更新 store

Provider 数据（模型覆盖弹窗）
  → 来源：useProviderStore（accounts / statuses / vendors / defaultAccountId）
  → 过滤条件：account.enabled=true 且有有效凭证（oauth/local 直通，apiKey 模式需 hasKey=true）
  → 去重规则：按 runtimeProviderKey 去重（custom/ollama 账号按 ID 后缀区分）
  → 排序：默认账号优先，其余按 updatedAt 倒序
```

---

## Toast 消息汇总（共 14 种）

| 触发动作 | 成功 Toast | 失败 Toast |
|---------|-----------|-----------|
| 创建 Agent | "Agent 已创建" | "创建 Agent 失败：{error}" |
| 重命名 Agent | "Agent 已更新" | "更新 Agent 失败：{error}" |
| 删除 Agent | "Agent 已删除" | "删除 Agent 失败：{error}" |
| 更新模型（设置覆盖） | "Agent 模型已更新" | "更新 Agent 模型失败：{error}" |
| 更新模型（重置默认） | "Agent 模型已恢复为默认" | "恢复 Agent 默认模型失败：{error}" |
| 保存模型前校验失败 | — | "模型格式必须为 provider/model" |
| 保存模型前校验失败 | — | "请先选择 Provider" |
| 保存模型前校验失败 | — | "模型 ID 不能为空" |

> 注：频道分配/移除的 Toast（"{{channel}} 已分配给 Agent" / "{{channel}} 已移除" 等）在 i18n 中已定义，但当前 UI 层无频道直接操作入口（只读展示），Channels 页面负责实际分配逻辑。

---

## 特殊说明

### 频道 Logo 映射
| channelType | 图标来源 |
|------------|---------|
| telegram | telegram.svg |
| discord | discord.svg |
| whatsapp | whatsapp.svg |
| wechat | wechat.svg |
| dingtalk | dingtalk.svg |
| feishu | feishu.svg |
| wecom | wecom.svg |
| qqbot | qq.svg |
| 其他 | CHANNEL_ICONS[type] 或 '💬' |

### runtimeProviderKey 解析规则
| 条件 | runtimeProviderKey |
|-----|--------------------|
| oauth_browser + Google | 'google-gemini-cli' |
| oauth_browser + OpenAI | 'openai-codex' |
| vendorId = 'custom' 或 'ollama' | '{vendorId}-{accountId 去横杠后前8位}' |
| vendorId = 'minimax-portal-cn' | 'minimax-portal' |
| 其他 | vendorId 本身 |

### 默认 Agent（isDefault=true）的限制
- 名称字段只读（无保存按钮）
- 不显示删除按钮（无法删除默认 Agent）
- 设置图标按钮始终可见（不需要悬停）

### 模型覆盖逻辑
- agent.overrideModelRef 不为空 → 表单初始化为覆盖值
- agent.overrideModelRef 为空 → 表单初始化为 agent.modelRef 或 defaultModelRef 的解析值
- 表单选择值 === defaultModelRef → desiredOverrideModelRef=null（等价于"重置为默认"）
- 表单选择值 ≠ defaultModelRef → desiredOverrideModelRef="{providerKey}/{modelId}"
