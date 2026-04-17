# Skills + Cron 精确思维导图

> 修改本文件中的任何文字即可精确定位代码修改位置。

---

## Skills 页面 (/skills)

**文件**: `src/pages/Skills/index.tsx` (958行)

```
Skills 页面
├── 标题: "技能" Georgia serif text-5xl/6xl
├── 副标题: "浏览和管理 AI 能力"
├── [打开技能文件夹] FolderOpen (条件: hasInstalledSkills)
│
├── 搜索+导航区:
│   ├── 搜索框: placeholder="搜索技能..." Search图标 + X清除
│   ├── 过滤Tab: [全部({n})] / [内置({n})] / [市场({n})]
│   └── 操作:
│       ├── [启用可见] toast:"当前可见技能都已启用。"
│       ├── [禁用可见] toast:"当前可见技能都已禁用。"
│       ├── [安装技能] → 右侧Sheet
│       └── [刷新] RefreshCw (disabled: !running)
│
├── 网关警告 (延迟1500ms):
│   └── "网关未运行。没有活跃的网关，无法加载技能。" yellow
│
├── 技能列表 (行式):
│   └── 每个技能卡片:
│       ├── 图标: skill.icon || '🧩' (40×40 rounded-xl bg-black/5)
│       ├── 名称: text-[15px] font-semibold
│       │   ├── Lock图标 (isCore)
│       │   └── Puzzle图标 blue-500/70 (isBundled)
│       ├── Slug标签: font-mono text-[11px] (slug≠name时)
│       ├── 描述: text-[13.5px] line-clamp-1
│       ├── 来源Badge text-[10px]:
│       │   ├── "Bundled" / "Managed" / "Workspace"
│       │   ├── "Extra dirs" / "Personal .agents" / "Project .agents"
│       │   └── "Unknown source"
│       ├── 路径: font-mono text-[11px] truncate
│       ├── 版本: "v{version}" font-mono text-[13px]
│       └── Switch开关 (disabled: isCore)
│           └── toast: "技能已启用。" / "技能已禁用。"
│
├── 空状态:
│   ├── Puzzle图标 (40px opacity-50)
│   └── "未找到技能。" / "暂无可用技能。"
│
├── ═══ 技能详情面板 (右侧Sheet, max-w-[450px]) ═══
│   │  bg-[#f3f1e9]
│   ├── 图标: skill.icon||'🔧' (64×64 rounded-full) + Lock核心Badge
│   ├── 名称: text-[28px] serif
│   ├── Badge: "v{version}" + "核心系统"/"内置"/"用户安装"
│   ├── 描述: text-[14px] text-foreground/70
│   │
│   ├── 来源:
│   │   ├── Badge同上
│   │   ├── 路径Input(readOnly) + [复制路径]Copy + [打开文件夹]FolderOpen
│   │   └── toast: "路径已复制。"
│   │
│   ├── API密钥 (非Core):
│   │   ├── 标题: Key图标blue + "API 密钥"
│   │   ├── Input: type=password, placeholder="输入 API 密钥（可选）"
│   │   └── 帮助: "此技能的主要 API 密钥。如果不需要或在别处配置，请留空。"
│   │
│   ├── 环境变量 (非Core):
│   │   ├── 标题: "环境变量" + 数量Badge
│   │   ├── [+ 添加变量] Plus text-[12px]
│   │   ├── 空: "未配置环境变量。" bg-[#eeece3]
│   │   └── 变量行: Key(placeholder:"KEY") + Value(placeholder:"VALUE") + Trash2删除
│   │
│   ├── 外部链接 (非bundled非core):
│   │   ├── [ClawHub] Globe text-[11px]
│   │   └── [打开手册] FileCode text-[11px]
│   │
│   └── 底部:
│       ├── [保存配置] bg-[#0a84ff] h-[42px] text-[13px]
│       └── [卸载]/[启用]/[禁用] outline
│
└── ═══ 安装技能Sheet (右侧, max-w-[560px]) ═══
    ├── 标题: "安装技能" text-[24px] serif
    ├── 副标题: "默认展示 Explore，输入关键词后执行搜索。"
    ├── 搜索: placeholder="搜索市场..." + "来源: ClawHub"
    │
    ├── 搜索中: LoadingSpinner + "正在搜索 ClawHub..."
    ├── 搜索错误: "ClawHub 搜索失败。请检查您的连接或安装。"
    │
    ├── 结果列表:
    │   └── 每条: 📦图标 + 名称(+作者) + 描述 + 版本
    │       ├── 已安装: [卸载] Trash2 destructive
    │       └── 未安装: [Install] rounded-full
    │
    └── 空: Package图标 + "未找到匹配的技能。"/"搜索新技能以扩展您的能力。"
```

---

## Cron 页面 (/cron)

**文件**: `src/pages/Cron/index.tsx` (1095行)

```
Cron 页面
├── 标题: "定时任务" Georgia serif text-5xl/6xl
├── 副标题: "通过定时任务自动化 AI 工作流"
├── [刷新] RefreshCw + "刷新" (disabled: !running)
├── [+ 新建任务] Plus + "新建任务" (disabled: !running)
│
├── 网关警告: "网关未运行。没有活跃的网关，无法管理定时任务。"
├── 错误: {error}
│
├── 统计卡片 (grid-cols-2 md:grid-cols-4):
│   │  每卡: bg-black/5 rounded-[24px] min-h-[130px]
│   ├── [1] Clock text-primary bg-primary/10 | {total} | "任务总数"
│   ├── [2] Play text-green-600 bg-green-500/10 | {active} | "运行中"
│   ├── [3] Pause text-yellow-600 bg-yellow-500/10 | {paused} | "已暂停"
│   └── [4] XCircle text-destructive bg-destructive/10 | {failed} | "失败"
│
├── 空状态 (border-dashed rounded-3xl):
│   ├── Clock图标 (h-10 w-10 opacity-50)
│   ├── "暂无定时任务" text-[18px]
│   ├── "创建定时任务以自动化 AI 工作流。任务可以在指定时间发送消息、运行查询或执行操作。"
│   └── [创建第一个任务] Plus rounded-full
│
├── 任务卡片 (grid 1/2列, p-5 rounded-2xl hover:bg-black/5):
│   ├── 图标: Clock (46×46 bg-black/5 rounded-full)
│   ├── 名称: text-[16px] font-semibold
│   ├── 状态点 (2×2): 启用=bg-green-500 / 禁用=bg-muted-foreground
│   │   └── title: "运行中" / "已暂停"
│   ├── 调度: Timer图标 + parseCronSchedule() 中文
│   │   ├── "* * * * *"     → "每分钟"
│   │   ├── "*/5 * * * *"   → "每 5 分钟"
│   │   ├── "0 * * * *"     → "每小时"
│   │   ├── "0 9 * * *"     → "每天上午 9 点"
│   │   ├── "0 18 * * *"    → "每天下午 6 点"
│   │   ├── "0 9 * * 1"     → "每周（周一上午 9 点）"
│   │   └── "0 9 1 * *"     → "每月（1号上午 9 点）"
│   ├── 消息: MessageSquare + {message} line-clamp-2
│   ├── 投递: 通道图标 + 通道名 + 账号名 (条件)
│   ├── 上次: History + "上次运行: {relative}" + ✓green/✗red
│   ├── 下次: Calendar + "下次运行: {locale}"
│   ├── 错误: AlertCircle + {error} bg-destructive/10 (条件)
│   ├── Switch开关
│   │   └── toast: "任务已启用。" / "任务已暂停。"
│   └── 悬停操作:
│       ├── [▶ 立即运行] Play / Loader2 + "立即运行"
│       │   └── toast: "任务已成功触发。"
│       └── [🗑 删除] Trash2 + "删除" → 确认弹窗
│
├── ═══ 创建/编辑弹窗 (TaskDialog, max-w-lg rounded-3xl) ═══
│   │  bg-[#f3f1e9]
│   ├── 标题: "创建任务" / "编辑任务" text-[24px] serif
│   ├── 描述: "安排自动化的 AI 任务"
│   ├── [X关闭]
│   │
│   ├── 任务名: label="任务名称" placeholder="例如：早间简报" h-[44px] font-mono
│   │   └── 错误: "请输入任务名称。"
│   │
│   ├── 消息: label="消息/提示词" placeholder="AI 应该做什么？例如：给我一份今天的新闻和天气摘要"
│   │   └── 错误: "请输入消息。"
│   │
│   ├── 调度计划: label="调度计划"
│   │   ├── 预设 (2列, 8个按钮):
│   │   │   每分钟 / 每5分钟 / 每15分钟 / 每小时
│   │   │   每天上午9点 / 每天下午6点 / 每周(周一9am) / 每月(1号9am)
│   │   ├── 自定义: placeholder="Cron 表达式 (例如：0 9 * * *)" font-mono
│   │   ├── 预览: "下次运行: {time}" text-[12px]
│   │   └── 切换: "使用自定义 Cron" / "使用预设"
│   │
│   ├── 投递设置: label="投递设置"
│   │   ├── 描述: "选择仅在 OpenAGI 内保留结果，或把最终结果推送到外部通道。"
│   │   ├── [仅在 OpenAGI 内] "任务照常运行，结果只保留在应用内。"
│   │   ├── [发送到外部通道] "将最终结果投递到已配置的消息通道。"
│   │   └── 外部通道配置 (条件):
│   │       ├── 通道: label="通道" placeholder="选择通道"
│   │       │   └── 帮助: "无可用频道。请先添加频道。"
│   │       │   └── 不支持: "微信通道当前不支持定时任务主动投递..."
│   │       ├── 账号: label="发送账号" placeholder="选择账号"
│   │       └── 目标: label="接收目标" placeholder="选择接收目标"/"正在加载目标..."
│   │
│   ├── 启用: "立即启用" + "创建后立即开始运行此任务。" + Switch
│   │
│   └── [取消] / [创建任务]/[保存更改] h-[42px] rounded-full
│       └── toast: "任务已创建。" / "任务已更新。"
│
└── 删除确认: "确定要删除此任务吗？" → toast: "任务已删除。"
```
