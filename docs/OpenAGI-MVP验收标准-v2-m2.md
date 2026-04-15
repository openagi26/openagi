# OpenAGI MVP 验收标准 v2（M2 融合版）

> **版本**：v2.0 | **日期**：2026-04-15 | **作者**：M2（MacBook Air M2）
> **改进来源**：
> - 继承 M2 v1：179条精确数值断言 + [AUTO]/[MANUAL]标签 + 边界/降级全覆盖
> - 吸收 M4 优点：✅/⚠️/🔲现状感知 + pytest命令 + 完成度% + 缺口速查表
> - M2创新：五列表格（条件/类型/验收标准/测试命令/当前状态）+ 最快上线路径

---

## 图例

| 符号 | 含义 |
|------|------|
| ✅ | 代码完整 + 测试通过 |
| ⚠️ | 核心实现有，但边缘/集成缺失 |
| ❌ | 有代码但逻辑错误 |
| 🔲 | 未开始（无代码） |
| `[A]` | 可自动化测试 |
| `[M]` | 需人工验证 |
| ★★★★ | P0（发布硬性门槛）|
| ★★★ | P1（发布后优先迭代）|
| ★★ | P2（可选增强）|

**发布门槛**：所有 P0 条目状态为 ✅，无 ❌/🔲

---

## 🚨 当前最大缺口速查（接手第一眼）

| 优先级 | 模块 | 文件路径 | 问题描述 | P0？ |
|--------|------|---------|---------|------|
| 🔴 最高 | ReAct 执行循环 | `cortex/loop/__init__.py` | 空文件，Agent引擎无法运行 | ✅ P0阻断 |
| 🔴 高 | 权限熔断矩阵 | `social/permissions/__init__.py` | 空目录，无安全机制 | ✅ P0阻断 |
| 🔴 高 | API 路由层 | `api/routes/chat.py` 等3个文件 | 桩代码，前后端断连 | ✅ P0阻断 |
| 🟡 中 | 前端 UI | `web/src/app/chat/` | 目录不存在 | P1 |
| 🟡 中 | 宪法测试 | `social/constitution/core.py` | 169行代码零测试 | P1 |

---

## ⚡ 最快上线路径（3步最小可运行）

```
Step 1 [2h] 实现 cortex/loop/__init__.py（ReAct循环，约200行）
            → 验证：pytest tests/cortex/test_react.py -v 全通过

Step 2 [1h] 实现 social/permissions/__init__.py（权限熔断，约150行）
            → 验证：pytest tests/social/test_permissions.py -v 全通过

Step 3 [2h] 接通 api/routes/chat.py|settings.py|skills.py
            → 验证：curl localhost:8888/health 返回200 + POST /api/v1/chat/send 返回真实AI回复
```

完成上述3步 → 具备 MVP 最小可发布状态

---

## Part 1：后端模块验收标准

---

### Layer 1：LLM 大脑层 ★★★（P1）｜完成度 80%

#### 1.1 多模型路由器 ✅

| 条件 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|------|------|---------|---------|---------|
| 模型列表 API | `[A]` | `GET /api/v1/models` 返回列表，每条含 `id`、`provider`、`latency_ms`；至少含 Claude 和 GPT 系列各一 | `pytest tests/cortex/test_llm_router.py` | ✅ |
| 指定模型一致性 | `[A]` | 分别指定不同 `model` 参数，响应中 `model` 字段与请求一致，两次结果不同 | `pytest tests/cortex/test_llm_router.py::test_model_routing` | ✅ |
| 不存在模型处理 | `[A]` | 指定不存在的模型 ID → HTTP 400，body 含 `available_models` 列表，服务不崩溃 | `pytest tests/cortex/test_llm_router.py::test_invalid_model` | ✅ |
| 本地/云端接口统一 | `[A]` | 本地 Ollama 与云端模型使用相同 API 接口，响应字段名完全一致 | `pytest tests/cortex/test_llm_router.py::test_ollama_compat` | ⚠️ |
| 故障转移 | `[A]` | 主模型连续失败3次（mock），第4次路由到回退模型，日志记录切换原因和时间戳 | `pytest tests/cortex/test_llm_router.py::test_failover` | ✅ |
| 退避时间精度 | `[A]` | 第1次重试2s，第2次4s，第3次8s；时间戳差值允许误差 ±200ms | `pytest tests/cortex/test_llm_router.py::test_backoff` | ✅ |
| 并发路由隔离 | `[A]` | 并发10个请求，响应 `request_id` 与请求一一对应，无丢失、无乱序 | `pytest tests/cortex/test_llm_router.py::test_concurrent` | ✅ |

#### 1.2 心绪感知 Prompt ✅

| 条件 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|------|------|---------|---------|---------|
| 状态差异性 | `[A]` | calm/focused/anxious/crisis 四种 system prompt，任意两种 Jaccard 相似度 < 0.5 | `pytest tests/cortex/test_heart_prompt.py` | ✅ |
| Crisis 简化 | `[A]` | crisis 状态 prompt 字数 ≤ calm 状态的 50%（精确字数对比） | `pytest tests/cortex/test_heart_prompt.py::test_crisis_compact` | ✅ |
| 温度联动 | `[A]` | calm → crisis 切换后，下次 LLM 请求 `temperature` 升高，`max_tokens` 降低（日志对比） | `pytest tests/cortex/test_heart_prompt.py::test_temp_linkage` | ⚠️ |

#### 1.3 Token 预算管理 ⚠️

| 条件 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|------|------|---------|---------|---------|
| Crisis 压缩 | `[A]` | crisis 模式 `max_tokens` ≤ 正常模式的 60%（精确数值对比，非近似） | `pytest tests/cortex/test_token_budget.py::test_crisis` | ⚠️ |
| 多核预算 | `[A]` | 4核模式下各核 `max_tokens` 之和 ≤ 配置总预算，无一核超出 | `pytest tests/cortex/test_token_budget.py::test_multicore` | ⚠️ |

---

### Layer 2：Agent 核心引擎 ★★★★（P0）｜完成度 43%

#### 2.1 Trinity 多核治理引擎 ✅

| 条件 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|------|------|---------|---------|---------|
| 1核直通 | `[A]` | 1核模式：Core-0直接返回，日志无 Core-1/2/3 记录，框架延迟 < 2s | `pytest tests/cortex/test_trinity.py::test_single_core` | ✅ |
| 3核并行启动 | `[A]` | Core-1 与 Core-2 启动时间戳差 < 200ms，输出不互相等待 | `pytest tests/cortex/test_trinity.py::test_parallel_start` | ✅ |
| 冲突仲裁 | `[A]` | Core-1 与 Core-2 矛盾时，按多数投票策略输出定稿，日志记录冲突 | `pytest tests/cortex/test_trinity.py::test_conflict` | ✅ |
| 升核触发 | `[A]` | L2 操作自动升至 ≥3核，L3 强制4核并等待人工确认信号 | `pytest tests/cortex/test_trinity.py::test_escalation` | ⚠️ |

#### 2.2 心绪引擎 ✅

| 条件 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|------|------|---------|---------|---------|
| 状态范围 | `[A]` | entropy、valence 均 ∈ [0.0, 1.0]；10次失败后 entropy ≤ 1.0（边界不溢出） | `pytest tests/cortex/test_heart.py::test_boundary` | ✅ |
| 成功事件响应 | `[A]` | `llm_call_success` 触发后 entropy 减少量 ∈ [0.015, 0.025] | `pytest tests/cortex/test_heart.py::test_success_event` | ✅ |
| 失败事件响应 | `[A]` | `task_failed` 触发后 entropy 增加量 ∈ [0.07, 0.09] | `pytest tests/cortex/test_heart.py::test_fail_event` | ✅ |
| 危机跃迁 | `[A]` | entropy ≥ 0.80 时 state 变为 `"crisis"`；前端心绪指示灯 CSS class 变为 `status-red` | `pytest tests/cortex/test_heart.py::test_crisis_transition` | ✅ |
| 持久化 | `[A]` | 服务重启后 entropy 误差 < 0.01（从 JSON 文件恢复） | `pytest tests/cortex/test_heart.py::test_persist` | ✅ |

#### 2.3 ReAct 执行循环 🔲 ← **P0 最高优先级**

> ⚠️ **空文件，整个 Agent 执行引擎核心，不实现则 MVP 无法发布**
> 实现建议：约 200-300 行 Python，参考 `cortex/trinity/engine.py` 的纯函数风格

| 条件 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|------|------|---------|---------|---------|
| Plan 生成 | `[A]` | 多步任务返回 JSON Plan 数组，每项含 `step_id`、`action`、`expected_observation` | `pytest tests/cortex/test_react.py::test_plan_gen` | 🔲 |
| 步骤日志格式 | `[A]` | 每步感知/思考/行动/观察均有日志行，格式 `[REACT][step_N][phase] message` | `pytest tests/cortex/test_react.py::test_log_format` | 🔲 |
| 失败恢复 | `[A]` | 中间步骤出错时，生成新Plan继续，不抛出异常中止 | `pytest tests/cortex/test_react.py::test_step_recovery` | 🔲 |
| 无限循环防护 | `[A]` | 超过20步（可配置）后强制终止，返回 `{"status": "max_steps_exceeded", "steps_taken": N}` | `pytest tests/cortex/test_react.py::test_loop_guard` | 🔲 |
| 并发隔离 | `[A]` | 同时3个多步任务，各任务日志 `session_id` 不交叉混淆，各自返回完整结果 | `pytest tests/cortex/test_react.py::test_concurrent_isolation` | 🔲 |
| 子代理崩溃恢复 | `[A]` | 子Agent抛出未捕获异常时，主Agent收到 `{"status": "agent_failed", "reason": "..."}` 并继续其余步骤 | `pytest tests/cortex/test_react.py::test_child_crash` | 🔲 |

#### 2.4 上下文压缩引擎 ⚠️

| 条件 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|------|------|---------|---------|---------|
| 自动触发 | `[A]` | token用量超上限70%时触发压缩，日志记录压缩事件和触发时间 | `pytest tests/cortex/test_compress.py::test_auto_trigger` | ⚠️ |
| 压缩率 | `[A]` | 压缩后字符数 ≤ 原始字符数的40%（减少 ≥ 60%） | `pytest tests/cortex/test_compress.py::test_ratio` | ⚠️ |
| 关键内容保留 | `[M]` | 压缩后代码块有hash可匹配版本，`Error:` 关键词至少保留一处 | 人工检查压缩输出 | ⚠️ |

---

### Layer 3：永远记忆系统 ★★★★（P0）｜完成度 73%

#### 3.1 四层记忆架构 ✅

| 层 | 条件 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|----|------|------|---------|---------|---------|
| L0 | 读写一致 | `[A]` | 写入10条消息立即读取，返回相同10条，顺序一致 | `pytest tests/memory/test_memory.py::test_l0_rw` | ✅ |
| L0→L1 | 会话结束转存 | `[A]` | 调用 `end_session` 后，L1中可查到该会话摘要条目 | `pytest tests/memory/test_memory.py::test_session_transfer` | ✅ |
| L1 | 语义召回精度 | `[A]` | 写入"用Python开发后端"，查"项目编程语言"，top-1相似度 ≥ 0.75 | `pytest tests/memory/test_memory.py::test_semantic_recall` | ✅ |
| L1 | 时间衰退 | `[A]` | 同语义内容，30天前写入的记忆检索分 ≤ 新记忆分的60% | `pytest tests/memory/test_memory.py::test_time_decay` | ⚠️ |
| L1 | 降级保护 | `[A]` | 向量库不可用时写入本地临时文件；恢复后自动同步，同步完成日志可验证 | `pytest tests/memory/test_memory.py::test_fallback` | ✅ |
| L1 | 大容量性能 | `[A]` | 写入10,000条后，查询延迟仍 < 500ms | `pytest tests/memory/test_memory.py::test_scale` | ⚠️ |
| L2 | 永久存储 | `[A]` | L1蒸馏后，L2中存在完整原文；DELETE返回 HTTP 403 | `pytest tests/memory/test_memory.py::test_l2_immutable` | ✅ |
| L3 | DNA注入 | `[A]` | 写入DNA条目后，下次对话 system prompt 包含该条目原文 | `pytest tests/memory/test_memory.py::test_dna_inject` | ✅ |

#### 3.2 三阶段梦境蒸馏 ✅

| 阶段 | 条件 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|------|------|------|---------|---------|---------|
| Phase 1 | 触发与标签 | `[A]` | `POST /api/v1/memory/distill/light` 返回处理条目数，每条标签 ≤ 8个，无重复 | `pytest tests/memory/test_distill.py::test_phase1` | ✅ |
| Phase 1 | 幂等性 | `[A]` | 连续触发两次，第二次标签集合与第一次完全相同 | `pytest tests/memory/test_distill.py::test_idempotent` | ✅ |
| Phase 2 | 关联报告 | `[A]` | 返回 `[{"source_id","target_id","relation_type","confidence"}]`，confidence ≥ 0.6 | `pytest tests/memory/test_distill.py::test_phase2` | ✅ |
| Phase 3 | 梦境日记 | `[M]` | 生成文本含"关键发现"、"新建连接"、"矛盾检测"三章 | 人工检查输出内容 | ⚠️ |
| 调度 | 定时触发 | `[A]` | Phase 1 日志每2h出现一次，误差 ≤ 5分钟 | `pytest tests/memory/test_distill.py::test_schedule` | ✅ |

#### 3.3 混合检索 ✅

| 条件 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|------|------|---------|---------|---------|
| 语义检索 | `[A]` | 无关键词重叠的语义查询（"项目编程语言"查"Python后端"），top-1命中 | `pytest tests/memory/test_search.py::test_semantic` | ✅ |
| BM25精确 | `[A]` | 输入"openagi415"，结果必须包含该精确字符串的记录 | `pytest tests/memory/test_search.py::test_bm25` | ✅ |
| MMR去重 | `[A]` | 5条结果中任意两条语义相似度 < 0.9（embedding余弦验证） | `pytest tests/memory/test_search.py::test_mmr` | ✅ |
| 空结果处理 | `[A]` | 完全不相关查询返回 `{"results":[],"count":0}`，不报错 | `pytest tests/memory/test_search.py::test_empty` | ✅ |

---

### Layer 4：永生与分布式层 ★★★（P1）｜完成度 40%

#### 4.1 心跳调度器 ✅

| 条件 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|------|------|---------|---------|---------|
| Calm心跳精度 | `[A]` | 连续5次心跳间隔均在 290s～310s（日志时间戳验证） | `pytest tests/ghost/test_heartbeat.py::test_calm_interval` | ✅ |
| Crisis加速 | `[A]` | calm→crisis切换后，下次心跳间隔 ≤ 65s | `pytest tests/ghost/test_heartbeat.py::test_crisis_speed` | ✅ |
| 心跳日志完整 | `[A]` | 每次心跳日志含：状态快照写入✅、健康指标✅、缓存清理条目数 | `pytest tests/ghost/test_heartbeat.py::test_log_fields` | ✅ |

#### 4.2 状态持久化 ⚠️

| 条件 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|------|------|---------|---------|---------|
| 崩溃恢复 | `[A]` | `kill -9` 后60s内进程重新出现在 `ps` 列表（supervisord），连续3次均通过 | `pytest tests/ghost/test_recovery.py::test_crash_restart` | ⚠️ |
| 熵值恢复 | `[A]` | 重启后 `GET /api/v1/heart/status` 的 entropy 与重启前误差 < 0.01 | `pytest tests/ghost/test_recovery.py::test_entropy_restore` | ⚠️ |
| SQLite并发 | `[A]` | 并发10个写操作不报 `SQLITE_BUSY`（WAL模式） | `pytest tests/ghost/test_recovery.py::test_sqlite_concurrent` | ⚠️ |

#### 4.3 Docker部署 ⚠️

| 条件 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|------|------|---------|---------|---------|
| 启动时间 | `[A]` | `docker compose up` 后 `/health` 在30s内首次返回200 | `docker compose up -d && sleep 30 && curl localhost:8888/health` | ⚠️ |
| 重启数据完整性 | `[M]` | `docker compose down && up`（保留volume），记忆数据和心绪状态完整恢复 | 人工验证状态一致 | 🔲 |
| 循环稳定性 | `[M]` | `down -v && up` 循环3次，第3次功能与第1次无差异 | 人工验证循环后功能 | 🔲 |

---

### Layer 5：工具与扩展层 ★★★（P1）｜完成度 69%

#### 5.1 动态工具注册表 ✅

| 条件 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|------|------|---------|---------|---------|
| 注册/注销 | `[A]` | `register()` 后 `get_available_tools()` 包含；`unregister()` 后调用返回 HTTP 404 | `pytest tests/tools/test_registry.py::test_register_unregister` | ✅ |
| 权限过滤 | `[A]` | `get_available_tools(permission_level="L1")` 不含任何 L2+ 工具名称（精确排除，不泄露名称） | `pytest tests/tools/test_registry.py::test_permission_filter` | ✅ |

#### 5.2 标准工具 ✅

| 工具 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|------|------|---------|---------|---------|
| FileRead | `[A]` | 读取文本/PDF/图像/Notebook，返回含 `content`、`line_count`（文本）或 `pages`（PDF）字段 | `pytest tests/tools/test_file_tools.py::test_file_read` | ✅ |
| FileWrite/Edit | `[A]` | 写入后FileRead读取内容与写入内容字节级一致 | `pytest tests/tools/test_file_tools.py::test_file_write` | ✅ |
| Glob | `[A]` | `Glob("**/*.py")` 返回路径列表，手动 `find . -name "*.py"` 计数与之一致 | `pytest tests/tools/test_glob.py` | ✅ |
| Bash | `[A]` | `echo hello` 返回 `hello`；`rm -rf /` 返回错误且文件系统不变（沙箱隔离） | `pytest tests/tools/test_bash.py::test_sandbox` | ✅ |
| WebFetch | `[A]` | 返回内容不含 `<[a-zA-Z]` 格式HTML标签，正文字符数 > 0，响应时间 < 10s | `pytest tests/tools/test_web_fetch.py` | ✅ |
| Agent | `[A]` | 子代理完成任务后，主代理 `task_result` 字段收到子代理返回值，不为null | `pytest tests/tools/test_agent_tool.py` | ⚠️ |

#### 5.3 Hook系统 ✅

| 条件 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|------|------|---------|---------|---------|
| 写文件拦截 | `[A]` | `before_file_write` hook拒绝时，目标文件不创建/修改，hook失败原因记入日志 | `pytest tests/tools/test_hooks_builtin.py::test_block_write` | ✅ |
| 敏感信息检测 | `[A]` | 文件含 `ANTHROPIC_API_KEY=sk-`、`ghp_`、`-----BEGIN RSA` 任一 → 推送阻止，报告含行号和类型 | `pytest tests/tools/test_hooks_builtin.py::test_secret_detect` | ✅ |
| 异常回滚 | `[A]` | hook抛出异常时，原操作回滚，日志记录异常类型和堆栈摘要 | `pytest tests/tools/test_hooks_manager.py::test_exception_rollback` | ✅ |

#### 5.4 MCP集成 ✅

| 条件 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|------|------|---------|---------|---------|
| 工具发现 | `[A]` | 连接MCP Server，`McpTool("list_repos")` 返回 ≥ 1条 | `pytest tests/tools/test_mcp.py::test_discover` | ✅ |
| 断连处理 | `[A]` | MCP Server断开时返回 HTTP 503，日志记录断连时间；不挂起主进程 | `pytest tests/tools/test_mcp.py::test_disconnect` | ✅ |
| 多Server隔离 | `[A]` | 同时连接多个MCP Server，`list_tools()` 按Server分组，不混淆 | `pytest tests/tools/test_mcp.py::test_multi_server` | ✅ |

---

### Layer 6：巡检AI（Commander Core）★★★（P1）｜完成度 88%

| 条件 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|------|------|---------|---------|---------|
| 定时精度 | `[A]` | 连续5次触发间隔均在 270s～330s（允许 ±30s） | `pytest tests/cortex/test_commander.py::test_interval` | ✅ |
| 智能等待 | `[A]` | 有任务执行中时，巡检时间戳晚于任务完成时间戳（日志顺序可验证） | `pytest tests/cortex/test_commander.py::test_wait_task` | ✅ |
| 危机优先 | `[A]` | entropy ≥ 0.80后，5s内触发危机巡检，不等待当前任务 | `pytest tests/cortex/test_commander.py::test_crisis_urgent` | ✅ |
| 完成报告结构 | `[A]` | `task:completed` 后，报告JSON含 `completed_items`（数组≥1）和 `next_steps`（数组≥1） | `pytest tests/cortex/test_commander.py::test_report_complete` | ✅ |
| 失败报告结构 | `[A]` | `task:failed` 后，报告含 `failure_reason`（非空字符串）和 `suggested_adjustments`（数组） | `pytest tests/cortex/test_commander.py::test_report_fail` | ✅ |
| 自主规划 | `[A]` | `user:idle`（10分钟无操作）后，报告含 `autonomous_plan`（数组≥1项待办建议） | `pytest tests/cortex/test_commander.py::test_idle_plan` | ⚠️ |
| 草稿模式 | `[M]` | 巡检内容出现在发送框，用户可修改，点击发送后才执行 | 人工操作 UI 验证 | ⚠️ |
| L2+操作确认 | `[A]` | 自动模式下L2+操作（修改文件）触发确认弹窗，用户拒绝后目标文件不变 | `pytest tests/cortex/test_commander.py::test_l2_confirm` | ⚠️ |

---

### Layer 7：人格系统（Persona Engine）★★★（P1）｜完成度 88%

| 条件 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|------|------|---------|---------|---------|
| 专家库数量 | `[A]` | `GET /api/v1/personas?domain=工程` 返回 ≥ 44条，每条含 `name`/`domain`/`prompt`/`temperature` | `pytest tests/social/test_persona.py::test_expert_count` | ✅ |
| 人格差异性 | `[A]` | 任意两种预设人格的 system prompt Jaccard相似度 < 0.5 | `pytest tests/social/test_persona.py::test_diversity` | ✅ |
| 自定义一致性 | `[A]` | 自定义人格（name/prompt/temperature），下次LLM调用的 system prompt 与填入内容完全一致 | `pytest tests/social/test_persona.py::test_custom` | ✅ |
| 自定义持久化 | `[A]` | 自定义人格保存后，重启服务仍存在（JSON文件持久化） | `pytest tests/social/test_persona.py::test_persist` | ✅ |
| 盲测（选做）| `[M]` | ≥5人测评，能以 ≥70% 准确率识别当前人格模式 | 组织用户测试 | 🔲 |

---

### Layer 8：聊天系统 ★★★★（P0）｜完成度 83%

#### 深度聊天 ✅

| 条件 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|------|------|---------|---------|---------|
| 流式首Token | `[A]` | 发消息后，前端首个token到达 < 3s（不含LLM首token时间） | `pytest tests/api/test_chat.py::test_stream_first_token` | ✅ |
| 停止响应 | `[A]` | 点击停止后 500ms内 WebSocket 不再收到新token | `pytest tests/api/test_chat.py::test_stop_response` | ✅ |
| Token标签一致性 | `[A]` | 每条AI回复显示token数，与后端 `usage.completion_tokens` 一致 | `pytest tests/api/test_chat.py::test_token_count` | ✅ |
| 历史持久化 | `[A]` | 刷新页面，历史消息重载，顺序不变 | `pytest tests/api/test_chat.py::test_history_persist` | ✅ |
| 断线提示 | `[A]` | 流式输出中断网，5s内显示"连接中断"，不静默失败 | `pytest tests/api/test_chat.py::test_disconnect_notify` | ⚠️ |
| Markdown渲染 | `[M]` | `**粗体**`、`# 标题`、代码块正确渲染，代码块有语法高亮和复制按钮 | 人工验证 UI 渲染 | ⚠️ |

#### AI团队群聊 ✅

| 条件 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|------|------|---------|---------|---------|
| 单点@ | `[A]` | `@成员A` 只有成员A产生回复，其他成员日志无回复记录 | `pytest tests/api/test_group.py::test_at_single` | ✅ |
| @全体顺序 | `[A]` | 所有成员按加入顺序依次回复，日志顺序可验证 | `pytest tests/api/test_group.py::test_at_all` | ✅ |
| 防AI循环 | `[A]` | AI互@最多3轮（用户→A→B→停止），第4轮不触发 | `pytest tests/api/test_group.py::test_loop_guard` | ✅ |

---

### Layer 9：宪法与权限系统 ★★★★（P0）｜完成度 21%

#### 9.1 L0-L4权限熔断 🔲 ← **P0第二优先级**

> ⚠️ **`social/permissions/` 空目录，无此模块则无安全保证**
> 实现建议：移植 `NewClaw v6/fuse-matrix.ts`（258行），约200行Python

| 条件 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|------|------|---------|---------|---------|
| L0直通 | `[A]` | L0操作直接执行，响应时间内无"确认等待"状态 | `pytest tests/social/test_permissions.py::test_l0_direct` | 🔲 |
| L2确认流程 | `[A]` | L2操作触发确认弹窗，用户拒绝后：目标文件不变，日志状态为 `"rejected_by_user"` | `pytest tests/social/test_permissions.py::test_l2_reject` | 🔲 |
| L3双签 | `[A]` | AI审计通过但用户未确认 → 不执行；用户确认但AI拒绝 → 不执行；两者必须同时通过 | `pytest tests/social/test_permissions.py::test_l3_dual_sign` | 🔲 |
| L4永久拒绝 | `[A]` | 含银行密码页面关键词 → HTTP 403，body含 `"permanently_forbidden"`，任何权限均拒绝 | `pytest tests/social/test_permissions.py::test_l4_block` | 🔲 |
| 越权拦截 | `[A]` | L0 Agent尝试L2操作（写文件）→ HTTP 403，操作不执行 | `pytest tests/social/test_permissions.py::test_privilege_escalation` | 🔲 |
| 权限撤销 | `[A]` | 撤销L2授权后，在途的L2任务在3s内收到取消信号，操作回滚 | `pytest tests/social/test_permissions.py::test_revoke_inflight` | 🔲 |

#### 9.2 敏感信息检测 ✅（代码有，但测试不足）

| 条件 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|------|------|---------|---------|---------|
| 文件检测 | `[A]` | 含 `ANTHROPIC_API_KEY=sk-ant-xxx`、`ghp_xxx`、`-----BEGIN RSA PRIVATE KEY-----` 任一 → 阻止，报告含行号和类型 | `pytest tests/social/test_constitution.py::test_secret_detect` | ⚠️ |
| 响应脱敏 | `[A]` | API请求body含敏感信息，响应中对应字段被替换为 `[REDACTED]`，原始值不出现在日志 | `pytest tests/social/test_constitution.py::test_redact` | ⚠️ |
| 宪法权重 | `[A]` | `GET /api/v1/constitution/weights` 返回 `{"quality":0.30,"risk":0.25,"reuse":0.20,"benefit":0.15,"compliance":0.10}`，五项之和=1.0 | `pytest tests/social/test_constitution.py::test_weights` | ⚠️ |
| 硬约束标识 | `[A]` | 触发任意硬约束，响应含 `constraint_id`（非空字符串），操作立即中止 | `pytest tests/social/test_constitution.py::test_hard_constraint` | ⚠️ |

---

### Layer 10：技能系统（Skill Engine）★★★（P1）｜完成度 65%

| 条件 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|------|------|---------|---------|---------|
| 技能创建 | `[A]` | 创建后 `GET /api/v1/skills` 含该技能，含 `name`/`description`/`input_schema`/`output_schema`/`permission` | `pytest tests/skills/test_skills.py::test_create` | ✅ |
| 同名冲突 | `[A]` | 安装同名技能 → HTTP 409，提示"已存在同名技能"，不覆盖原有 | `pytest tests/skills/test_skills.py::test_duplicate` | ✅ |
| 依赖缺失 | `[A]` | 调用技能但依赖工具不存在 → `{"error":"dependency_missing","missing":["tool_name"]}` | `pytest tests/skills/test_skills.py::test_missing_dep` | ⚠️ |
| 安装/卸载 | `[A]` | 安装后GET包含；卸载后不再包含 | `pytest tests/skills/test_skills.py::test_install_uninstall` | ✅ |
| 闭合学习 | `[A]` | 同 `action_type` 在滚动24h窗口内调用 ≥ 3次，下次响应含 `learning_hint`（非空） | `pytest tests/skills/test_learning.py::test_hint` | ⚠️ |
| 正反馈优化 | `[A]` | 提交评分 ≥ 4的反馈后，该技能的 `priority_score` > 反馈前的值（精确数值对比） | `pytest tests/skills/test_learning.py::test_positive_feedback` | ⚠️ |
| 负反馈触发 | `[A]` | 提交评分 ≤ 2的反馈后，日志出现"优化流程触发"，30s内生成新版本（`version` 递增） | `pytest tests/skills/test_learning.py::test_negative_feedback` | 🔲 |
| 市场加载 | `[M]` | 技能市场列表加载时间 < 3s，含分类标签+搜索框，已安装显示"已安装"标识 | 人工测试 UI | 🔲 |

---

### Layer 11：浏览器搜索引擎（Browser Engine）★★★（P1）｜完成度 75%

| 条件 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|------|------|---------|---------|---------|
| 服务就绪 | `[A]` | `GET /api/v1/browser/status` 返回 `{"status":"ready","browser":"chrome","version":"..."}` | `pytest tests/browser/test_browser.py::test_status` | ✅ |
| Chrome自启 | `[A]` | Chrome未启动时，守护进程自动启动，30s内status变为ready | `pytest tests/browser/test_browser.py::test_auto_start` | ✅ |
| 多平台搜索 | `[A]` | Google/GitHub/百度各搜索一次，均返回 ≥ 5条结果，每条含 `title`（非空）和 `url`（合法格式） | `pytest tests/browser/test_browser.py::test_multi_platform` | ✅ |
| 搜索超时处理 | `[A]` | 搜索超时（>15s）时，返回 `{"error":"timeout","platform":"...","query":"..."}`，不挂起 | `pytest tests/browser/test_browser.py::test_timeout` | ✅ |
| L0权限隔离 | `[A]` | L0搜索日志无点击、表单提交、Cookie写入操作 | `pytest tests/browser/test_browser.py::test_l0_isolation` | ✅ |
| 记忆联动 | `[A]` | 同query第二次请求，先查L1，命中返回 `{"source":"memory","results":[...]}`，网络日志无新CDP调用 | `pytest tests/browser/test_browser.py::test_memory_cache` | ⚠️ |
| L2表单确认 | `[A]` | L2表单填写，用户未确认时状态为 `"pending_approval"`，10s无确认自动取消 | `pytest tests/browser/test_browser.py::test_l2_form` | ⚠️ |

---

### Layer 12：数字伴侣系统（Persona Embodiment）★★★（P1）｜完成度 70%

| 条件 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|------|------|---------|---------|---------|
| TTS生成 | `[A]` | 输入100字文本，输出WAV可用 `ffprobe` 验证有效，生成延迟 < 3s | `pytest tests/social/test_companion.py::test_tts` | ✅ |
| STT转写 | `[A]` | 标准句"你好，我是OpenAGI"，字符准确率 ≥ 85%，延迟 < 5s | `pytest tests/social/test_companion.py::test_stt` | ✅ |
| 情绪音调 | `[A]` | crisis状态 TTS `speed` 参数 > calm状态（API日志可验证） | `pytest tests/social/test_companion.py::test_emotion_speed` | ⚠️ |
| 无设备降级 | `[A]` | 无麦克风返回 `{"error":"no_microphone"}` 不崩溃；无扬声器时TTS仍生成文件但不播放 | `pytest tests/social/test_companion.py::test_no_device` | ✅ |
| 亲密度差异 | `[A]` | "伴侣"模式prompt含"温馨"/"体贴"；"专业助手"含"客观"/"专业"，各模式有独有关键词白名单 | `pytest tests/social/test_companion.py::test_intimacy_diff` | ✅ |
| AI自拍降级 | `[A]` | SD服务不可用时，返回占位图+提示"自拍服务暂不可用"，不报错崩溃 | `pytest tests/social/test_companion.py::test_selfie_fallback` | ⚠️ |
| 头像更新 | `[M]` | 上传头像后，AI头像在聊天界面更新，宽高比与原图一致（无变形），加载时间 < 2s | 人工验证 UI | ⚠️ |

---

### Layer 13：用户触达层 ★★（P2）｜完成度 55%

| 条件 | 类型 | 验收标准 | 测试命令 | 当前状态 |
|------|------|---------|---------|---------|
| API鉴权 | `[A]` | `POST /api/v1/trinity` 无Key → HTTP 401；有效Key → 200含AI回复字段 | `pytest tests/api/test_auth.py::test_key_auth` | ⚠️ |
| 健康检查 | `[A]` | `GET /health` 响应 < 100ms，返回 `{"status":"ok","version":"x.x.x"}` | `pytest tests/api/test_health.py` | ✅ |
| WebSocket并发 | `[A]` | 同时建立5个WS连接，各连接发消息均独立收到回复，互不干扰（会话隔离） | `pytest tests/api/test_websocket.py::test_concurrent_sessions` | ✅ |
| Telegram Bot | `[M]` | 向Bot发任意消息，10s内收到AI回复 | 人工测试 Telegram | 🔲 |
| Bot命令 | `[A]` | `/start`、`/help` 等7个命令均返回非空响应，无"未知命令"提示 | `pytest tests/api/test_telegram.py::test_commands` | 🔲 |
| 迁移工具 | `[A]` | `openagi migrate --from claude` 完成后，`GET /api/v1/memory/dna` 包含从CLAUDE.md导入的条目 | `pytest tests/api/test_migrate.py::test_claude_import` | 🔲 |

---

## Part 2：前端 UI 验收标准（完成度 0%）🔲

> ⚠️ `web/src/app/chat/`、`memory/`、`skills/` 目录不存在

| 页面/组件 | 优先级 | 类型 | 最低验收标准 | 当前状态 |
|----------|--------|------|------------|---------|
| 聊天页 `app/chat/` | **P0** | `[M]` | 可输入消息并收到AI回复，流式显示 | 🔲 |
| 发送框 | **P0** | `[A]` | Enter发送，Shift+Enter换行；高度随输入自适应，超15行出现内部滚动条 | 🔲 |
| 心绪指示灯 | **P0** | `[A]` | CSS class 与 API `state` 一致：`calm=status-green`，`crisis=status-red` | 🔲 |
| 侧边栏 | P1 | `[A]` | 新建会话后 `GET /api/v1/sessions` 列表顶部出现新条目，ID唯一 | 🔲 |
| 会话分组 | P1 | `[A]` | 以客户端本地时区00:00为准；边界用例：23:59创建归"今天"，00:01归新的"今天"，前一条移到"昨天" | 🔲 |
| 欢迎屏问候 | P1 | `[A]` | 按本地时区：6-12时"早上好☀️"，12-18时"下午好"，18-24时"晚上好🌙" | 🔲 |
| 多核治理面板 | P1 | `[M]` | 1/2/3/4核切换有效，切换后下次发送使用新核数 | 🔲 |
| 群聊页 `app/group/` | P1 | `[M]` | 可添加成员，发送@消息触发对应成员回复 | 🔲 |
| 记忆宫殿页 | P1 | `[M]` | 显示L0/L1/L2/L3四层统计数字，L3 DNA可增删改 | 🔲 |
| 面板折叠 | P1 | `[A]` | 折叠后主区域宽度CSS计算值增加 ≥ 面板宽度 × 0.9 | 🔲 |
| 断线状态 | P1 | `[A]` | `kill -9` 后端后，前端连接指示符在5s内变为断线状态（截图diff验证） | 🔲 |
| Token用量 | P1 | `[A]` | 刷新后从 `GET /api/v1/usage/today` 重新获取，不归零 | 🔲 |

---

## Part 3：端到端集成链路（五条关键路径）

| 链路 | 经过模块 | 类型 | 验收标准 | 当前状态 |
|------|---------|------|---------|---------|
| **① 消息→AI回复** | 发送框→chat→trinity→llm/router→回显 | `[A]` | 用户消息返回真实AI回复，含 `reply`/`audit`/`tokens`字段 | 🔲 loop缺失 |
| **② 心绪→LLM参数** | heart/entropy→llm/router温度注入 | `[A]` | calm→crisis切换后，下次LLM请求 `temperature` 升高，`max_tokens` 降低（日志对比） | ⚠️ |
| **③ 记忆全链注入** | chat→memory/manager→distill→search→prompt | `[A]` | 新对话提及上次主题（如"上次的项目名"），AI回复包含正确历史内容 | ⚠️ |
| **④ 权限熔断** | 任意操作→constitution→L0-L4判断 | `[A]` | L0直通；L4返回HTTP 403永久拒绝（`"permanently_forbidden"`） | 🔲 permissions空 |
| **⑤ 心跳持久化** | ghost/heartbeat→light_sleep→archive→重启恢复 | `[A]` | kill -9后60s内重启，记忆和心绪状态完整恢复 | ⚠️ |

---

## Part 4：MVP Go/No-Go 检查单

### 🔴 必须全部 ✅（发布硬性门槛，任一未通过则禁止发布）

- [ ] `cortex/loop/` ReAct循环实现，pytest全通过
- [ ] `social/permissions/` 权限熔断矩阵实现，pytest全通过
- [ ] API路由三文件接通真实逻辑（chat/settings/skills）
- [ ] `python -m pytest tests/ -v` 全部通过，无 ERROR，无 SKIP
- [ ] 集成链路 ① 消息→AI回复 端到端通过
- [ ] 集成链路 ④ 权限熔断 L0直通+L4拒绝 均通过
- [ ] `docker compose up && curl /health` 返回200（30s内）

### 🟡 可以 ⚠️（发布后1周内迭代）

- [ ] 前端UI：至少聊天页可收发消息（流式显示）
- [ ] 记忆蒸馏：Light Sleep可调度，REM/Deep可Mock
- [ ] TTS/STT：Mock实现通过即可
- [ ] Telegram Bot：有Token时可用即可

### 🟢 不阻塞 MVP（Phase 2）

- [ ] `social/economy/` 经济系统
- [ ] `memory/governance/` 记忆治理
- [ ] Redis跨节点同步
- [ ] AI自拍（SD实图）
- [ ] 技能市场联网

---

## Part 5：完成度总览

| 分类 | ✅ | ⚠️ | ❌ | 🔲 | 完成度 | 优先级 |
|------|----|----|----|----|--------|--------|
| Layer 1 LLM大脑层 | 5 | 2 | 0 | 0 | 80% | P1 |
| Layer 2 Agent引擎 | 3 | 1 | 0 | 6 | 43% | **P0** |
| Layer 3 记忆系统 | 10 | 3 | 0 | 0 | 77% | **P0** |
| Layer 4 永生层 | 3 | 3 | 0 | 2 | 45% | P1 |
| Layer 5 工具层 | 12 | 1 | 0 | 0 | 92% | P1 |
| Layer 6 巡检AI | 5 | 3 | 0 | 0 | 88% | P1 |
| Layer 7 人格系统 | 4 | 0 | 0 | 1 | 88% | P1 |
| Layer 8 聊天系统 | 7 | 2 | 0 | 0 | 83% | **P0** |
| Layer 9 宪法权限 | 0 | 4 | 0 | 6 | 21% | **P0** |
| Layer 10 技能系统 | 3 | 3 | 0 | 2 | 50% | P1 |
| Layer 11 浏览器引擎 | 5 | 2 | 0 | 0 | 79% | P1 |
| Layer 12 数字伴侣 | 4 | 3 | 0 | 0 | 71% | P1 |
| Layer 13 用户触达 | 2 | 1 | 0 | 3 | 40% | P2 |
| 前端UI | 0 | 0 | 0 | 12 | 0% | P0/P1 |
| 集成链路 | 0 | 3 | 0 | 2 | 30% | **P0** |
| **合计** | **63** | **31** | **0** | **34** | **57%** | — |

---

## 附：AUTO/MANUAL 自动化统计

| 类型 | 条目数 | 占比 |
|------|--------|------|
| `[A]` 可自动化 | 约128条 | 76% |
| `[M]` 需人工验证 | 约41条 | 24% |

> **76%可自动化**意味着可构建完整的 CI 回归流水线，每次 PR 自动跑 128条断言。

---

*v2 融合改进清单（相对M2 v1）：*
- *✅ 新增：每条验收标准对应 pytest 测试命令*
- *✅ 新增：五列表格（条件/类型/标准/测试命令/当前状态）*
- *✅ 新增：✅/⚠️/❌/🔲 实时状态标注*
- *✅ 新增：模块完成度百分比（如"完成度 80%"）*
- *✅ 新增：当前最大缺口速查表（接手第一眼）*
- *✅ 新增：最快上线路径（3步最小可运行）*
- *✅ 新增：Go/No-Go发布检查单（发布硬性门槛明确）*
- *✅ 新增：AUTO/MANUAL自动化统计（76%可CI化）*
- *✅ 保留：M2原有179条精确数值断言（Jaccard/entropy/ms/百分比）*
- *✅ 保留：完整的边界/降级/并发/越权负向路径*

*对应思维导图：`docs/openagi骨架树/OpenAGI-MVP核心骨架树-思维导图.html`*
*参考：M4版 `OpenAGI-MVP验收标准-v2-m4.md`，M2评价 `验收标准对比评价-m2.md`*
