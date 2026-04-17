# Models + Agents 精确思维导图

> 本文件是 master-sitemap-v2.md 的子模块，修改本文件中的任何文字即可精确定位代码修改位置。

---

## Models 页面 (/models)

**文件**: `src/pages/Models/index.tsx`

```
Models 页面
├── 标题: t('models.title') — Georgia serif text-5xl/6xl
├── 副标题: t('models.subtitle')
│
├── ═══ AI Providers 部分 (ProvidersSettings组件) ═══
│   │
│   ├── 标题: "AI Providers" (text-2xl serif)
│   ├── [+ 添加] 按钮: t('aiProviders.add') rounded-full px-5 h-9
│   │
│   ├── 加载状态: Loader2 animate-spin + py-12 bg-black/5 rounded-3xl
│   │
│   ├── 空状态:
│   │   ├── 图标: Key (h-12 w-12 opacity-50)
│   │   ├── 标题: t('aiProviders.empty.title')
│   │   ├── 描述: t('aiProviders.empty.desc')
│   │   └── 按钮: t('aiProviders.empty.cta') bg-[#0a84ff] rounded-full px-6 h-10
│   │
│   └── Provider卡片列表 (每卡):
│       ├── 图标: 提供商Logo (h-[42px] w-[42px])
│       ├── 名称: account.label (text-[15px] font-semibold)
│       ├── 默认Badge: Check图标 + t('aiProviders.card.default') text-[10px] font-mono
│       ├── 元数据: vendor.name · authMode · model
│       ├── 状态指示: 绿点"已配置" / 红点"API Key 缺失"
│       │
│       ├── 悬停按钮 (opacity-0 → group-hover:opacity-100):
│       │   ├── [设为默认] Check图标 h-8 w-8 → hover:text-blue-600
│       │   ├── [编辑] Edit图标 h-8 w-8
│       │   └── [删除] Trash2图标 h-8 w-8 → hover:text-destructive
│       │
│       └── 编辑模式展开:
│           ├── 文档链接: t('aiProviders.dialog.customDoc') ExternalLink text-blue-500
│           ├── Base URL: label=t('aiProviders.dialog.baseUrl') placeholder动态
│           ├── Model ID: label=t('aiProviders.dialog.modelId')
│           ├── Protocol选择 (custom时): "OpenAI Completions" / "OpenAI Responses" / "Anthropic"
│           ├── User Agent: label=t('aiProviders.dialog.userAgent')
│           ├── Fallback折叠:
│           │   ├── 标题: t('aiProviders.sections.fallback')
│           │   ├── Fallback Model IDs: textarea, placeholder=t('...fallbackModelIdsPlaceholder')
│           │   └── Fallback Providers: checkbox列表
│           └── API Key:
│               ├── 状态: t('apiKeyConfigured') / t('apiKeyMissing')
│               ├── 获取链接: t('aiProviders.oauth.getApiKey') ExternalLink
│               ├── Input: type=password, Eye/EyeOff切换
│               ├── [✓确认] Check green | [✗取消] X
│               └── 帮助: t('aiProviders.dialog.replaceApiKeyHelp') text-[12px]
│
├── ═══ 添加Provider弹窗 ═══
│   │  (fixed inset-0 z-50 bg-black/50, Card max-w-2xl rounded-3xl)
│   │
│   ├── Header:
│   │   ├── 标题: t('aiProviders.dialog.title') text-2xl serif
│   │   ├── 描述: t('aiProviders.dialog.desc') text-[15px]
│   │   └── [X关闭] h-8 w-8 rounded-full
│   │
│   ├── 选择网格 (grid-cols-2 md:grid-cols-3):
│   │   └── 11个提供商按钮 (p-4 rounded-2xl):
│   │       每个: 图标(h-12 w-12) + 名称(text-[13px])
│   │
│   └── 配置表单 (选择后):
│       ├── 面包屑: 图标+名称 + "Change"链接(text-blue-500)
│       ├── 显示名称: label=t('aiProviders.dialog.displayName')
│       ├── Auth切换: "OAuth" / "API Key" (条件显示)
│       ├── API Key: type=password, Eye/EyeOff, placeholder动态
│       │   └── 帮助: t('aiProviders.dialog.apiKeyStored') text-[12px]
│       ├── Base URL / Model ID / Protocol (条件)
│       ├── OAuth流程 (条件):
│       │   ├── 登录提示: t('aiProviders.oauth.loginPrompt') bg-blue-500/10
│       │   ├── 按钮: t('aiProviders.oauth.loginButton') bg-[#0a84ff] h-[42px]
│       │   ├── 设备码: font-mono text-3xl tracking-[0.2em]
│       │   ├── 步骤: t('oauth.step1/2/3')
│       │   └── 等待: Loader2 + t('oauth.waitingApproval')
│       └── [Add] bg-[#0a84ff] rounded-full px-8 h-[42px]
│
└── ═══ Token Usage History 部分 ═══
    ├── 标题: t('recentTokenHistory.title') text-3xl serif
    ├── 工具栏:
    │   ├── 分组: [按模型] / [按时间] (rounded-xl border p-1)
    │   ├── 时间: [7天] / [30天] / [全部]
    │   └── 统计: t('showingLast', {count}) text-[13px]
    │
    ├── 图例: 🔵输入 🟣输出 🟠缓存 (text-[13px])
    │
    ├── 柱状图 (UsageBarChart):
    │   └── 每行: 标签 + 总量 + 进度条(sky-500/violet-500/amber-500)
    │
    ├── 条目列表 (5条/页):
    │   └── 每条 (rounded-2xl border p-5):
    │       ├── 模型名(text-[15px] font-semibold) + 元数据(provider·agent·session)
    │       ├── 总量(text-[15px] font-bold) + 时间戳(text-[12px])
    │       ├── 明细: 🔵输入 🟣输出 🟠缓存读 🟠缓存写
    │       └── 费用Badge: "$X.XXXX" bg-black/5 rounded-md
    │
    ├── 分页: t('page', {current, total}) + [上一页] ChevronLeft + [下一页] ChevronRight
    │
    └── 空/加载/无数据状态:
        ├── 加载: t('recentTokenHistory.loading')
        ├── 空: t('recentTokenHistory.empty')
        └── 窗口空: t('recentTokenHistory.emptyForWindow')
```

---

## Agents 页面 (/agents)

**文件**: `src/pages/Agents/index.tsx`

```
Agents 页面
├── 标题: t('title') Georgia serif text-5xl/6xl
├── 副标题: t('subtitle') text-[17px]
├── [刷新] RefreshCw + t('refresh') rounded-full h-9
├── [+ 添加智能体] Plus + t('addAgent') rounded-full h-9
│
├── 网关警告 (条件: !running):
│   └── AlertCircle yellow + t('gatewayWarning')
│       border-yellow-500/50 bg-yellow-500/10
│
├── 错误提示 (条件: error):
│   └── AlertCircle red + {error} border-destructive/50 bg-destructive/10
│
├── Agent卡片列表:
│   └── 每卡 (p-4 rounded-2xl hover:bg-black/5):
│       ├── 图标: Bot (22×22) text-primary bg-primary/10 (46×46 rounded-full)
│       ├── 名称: text-[16px] font-semibold
│       ├── 默认Badge: Check + t('defaultBadge') text-[10px] font-mono
│       ├── Model行: t('modelLine', {model, suffix}) — suffix="(继承)"
│       ├── Channels行: t('channelsLine', {channels}) — "Type·Account, ..."
│       │
│       ├── [⚙设置] Settings2 h-7 w-7 → AgentSettingsModal
│       └── [🗑删除] Trash2 h-7 w-7 hover:text-destructive (仅非默认)
│           └── 确认: t('actions.confirm') / t('actions.delete')
│
├── ═══ 添加Agent弹窗 (AddAgentDialog) ═══
│   │  (max-w-md rounded-3xl bg-[#f3f1e9])
│   ├── 标题: t('createDialog.title') text-2xl serif
│   ├── 描述: t('createDialog.description')
│   ├── 名称: label=t('createDialog.nameLabel')
│   │   └── placeholder=t('createDialog.namePlaceholder') h-[44px] font-mono
│   ├── 继承: label=t('createDialog.inheritWorkspaceLabel')
│   │   └── 描述=t('createDialog.inheritWorkspaceDescription') + Switch
│   └── [取消] / [保存] (disabled: saving || !name)
│
├── ═══ Agent设置弹窗 (AgentSettingsModal) ═══
│   │  (max-w-2xl max-h-[90vh] rounded-3xl bg-[#f3f1e9])
│   ├── 标题: t('settingsDialog.title', {name}) text-2xl serif
│   ├── 描述: t('settingsDialog.description')
│   ├── [X关闭] h-8 w-8 rounded-full
│   │
│   ├── 名称编辑: Input h-[44px] (readOnly: isDefault) + [Save]
│   ├── 信息卡 (grid md:grid-cols-2):
│   │   ├── Agent ID: text-[11px] uppercase + font-mono
│   │   └── Model (可点击→ModelModal):
│   │       ├── 显示名 + "(继承)"
│   │       └── modelRef font-mono text-[12px]
│   │
│   ├── Channels部分:
│   │   ├── 标题: t('settingsDialog.channelsTitle') text-xl serif
│   │   ├── 描述: t('settingsDialog.channelsDescription')
│   │   ├── 空: t('settingsDialog.noChannels') border-dashed
│   │   └── 列表: Logo(40×40) + "Type·Account" + error(text-destructive)
│   │
│   └── 未保存确认: t('unsavedChangesTitle') / t('closeWithoutSaving')
│
└── ═══ Model选择弹窗 (AgentModelModal) ═══
    │  (z-[60] max-w-xl rounded-3xl bg-[#f3f1e9])
    ├── 标题: t('settingsDialog.modelLabel') text-2xl serif
    ├── 描述: t('modelOverrideDescription', {defaultModel})
    ├── Provider下拉: placeholder=t('modelProviderPlaceholder') h-[44px] font-mono
    ├── Model ID: placeholder动态 h-[44px] font-mono
    ├── 预览: t('modelPreview'): "{providerKey}/{modelId}" font-mono
    ├── 空提示: t('modelProviderEmpty') text-amber-600
    └── [Use Default] / [Cancel] / [Save]
```
