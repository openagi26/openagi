# 🎯 Models 页面 — 100% 全量思维导图（基准案例）

> **标准说明**：本文档逐字、逐按钮、逐图标、逐颜色、逐状态、逐交互记录 `/models` 页面的所有可见元素与内部逻辑。通过此基准验证后，将以同标准复刻全站。

---

## 📁 源文件清单

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/pages/Models/index.tsx` | 685 | 页面主组件 + Token 用量图表 + 弹窗 |
| `src/pages/Models/usage-history.ts` | 118 | 用量数据类型 + 筛选/分组/格式化工具函数 |
| `src/components/settings/ProvidersSettings.tsx` | 1674 | 提供商管理（嵌入在 Models 页面内） |
| `src/stores/providers.ts` | 351 | Zustand 状态管理 |
| `src/lib/providers.ts` | 256 | 提供商类型定义 + 元数据 |
| `src/lib/provider-accounts.ts` | 126 | 账户快照 + 列表构建 |
| `src/i18n/locales/zh/dashboard.json` | 65 | 中文翻译（仪表盘/模型） |
| `src/i18n/locales/zh/settings.json` | 282 | 中文翻译（提供商设置） |

---

## 🗺️ 页面整体结构

```
/models 页面
├── 1. 页面头部（Header）
├── 2. 提供商管理区（ProvidersSettings 组件）
│   ├── 2.1 提供商卡片列表
│   ├── 2.2 空状态
│   └── 2.3 添加提供商对话框（AddProviderDialog）
└── 3. Token 用量历史区（Token Usage History）
    ├── 3.1 标题栏 + 控制按钮
    ├── 3.2 柱状图（UsageBarChart）
    ├── 3.3 用量条目列表（分页）
    ├── 3.4 分页控件
    ├── 3.5 用量详情弹窗（UsageContentPopup）
    └── 3.6 特殊状态（加载/空/错误）
```

---

## 1. 页面头部（Header）

### 1.1 容器样式
- 外层：`flex flex-col -m-6 dark:bg-background h-[calc(100vh-2.5rem)]`
- 内层滚动区：`overflow-y-auto`
- 内容区：`max-w-4xl mx-auto px-6 py-8 w-full`

### 1.2 标题
| 属性 | 值 |
|------|------|
| 中文文字 | **模型** |
| 英文文字 | **Models** |
| i18n key | `dashboard:models.title` |
| 字体 | `font-serif` (Georgia) |
| 大小 | `text-5xl`（移动端）/ `text-6xl`（md 以上） |
| 颜色 | `text-foreground`（默认前景色） |

### 1.3 副标题
| 属性 | 值 |
|------|------|
| 中文文字 | **管理您的 AI 提供商并监控 Token 用量** |
| 英文文字 | **Manage your AI providers and monitor token usage.** |
| i18n key | `dashboard:models.subtitle` |
| 大小 | `text-lg` |
| 颜色 | `text-muted-foreground` |

### 1.4 Telemetry
- 页面挂载时调用 `trackUiEvent('models.page_viewed')`

---

## 2. 提供商管理区（ProvidersSettings 组件）

### 2.1 区域标题
| 属性 | 值 |
|------|------|
| 中文文字 | **AI 模型提供商** |
| i18n key | `settings:aiProviders.title` |
| 右侧按钮 | ➕ **添加提供商** |
| 按钮 i18n | `settings:aiProviders.add` |
| 按钮图标 | `Plus` (lucide-react) |
| 按钮样式 | `ghost` variant, `text-sm` |

### 2.2 空状态（无任何提供商时）
| 属性 | 值 |
|------|------|
| 标题 | **未配置提供商** |
| 描述 | **添加 AI 提供商以开始使用 OpenAGI** |
| CTA 按钮 | **添加您的第一个提供商** |
| i18n keys | `settings:aiProviders.empty.title` / `.desc` / `.cta` |
| 容器样式 | `bg-black/5 dark:bg-white/5 rounded-3xl border border-transparent border-dashed` |
| 图标 | `Inbox`（muted-foreground 色） |

### 2.3 提供商卡片列表

#### 2.3.1 卡片容器
- 布局：垂直列表，`flex flex-col gap-3`
- 卡片样式：`rounded-2xl bg-black/[0.04] dark:bg-white/[0.06]`
- Hover：`hover:bg-black/5 dark:hover:bg-white/5`
- 内边距：`p-4`

#### 2.3.2 卡片内容（非编辑模式）

```
┌─────────────────────────────────────────────┐
│ [图标圆圈]  提供商名称          [操作按钮组] │
│             认证模式 · 状态标识              │
│             回退信息（如有）                  │
└─────────────────────────────────────────────┘
```

| 元素 | 详情 |
|------|------|
| **图标圆圈** | `h-[42px] w-[42px] rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10`，内含 SVG logo（`dark:invert` 反色） |
| **提供商名称** | `font-medium text-[15px]`，显示 account.label 或 vendor.name |
| **默认标识** | 若为默认：显示 `默认` 徽章，`font-mono text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary` |
| **已配置标识** | 绿色圆点 `bg-green-500 h-2 w-2 rounded-full` + 文字 **已配置** |
| **未配置标识** | 红色圆点 `bg-red-500 h-2 w-2 rounded-full` + 文字 **未设置 API 密钥** |
| **认证模式** | `API 密钥` / `OAuth 设备登录` / `OAuth 浏览器登录` / `本地` |
| **回退信息** | 若有回退提供商：**回退：提供商A, 提供商B** / **回退（3 个）：A, B, C** |

#### 2.3.3 卡片操作按钮（Hover 时显示）

| 按钮 | 图标 | Tooltip 中文 | 颜色 | 条件 |
|------|------|------|------|------|
| 设为默认 | `Check` | 设为默认 | `text-foreground hover:text-blue-600` | 非当前默认时显示 |
| 编辑 | `Edit` | 编辑 API 密钥 | `text-foreground hover:text-blue-600` | 始终显示 |
| 删除 | `Trash2` | 删除提供商 | `text-foreground hover:text-destructive` | 始终显示 |

#### 2.3.4 卡片编辑模式（点击编辑后展开）

展开后在卡片下方显示编辑表单，包含以下字段（根据提供商类型有条件显示）：

##### A. Base URL 字段
| 属性 | 值 |
|------|------|
| 标签 | **基础 URL** (`settings:aiProviders.dialog.baseUrl`) |
| 条件 | `typeInfo.showBaseUrl === true` |
| 输入框样式 | `h-[44px] rounded-xl font-mono text-[13px] bg-[#eeece3] dark:bg-muted border-black/10 dark:border-white/10` |
| placeholder | 根据提供商不同，如 `https://api.openai.com/v1` |

##### B. 模型 ID 字段
| 属性 | 值 |
|------|------|
| 标签 | **模型 ID** (`settings:aiProviders.dialog.modelId`) |
| 条件 | `shouldShowProviderModelId(typeInfo, devModeUnlocked)` |
| placeholder | 如 `openai/gpt-5.4`（OpenRouter）或 `gpt-5.4`（OpenAI）|

##### C. API 协议选择（仅 Custom / Ollama 类型）
| 属性 | 值 |
|------|------|
| 标签 | **协议** (`settings:aiProviders.dialog.protocol`) |
| 选项 | 三个按钮组：|

| 按钮文字 | 值 | i18n key |
|------|------|------|
| OpenAI Completions | `openai-completions` | `settings:aiProviders.protocols.openaiCompletions` |
| OpenAI Responses | `openai-responses` | `settings:aiProviders.protocols.openaiResponses` |
| Anthropic 兼容 | `anthropic-messages` | `settings:aiProviders.protocols.anthropic` |

按钮样式：选中 `bg-black/5 dark:bg-white/10 text-foreground`，未选中 `text-muted-foreground`

##### D. User-Agent 字段（仅 Custom 类型）
| 属性 | 值 |
|------|------|
| 标签 | **User-Agent** |
| placeholder | `OpenAGI/1.0` |
| i18n key | `settings:aiProviders.dialog.userAgent` / `userAgentPlaceholder` |

##### E. 回退配置区（可折叠）
| 属性 | 值 |
|------|------|
| 折叠切换 | `ChevronDown` 图标 + **回退配置**（`settings:aiProviders.sections.fallback`）|
| 图标动画 | `transition-transform`，展开时 `rotate-180` |

**E1. 同 Provider 回退模型 ID**
| 属性 | 值 |
|------|------|
| 标签 | **同 Provider 回退模型 ID** |
| 输入 | `<textarea>` 多行 |
| placeholder | `gpt-4.1-mini\nanother-model-id` |
| 说明 | **每行一个模型 ID。会先使用当前 provider 的这些模型，再回退到其他 provider。** |

**E2. 跨 Provider 回退**
| 属性 | 值 |
|------|------|
| 标签 | **跨 Provider 回退** |
| 类型 | 复选框列表，每个已配置的其他提供商一个 checkbox |
| 复选框样式 | `h-4 w-4 rounded border border-black/20 dark:border-white/20` |
| 空状态 | **请先添加其他 provider，才能把它设为回退目标。** |

##### F. API 密钥字段
| 属性 | 值 |
|------|------|
| 标签 | **API 密钥** (`settings:aiProviders.dialog.apiKey`) |
| 类型 | `password`（默认隐藏）/ `text`（点击眼睛切换） |
| 眼睛图标 | `Eye`（隐藏时）/ `EyeOff`（显示时） |
| 已有 key 提示 | **这个 provider 已经保存了 API key。** |
| 无 key 提示 | **这个 provider 还没有保存 API key。** |
| 替换提示 | **如果想保留当前已保存的 API key，这里留空即可。** |
| 安全提示 | **您的 API 密钥存储在本地机器上。** |

##### G. Ark Code Plan 预设（仅 ByteDance Ark 类型）
| 属性 | 值 |
|------|------|
| 模式切换 | 两个按钮：**API Key** / **Code Plan** |
| 预设说明 | **Code Plan 使用 https://ark.cn-beijing.volces.com/api/coding/v3 与模型 ark-code-latest。请勿把 /api/v3 用于 Code Plan 流量。** |
| 文档链接 | **Code Plan 文档** → 外部链接 |

##### H. 编辑操作按钮
| 按钮 | 图标 | 行为 | 样式 |
|------|------|------|------|
| 保存 ✓ | `Check`（保存中时 `Loader2 animate-spin`） | 验证 API key → PUT 更新 | `ghost` |
| 取消 ✗ | `X` | 关闭编辑模式 | `ghost` |

### 2.4 添加提供商对话框（AddProviderDialog）

#### 2.4.1 对话框容器
- 固定覆盖层：`fixed inset-0 z-50 bg-black/50`
- 内容框：`bg-background rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto`

#### 2.4.2 对话框头部
| 属性 | 值 |
|------|------|
| 标题 | **添加 AI 提供商** (`settings:aiProviders.dialog.title`) |
| 描述 | **配置新的 AI 模型提供商** (`settings:aiProviders.dialog.desc`) |
| 关闭按钮 | `X` 图标，右上角 |

#### 2.4.3 第一步：选择提供商类型（Grid）

布局：`grid grid-cols-2 md:grid-cols-3 gap-3`

**12 个提供商类型卡片：**

| 序号 | 名称 | 图标 | 类别 | 需要 API Key | 默认模型 | Base URL |
|------|------|------|------|------|------|------|
| 1 | Anthropic | 🤖 SVG | official | ✅ | — | — |
| 2 | OpenAI | 💚 SVG | official | ✅（支持 OAuth） | gpt-5.4 | — |
| 3 | Google | 🔷 SVG | official | ✅（支持 OAuth） | gemini-3-pro-preview | — |
| 4 | OpenRouter | 🌐 SVG | compatible | ✅ | openai/gpt-5.4 | — |
| 5 | MiniMax 国内站 | ☁️ SVG | compatible | ✅（支持 OAuth） | MiniMax-M2.7 | — |
| 6 | Moonshot | 🌙 SVG | compatible | ✅ | kimi-k2.5 | https://api.moonshot.cn/v1 |
| 7 | SiliconFlow | 🌊 SVG | compatible | ✅ | deepseek-ai/DeepSeek-V3 | https://api.siliconflow.cn/v1 |
| 8 | MiniMax 国际站 | ☁️ SVG | compatible | ✅（支持 OAuth） | — | — |
| 9 | Model Studio | ☁️ SVG | compatible | ✅ | — | https://coding.dashscope.aliyuncs.com/v1 |
| 10 | ByteDance Ark | A SVG | compatible | ✅ | — | https://ark.cn-beijing.volces.com/api/v3 |
| 11 | Ollama | 🦙 SVG | local | ❌ | — | http://localhost:11434/v1 |
| 12 | Custom | ⚙️ SVG | custom | ✅ | — | 用户自定义 |

**卡片样式：**
- 默认：`rounded-xl border border-black/10 dark:border-white/10 p-4 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer`
- 已选中：`ring-2 ring-primary bg-black/5 dark:bg-white/5`
- 已存在（不支持多账户时）：`opacity-50 cursor-not-allowed`

**排除规则：**
- `hidden: true` 的提供商不显示（Model Studio 在非 dev 模式下隐藏）
- MiniMax 国际站和国内站互斥：已有一个时另一个禁用

#### 2.4.4 第二步：配置表单（选择类型后）

##### 顶部切换
| 按钮 | 文字 | 图标 | 作用 |
|------|------|------|------|
| 更换提供商 | **更换提供商** | `ChevronLeft` | 返回第一步 |
| 查看文档 | **查看文档** | `ExternalLink` | 打开 docsUrl（中文用户用 docsUrlZh） |

##### 显示名称字段
| 属性 | 值 |
|------|------|
| 标签 | **显示名称** (`settings:aiProviders.dialog.displayName`) |
| 默认值 | 提供商名称（如 "Anthropic"） |
| 输入框样式 | 同上述 inputClasses |

##### 认证方式切换（支持 OAuth 的提供商）
两个按钮：
| 按钮 | 文字（中文） | i18n key |
|------|------|------|
| OAuth 登录 | **OAuth 登录** | `settings:aiProviders.oauth.loginMode` |
| API 密钥 | **API 密钥** | `settings:aiProviders.oauth.apikeyMode` |

#### 2.4.5 OAuth 登录流程

##### 阶段 A：初始状态
| 元素 | 值 |
|------|------|
| 提示 | **此提供商需要通过浏览器登录授权。** |
| 按钮 | **浏览器登录** (`settings:aiProviders.oauth.loginButton`) |
| 替代链接 | **获取 API 密钥** → 跳转到 apiKeyUrl |

##### 阶段 B：等待授权码
| 元素 | 值 |
|------|------|
| 动画 | 背景 pulse 动画 |
| 文字 | **正在获取安全登录码...** (`settings:aiProviders.oauth.requestingCode`) |
| Loader | `Loader2 animate-spin` |

##### 阶段 C：显示设备码（Device Flow）
```
┌──────────────────────────────────┐
│  确认登录                        │
│                                  │
│  复制下方的授权码。               │
│  在浏览器中打开登录页面。         │
│  粘贴授权码以批准访问。           │
│                                  │
│  ┌────────────────────────┐      │
│  │ ABCD-EFGH      [复制]  │      │
│  └────────────────────────┘      │
│                                  │
│  等待浏览器中的授权...            │
│  [Loader2 spinner]               │
└──────────────────────────────────┘
```

| 元素 | 中文 | i18n key |
|------|------|------|
| 标题 | 确认登录 | `settings:aiProviders.oauth.approveLogin` |
| 步骤 1 | 复制下方的授权码。 | `settings:aiProviders.oauth.step1` |
| 步骤 2 | 在浏览器中打开登录页面。 | `settings:aiProviders.oauth.step2` |
| 步骤 3 | 粘贴授权码以批准访问。 | `settings:aiProviders.oauth.step3` |
| 复制按钮 | `Copy` 图标 | 点击复制设备码到剪贴板 |
| 复制成功 toast | **代码已复制到剪贴板** | `settings:aiProviders.oauth.codeCopied` |
| 等待文字 | 等待浏览器中的授权... | `settings:aiProviders.oauth.waitingApproval` |

##### 阶段 D：手动输入码（Manual Flow）
| 元素 | 值 |
|------|------|
| 输入框 | 手动粘贴授权码 |
| 提交按钮 | 提交 |

##### 阶段 E：授权失败
| 元素 | 中文 | i18n key |
|------|------|------|
| 错误标题 | 认证失败 | `settings:aiProviders.oauth.authFailed` |
| 错误详情 | 动态错误消息 | — |
| 重试按钮 | **重试** | `settings:aiProviders.oauth.tryAgain` |

##### 阶段 F：授权成功
- 自动调用 `refreshProviderSnapshot()` + `setDefaultAccount()`
- 对话框自动关闭
- Toast：**提供商添加成功** (`settings:aiProviders.toast.added`)

#### 2.4.6 API Key 认证流程

表单字段（从上到下）：

| 序号 | 字段 | 条件 | placeholder 示例 |
|------|------|------|------|
| 1 | 显示名称 | 始终 | 提供商名称 |
| 2 | Base URL | showBaseUrl=true | 如 `https://api.moonshot.cn/v1` |
| 3 | 模型 ID | showModelId=true | 如 `openai/gpt-5.4` |
| 4 | 协议选择 | Custom/Ollama | 三按钮组 |
| 5 | User-Agent | Custom only | `OpenAGI/1.0` |
| 6 | API 密钥 | requiresApiKey=true | 如 `sk-ant-api03-...` |
| 7 | Ark 模式切换 | Ark only | API Key / Code Plan |

**API Key 输入框特殊行为：**
- 输入类型切换：`Eye`/`EyeOff` 图标切换 password/text
- Ollama 不需要 API key，自动填充 `OLLAMA_PLACEHOLDER_API_KEY`

**底部按钮：**
| 按钮 | 文字 | 条件 | 样式 |
|------|------|------|------|
| 添加提供商 | **添加提供商** | 表单有效时 | `default` variant |
| 加载状态 | `Loader2 animate-spin` + **添加提供商** | saving=true | disabled |

#### 2.4.7 验证与 Toast 消息

| 场景 | Toast 消息（中文） | i18n key |
|------|------|------|
| 添加成功 | 提供商添加成功 | `settings:aiProviders.toast.added` |
| 添加失败 | 添加提供商失败 | `settings:aiProviders.toast.failedAdd` |
| 删除成功 | 提供商已删除 | `settings:aiProviders.toast.deleted` |
| 删除失败 | 删除提供商失败 | `settings:aiProviders.toast.failedDelete` |
| 设为默认成功 | 默认提供商已更新 | `settings:aiProviders.toast.defaultUpdated` |
| 设为默认失败 | 设置默认失败 | `settings:aiProviders.toast.failedDefault` |
| 更新成功 | 提供商已更新 | `settings:aiProviders.toast.updated` |
| 更新失败 | 更新提供商失败 | `settings:aiProviders.toast.failedUpdate` |
| API Key 无效 | 无效的 API 密钥 | `settings:aiProviders.toast.invalidKey` |
| 缺少模型 ID | 需要模型 ID | `settings:aiProviders.toast.modelRequired` |
| MiniMax 冲突 | 不能同时添加 MiniMax 国际站和国内站的服务商。 | `settings:aiProviders.toast.minimaxConflict` |

---

## 3. Token 用量历史区（Token Usage History）

### 3.1 区域标题栏

```
┌──────────────────────────────────────────────────────┐
│  最近 Token 消耗                                      │
│                                                       │
│  [按模型] [按时间]      [7 天] [30 天] [全部]         │
└──────────────────────────────────────────────────────┘
```

| 元素 | 中文 | 英文 | i18n key |
|------|------|------|------|
| 标题 | **最近 Token 消耗** | Token Usage History | `dashboard:recentTokenHistory.title` |
| 分组-按模型 | 按模型 | By Model | `dashboard:recentTokenHistory.groupByModel` |
| 分组-按时间 | 按时间 | By Time | `dashboard:recentTokenHistory.groupByTime` |
| 窗口-7天 | 7 天 | Last 7 Days | `dashboard:recentTokenHistory.last7Days` |
| 窗口-30天 | 30 天 | Last 30 Days | `dashboard:recentTokenHistory.last30Days` |
| 窗口-全部 | 全部 | All Time | `dashboard:recentTokenHistory.allTime` |

**按钮样式：**
- 分组和窗口均为 toggle 按钮组
- 选中状态：`bg-black/5 dark:bg-white/10 text-foreground font-medium`
- 未选中状态：`text-muted-foreground`
- 按钮大小：`text-sm px-3 py-1 rounded-lg`

### 3.2 柱状图（UsageBarChart 组件）

#### 3.2.1 图例（Legend）
```
● 输入  ● 输出  ● 缓存          总 token
```

| 元素 | 中文 | 英文 | 颜色 | i18n key |
|------|------|------|------|------|
| 输入 | 输入 | Input | `bg-sky-500` | `dashboard:recentTokenHistory.inputShort` |
| 输出 | 输出 | Output | `bg-violet-500` | `dashboard:recentTokenHistory.outputShort` |
| 缓存 | 缓存 | Cache | `bg-amber-500` | `dashboard:recentTokenHistory.cacheShort` |
| 总计 | 总 token | Total Tokens | — | `dashboard:recentTokenHistory.totalTokens` |

#### 3.2.2 柱状条
- 每个 group 一行：`[标签] [=======] [总数]`
- 柱体为水平堆叠条（Stacked Bar）：
  - 天蓝色段（sky-500）= inputTokens
  - 紫色段（violet-500）= outputTokens
  - 琥珀色段（amber-500）= cacheTokens
- 最小宽度：`min-w-[6%]`
- 宽度计算：`(该 group 总 token ÷ 最大 group 总 token) × 100%`
- 圆角：`rounded-md`
- 高度：`h-6`

#### 3.2.3 标签
- 按模型分组：显示模型名称（如 `claude-3.5-sonnet`、`gpt-5.4`）
- 按时间分组：显示日期（如 `4月 11`）
- 最多显示 8 个 group（按模型），按时间则显示全部

### 3.3 记录数统计
| 元素 | 中文 | i18n key |
|------|------|------|
| 统计 | **共 {{count}} 条记录** | `dashboard:recentTokenHistory.showingLast` |
| 样式 | `text-xs text-muted-foreground` |

### 3.4 用量条目列表

每页 5 条，每条格式：

```
┌──────────────────────────────────────────────────────┐
│  模型名称                    总 token 数    时间戳   │
│  ● 输入 1,234  ● 输出 5,678  ● 缓存读取 999         │
│  ● 缓存写入 100               费用 $0.0123           │
│                                       [查看内容]     │
└──────────────────────────────────────────────────────┘
```

#### 3.4.1 条目卡片样式
- 容器：`rounded-2xl bg-transparent border border-black/10 dark:border-white/10 p-5`
- Hover：`hover:bg-black/5 dark:hover:bg-white/5 transition-colors`
- 有内容可查看时：`cursor-pointer`

#### 3.4.2 条目字段

| 字段 | 中文格式 | 颜色/样式 | i18n key |
|------|------|------|------|
| 模型名 | 如 `claude-3.5-sonnet` | `font-medium text-sm truncate` | — |
| 未知模型 | **未知模型** | `text-muted-foreground italic` | `dashboard:recentTokenHistory.unknownModel` |
| 总 token | 如 `12,345` | 根据 usageStatus 变色（见下表） | — |
| 时间戳 | 如 `4月 11 14:30` | `text-xs text-muted-foreground` | — |
| 输入 | **输入 1,234** | 天蓝圆点 `bg-sky-500` | `dashboard:recentTokenHistory.input` |
| 输出 | **输出 5,678** | 紫色圆点 `bg-violet-500` | `dashboard:recentTokenHistory.output` |
| 缓存读取 | **缓存读取 999** | 琥珀圆点 `bg-amber-500` | `dashboard:recentTokenHistory.cacheRead` |
| 缓存写入 | **缓存写入 100** | 琥珀圆点 `bg-amber-500` | `dashboard:recentTokenHistory.cacheWrite` |
| 费用 | **费用 $0.0123** | `text-foreground/80 bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-md` | `dashboard:recentTokenHistory.cost` |
| 查看内容 | **查看内容** | `text-blue-500 hover:text-blue-600` | `dashboard:recentTokenHistory.viewContent` |

**总 token 数颜色根据 usageStatus：**

| usageStatus | CSS class | 视觉 |
|------|------|------|
| `available` | `text-foreground` | 正常前景色 |
| `missing` | `text-amber-500` | 琥珀色 + 显示 `?` 代替数字 |
| `error` | `text-red-500` | 红色 + 显示 `!` 代替数字 |

**"查看内容" 按钮条件：**
- 仅当 `devModeUnlocked === true` **且** `entry.content` 存在时显示

### 3.5 分页控件

```
[◀ 上一页]    第 1 / 3 页    [下一页 ▶]
```

| 元素 | 中文 | 图标 | 禁用条件 | i18n key |
|------|------|------|------|------|
| 上一页 | **上一页** | `ChevronLeft` | 第 1 页时 | `dashboard:recentTokenHistory.prev` |
| 页码 | **第 1 / 3 页** | — | — | `dashboard:recentTokenHistory.page` |
| 下一页 | **下一页** | `ChevronRight` | 最后一页时 | `dashboard:recentTokenHistory.next` |

按钮样式：`ghost` variant, `text-sm`, 禁用时 `opacity-50 cursor-not-allowed`

### 3.6 用量详情弹窗（UsageContentPopup）

触发条件：在 devMode 下点击条目或"查看内容"按钮

```
┌─────────────────────────────────────┐
│  用量明细内容                   [X]  │
│─────────────────────────────────────│
│  模型：claude-3.5-sonnet            │
│  时间：4月 11 14:30                 │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ {原始 JSON 内容}             │   │
│  │ font-mono 等宽字体显示       │   │
│  └─────────────────────────────┘   │
│                                     │
│              [关闭]                 │
└─────────────────────────────────────┘
```

| 元素 | 中文 | i18n key |
|------|------|------|
| 标题 | **用量明细内容** | `dashboard:recentTokenHistory.contentDialogTitle` |
| 关闭按钮(头部) | `X` 图标 | — |
| 关闭按钮(底部) | **关闭** | `dashboard:recentTokenHistory.close` |
| 未知模型 | **未知模型** | `dashboard:recentTokenHistory.unknownModel` |

**弹窗样式：**
- 覆盖层：`fixed inset-0 z-50 bg-black/50 flex items-center justify-center`
- 内容框：`bg-background rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh]`
- 内容区域：`overflow-y-auto font-mono text-xs whitespace-pre-wrap`
- 关闭按钮响应：点击 X、点击底部"关闭"、按 Escape 键

### 3.7 特殊状态

#### 3.7.1 加载状态
| 属性 | 值 |
|------|------|
| 组件 | `FeedbackState` (state='loading') |
| 图标 | `Loader2 h-6 w-6 animate-spin text-primary` |
| 文字 | **正在加载 token 消耗历史...** |
| i18n key | `dashboard:recentTokenHistory.loading` |

#### 3.7.2 空状态（全局无数据）
| 属性 | 值 |
|------|------|
| 组件 | `FeedbackState` (state='empty') |
| 图标 | `Inbox text-muted-foreground` |
| 文字 | **还没有 token 消耗历史** |
| i18n key | `dashboard:recentTokenHistory.empty` |

#### 3.7.3 空状态（时间窗口内无数据）
| 属性 | 值 |
|------|------|
| 文字 | **当前时间范围内没有 token 消耗历史** |
| i18n key | `dashboard:recentTokenHistory.emptyForWindow` |

#### 3.7.4 网关未运行
| 属性 | 值 |
|------|------|
| 文字 | **无用量数据** |
| i18n key | `dashboard:recentTokenHistory.noUsage` |

#### 3.7.5 解析错误
| 属性 | 值 |
|------|------|
| 文字 | **用量解析失败** |
| i18n key | `dashboard:recentTokenHistory.usageParseError` |

---

## 4. 数据流与后端 API

### 4.1 提供商相关 API

| 方法 | 端点 | 用途 |
|------|------|------|
| GET | `/api/providers` | 获取提供商状态列表 |
| GET | `/api/provider-accounts` | 获取账户列表 |
| GET | `/api/provider-vendors` | 获取供应商元数据 |
| GET | `/api/provider-accounts/default` | 获取默认账户 ID |
| POST | `/api/provider-accounts` | 创建新账户 |
| PUT | `/api/provider-accounts/{id}` | 更新账户 |
| DELETE | `/api/provider-accounts/{id}` | 删除账户 |
| PUT | `/api/provider-accounts/default` | 设置默认 |
| POST | `/api/providers/validate` | 验证 API Key |
| GET | `/api/providers/{id}/api-key` | 获取 API Key |
| POST | `/api/providers/oauth/start` | 开始 OAuth 流程 |
| POST | `/api/providers/oauth/cancel` | 取消 OAuth |
| POST | `/api/providers/oauth/submit` | 提交手动授权码 |

### 4.2 Token 用量 API

| 方法 | 端点 | 用途 |
|------|------|------|
| GET | `/api/usage/recent-token-history` | 获取最近 token 使用记录 |

### 4.3 自动刷新机制

| 参数 | 值 |
|------|------|
| 自动刷新间隔 | `15,000ms`（15 秒） |
| 最大重试次数 | `2`（非 Windows）/ `3`（Windows） |
| 重试间隔 | `1,500ms` |
| 安全超时 | `30,000ms` |
| 刷新触发 | 定时器 / 窗口获得焦点 / 文档可见性变化 |

### 4.4 隐藏的数据源
以下来源的条目会被自动过滤不显示：
- `gateway-injected`
- `delivery-mirror`

### 4.5 Zustand Store 状态结构

```typescript
ProviderState {
  statuses: ProviderWithKeyInfo[]     // 所有提供商的 key 状态
  accounts: ProviderAccount[]          // 所有账户
  vendors: ProviderVendorInfo[]        // 供应商元数据（11+1 个）
  defaultAccountId: string | null      // 默认账户 ID
  loading: boolean                     // 是否正在加载
  error: string | null                 // 错误信息
}
```

---

## 5. 完整 i18n 翻译键清单

### 5.1 dashboard.json（模型页面专用）

| key | 中文 | 英文 |
|------|------|------|
| `models.title` | 模型 | Models |
| `models.subtitle` | 管理您的 AI 提供商并监控 Token 用量 | Manage your AI providers and monitor token usage. |
| `recentTokenHistory.title` | 最近 Token 消耗 | Token Usage History |
| `recentTokenHistory.loading` | 正在加载 token 消耗历史... | Loading... |
| `recentTokenHistory.empty` | 还没有 token 消耗历史 | No usage data |
| `recentTokenHistory.emptyForWindow` | 当前时间范围内没有 token 消耗历史 | No data in this time window |
| `recentTokenHistory.groupByModel` | 按模型 | By Model |
| `recentTokenHistory.groupByTime` | 按时间 | By Time |
| `recentTokenHistory.last7Days` | 7 天 | Last 7 Days |
| `recentTokenHistory.last30Days` | 30 天 | Last 30 Days |
| `recentTokenHistory.allTime` | 全部 | All Time |
| `recentTokenHistory.showingLast` | 共 {{count}} 条记录 | Showing last {{count}} |
| `recentTokenHistory.totalTokens` | 总 token | Total Tokens |
| `recentTokenHistory.inputShort` | 输入 | Input |
| `recentTokenHistory.outputShort` | 输出 | Output |
| `recentTokenHistory.cacheShort` | 缓存 | Cache |
| `recentTokenHistory.page` | 第 {{current}} / {{total}} 页 | Page {{current}} / {{total}} |
| `recentTokenHistory.prev` | 上一页 | Previous |
| `recentTokenHistory.next` | 下一页 | Next |
| `recentTokenHistory.unknownModel` | 未知模型 | Unknown Model |
| `recentTokenHistory.input` | 输入 {{value}} | Input {{value}} |
| `recentTokenHistory.output` | 输出 {{value}} | Output {{value}} |
| `recentTokenHistory.cacheRead` | 缓存读取 {{value}} | Cache Read {{value}} |
| `recentTokenHistory.cacheWrite` | 缓存写入 {{value}} | Cache Write {{value}} |
| `recentTokenHistory.cost` | 费用 ${{amount}} | Cost ${{amount}} |
| `recentTokenHistory.viewContent` | 查看内容 | View content |
| `recentTokenHistory.contentDialogTitle` | 用量明细内容 | Usage Details |
| `recentTokenHistory.close` | 关闭 | Close |
| `recentTokenHistory.noUsage` | 无用量数据 | No usage data available |
| `recentTokenHistory.usageParseError` | 用量解析失败 | Failed to parse usage data |

### 5.2 settings.json（提供商管理专用 — 仅列出 aiProviders 命名空间）

| key | 中文 |
|------|------|
| `aiProviders.title` | AI 模型提供商 |
| `aiProviders.description` | 配置 AI 模型提供商和 API 密钥 |
| `aiProviders.add` | 添加提供商 |
| `aiProviders.custom` | 自定义 |
| `aiProviders.notRequired` | 非必填 |
| `aiProviders.sections.model` | 模型配置 |
| `aiProviders.sections.fallback` | 回退配置 |
| `aiProviders.empty.title` | 未配置提供商 |
| `aiProviders.empty.desc` | 添加 AI 提供商以开始使用 OpenAGI |
| `aiProviders.empty.cta` | 添加您的第一个提供商 |
| `aiProviders.dialog.title` | 添加 AI 提供商 |
| `aiProviders.dialog.desc` | 配置新的 AI 模型提供商 |
| `aiProviders.dialog.displayName` | 显示名称 |
| `aiProviders.dialog.apiKey` | API 密钥 |
| `aiProviders.dialog.apiKeyConfigured` | 这个 provider 已经保存了 API key。 |
| `aiProviders.dialog.apiKeyMissing` | 这个 provider 还没有保存 API key。 |
| `aiProviders.dialog.apiKeyStored` | 您的 API 密钥存储在本地机器上。 |
| `aiProviders.dialog.replaceApiKey` | 替换 API Key |
| `aiProviders.dialog.replaceApiKeyHelp` | 如果想保留当前已保存的 API key，这里留空即可。 |
| `aiProviders.dialog.baseUrl` | 基础 URL |
| `aiProviders.dialog.modelId` | 模型 ID |
| `aiProviders.dialog.protocol` | 协议 |
| `aiProviders.dialog.codePlanPreset` | Code Plan 预设 |
| `aiProviders.dialog.codePlanMode` | Code Plan |
| `aiProviders.dialog.codePlanPresetDesc` | Code Plan 使用 https://ark.cn-beijing.volces.com/api/coding/v3 与模型 ark-code-latest... |
| `aiProviders.dialog.codePlanDoc` | Code Plan 文档 |
| `aiProviders.dialog.advancedConfig` | 高级配置 |
| `aiProviders.dialog.userAgent` | User-Agent |
| `aiProviders.dialog.userAgentPlaceholder` | OpenAGI/1.0 |
| `aiProviders.dialog.fallbackModels` | 回退模型 |
| `aiProviders.dialog.fallbackProviders` | 跨 Provider 回退 |
| `aiProviders.dialog.fallbackModelIds` | 同 Provider 回退模型 ID |
| `aiProviders.dialog.fallbackModelIdsPlaceholder` | gpt-4.1-mini\nanother-model-id |
| `aiProviders.dialog.fallbackModelIdsHelp` | 每行一个模型 ID... |
| `aiProviders.dialog.noFallbackOptions` | 请先添加其他 provider... |
| `aiProviders.dialog.cancel` | 取消 |
| `aiProviders.dialog.change` | 更换提供商 |
| `aiProviders.dialog.add` | 添加提供商 |
| `aiProviders.dialog.save` | 保存 |
| `aiProviders.dialog.customDoc` | 查看文档 |
| `aiProviders.dialog.validate` | 验证 |
| `aiProviders.authModes.apiKey` | API 密钥 |
| `aiProviders.authModes.oauthDevice` | OAuth 设备登录 |
| `aiProviders.authModes.oauthBrowser` | OAuth 浏览器登录 |
| `aiProviders.authModes.local` | 本地 |
| `aiProviders.card.default` | 默认 |
| `aiProviders.card.configured` | 已配置 |
| `aiProviders.card.noKey` | 未设置 API 密钥 |
| `aiProviders.card.none` | 无 |
| `aiProviders.card.fallbacks_one` | 回退：{{names}} |
| `aiProviders.card.fallbacks_other` | 回退（{{count}} 个）：{{names}} |
| `aiProviders.card.setDefault` | 设为默认 |
| `aiProviders.card.editKey` | 编辑 API 密钥 |
| `aiProviders.card.delete` | 删除提供商 |
| `aiProviders.protocols.openaiCompletions` | OpenAI Completions |
| `aiProviders.protocols.openaiResponses` | OpenAI Responses |
| `aiProviders.protocols.anthropic` | Anthropic 兼容 |
| `aiProviders.toast.added` | 提供商添加成功 |
| `aiProviders.toast.failedAdd` | 添加提供商失败 |
| `aiProviders.toast.deleted` | 提供商已删除 |
| `aiProviders.toast.failedDelete` | 删除提供商失败 |
| `aiProviders.toast.defaultUpdated` | 默认提供商已更新 |
| `aiProviders.toast.failedDefault` | 设置默认失败 |
| `aiProviders.toast.updated` | 提供商已更新 |
| `aiProviders.toast.failedUpdate` | 更新提供商失败 |
| `aiProviders.toast.invalidKey` | 无效的 API 密钥 |
| `aiProviders.toast.modelRequired` | 需要模型 ID |
| `aiProviders.toast.minimaxConflict` | 不能同时添加 MiniMax 国际站和国内站... |
| `aiProviders.oauth.loginMode` | OAuth 登录 |
| `aiProviders.oauth.apikeyMode` | API 密钥 |
| `aiProviders.oauth.loginPrompt` | 此提供商需要通过浏览器登录授权。 |
| `aiProviders.oauth.loginButton` | 浏览器登录 |
| `aiProviders.oauth.getApiKey` | 获取 API 密钥 |
| `aiProviders.oauth.waiting` | 等待中... |
| `aiProviders.oauth.openLoginPage` | 打开登录页面 |
| `aiProviders.oauth.waitingApproval` | 等待浏览器中的授权... |
| `aiProviders.oauth.cancel` | 取消 |
| `aiProviders.oauth.codeCopied` | 代码已复制到剪贴板 |
| `aiProviders.oauth.authFailed` | 认证失败 |
| `aiProviders.oauth.browserFlowUnavailable` | 该提供商的浏览器 OAuth 登录链路暂未接通。 |
| `aiProviders.oauth.tryAgain` | 重试 |
| `aiProviders.oauth.approveLogin` | 确认登录 |
| `aiProviders.oauth.step1` | 复制下方的授权码。 |
| `aiProviders.oauth.step2` | 在浏览器中打开登录页面。 |
| `aiProviders.oauth.step3` | 粘贴授权码以批准访问。 |
| `aiProviders.oauth.requestingCode` | 正在获取安全登录码... |
| `aiProviders.overview.title` | 提供商账户 |
| `aiProviders.overview.description` | 这里汇总当前已配置的 provider 账户与模型信息。 |
| `aiProviders.overview.noModelSelected` | 未选择模型 |
| `aiProviders.overview.multiAccountReady` | 支持多账户 |
| `aiProviders.overview.singletonVendor` | 单例提供商 |

---

## 6. 响应式断点与布局

| 断点 | 影响 |
|------|------|
| 默认（移动端） | 标题 text-5xl，提供商 grid 2 列，表单垂直堆叠 |
| `md`（768px+） | 标题 text-6xl，提供商 grid 3 列 |
| 内容最大宽度 | `max-w-4xl mx-auto` |

---

## 7. 键盘交互与无障碍

| 交互 | 行为 |
|------|------|
| Escape 键 | 关闭 AddProviderDialog、关闭 UsageContentPopup |
| Tab 键 | 正常焦点导航 |
| 确认对话框 | 删除提供商时弹出 ConfirmDialog，Cancel 自动聚焦 |

---

## 8. 暗黑模式颜色对照表

| 元素 | 浅色 | 暗黑 |
|------|------|------|
| 页面背景 | 默认 | `dark:bg-background` |
| 卡片背景 | `bg-black/[0.04]` | `dark:bg-white/[0.06]` |
| 卡片 Hover | `bg-black/5` | `dark:bg-white/5` |
| 输入框背景 | `bg-[#eeece3]` | `dark:bg-muted` |
| 输入框边框 | `border-black/10` | `dark:border-white/10` |
| 图标圆圈背景 | `bg-black/5` | `dark:bg-white/5` |
| 图标圆圈边框 | `border-black/5` | `dark:border-white/10` |
| Toggle 选中 | `bg-black/5` | `dark:bg-white/10` |
| 费用标签 | `bg-black/5` | `dark:bg-white/5` |
| 覆盖层 | `bg-black/50` | `bg-black/50` |
| SVG Logo | 原色 | `dark:invert` 反色 |

---

## 9. 动画与过渡

| 元素 | 动画 |
|------|------|
| 加载 Spinner | `Loader2` + `animate-spin` |
| 回退展开箭头 | `ChevronDown` + `transition-transform rotate-180` |
| 卡片 Hover | `transition-colors` |
| OAuth 等待 | 背景 pulse 动画 |
| 按钮 Hover | `transition-all` / `transition-colors` |
| 弹窗出现 | 无动画（直接显示） |

---

## 10. 完整用户操作路径

### 10.1 添加新提供商（API Key 模式）
1. 点击 **➕ 添加提供商** → 弹出 AddProviderDialog
2. 在 Grid 中选择提供商类型（如 Anthropic）
3. 表单出现：填写显示名称、API 密钥
4. 点击 **添加提供商** → 验证 key → POST 创建 → Toast "提供商添加成功"
5. 对话框关闭，卡片列表刷新

### 10.2 添加新提供商（OAuth 模式）
1. 选择支持 OAuth 的提供商（如 OpenAI）
2. 点击 **OAuth 登录** tab
3. 点击 **浏览器登录** → 弹出浏览器授权页
4. 显示设备码（可复制）→ 等待用户在浏览器中授权
5. 授权成功 → Toast 成功 → 对话框关闭

### 10.3 编辑提供商
1. Hover 卡片 → 显示操作按钮
2. 点击 ✏️ Edit → 卡片展开编辑表单
3. 修改字段（Base URL / 模型 ID / API Key / 回退配置）
4. 点击 ✓ 保存 → 验证 → PUT 更新 → Toast "提供商已更新"

### 10.4 删除提供商
1. Hover 卡片 → 点击 🗑️ Delete
2. 弹出 ConfirmDialog → Cancel 按钮自动聚焦
3. 确认删除 → DELETE API → Toast "提供商已删除"

### 10.5 设为默认提供商
1. Hover 卡片 → 点击 ✓ Set Default
2. PUT /api/provider-accounts/default → Toast "默认提供商已更新"
3. 卡片显示"默认"徽章

### 10.6 查看 Token 用量
1. 页面加载时自动拉取用量数据（网关运行中）
2. 切换分组：点击 **按模型** / **按时间**
3. 切换时间窗口：**7 天** / **30 天** / **全部**
4. 柱状图和列表实时更新
5. 翻页：**上一页** / **下一页**
6. Dev 模式下点击条目 → 弹出 UsageContentPopup 查看原始内容

---

*本文档由代码源文件逐行分析生成，覆盖 Models 页面 100% 的可见元素、交互逻辑、数据流和样式。作为基准案例，验证通过后将以同标准复刻全站其他页面。*
