# Sessions 页面 — 骨架树（去叶留枝版）

```
/sessions
│
├── 页面头部
│   ├── 标题："会话管理"
│   ├── 副标题："查看和管理所有会话 · N 个会话"（N = 会话总数，实时更新）
│   └── [刷新] 按钮（点击时图标旋转 + 触发拉取）
│
├── 搜索栏
│   └── 输入框
│       ├── 占位符："搜索会话（智能体名、渠道类型、会话 ID...）"
│       └── 实时过滤字段：key / agentName / channelType / displayName（不区分大小写）
│
├── 会话列表区
│   │
│   ├── 加载中状态（首次拉取时）
│   │   └── （列表为空，刷新图标旋转）
│   │
│   ├── 空状态（无搜索词 + 会话数=0）
│   │   └── 提示文字："暂无会话记录"
│   │
│   ├── 搜索无结果状态（有搜索词 + 过滤后为空）
│   │   └── 提示文字："没有匹配的会话"
│   │
│   └── 会话卡片列表（过滤后 ≥1 条时）
│       └── 每张卡片
│           ├── 图标区：MessageSquare 图标
│           ├── 会话名称：displayName（优先）或 key
│           ├── 状态徽章
│           │   ├── "活跃"（status=active）
│           │   ├── "空闲"（status=idle）
│           │   └── "已完成"（status=completed）
│           ├── 元信息行
│           │   ├── 智能体：agentName（优先）或 agentId
│           │   ├── 渠道类型：channelType（有值时显示）
│           │   ├── 消息数："N 条消息"
│           │   └── 最后活跃时间：lastActivityAt 本地化显示（无值时显示"未知"）
│           └── （仅 status=active 时）[终止] 按钮 → 弹出确认对话框
│
├── 终止会话确认对话框（点击"终止"后弹出）
│   ├── 标题："终止会话"
│   ├── 内容："确定要终止会话「会话名/key」吗？这将立即中断正在进行的对话。"
│   ├── [取消] 按钮 → 关闭对话框（不执行操作）
│   ├── [终止] 按钮（危险样式，destructive）→ 执行终止 API
│   │   └── 执行中：两个按钮均禁用
│   └── Escape 键 → 等同"取消"（执行中时无效）
│
└── Toast 消息（操作反馈，共 2 种）
    ├── 成功："会话 {名称/key} 已终止"
    └── 失败："终止失败: {错误信息}"
```

## 数据结构骨架

```
SessionInfo {
  key          — 会话唯一标识（用于 API 调用和显示回退）
  agentId      — 智能体 ID
  agentName    — 智能体名称（可选，优先显示）
  channelType  — 渠道类型（可选，有值时显示）
  status       — 'active' | 'idle' | 'completed'
  messageCount — 消息条数
  startedAt    — 会话开始时间
  lastActivityAt — 最后活跃时间（可选）
  displayName  — 显示名称（可选，优先于 key 显示）
}
```

## 数据流骨架

```
会话数据拉取
  → GET /api/gateway/sessions
  → 首次挂载立即拉取
  → 每 8 秒自动轮询刷新
  → [刷新] 按钮手动触发（强制 loading=true）
  → 拉取失败静默处理（不报错，列表保持上次状态）

终止会话流程
  → 点击卡片 [终止] → 设置 killTarget → 弹出确认对话框
  → 点击 [取消] → 清空 killTarget → 关闭对话框
  → 点击 [终止] → POST /api/gateway/sessions/{key}/kill
      → 成功：Toast 成功 + 重新拉取会话列表 + 清空 killTarget
      → 失败：Toast 失败（含错误信息）+ 清空 killTarget

搜索过滤
  → 纯前端过滤，无网络请求
  → 过滤范围：key / agentName / channelType / displayName
  → 实时响应（onChange）
```

## 状态机骨架

```
页面状态
  loading=true  → 首次拉取中（刷新图标旋转）
  loading=false + sessions=[]  → 空状态
  loading=false + sessions≥1  → 正常列表
  search 有值 + filtered=[]   → 搜索无结果状态

会话状态（每条记录独立）
  active    → 显示 [终止] 按钮
  idle      → 不显示 [终止] 按钮
  completed → 不显示 [终止] 按钮

确认对话框状态
  closed（killTarget=null）  → 不渲染
  open + confirming=false    → 两个按钮可点击
  open + confirming=true     → 两个按钮禁用、Escape 无效
```
