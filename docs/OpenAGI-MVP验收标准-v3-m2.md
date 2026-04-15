# OpenAGI MVP 验收标准 v3（M2 终极融合版）

> **版本**：v3.0 | **日期**：2026-04-15 | **作者**：M2（MacBook Air M2）
> **融合来源**：
> - M2 v2：五列表格 + pytest命令 + 精确数值断言 + 缺口速查 + 最快上线路径
> - M4 v2：实现建议内嵌（行数+参考文件）+ ✅/⚠️/🔲现状感知
> - GPT版：骨架可用级/全量兑现级双口径 + 不通过条件 + 6条阻塞规则 + 扩展位纳入验收
> - Grok版：非功能性SLA + 开源合规验收 + 交付物清单 + 验收流程建议

---

## 图例

| 符号 | 含义 | 类型标签 |
|------|------|---------|
| ✅ | 代码完整 + 测试通过 | `[A]` = 可自动化 |
| ⚠️ | 核心有，边缘/集成缺失 | `[M]` = 需人工验证 |
| ❌ | 有代码但逻辑错误 | ★★★★ = P0 发布门槛 |
| 🔲 | 未开始 | ★★★ = P1 优先迭代 |

**骨架可用级（MVP通过线）**：所有P0项无 ❌/🔲，可跑通至少1条完整用户链路
**全量兑现级（完整目标线）**：思维导图中所有数量、覆盖度、生态规模完全对齐

---

## 🚨 第一眼：当前最大缺口

| 优先级 | 模块 | 文件路径 | 问题 | 骨架可用级阻断？ |
|--------|------|---------|------|----------------|
| 🔴 P0 | ReAct执行循环 | `cortex/loop/__init__.py` | 空文件，Agent引擎无法运行 | **是** |
| 🔴 P0 | 权限熔断矩阵 | `social/permissions/__init__.py` | 空目录，无安全机制 | **是** |
| 🔴 P0 | API路由层 | `api/routes/chat.py` 等3个文件 | 桩代码，前后端断连 | **是** |
| 🟡 P1 | 前端UI | `web/src/app/chat/` | 目录不存在 | 否（允许⚠️发布）|
| 🟡 P1 | 宪法测试 | `social/constitution/core.py` | 169行代码零测试 | 否 |

---

## ⚡ 最快上线路径（3步，共约5小时）

```
Step 1 [约2h]  实现 cortex/loop/__init__.py（ReAct循环，约200-300行）
               参考：cortex/trinity/engine.py 纯函数风格
               验证：pytest tests/cortex/test_react.py -v 全通过

Step 2 [约1h]  实现 social/permissions/__init__.py（权限熔断，约150-200行）
               参考：NewClaw v6/fuse-matrix.ts 移植为Python
               验证：pytest tests/social/test_permissions.py -v 全通过

Step 3 [约2h]  接通 api/routes/chat.py | settings.py | skills.py（真实逻辑替换桩代码）
               验证：curl localhost:8888/health 返回200
                     POST /api/v1/chat/send 返回真实AI回复（非占位符）
```

完成上述3步 → 达到**骨架可用级发布门槛**

---

## 🔴 发布阻塞规则（6条，任一命中则禁止发布）

1. 任一P0主链路无法端到端跑通
2. L2/L3操作未按权限规则执行确认、审计或阻断
3. L4禁止项（银行密码等）可被任何方式绕过执行
4. 主模型故障时没有自动回退，且用户无可见提示
5. 会话、记忆、核心状态在服务重启后出现不可恢复的数据丢失
6. 敏感信息（API Key、私钥、Token）在界面/日志/导出文件中明文泄露

---

## 📏 验收分级说明

### 骨架可用级（当前MVP通过线）
满足四类：① 结构存在 ② 主链路可用 ③ 异常可控 ④ 可扩展（后续演进不推翻架构）

### 全量兑现级（完整目标线）
在骨架可用级基础上，数量/覆盖度/生态达到思维导图全量目标

---

## 📊 数量型双口径目标

| 项目 | 骨架可用级（MVP） | 全量兑现级（完整） |
|------|-----------------|-----------------|
| 标准工具 | 六大类各≥1个真实可调用工具 | 23种标准工具全部可用 |
| 专家人格 | 13域分类齐全，每类≥1个条目 | 162位全中文专家人格 |
| 浏览器平台 | 搜索/社交/开发/视频/财经/学术各≥1个 | 36平台103命令 |
| 消息平台 | Web API + WebSocket + Telegram可用 | 15+平台接入 |
| 预设团队 | ≥3个模板可用 | 6个预设团队 |
| 参考应用映射 | 12个参考应用有借鉴点映射表 | 所有借鉴点在系统中有对应实现或预留 |

---

## 🌐 通用验收要求

### G1 可部署性（骨架可用级必须）
- `[A]` `docker compose up` 后，`/health` 在30s内首次返回200
- `[A]` 首次启动失败时给出可定位错误信息，不静默退出
- `[A]` 提供：Web入口 + 健康检查接口 + 环境变量配置模板

### G2 可观测性（骨架可用级必须）
- `[A]` 所有核心模块具备：当前状态 + 最近一次执行结果 + 最近一次失败原因
- `[A]` 主链路日志可追踪：触发来源 / 使用模型 / 工具调用 / 权限判定 / 回退情况

### G3 安全与权限（P0，任一缺失=阻塞发布）
- `[A]` 所有外部真实操作必须经过权限等级判定，无绕过路径
- `[A]` L3及以上必须有人机确认，且确认记录可追踪（日志存证）
- `[A]` L4项必须被系统级阻断，不允许以"提示"替代阻断
- `[A]` API Key/Token/私钥在界面遮罩显示，日志中不得明文落盘

### G4 稳定性与恢复（P0）
- `[A]` `kill -9` 后60s内进程自动恢复（supervisord），连续3次均通过
- `[A]` 恢复后状态完整：最近会话索引 + 持久化记忆 + DNA + 心绪状态
- `[A]` 崩溃恢复后不产生重复执行高风险动作

### G5 中文可用性（P1）
- `[M]` 核心功能支持中文界面与中文输入
- `[A]` 记忆检索中的中文全文检索（BM25中文分词）能力可用
- `[M]` 专家人格、技能市场等中文定位模块具备中文可读性

### G6 非功能性SLA（P1性能基线）

| 指标 | 骨架可用级门槛 | 全量兑现级目标 |
|------|-------------|-------------|
| 4核模式长对话响应 | < 12s | < 8s |
| 记忆检索延迟 | < 1000ms | < 800ms（10,000条后） |
| 首页加载时间 | < 5s | < 3s |
| WebSocket首token | < 5s | < 3s |
| Docker健康检查 | 30s内返回200 | 15s内返回200 |

### G7 开源合规（P1）
- `[M]` 核心代码采用Apache-2.0协议
- `[M]` 所有第三方依赖许可证与Apache-2.0兼容（无GPL污染）
- `[A]` `pip-licenses` 输出无 GPL/AGPL 依赖：`pip install pip-licenses && pip-licenses --fail-on="GPL"`

---

## Part 1：后端模块验收标准

---

### Layer 1：LLM大脑层 ★★★（P1）｜完成度 80%

#### 骨架可用级验收标准

| 条件 | 类型 | 精确断言 | pytest命令 | 当前状态 |
|------|------|---------|-----------|---------|
| 主回退模型配置 | `[A]` | 支持主模型+≥2个回退模型配置；`GET /api/v1/models` 返回列表含 `id`/`provider`/`latency_ms` | `pytest tests/cortex/test_llm_router.py` | ✅ |
| 故障转移 | `[A]` | 主模型连续失败3次（mock），第4次路由到回退模型，日志记录切换原因+时间戳 | `pytest tests/cortex/test_llm_router.py::test_failover` | ✅ |
| 退避时间精度 | `[A]` | 第1次2s，第2次4s，第3次8s；时间戳差值允许误差 ±200ms | `pytest tests/cortex/test_llm_router.py::test_backoff` | ✅ |
| 故障转移Toast | `[A]` | 故障转移发生时，前端Toast显示"已切换到xxx模型"，3s内出现 | `pytest tests/cortex/test_llm_router.py::test_failover_toast` | ⚠️ |
| 并发路由隔离 | `[A]` | 并发10个请求，响应 `request_id` 与请求一一对应，无丢失、无乱序 | `pytest tests/cortex/test_llm_router.py::test_concurrent` | ✅ |
| 心绪感知Prompt差异 | `[A]` | calm/focused/anxious/crisis四种prompt，任意两种Jaccard相似度 < 0.5 | `pytest tests/cortex/test_heart_prompt.py::test_jaccard` | ✅ |
| Token预算crisis压缩 | `[A]` | crisis模式 `max_tokens` ≤ 正常模式的60%（精确数值对比） | `pytest tests/cortex/test_token_budget.py::test_crisis` | ⚠️ |

#### 全量兑现级补充
- `[M]` 模型提供商覆盖：Claude / GPT-4o / Grok-3 / DeepSeek / 本地Ollama / 中转站
- `[A]` 中转站一键发现可用模型，连续3次失败的模型自动降级到候选队尾

#### 不通过条件 🚫
- 情绪感知Prompt切换只改变标签，对实际LLM请求参数无影响
- 故障转移后用户无任何可见提示（静默切换不算通过）

---

### Layer 2：Agent核心引擎 ★★★★（P0）｜完成度 43%

#### 2.1 Trinity多核治理引擎 ✅

| 条件 | 类型 | 精确断言 | pytest命令 | 当前状态 |
|------|------|---------|-----------|---------|
| 1核直通延迟 | `[A]` | 1核模式：Core-0直接返回，日志无Core-1/2/3记录，框架延迟 < 2s | `pytest tests/cortex/test_trinity.py::test_single_core` | ✅ |
| 3核并行启动 | `[A]` | Core-1与Core-2启动时间戳差 < 200ms | `pytest tests/cortex/test_trinity.py::test_parallel_start` | ✅ |
| 冲突仲裁 | `[A]` | Core-1与Core-2矛盾时，按多数投票策略输出定稿，日志记录冲突 | `pytest tests/cortex/test_trinity.py::test_conflict` | ✅ |
| 权限升核 | `[A]` | L2操作自动升至≥3核，L3强制4核并等待人工确认信号 | `pytest tests/cortex/test_trinity.py::test_escalation` | ⚠️ |

#### 2.2 心绪引擎 ✅

| 条件 | 类型 | 精确断言 | pytest命令 | 当前状态 |
|------|------|---------|-----------|---------|
| 状态边界 | `[A]` | entropy/valence均∈[0.0,1.0]；10次失败后entropy≤1.0（不溢出） | `pytest tests/cortex/test_heart.py::test_boundary` | ✅ |
| 成功事件响应 | `[A]` | `llm_call_success` 触发后entropy减少量∈[0.015, 0.025] | `pytest tests/cortex/test_heart.py::test_success_event` | ✅ |
| 失败事件响应 | `[A]` | `task_failed` 触发后entropy增加量∈[0.07, 0.09] | `pytest tests/cortex/test_heart.py::test_fail_event` | ✅ |
| 危机跃迁 | `[A]` | entropy≥0.80时state变为`"crisis"`；前端心绪灯CSS class=`status-red` | `pytest tests/cortex/test_heart.py::test_crisis_transition` | ✅ |
| 持久化恢复 | `[A]` | 服务重启后entropy误差 < 0.01（JSON文件恢复） | `pytest tests/cortex/test_heart.py::test_persist` | ✅ |

#### 2.3 ReAct执行循环 🔲 ← **P0最高优先，约2h实现**

> **实现建议**：约200-300行Python，参考 `cortex/trinity/engine.py` 纯函数风格

| 条件 | 类型 | 精确断言 | pytest命令 | 当前状态 |
|------|------|---------|-----------|---------|
| Plan生成格式 | `[A]` | 多步任务返回JSON Plan数组，每项含 `step_id`/`action`/`expected_observation` | `pytest tests/cortex/test_react.py::test_plan_gen` | 🔲 |
| 步骤日志格式 | `[A]` | 每步日志格式：`[REACT][step_N][phase] message` | `pytest tests/cortex/test_react.py::test_log_format` | 🔲 |
| 失败恢复 | `[A]` | 中间步骤出错时生成新Plan继续，不抛出异常中止 | `pytest tests/cortex/test_react.py::test_step_recovery` | 🔲 |
| 无限循环防护 | `[A]` | 超过20步（可配置）后强制终止，返回 `{"status":"max_steps_exceeded","steps_taken":N}` | `pytest tests/cortex/test_react.py::test_loop_guard` | 🔲 |
| 并发隔离 | `[A]` | 同时3个多步任务，各任务日志 `session_id` 不交叉混淆 | `pytest tests/cortex/test_react.py::test_concurrent_isolation` | 🔲 |

#### 不通过条件 🚫
- ReAct循环只在日志打印步骤，不实际调用工具或执行操作
- 核数切换只改变UI，不影响实际治理链路

---

### Layer 3：永远记忆系统 ★★★★（P0）｜完成度 73%

#### 3.1 四层记忆架构 ✅

| 层 | 条件 | 类型 | 精确断言 | pytest命令 | 当前状态 |
|----|------|------|---------|-----------|---------|
| L0 | 读写一致 | `[A]` | 写入10条立即读取，返回相同10条，顺序一致 | `pytest tests/memory/test_memory.py::test_l0_rw` | ✅ |
| L0→L1 | 会话结束转存 | `[A]` | 调用 `end_session` 后，L1中可查到该会话摘要条目 | `pytest tests/memory/test_memory.py::test_session_transfer` | ✅ |
| L1 | 语义召回精度 | `[A]` | 查"项目编程语言"可召回"用Python开发后端"，top-1相似度 ≥ 0.75 | `pytest tests/memory/test_memory.py::test_semantic_recall` | ✅ |
| L1 | 时间衰退 | `[A]` | 同语义内容，30天前的记忆检索分 ≤ 新记忆分的60% | `pytest tests/memory/test_memory.py::test_time_decay` | ⚠️ |
| L1 | 降级保护 | `[A]` | 向量库不可用时写入本地临时文件；恢复后自动同步 | `pytest tests/memory/test_memory.py::test_fallback` | ✅ |
| L1 | 大容量性能 | `[A]` | 写入10,000条后，查询延迟 < 500ms | `pytest tests/memory/test_memory.py::test_scale` | ⚠️ |
| L2 | 永久存储 | `[A]` | L1蒸馏后L2存在完整原文；DELETE返回HTTP 403 | `pytest tests/memory/test_memory.py::test_l2_immutable` | ✅ |
| L3 | DNA注入 | `[A]` | 写入DNA条目后，下次对话system prompt包含该条目原文 | `pytest tests/memory/test_memory.py::test_dna_inject` | ✅ |

#### 验收方法 💡
结束一段对话后，重新查询相关主题，验证记忆可被召回；注入冲突事实后执行REM蒸馏，验证是否检测到矛盾；重启服务后验证核心记忆仍可查询。

#### 不通过条件 🚫
- 会话结束后L0内容全部丢失，不转入后续层
- L3核心记忆重启后不注入system prompt

---

### Layer 4：永生与分布式层 ★★★（P1）｜完成度 40%

| 条件 | 类型 | 精确断言 | pytest命令 | 当前状态 |
|------|------|---------|-----------|---------|
| Calm心跳精度 | `[A]` | 连续5次心跳间隔均在290s～310s（日志时间戳验证） | `pytest tests/ghost/test_heartbeat.py::test_calm_interval` | ✅ |
| Crisis加速 | `[A]` | calm→crisis切换后，下次心跳间隔 ≤ 65s | `pytest tests/ghost/test_heartbeat.py::test_crisis_speed` | ✅ |
| 崩溃恢复 | `[A]` | `kill -9` 后60s内进程重新出现在ps列表，连续3次均通过 | `pytest tests/ghost/test_recovery.py::test_crash_restart` | ⚠️ |
| 熵值恢复精度 | `[A]` | 重启后entropy与重启前误差 < 0.01 | `pytest tests/ghost/test_recovery.py::test_entropy_restore` | ⚠️ |
| SQLite并发 | `[A]` | 并发10个写操作不报 `SQLITE_BUSY`（WAL模式） | `pytest tests/ghost/test_recovery.py::test_sqlite_concurrent` | ⚠️ |
| Docker启动 | `[A]` | `docker compose up` 后 `/health` 在30s内首次返回200 | `docker compose up -d && sleep 30 && curl localhost:8888/health` | ⚠️ |

#### 不通过条件 🚫
- 心跳调度器只存在配置，不实际执行任何任务
- 服务恢复后会话索引丢失

---

### Layer 5：工具与扩展层 ★★★（P1）｜完成度 92%

#### 骨架可用级：六大类工具各≥1个真实可调用

| 工具/条件 | 类型 | 精确断言 | pytest命令 | 当前状态 |
|----------|------|---------|-----------|---------|
| FileRead | `[A]` | 读取文本/PDF/图像，返回含 `content`/`line_count`（文本）或`pages`（PDF）字段 | `pytest tests/tools/test_file_tools.py` | ✅ |
| Bash沙箱 | `[A]` | `echo hello` 返回 `hello`；`rm -rf /` 返回错误且文件系统不变 | `pytest tests/tools/test_bash.py::test_sandbox` | ✅ |
| WebFetch | `[A]` | 返回内容不含 `<[a-zA-Z]` HTML标签，响应时间 < 10s | `pytest tests/tools/test_web_fetch.py` | ✅ |
| Hook拦截 | `[A]` | `before_file_write` hook拒绝时，目标文件不创建，原因记入日志 | `pytest tests/tools/test_hooks_builtin.py` | ✅ |
| 敏感信息Hook | `[A]` | 含 `ANTHROPIC_API_KEY=sk-`/`ghp_`/`-----BEGIN RSA` 任一 → 推送阻止，报告含行号 | `pytest tests/tools/test_hooks_builtin.py::test_secret_detect` | ✅ |
| MCP工具发现 | `[A]` | 连接MCP Server，`list_tools()` 返回 ≥ 1条；断连时返回HTTP 503，不挂起主进程 | `pytest tests/tools/test_mcp.py` | ✅ |
| 权限过滤 | `[A]` | `get_available_tools(permission_level="L1")` 不含任何L2+工具名称（精确排除） | `pytest tests/tools/test_registry.py::test_permission_filter` | ✅ |

#### 扩展位预留验收（骨架可用级必须）✅
- `[A]` 工具注册/注销接口存在且可用，后续新增工具无需修改核心代码
- `[A]` Hook点覆盖文件/Git/Agent/API四类，第三方可通过注册新Hook扩展

#### 全量兑现级：23种标准工具全部可用
`pytest tests/tools/test_all_tools.py -v --count-ge=23`

#### 不通过条件 🚫
- 工具权限标记不存在或不生效（L0 Agent可调用L2工具）
- Hook只在文档中存在，实际不触发

---

### Layer 6：巡检AI（Commander Core）★★★（P1）｜完成度 88%

| 条件 | 类型 | 精确断言 | pytest命令 | 当前状态 |
|------|------|---------|-----------|---------|
| 定时精度 | `[A]` | 连续5次触发间隔均在270s～330s（允许±30s） | `pytest tests/cortex/test_commander.py::test_interval` | ✅ |
| 危机优先 | `[A]` | entropy≥0.80后5s内触发危机巡检，不等待当前任务 | `pytest tests/cortex/test_commander.py::test_crisis_urgent` | ✅ |
| 完成报告JSON | `[A]` | `task:completed` 后报告含 `completed_items`（数组≥1）和 `next_steps`（数组≥1） | `pytest tests/cortex/test_commander.py::test_report_complete` | ✅ |
| 草稿模式 | `[M]` | 巡检内容出现在发送框，用户修改后发送才执行（不可直接执行） | 人工操作UI验证 | ⚠️ |
| L2+操作确认 | `[A]` | 自动模式下L2+操作触发确认弹窗，用户拒绝后目标文件不变 | `pytest tests/cortex/test_commander.py::test_l2_confirm` | ⚠️ |

#### 不通过条件 🚫
- 草稿模式仍绕过用户确认直接发送
- 巡检在高风险场景下无视权限等级自动执行

---

### Layer 7：人格系统 ★★★（P1）｜完成度 88%

| 条件 | 类型 | 精确断言 | pytest命令 | 当前状态 |
|------|------|---------|-----------|---------|
| 人格差异性 | `[A]` | 任意两种预设人格system prompt Jaccard相似度 < 0.5 | `pytest tests/social/test_persona.py::test_diversity` | ✅ |
| 自定义一致性 | `[A]` | 自定义人格后，下次LLM调用system prompt与填入内容完全一致 | `pytest tests/social/test_persona.py::test_custom` | ✅ |
| 持久化 | `[A]` | 自定义人格重启后仍存在（JSON文件持久化） | `pytest tests/social/test_persona.py::test_persist` | ✅ |
| 骨架可用级专家库 | `[A]` | 13个专家域分类齐全，每类≥1个条目，支持搜索/预览/启用 | `pytest tests/social/test_persona.py::test_domains` | ✅ |
| 全量兑现专家库 | `[A]` | `GET /api/v1/personas?domain=工程` 返回≥44条 | `pytest tests/social/test_persona.py::test_expert_count` | ✅ |

#### 不通过条件 🚫
- 人格切换后对实际LLM输出风格无影响（仅改变标签）
- 自定义人格无法保存或无法再次选用

---

### Layer 8：聊天系统 ★★★★（P0）｜完成度 83%

#### 深度聊天

| 条件 | 类型 | 精确断言 | pytest命令 | 当前状态 |
|------|------|---------|-----------|---------|
| 流式首Token | `[A]` | 前端首个token到达 < 3s（不含LLM首token时间） | `pytest tests/api/test_chat.py::test_stream_first_token` | ✅ |
| 停止响应 | `[A]` | 点击停止后500ms内WebSocket不再收到新token | `pytest tests/api/test_chat.py::test_stop_response` | ✅ |
| 历史持久化 | `[A]` | 刷新页面，历史消息重载，顺序不变 | `pytest tests/api/test_chat.py::test_history_persist` | ✅ |
| 断线提示 | `[A]` | 流式输出中断网，5s内显示"连接中断"，不静默失败 | `pytest tests/api/test_chat.py::test_disconnect_notify` | ⚠️ |

#### AI团队群聊

| 条件 | 类型 | 精确断言 | pytest命令 | 当前状态 |
|------|------|---------|-----------|---------|
| 单点@ | `[A]` | `@成员A` 只有成员A产生回复，其他成员日志无回复记录 | `pytest tests/api/test_group.py::test_at_single` | ✅ |
| 防AI循环 | `[A]` | AI互@最多3轮（用户→A→B→停止），第4轮不触发 | `pytest tests/api/test_group.py::test_loop_guard` | ✅ |

#### 验收方法 💡
在4核模式下发送复杂任务，验证各Core日志独立且最终输出经过仲裁；群聊中AI互@，验证轮次上限生效。

#### 不通过条件 🚫
- 切换为群聊模式后仍是单体回复，不存在成员视角
- "停止"按钮仅改UI，不中断实际生成

---

### Layer 9：宪法与权限系统 ★★★★（P0）｜完成度 21%

> ⚠️ **`social/permissions/` 空目录，无此模块则无安全保证**
> **实现建议**：移植 `NewClaw v6/fuse-matrix.ts`（258行），约150-200行Python

#### L0-L4权限熔断 🔲 ← **P0第二优先，约1h实现**

| 条件 | 类型 | 精确断言 | pytest命令 | 当前状态 |
|------|------|---------|-----------|---------|
| L0直通 | `[A]` | L0操作直接执行，响应时间内无"确认等待"状态 | `pytest tests/social/test_permissions.py::test_l0_direct` | 🔲 |
| L2确认流程 | `[A]` | L2操作触发确认，用户拒绝后：目标文件不变，日志状态=`"rejected_by_user"` | `pytest tests/social/test_permissions.py::test_l2_reject` | 🔲 |
| L3双签 | `[A]` | AI审计通过但用户未确认→不执行；用户确认但AI拒绝→不执行；两者必须同时通过 | `pytest tests/social/test_permissions.py::test_l3_dual_sign` | 🔲 |
| L4永久拒绝 | `[A]` | 含银行密码等关键词→HTTP 403，body含`"permanently_forbidden"`，任何权限均拒绝 | `pytest tests/social/test_permissions.py::test_l4_block` | 🔲 |
| 越权拦截 | `[A]` | L0 Agent尝试L2操作（写文件）→HTTP 403，操作不执行 | `pytest tests/social/test_permissions.py::test_privilege_escalation` | 🔲 |
| 权限撤销 | `[A]` | 撤销L2授权后，在途L2任务在3s内收到取消信号，操作回滚 | `pytest tests/social/test_permissions.py::test_revoke_inflight` | 🔲 |

#### 扩展位预留验收（骨架可用级必须）
- `[A]` 宪法规则以配置/数据形式存在，不硬编码；新增规则无需修改核心代码

#### 不通过条件 🚫（= 发布阻塞规则中的第2、3、4条）
- L2/L3操作未按权限规则执行确认/审计/阻断
- L4禁止项被前端参数绕过
- 检测到敏感信息后仅做提示，不升级权限或阻断

---

### Layer 10-13：其余后端模块（汇总）

> 已在M2 v2详细展开，此处给出骨架可用级最低验收条件

| 模块 | 骨架可用级最低条件 | 不通过条件 | 完成度 |
|------|-----------------|---------|--------|
| 技能系统（P1） | 技能有统一定义结构；内置技能集可被调用；安装高权限技能需确认 | 技能只是提示词收藏，无法作为可执行能力调用 | 50% |
| 浏览器引擎（P1） | 三层架构（AI→守护进程→真实浏览器）存在；≥1条真实搜索链路 | 搜索能力依赖纯mock，无法访问真实页面 | 75% |
| 数字伴侣（P1） | ≥1种语音输入或输出；情绪与表达存在映射；亲密模式≥2档可切换 | 宣称数字伴侣仅是更换头像，无任何交互层差异 | 70% |
| 用户触达（P2） | Web API + WebSocket + Telegram可用；消息网关有统一抽象 | API可启动但核心接口不可达 | 40% |

---

## Part 2：前端UI验收标准（完成度 0%）🔲

#### 骨架可用级（P0）

| 页面/组件 | 类型 | 精确断言 | 当前状态 |
|----------|------|---------|---------|
| 聊天页 `app/chat/` | `[M]` | 可输入消息并收到AI回复，流式显示 | 🔲 |
| 发送框 | `[A]` | Enter发送，Shift+Enter换行；高度随输入自适应，超15行内部滚动 | 🔲 |
| 心绪指示灯 | `[A]` | CSS class与API state一致：`calm=status-green`，`crisis=status-red` | 🔲 |
| 停止按钮 | `[A]` | 点击停止后，WebSocket 500ms内不再收到新token（不仅改UI） | 🔲 |

#### P1补充

| 页面/组件 | 类型 | 精确断言 | 当前状态 |
|----------|------|---------|---------|
| 侧边栏会话分组 | `[A]` | 以客户端本地时区00:00为准；边界：23:59创建归"今天"，00:01归新的"今天" | 🔲 |
| 欢迎屏问候语 | `[A]` | 6-12时"早上好☀️"，12-18时"下午好"，18-24时"晚上好🌙" | 🔲 |
| 多核治理面板 | `[M]` | 1/2/3/4核切换后，下次发送实际使用新核数（日志可验证） | 🔲 |
| 巡检倒计时 | `[A]` | 倒计时每秒递减1，误差≤1s（JS `performance.now()` 验证） | 🔲 |
| 断线状态 | `[A]` | `kill -9` 后端后5s内前端连接指示变为断线（截图diff验证） | 🔲 |
| Token用量 | `[A]` | 刷新后从 `GET /api/v1/usage/today` 重新获取，不归零 | 🔲 |

#### 不通过条件 🚫
- 首页仅为静态展示，无法进入聊天主流程
- 核数切换只改变UI，不影响实际执行链路

---

## Part 3：端到端集成链路（5条关键路径）

| 链路 | 经过模块 | 类型 | 验收标准 | 当前状态 |
|------|---------|------|---------|---------|
| **① 消息→AI回复** | 发送框→chat→trinity→llm/router→回显 | `[A]` | 用户消息返回真实AI回复，含 `reply`/`audit`/`tokens`字段 | 🔲 loop缺失 |
| **② 心绪→LLM参数** | heart/entropy→llm/router温度注入 | `[A]` | calm→crisis切换后，LLM请求 `temperature` 升高，`max_tokens` 降低（日志两次请求对比） | ⚠️ |
| **③ 记忆全链注入** | chat→memory→distill→search→prompt | `[A]` | 新对话提及上次主题，AI回复包含正确历史内容 | ⚠️ |
| **④ 权限熔断** | 任意操作→constitution→L0-L4判断 | `[A]` | L0直通；L4返回HTTP 403（`"permanently_forbidden"`） | 🔲 permissions空 |
| **⑤ 心跳持久化** | ghost/heartbeat→light_sleep→archive→重启恢复 | `[A]` | kill -9后60s内重启，记忆和心绪状态完整恢复 | ⚠️ |

**验收方法 💡**：运行 `pytest tests/integration/` 跑端到端测试；对于🔲链路，先实现Step1和Step2后再验证链路①④。

---

## Part 4：MVP Go/No-Go 发布检查单

### 🔴 骨架可用级门槛（任一未通过=禁止发布）

- [ ] `cortex/loop/` ReAct循环实现，`pytest tests/cortex/test_react.py -v` 全通过
- [ ] `social/permissions/` 权限熔断矩阵实现，`pytest tests/social/test_permissions.py -v` 全通过
- [ ] API路由三文件接通真实逻辑，`POST /api/v1/chat/send` 返回真实AI回复
- [ ] `python -m pytest tests/ -v` 全部通过，无ERROR，无SKIP
- [ ] 集成链路① 消息→AI回复 端到端通过
- [ ] 集成链路④ 权限熔断 L0直通+L4拒绝 均通过
- [ ] `docker compose up && curl /health` 返回200（30s内）
- [ ] **发布阻塞规则6条全部通过**（敏感信息不泄露、重启不丢失、L4不可绕过等）

### 🟡 骨架可用级允许⚠️（发布后1周迭代）

- [ ] 前端UI：至少聊天页可收发消息（流式显示）
- [ ] 故障转移Toast通知（前端可见提示）
- [ ] 记忆蒸馏：Light Sleep可调度，REM/Deep可Mock
- [ ] TTS/STT：Mock实现通过即可

### 🟢 全量兑现级（Phase 2）

- [ ] 23种标准工具全部实现
- [ ] 162位专家人格全量
- [ ] 36平台103命令浏览器搜索
- [ ] Redis跨节点同步
- [ ] AI自拍（SD真实生成）
- [ ] 技能市场联网

---

## Part 5：完成度总览

| 分类 | ✅ | ⚠️ | 🔲 | 骨架可用级 | 全量兑现级 | 优先级 |
|------|----|----|-----|----------|---------|--------|
| Layer 1 LLM大脑层 | 5 | 2 | 0 | 80% | 60% | P1 |
| Layer 2 Agent引擎 | 4 | 1 | 6 | 43% | 30% | **P0** |
| Layer 3 记忆系统 | 10 | 3 | 0 | 77% | 70% | **P0** |
| Layer 4 永生层 | 2 | 4 | 0 | 45% | 30% | P1 |
| Layer 5 工具层 | 14 | 0 | 0 | 92% | 65% | P1 |
| Layer 6 巡检AI | 5 | 3 | 0 | 88% | 75% | P1 |
| Layer 7 人格系统 | 5 | 0 | 0 | 88% | 50% | P1 |
| Layer 8 聊天系统 | 7 | 2 | 0 | 83% | 75% | **P0** |
| Layer 9 宪法权限 | 0 | 4 | 6 | 21% | 15% | **P0** |
| Layer 10-13 其余 | 14 | 8 | 3 | 56% | 40% | P1-P2 |
| 前端UI | 0 | 0 | 12 | 0% | 0% | P0/P1 |
| 集成链路 | 0 | 3 | 2 | 30% | 20% | **P0** |
| **合计** | **66** | **30** | **29** | **57%** | **42%** | — |

---

## 📦 交付物清单

| # | 交付物 | 骨架可用级要求 | 全量兑现级要求 |
|---|-------|-------------|-------------|
| 1 | Docker Compose项目 | 一键启动，`/health` 30s内200 | 含所有服务完整配置 |
| 2 | 功能演示 | 4核治理+心绪+记忆全链路截图/视频 | 所有★★★+模块演示 |
| 3 | API文档 | FastAPI `/docs` Swagger可访问 | 完整Markdown API文档 |
| 4 | 部署手册 | 环境变量说明+常见错误排查 | 完整运维手册 |
| 5 | 测试报告 | `pytest --html=report.html` 输出 | 覆盖率≥80% |
| 6 | 许可证合规 | `pip-licenses` 输出无GPL/AGPL | 所有依赖许可证清单 |

---

## 🔍 验收流程建议（5步）

```
Step 1【代码审查】  对照本标准逐条检查实现，重点看P0条目和"不通过条件"
Step 2【功能演示】  开发者现场演示：4核治理+心绪引擎+记忆蒸馏全链路+巡检AI+群聊
Step 3【压力测试】  触发边界场景：主模型全部不可用、心绪进入crisis、长上下文压缩、kill -9恢复
Step 4【用户视角】  真实使用场景：深度聊天→团队协作→自主巡检→记忆召回
Step 5【文档验收】  核心模块有中文注释；API文档可访问；许可证无冲突
```

---

*v3 相对 v2 的核心升级（10项创新）：*
- *✅ 新增：骨架可用级 vs 全量兑现级双口径验收框架（来自GPT版）*
- *✅ 新增：每模块"不通过条件"明文定义（来自GPT版）*
- *✅ 新增：6条发布阻塞规则（任一命中=禁止发布）（来自GPT版）*
- *✅ 新增：扩展位预留纳为骨架可用级必要条件（来自GPT版）*
- *✅ 新增：非功能性SLA表（长对话<8s/记忆<800ms）（来自Grok版）*
- *✅ 新增：开源合规验收（Apache-2.0，pip-licenses自动检测）（来自Grok版）*
- *✅ 新增：交付物清单（6项，含骨架/全量双标准）（来自Grok版）*
- *✅ 新增：验收流程建议（5步标准化流程）（来自Grok版）*
- *✅ 新增：验收方法提示（💡标记，每关键模块提供验证思路）*
- *✅ 新增：数量型双口径目标表（工具数/人格数/平台数骨架vs全量）*

*对应思维导图：`docs/openagi骨架树/OpenAGI-MVP核心骨架树-思维导图.html`*
*参考：M4版/GPT版/Grok版；评价详见 `docs/验收标准四方对比评价-m2.md`*
