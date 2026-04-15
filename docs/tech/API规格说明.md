# OpenAGI API 规格说明 v1.0

> 基准：FastAPI + WebSocket | 端口：8888 | 前缀：`/api/v1`

---

## 通用规范

- 所有响应格式：`{"success": bool, "data": any, "error": str | null}`
- 认证：Bearer Token（MVP阶段可选，Header: `Authorization: Bearer <token>`）
- 错误码：标准 HTTP（400/401/403/404/422/500/503）

---

## 核心端点

### 聊天系统

| 方法 | 路径 | 说明 | 请求体 | 响应 |
|------|------|------|--------|------|
| `POST` | `/chat/send` | 深度聊天发消息 | `{message, session_id?, model?, core_count?}` | `{reply, session_id, tokens, duration_ms, audit?}` |
| `GET` | `/chat/sessions` | 会话列表（分组） | — | `[{id, title, created_at, group}]` |
| `DELETE` | `/chat/sessions/{id}` | 删除会话 | — | `{success}` |
| `GET` | `/chat/history/{session_id}` | 会话消息历史 | — | `[{role, content, tokens, ts}]` |
| `POST` | `/chat/group/create` | 创建群聊 | `{name, members[], template?}` | `{room_id, name}` |
| `POST` | `/chat/group/send` | 群聊发消息 | `{room_id, message, mentions[]}` | `{replies[]}` |
| `WS` | `/ws/chat` | 流式实时聊天 | 连接后发 JSON `{message, session_id, core_count}` | 流式 `{token}` + 最终 `{done, tokens, duration_ms}` |

### 记忆系统

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/memory/search?q=&layer=` | 混合检索（语义+BM25）|
| `GET` | `/memory/stats` | 四层记忆统计 |
| `GET` | `/memory/dna` | L3 DNA条目列表 |
| `POST` | `/memory/dna` | 写入DNA条目 |
| `POST` | `/memory/distill/light` | 手动触发轻睡眠蒸馏 |

### 模型与设置

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/models` | 已配置模型列表（含状态/延迟）|
| `POST` | `/models/relay` | 添加中转站 |
| `POST` | `/models/test` | 测试模型可用性 |
| `GET` | `/settings` | 获取全部设置 |
| `PUT` | `/settings` | 更新设置 |

### 人格 / 技能 / 工具

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/personas?domain=` | 专家人格列表 |
| `GET` | `/skills` | 已安装技能列表 |
| `GET` | `/skills/market` | 技能市场 |
| `POST` | `/skills/install` | 安装技能 |
| `GET` | `/tools` | 可用工具列表（按权限过滤）|

### 系统状态

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/heart/status` | 心绪状态（entropy/valence/state）|
| `GET` | `/commander/stats` | 巡检AI状态 |
| `GET` | `/constitution/weights` | 宪法权重 |
| `GET` | `/usage/today` | 今日Token用量 |
| `GET` | `/health` | 健康检查（<100ms）|

---

## WebSocket 协议

```jsonc
// 客户端发送
{"message": "你好", "session_id": "sess_123", "core_count": 2}

// 服务端流式返回（多帧）
{"type": "token", "content": "你"}
{"type": "token", "content": "好"}
// ...
{"type": "done", "session_id": "sess_123", "tokens": 42, "duration_ms": 1230, "model": "claude-3-5-sonnet"}

// 错误帧
{"type": "error", "message": "LLM不可用，已切换到回退模型"}
```

---

## 权限层级

| 级别 | 说明 | 要求 |
|------|------|------|
| L0 | 只读/查询 | 直接执行 |
| L1 | 受限外部读 | ≥2核审计 |
| L2 | 修改操作 | ≥3核+用户确认弹窗 |
| L3 | 高风险操作 | 4核+AI审计+人机双签 |
| L4 | 永久禁止 | HTTP 403，无论任何权限 |
