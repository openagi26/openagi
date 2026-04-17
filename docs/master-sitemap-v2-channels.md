# Channels 精确思维导图

> 修改本文件中的任何文字即可精确定位代码修改位置。

---

## Channels 页面 (/channels)

**文件**: `src/pages/Channels/index.tsx` + `src/components/channels/ChannelConfigModal.tsx`

```
Channels 页面
├── 标题: t('title') — "消息渠道" Georgia serif text-5xl/6xl
├── 副标题: t('subtitle') — "统一管理消息频道..." text-[17px]
├── [刷新] RefreshCw + "刷新" (disabled: !running)
│
├── 网关警告: AlertCircle yellow + "网关未运行。未启用网关时无法管理频道。"
├── 错误提示: AlertCircle red + {error}
│
├── ═══ 已配置频道 (configuredGroups.length > 0时) ═══
│   │
│   ├── 标题: "已配置频道" text-3xl serif
│   │
│   └── 每个频道组卡片 (rounded-2xl border-black/10 p-4):
│       ├── Logo: h-[40px] w-[40px] rounded-full bg-black/5 shadow-sm
│       │   └── 图像: w-[22px] h-[22px] dark:invert
│       ├── 名称: CHANNEL_NAMES[type] text-[16px] font-semibold
│       ├── 类型代码: channelType text-[12px] text-muted-foreground
│       ├── 状态灯 (w-2 h-2 rounded-full):
│       │   ├── connected:    bg-green-500
│       │   ├── connecting:   bg-yellow-500 animate-pulse
│       │   ├── error:        bg-destructive
│       │   └── disconnected: bg-muted-foreground
│       │
│       ├── [+ 添加账户] Plus + "添加账号" h-8 text-xs rounded-full
│       ├── [🗑删除] Trash2 h-7 w-7 hover:text-destructive
│       │
│       └── 账户列表 (每个 rounded-xl bg-black/5 px-3 py-2):
│           ├── 名称: "主账号"(default时) 或 account.name text-[13px]
│           ├── 错误: account.lastError text-[12px] text-destructive
│           ├── 绑定Agent下拉: "未绑定" + agents列表 h-8 text-xs
│           ├── [编辑] "编辑" outline h-8 text-xs rounded-full
│           └── [🗑删除] Trash2 h-7 w-7
│
├── ═══ 支持的频道 (grid 1/2列) ═══
│   │
│   ├── 标题: "支持的频道" text-3xl serif
│   │
│   └── 8个主频道按钮卡片 (p-4 rounded-2xl hover:bg-black/5):
│       ├── Logo: h-[46px] w-[46px] rounded-full
│       ├── 名称: text-[16px] font-semibold
│       ├── Plugin Badge: "插件" text-[10px] font-mono rounded-full (条件)
│       ├── 描述: text-[13.5px] line-clamp-2
│       ├── 连接类型: "二维码" 或 "令牌" text-[12px]
│       └── 已配置Badge: "已配置" bg-green-600 text-[10px] (条件)
│
├── ═══ 频道配置弹窗 (ChannelConfigModal) ═══
│   │  (max-w-3xl max-h-[90vh] rounded-3xl bg-[#f3f1e9])
│   │
│   ├── Header:
│   │   ├── 标题: "配置 {name}" / "更新 {name}" / "添加频道"
│   │   ├── 描述: meta.description / "更新您现有的配置" / "选择要配置的频道类型"
│   │   └── [X关闭]
│   │
│   ├── 状态1 — 类型选择 (grid 1/2列):
│   │   └── 同上频道按钮，但含已配置border-green-500/40
│   │
│   ├── 状态2 — QR码模式:
│   │   ├── QR图像: w-64 h-64 rounded-2xl bg-[#eeece3]
│   │   ├── 提示: "使用 {name} 扫描此二维码"
│   │   └── [刷新代码] outline rounded-full
│   │
│   ├── 状态3 — 加载中:
│   │   └── Loader2 + "正在加载配置..."
│   │
│   ├── 状态4 — Token表单:
│   │   ├── 已有配置提示: CheckCircle + "您已配置过此频道" bg-blue-500/10
│   │   ├── 说明框: "如何连接" + 文档按钮 + 步骤列表
│   │   ├── 频道名输入: label="频道名称" placeholder="我的 {name}"
│   │   ├── 账户ID输入: label="账号 ID" placeholder="feishu-sales-bot"
│   │   │   └── 帮助: "可自定义账号 ID，用于区分同一频道下的多个账号。"
│   │   ├── 动态配置字段 (ConfigField):
│   │   │   └── label + Input(h-[44px] font-mono) + 密码切换 + 描述 + envVar提示
│   │   ├── 验证结果:
│   │   │   ├── 成功: CheckCircle green + "凭证已验证"
│   │   │   └── 失败: AlertCircle red + "验证失败" + 错误列表
│   │   ├── [验证配置] ShieldCheck + "验证凭证" outline
│   │   └── [保存并连接] Check + "保存并连接" / "更新并重新连接" primary
│   │
│   └── 删除确认: "确定要删除该账号吗？" / "确定要删除此频道吗？"
│
└── ═══ 频道配置字段清单 ═══

    Telegram:
      botToken (password, required, env:TELEGRAM_BOT_TOKEN) "123456:ABC-DEF..."
      allowedUsers (text, required) "123456789, 987654321"

    Discord:
      token (password, required, env:DISCORD_BOT_TOKEN)
      guildId (text, required) "123456789012345678"
      channelId (text, optional) "123456789012345678"

    WhatsApp: QR模式, 无字段
    WeChat: QR模式, 无字段, Plugin

    DingTalk (Plugin):
      clientId, clientSecret(password), robotCode(opt), corpId(opt), agentId(opt)

    Feishu (Plugin):
      appId (env:FEISHU_APP_ID), appSecret (password, env:FEISHU_APP_SECRET)

    WeCom (Plugin):
      botId, secret(password)

    QQ Bot:
      appId, clientSecret(password)

    Signal: phoneNumber "+1234567890"
    iMessage: serverUrl, password(password)
    Matrix (Plugin): homeserver, accessToken(password)
    LINE (Plugin): channelAccessToken(password, env), channelSecret(password, env)
    MS Teams (Plugin): appId(env), appPassword(password, env)
    Google Chat: serviceAccountKey (webhook模式)
    Mattermost (Plugin): serverUrl, botToken(password)
```
