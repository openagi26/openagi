# Setup 页面 — 骨架树（去叶留枝版）

```
/setup
│
├── 顶部进度指示器（5 步骤圆点 + 连接线）
│   ├── 步骤圆点状态
│   │   ├── 已完成：✓ 勾号图标
│   │   ├── 当前：步骤编号（高亮）
│   │   └── 未到达：步骤编号（灰色）
│   └── 步骤列表
│       ├── 步骤0："欢迎使用 OpenAGI"
│       ├── 步骤1："环境检查"
│       ├── 步骤2："AI 提供商"
│       ├── 步骤3："设置中"
│       └── 步骤4："准备就绪！"
│
├── 步骤内容区（按当前步骤切换，带滑动动画）
│   │
│   ├── 步骤0：欢迎页（WelcomeContent）
│   │   ├── OpenAGI Logo 图标
│   │   ├── 标题："欢迎使用 OpenAGI"
│   │   ├── 描述文字：产品介绍段落
│   │   ├── 语言选择器（按钮组）
│   │   │   └── 遍历 SUPPORTED_LANGUAGES，当前语言高亮
│   │   └── 产品特性列表（✓图标）
│   │       ├── "无需命令行"
│   │       ├── "现代美观的界面"
│   │       ├── "预装技能包"
│   │       └── "跨平台支持"
│   │
│   ├── 步骤1：环境检查（RuntimeContent）
│   │   ├── 标题："检查环境"
│   │   ├── 操作按钮组（右上角）
│   │   │   ├── [查看日志] → 加载日志面板
│   │   │   └── [重新检查] → 重新执行三项检查
│   │   │
│   │   ├── 检查项列表（逐一显示状态）
│   │   │   ├── Node.js 运行时
│   │   │   │   ├── 检查中：旋转加载图标 + "检查中..."
│   │   │   │   ├── 成功：绿色✓ + "Node.js 可用"
│   │   │   │   └── 失败：红色✗ + 错误信息（超30字截断+Tooltip展开）
│   │   │   ├── OpenAGI 包
│   │   │   │   ├── 检查中：旋转加载图标
│   │   │   │   ├── 成功：绿色✓ + "OpenAGI 包已就绪 vX.X"
│   │   │   │   ├── 失败（包不存在）：红色✗ + 路径信息
│   │   │   │   ├── 失败（dist缺失）：红色✗ + 说明
│   │   │   │   └── 包路径说明（次要文字，等宽字体）
│   │   │   └── 网关服务
│   │   │       ├── 检查中：旋转加载图标 + "检查中..."
│   │   │       ├── 成功：绿色✓ + "运行在端口 {{port}}"
│   │   │       ├── 失败：红色✗ + 错误信息 + [启动网关] 按钮
│   │   │       └── 超时（600秒后）：红色✗ + "Gateway startup timed out"
│   │   │
│   │   ├── 环境问题警告框（Node.js 或 OpenAGI 包检查失败时显示）
│   │   │   ├── 标题："检测到环境问题"
│   │   │   └── 描述："请确保 OpenAGI 已正确安装。查看日志以获取详情。"
│   │   │
│   │   └── 日志面板（点击"查看日志"后展开）
│   │       ├── 标题："应用程序日志"
│   │       ├── [打开日志文件夹] → 在 Finder（访达）中显示
│   │       ├── [关闭] → 收起面板
│   │       └── 日志内容（最近100行，等宽字体，可滚动）
│   │           └── 无日志时："（暂无日志）"
│   │
│   ├── 步骤2：AI 提供商（ProviderContent）
│   │   ├── 提供商选择下拉框
│   │   │   ├── 标签："模型提供商"
│   │   │   ├── 占位文本："选择提供商..."（未选时）
│   │   │   ├── 已选显示：提供商图标 + 名称（+ 模型名，如有）
│   │   │   ├── [查看文档] 链接（选择提供商后显示，外链）
│   │   │   └── 下拉菜单列表（展开时）
│   │   │       └── 每个选项：提供商图标 + 名称 + 模型（如有） + ✓（当前选中）
│   │   │
│   │   └── 动态配置区（选择提供商后出现，带淡入动画）
│   │       │
│   │       ├── Ark Code Plan 预设切换（仅 ByteDance Ark）
│   │       │   ├── 标签："Code Plan 预设"
│   │       │   ├── [API Key] / [Code Plan] 模式切换按钮
│   │       │   ├── Code Plan 模式说明文字（仅 codeplan 模式显示）
│   │       │   └── [Code Plan 文档] 外链
│   │       │
│   │       ├── 基础 URL 输入框（showBaseUrl=true 的提供商显示）
│   │       │   ├── 标签："基础 URL"
│   │       │   └── 占位符根据协议变化（openai/anthropic 格式）
│   │       │
│   │       ├── 模型 ID 输入框（showModelIdField=true 的提供商显示）
│   │       │   ├── 标签："模型 ID"
│   │       │   ├── 占位符："e.g. deepseek-ai/DeepSeek-V3"
│   │       │   └── 说明文字："提供商的模型标识符（例如 deepseek-ai/DeepSeek-V3）"
│   │       │
│   │       ├── 协议选择（仅 Custom 提供商显示）
│   │       │   ├── 标签："协议"
│   │       │   ├── [OpenAI Completions]
│   │       │   ├── [OpenAI Responses]
│   │       │   └── [Anthropic 兼容]
│   │       │
│   │       ├── 认证方式切换（isOAuth && supportsApiKey 时显示）
│   │       │   ├── [OAuth 登录] tab
│   │       │   └── [API 密钥] tab
│   │       │
│   │       ├── API 密钥输入框（非 OAuth 流程，或选择"API 密钥"tab 时）
│   │       │   ├── 标签："API 密钥"
│   │       │   ├── 密码输入框（默认隐藏）
│   │       │   └── [眼睛图标] 切换显示/隐藏
│   │       │
│   │       ├── OAuth 流程区域（useOAuthFlow=true 时显示）
│   │       │   ├── 初始提示："此提供商需要通过浏览器登录授权。"
│   │       │   ├── [浏览器登录] 按钮（oauthFlowing 时禁用+显示"Waiting..."）
│   │       │   │
│   │       │   └── OAuth 进行中状态（oauthFlowing=true）
│   │       │       ├── 状态A：获取登录码中
│   │       │       │   └── 旋转加载图标 + "Requesting secure login code..."
│   │       │       │
│   │       │       ├── 状态B：设备码模式（mode=device）
│   │       │       │   ├── 标题："Approve Login"
│   │       │       │   ├── 步骤说明：
│   │       │       │   │   ├── "1. Copy the authorization code below."
│   │       │       │   │   ├── "2. Open the login page in your browser."
│   │       │       │   │   └── "3. Paste the code to approve access."
│   │       │       │   ├── 授权码显示框（大字等宽字体）+ [复制图标] → Toast "Code copied to clipboard"
│   │       │       │   ├── [Open Login Page] 按钮（外链）
│   │       │       │   ├── "Waiting for approval in browser..." + 旋转图标
│   │       │       │   └── [Cancel] → 取消 OAuth 流程
│   │       │       │
│   │       │       ├── 状态C：手动模式（mode=manual）
│   │       │       │   ├── 标题："Complete OpenAI Login"
│   │       │       │   ├── 说明文字（来自 oauthData.message 或默认提示）
│   │       │       │   ├── [Open Authorization Page] 按钮（外链）
│   │       │       │   ├── 回调URL/Code 输入框
│   │       │       │   ├── [Submit Code] 按钮（输入为空时禁用）
│   │       │       │   └── [Cancel]
│   │       │       │
│   │       │       └── 状态D：认证失败
│   │       │           ├── ✗ 图标 + "Authentication Failed"
│   │       │           ├── 错误信息文字
│   │       │           └── [Try Again] → 重置 OAuth 状态
│   │       │
│   │       ├── [验证并保存] / [保存] 按钮
│   │       │   ├── 验证中：旋转加载图标 + 禁用
│   │       │   ├── useOAuthFlow=true 时：按钮隐藏
│   │       │   └── 无选择提供商 / API Key 为空 / 模型ID为空时：禁用
│   │       │
│   │       ├── 验证结果提示（keyValid 有值时）
│   │       │   ├── 成功：绿色 "✓ 提供商配置成功"
│   │       │   └── 失败：红色 "✗ 无效的 API 密钥"
│   │       │
│   │       └── 安全提示文字："您的 API 密钥存储在本地机器上。"
│   │
│   ├── 步骤3：安装中（InstallingContent）
│   │   ├── 图标："⚙️"
│   │   ├── 标题："安装必要组件"
│   │   ├── 副标题："正在设置 AI 助手所需的工具"
│   │   │
│   │   ├── 进度条
│   │   │   ├── 标签："进度" + 百分比（0% → 100%）
│   │   │   └── 动态进度条（动画宽度变化）
│   │   │
│   │   ├── 技能安装列表（5项，可滚动）
│   │   │   └── 每项
│   │   │       ├── 技能名称 + 描述
│   │   │       ├── 状态图标
│   │   │       │   ├── 等待中：空心圆圈
│   │   │       │   ├── 安装中：旋转加载图标
│   │   │       │   ├── 已安装：绿色✓
│   │   │       │   └── 失败：红色✗
│   │   │       └── 状态文字："等待中" / "安装中..." / "已安装" / "失败"
│   │   │   └── 技能清单（5项）
│   │   │       ├── OpenCode — "AI 编程助手后端"
│   │   │       ├── Python 环境 — "技能所需的 Python 运行时"
│   │   │       ├── 代码辅助 — "代码分析与建议"
│   │   │       ├── 文件工具 — "文件操作与管理"
│   │   │       └── 终端 — "Shell 命令执行"
│   │   │
│   │   ├── 错误信息区（安装失败时显示）
│   │   │   ├── 标题："设置错误："
│   │   │   ├── 错误详情（等宽字体，可横向滚动）
│   │   │   └── [尝试重启应用] → window.location.reload()
│   │   │
│   │   ├── 等待提示（无错误时显示）："这可能需要一点时间..."
│   │   │
│   │   └── [跳过此步骤] 按钮 → 直接进入步骤4
│   │       （安装完成后自动延迟1秒跳转，不显示导航栏）
│   │
│   └── 步骤4：完成（CompleteContent）
│       ├── 庆祝图标："🎉"
│       ├── 标题："设置完成！"
│       ├── 副标题："OpenAGI 已配置并准备就绪。您现在可以开始与您的 AI 助手聊天了。"
│       │
│       ├── 配置汇总卡片（3行）
│       │   ├── "AI 提供商" → 提供商图标 + 名称（未选则显示 "—"）
│       │   ├── "组件" → 已安装技能名称列表（逗号分隔）或 "N 已安装"
│       │   └── "网关" → 运行中："✓ 运行中"（绿色）/ 其他状态显示状态名（黄色）
│       │
│       └── 底部说明文字："您可以在设置中自定义技能并连接渠道"
│
└── 底部导航栏（步骤3安装中时隐藏）
    ├── 左侧
    │   └── [返回] 按钮（非第一步时显示）
    └── 右侧
        ├── [跳过设置] 按钮（非最后步、非步骤1时显示）→ 标记安装完成 → 跳转 /
        └── [下一步 →] / [开始使用] 按钮
            ├── 步骤0（欢迎）：始终可点击
            ├── 步骤1（环境检查）：三项全部通过后可点击
            ├── 步骤2（提供商）：提供商配置成功后可点击
            └── 步骤4（完成）：文字变为"开始使用" → 标记安装完成 → 跳转 /
```

## 步骤流转图

```
步骤0 欢迎
  → [下一步] → 步骤1 环境检查
  → [跳过设置] → / (主页)

步骤1 环境检查
  → 三项全通过 → [下一步] 解锁 → 步骤2
  → 网关失败 → [启动网关] → 等待重试
  → [查看日志] → 展开日志面板
    → [打开日志文件夹] → Finder
    → [关闭] → 收起面板
  ※ 此步骤不显示"跳过设置"按钮

步骤2 AI 提供商
  → 选择提供商 → 展开配置区
  → OAuth 提供商 → [浏览器登录]
      → 等待设备码 → 展示授权码 + [复制] + [Open Login Page]
          → 用户在浏览器授权 → oauth:success → 自动标记已配置 → [下一步] 解锁
          → 失败 → [Try Again]
      → 手动模式 → [Open Authorization Page] + 粘贴回调URL → [Submit Code]
  → API Key 提供商 → 填写 Key → [验证并保存]
      → 验证通过 → Toast "提供商配置成功" → [下一步] 解锁
      → 验证失败 → Toast "无效的 API 密钥" / 错误信息
  → [跳过设置] → / (主页)

步骤3 安装中（自动执行，无导航栏）
  → 自动调用 uv:install-all
      → 成功 → 所有技能标为"已安装" → 进度100% → 延迟1秒 → 步骤4
      → 失败 → 显示错误 + [尝试重启应用]
  → [跳过此步骤] → 步骤4

步骤4 完成
  → [开始使用] → markSetupComplete() → Toast "设置完成！" → /
  → [返回] → 步骤3
```

## Toast 消息汇总

```
├── "提供商配置成功"（provider.valid）— API Key 验证通过 / OAuth 成功
├── "无效的 API 密钥"（provider.invalid）— 验证失败
├── "Configuration failed: ..."— 保存配置异常
├── "Environment setup failed"— uv:install-all 返回失败
├── "Installation error"— uv:install-all 抛出异常
├── "Code copied to clipboard"— 复制 OAuth 授权码
├── "设置完成！"（complete.title）— 最后一步点击"开始使用"
└── "不能同时添加 MiniMax 国际站和国内站的服务商。"（minimaxConflict）— 冲突检测
```

## 数据流骨架

```
环境检查
  → Node.js：在 Electron 中始终可用，直接标记 success
  → OpenAGI 包：IPC invokeIpc('openclaw:status') → 检查 packageExists + isBuilt
  → 网关：读取 useGatewayStore 实时状态
      → running → success
      → error → 失败 + [启动网关]
      → starting/reconnecting → 检查中（等待状态变更）
      → 600秒超时 → 强制标记失败

提供商配置
  → 页面加载：fetchProviderSnapshot() → 恢复已配置的提供商
  → 切换提供商：重置表单 + 加载已保存的 baseUrl / modelId / apiKey
  → API Key 流程：validateKey → POST /api/provider-accounts → PUT /api/provider-accounts/default
  → OAuth 流程：POST /api/providers/oauth/start → 监听 host events (oauth:code / oauth:success / oauth:error)
      → 成功：PUT /api/provider-accounts/default

安装流程（步骤3）
  → IPC invokeIpc('uv:install-all') → 安装 uv + Python 环境
  → 成功：onComplete(skillIds) → 父组件 setInstalledSkills → 1秒后 setCurrentStep(4)
  → 失败：显示错误 + 允许跳过

完成页
  → 展示已选提供商（从父组件 selectedProvider 传入）
  → 展示已安装技能列表（从父组件 installedSkills 传入）
  → 读取 useGatewayStore 显示网关状态
```
