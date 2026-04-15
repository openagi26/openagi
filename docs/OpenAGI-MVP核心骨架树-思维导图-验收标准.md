# OpenAGI MVP 核心骨架树 — 验收标准 v2

> **说明：**
> - `[AUTO]` = 可自动化测试  `[MANUAL]` = 需人工验证（含盲测协议）
> - 优先级：★★★★ = P0，★★★ = P1，★★ = P2，★ = P3
> - 本文件覆盖思维导图全部 14 个功能模块 + 模块间集成
> - v1→v2：经 2 轮外审，修复 20 个问题（完整性×10 + 可测试性×10）
> - P0 模块（Layer 2/3/聊天系统）详细标准见 `docs/P0_completion_criteria.md`

---

## Layer 1：LLM 大脑层 ★★★（P1）

### 1.1 多模型路由器

- [ ] `[AUTO]` `GET /api/v1/models` 返回已配置模型列表，至少含 Claude 和 GPT 系列各一个，每条含 `id`、`provider`、`latency_ms` 字段
- [ ] `[AUTO]` 分别指定不同 `model` 参数发送同一消息，响应中 `model` 字段与请求一致，两次结果不同
- [ ] `[AUTO]` 指定不存在的模型 ID，返回 HTTP 400，body 中含 `available_models` 列表，服务不崩溃
- [ ] `[AUTO]` 本地 Ollama 模型与云端模型使用相同 API 接口，响应格式一致（字段名相同）

### 1.2 中转模型管理

- [ ] `[MANUAL]` 输入 API Base URL + Key 后点击"一键测试"，返回模型列表；每条含：名称、状态（✅/❌）、延迟(ms)、评级
- [ ] `[AUTO]` 不可用模型的 `status` 字段为 `"error"`，HTTP 仍返回 200，不影响其他模型结果
- [ ] `[AUTO]` 设为主模型后，下次 LLM 调用的请求 body 中 `model` 字段与所选一致（日志可验证）

### 1.3 API 池故障转移

- [ ] `[AUTO]` 主模型连续失败 3 次（可 mock），第 4 次请求路由到回退模型 1，日志记录切换原因和时间戳
- [ ] `[AUTO]` 退避时间：第1次重试 2s，第2次 4s，第3次 8s；通过日志时间戳差值验证（允许误差 ±200ms）
- [ ] `[AUTO]` 故障转移发生时，前端 Toast 显示"已切换到 xxx 模型"，3 秒内出现
- [ ] `[AUTO]` 并发10个请求时，路由器不丢请求、不返回错误顺序（响应 request_id 与请求 request_id 一一对应）

### 1.4 情绪感知 Prompt

- [ ] `[AUTO]` 四种状态（calm/focused/anxious/crisis）的 system prompt 模板，任意两种之间词汇 Jaccard 相似度 < 0.5
- [ ] `[AUTO]` crisis 状态的 prompt 字数 ≤ calm 状态 prompt 字数的 50%

### 1.5 Token 预算管理

- [ ] `[AUTO]` crisis 模式下，API 请求中 `max_tokens` ≤ 正常模式的 60%（精确数值对比，非近似）
- [ ] `[AUTO]` 多核模式下，各核的 `max_tokens` 之和 ≤ 配置的总预算，无一核超出

---

## Layer 2：Agent 核心引擎 ★★★★（P0）

> 详细标准见 `docs/P0_completion_criteria.md`

### 补充：并发与异常恢复

- [ ] `[AUTO]` 同时发起 3 个多步任务，各任务日志 session_id 不交叉混淆，最终各自返回完整结果
- [ ] `[AUTO]` 子 Agent 崩溃（抛出未捕获异常）时，主 Agent 收到 `{"status": "agent_failed", "reason": "..."}` 并继续执行其余步骤
- [ ] `[AUTO]` L0 Agent 尝试发起 L2 操作（如写文件），权限系统拦截，返回 HTTP 403，操作不执行

---

## Layer 3：永远记忆系统 ★★★★（P0）

> 详细标准见 `docs/P0_completion_criteria.md`

### 补充：容量与降级

- [ ] `[AUTO]` L1 向量库写入 10,000 条后，查询延迟仍 < 500ms（性能基线）
- [ ] `[AUTO]` 向量库不可用时，降级写入本地 fallback 文件；恢复后自动同步，同步完成日志可验证

---

## Layer 4：永生与分布式层 ★★★（P1）

### 4.1 心跳调度器（GhostScheduler）

- [ ] `[AUTO]` calm 状态下，连续5次心跳间隔均在 290s～310s 之间（日志时间戳验证）
- [ ] `[AUTO]` 从 calm 切换到 crisis 后，下一次心跳间隔 ≤ 65s
- [ ] `[AUTO]` 每次心跳日志包含：状态快照写入✅、健康指标正常✅、缓存清理条目数

### 4.2 状态同步引擎

- [ ] `[AUTO]` 对后端进程执行 `kill -9`，60 秒内进程重新出现在 `ps` 列表（supervisord 恢复），连续3次测试均通过
- [ ] `[AUTO]` 进程重启后，`GET /api/v1/heart/status` 的 entropy 值与重启前误差 < 0.01（从 JSON 文件恢复）
- [ ] `[AUTO]` SQLite WAL 模式下，并发10个写操作不报 `SQLITE_BUSY` 错误

### 4.3 部署编排器

- [ ] `[AUTO]` `docker compose up` 后，`/health` 在 30 秒内首次返回 200
- [ ] `[MANUAL]` `docker compose down -v && docker compose up` 循环3次，第3次功能与第1次无差异
- [ ] `[AUTO]` `docker compose down && docker compose up`（保留 volume），记忆数据、心绪状态完整恢复，无数据丢失

---

## Layer 5：工具与扩展层 ★★★（P1）

### 5.1 动态工具注册表

- [ ] `[AUTO]` `register()` 后 `get_available_tools()` 包含新工具；`unregister()` 后调用该工具返回 HTTP 404
- [ ] `[AUTO]` `get_available_tools(permission_level="L1")` 不包含 L2+ 权限工具（精确过滤，不泄露高权限工具名称）

### 5.2 标准工具

- [ ] `[AUTO]` **FileRead**：读取文本/PDF/图像/Notebook，返回结构含 `content`、`line_count`（文本）或 `pages`（PDF）字段
- [ ] `[AUTO]` **FileWrite/Edit**：写入后 FileRead 读取内容与写入内容字节级一致
- [ ] `[AUTO]` **Glob**：`Glob("**/*.py")` 返回路径列表，手动 `find . -name "*.py"` 计数与之一致
- [ ] `[AUTO]` **Bash**：执行 `echo hello` 返回 `hello`；执行 `rm -rf /` 返回错误且文件系统不变（沙箱隔离）
- [ ] `[AUTO]` **WebFetch**：返回内容不含 `<[a-zA-Z]` 格式的 HTML 标签，正文字符数 > 0，响应时间 < 10s
- [ ] `[AUTO]` **Agent**：子代理完成任务后，主代理 `task_result` 字段收到子代理返回值，不为 null

### 5.3 Hook 系统

- [ ] `[AUTO]` `before_file_write` hook 返回拒绝信号，目标文件不创建/修改，hook 失败原因记入日志
- [ ] `[AUTO]` `before_git_push` hook 检测文件含 `ANTHROPIC_API_KEY=sk-`、`ghp_`、`-----BEGIN RSA` 任意一种，推送被阻止，返回含行号的报告
- [ ] `[AUTO]` hook 执行抛出异常时，原操作回滚，日志记录异常类型和堆栈摘要

### 5.4 MCP 集成

- [ ] `[AUTO]` 连接 GitHub MCP Server，`McpTool("list_repos")` 返回仓库列表，至少1条
- [ ] `[AUTO]` MCP Server 断开时，调用 MCP 工具返回 HTTP 503，日志记录断连时间；不挂起主进程
- [ ] `[AUTO]` 同时连接多个 MCP Server，`ListMcpResources` 分组列出各 Server 的工具，不混淆

---

## 巡检 AI（Commander Core）★★★（P1）

### 6.1 触发机制

- [ ] `[AUTO]` 5分钟定时巡检：日志中连续5条触发记录的间隔均在 270s～330s（允许 ±30s）
- [ ] `[AUTO]` 有任务执行中时，巡检记录时间戳晚于任务完成时间戳（日志顺序可验证）
- [ ] `[AUTO]` entropy ≥ 0.80 触发危机巡检：从事件触发到巡检日志出现 < 5s，不等待当前任务

### 6.2 报告生成

- [ ] `[AUTO]` `task:completed` 后，巡检报告 JSON 含 `completed_items`（数组，≥1项）和 `next_steps`（数组，≥1项）
- [ ] `[AUTO]` `task:failed` 后，报告含 `failure_reason`（字符串，非空）和 `suggested_adjustments`（数组）
- [ ] `[AUTO]` `user:idle`（10分钟无操作）后，报告含 `autonomous_plan`（数组，≥1项待办建议）

### 6.3 发送模式与权限

- [ ] `[MANUAL]` 草稿模式：巡检内容出现在发送框，用户可修改，点击发送后才执行
- [ ] `[AUTO]` 自动模式下 L0/L1 操作（写日志、查询 API）直接执行，日志无"等待确认"记录
- [ ] `[AUTO]` 自动模式下 L2+ 操作（修改文件）触发确认弹窗，用户拒绝后目标文件不变

---

## 人格系统（Persona Engine）★★★（P1）

### 7.1 人格设定

- [ ] `[AUTO]` 从专家库选"Python工程师"，Core-0 的 system prompt 含"Python"或"工程"，与默认 prompt 余弦相似度 < 0.7
- [ ] `[AUTO]` 自定义人格（填入 name/prompt/temperature），下次 LLM 调用的 system prompt 与填入内容完全一致
- [ ] `[MANUAL]` 盲测：随机切换3种模式，测评者不知当前模式，能以 ≥ 70% 准确率识别出正确模式（最少5人测试）

### 7.2 专家库

- [ ] `[AUTO]` `GET /api/v1/personas?domain=工程` 返回 ≥ 44 条，每条含 `name`、`domain`、`prompt`、`temperature` 字段
- [ ] `[AUTO]` 搜索"数据分析"，返回结果的 `prompt` 字段均含"数据"或"分析"相关词（精确字符串匹配，非语义）
- [ ] `[MANUAL]` 点击"预览 Prompt"，弹窗展示完整 system prompt，内容与数据库存储一致

---

## 聊天系统 ★★★★（P0）

> 详细标准见 `docs/P0_completion_criteria.md`

---

## 技能系统（Skill Engine）★★★（P1）

### 9.1 技能定义与调用

- [ ] `[AUTO]` 创建技能后，`GET /api/v1/skills` 返回该技能，含 `name`、`description`、`input_schema`、`output_schema`、`permission` 字段
- [ ] `[AUTO]` 安装同名技能时，返回 HTTP 409 并提示"已存在同名技能"，不覆盖原有技能
- [ ] `[AUTO]` 技能依赖的工具不存在时，调用返回 `{"error": "dependency_missing", "missing": ["tool_name"]}`

### 9.2 技能市场

- [ ] `[MANUAL]` 技能市场列表加载时间 < 3s，含分类标签和搜索框，已安装技能显示"已安装"标识不显示安装按钮
- [ ] `[AUTO]` 安装技能后，`GET /api/v1/skills` 包含该技能；卸载后不再包含

### 9.3 闭合学习循环

- [ ] `[AUTO]` 同一 `action_type` 在滚动 24 小时窗口内被调用 ≥ 3 次，下次调用响应含 `learning_hint` 字段且非空
- [ ] `[AUTO]` 提交评分 ≥ 4 的正面反馈后，`GET /api/v1/skills/{id}` 的 `priority_score` 字段 > 反馈前的值（精确数值对比）
- [ ] `[AUTO]` 提交评分 ≤ 2 的负面反馈后，日志出现"优化流程触发"记录，30 秒内生成新版本技能（`version` 字段递增）

---

## 免 API 浏览器搜索（Browser Engine）★★★（P1）

### 10.1 架构连通与降级

- [ ] `[AUTO]` 守护进程启动，`GET /api/v1/browser/status` 返回 `{"status": "ready", "browser": "chrome", "version": "..."}`
- [ ] `[AUTO]` Chrome 未启动时，守护进程执行 `chrome --headless` 自动启动，整个过程用户无需操作，30s 内 status 变为 ready
- [ ] `[AUTO]` Chrome 启动失败（如缺少依赖），`status` 返回 `"unavailable"`，错误信息含具体原因（非空）
- [ ] `[AUTO]` 搜索超时（>15s）时，返回 `{"error": "timeout", "platform": "...", "query": "..."}`，不挂起

### 10.2 多平台搜索

- [ ] `[AUTO]` Google/GitHub/百度 各搜索一次，均返回 ≥ 5 条结果，每条含 `title`（非空）和 `url`（合法格式）
- [ ] `[MANUAL]` 知乎/B站 各搜索一次，返回内容为中文，与查询词语义相关（人工验证）

### 10.3 权限与记忆联动

- [ ] `[AUTO]` L0 搜索请求日志中无点击、表单提交、Cookie 写入操作
- [ ] `[AUTO]` L2 表单填写操作，用户未确认时状态为 `"pending_approval"`，10 秒无确认则自动取消
- [ ] `[AUTO]` 同一 `query` 第二次请求时，先查 L1 记忆，命中则返回 `{"source": "memory", "results": [...]}` 且不发起 Chrome 请求（网络日志无新 CDP 调用）

---

## 宪法与权限系统 ★★★（P1）

### 11.1 L0-L4 权限熔断

- [ ] `[AUTO]` L0 操作直接执行，响应时间内无"确认等待"状态
- [ ] `[AUTO]` L2 操作触发确认弹窗，用户拒绝后：目标文件内容不变，操作日志状态为 `"rejected_by_user"`
- [ ] `[AUTO]` L3 操作：模拟 AI 审计通过但用户未确认，操作不执行；模拟用户确认但 AI 审计拒绝，操作不执行；两者需同时通过
- [ ] `[AUTO]` L4 操作（含银行密码页面关键词）：返回 HTTP 403，响应 body 含 `"permanently_forbidden"`，无论任何用户权限均拒绝
- [ ] `[AUTO]` 用户撤销 L2 授权后，已在途的 L2 任务在 3s 内收到取消信号，操作回滚

### 11.2 敏感信息检测

- [ ] `[AUTO]` 提交含 `ANTHROPIC_API_KEY=sk-ant-xxx`、`ghp_xxx`、`-----BEGIN RSA PRIVATE KEY-----` 任意一种的文件，hook 返回阻止信号，含检测到的行号和类型
- [ ] `[AUTO]` API 请求 body 含敏感信息，响应中对应字段被替换为 `[REDACTED]`，原始值不出现在日志
- [ ] `[AUTO]` 钩子与 L3 权限边界：hook 拦截属于自动 L2 审计，不等同于 L3 人工确认；两者串联时，hook 通过后仍需人工确认（集成测试验证）

### 11.3 宪法规则

- [ ] `[AUTO]` `GET /api/v1/constitution/weights` 返回 `{"quality": 0.30, "risk": 0.25, "reuse": 0.20, "benefit": 0.15, "compliance": 0.10}`，五项之和 = 1.0
- [ ] `[AUTO]` 触发任意一条硬约束，响应含 `constraint_id`（非空字符串，标识具体约束条款），操作立即中止

---

## 数字伴侣系统（Persona Embodiment）★★★（P1）

### 12.1 五感系统

- [ ] `[MANUAL]` 上传头像后，AI 头像在聊天界面更新，宽高比与原图一致（无变形），加载时间 < 2s
- [ ] `[AUTO]` 本地 Whisper.cpp 语音转文字：静音环境下，朗读标准句"你好，我是OpenAGI"，字符准确率 ≥ 85%，延迟 < 5s
- [ ] `[AUTO]` 本地 Piper TTS：输入100字文本，输出 WAV 文件可用 `ffprobe` 验证为有效音频，生成延迟 < 3s
- [ ] `[AUTO]` crisis 状态的 TTS `speed` 参数 > calm 状态（API 日志可验证），体现情绪差异
- [ ] `[MANUAL]` AI 执行代码时显示"打字"动画，搜索时显示"翻找"动画，两者不互换
- [ ] `[AUTO]` 无麦克风设备时，STT 功能返回 `{"error": "no_microphone"}` 而非崩溃；无扬声器时 TTS 仍生成文件但不播放

### 12.2 亲密沟通模式

- [ ] `[AUTO]` 5种模式的 system prompt 中，"伴侣"模式含"温馨"/"体贴"等词，"专业助手"模式含"客观"/"专业"等词，各模式有独有关键词白名单
- [ ] `[MANUAL]` 盲测：测评者（≥3人）能以 ≥ 60% 准确率识别当前模式，否则判定模式差异不足

### 12.3 AI 自拍

- [ ] `[MANUAL]` 发送"你在干嘛？"触发自拍，聊天区出现图片，图片内容与当前 HeartEngine 状态语义相关（人工判断）
- [ ] `[AUTO]` 图片生成调用本地 SD API（`localhost:7860` 或配置的本地端口），网络日志无外部付费 API 请求
- [ ] `[AUTO]` SD 服务不可用时，返回占位图 + 提示"自拍服务暂不可用"，不报错崩溃

---

## 用户触达层 ★★（P2）

### 13.1 Web API

- [ ] `[AUTO]` `POST /api/v1/trinity` 无 API Key 时返回 HTTP 401，有效 Key 时返回 200，含 AI 回复字段
- [ ] `[AUTO]` `GET /health` 响应 < 100ms，返回 `{"status": "ok", "version": "x.x.x"}`
- [ ] `[AUTO]` WebSocket `/ws` 同时建立 5 个连接，各连接发送消息均独立收到回复，互不干扰（会话隔离）

### 13.2 Telegram Bot

- [ ] `[MANUAL]` 向 Bot 发送任意消息，10s 内收到 AI 回复
- [ ] `[AUTO]` `/start`、`/help` 等7个命令均返回非空响应，无"未知命令"提示

### 13.3 迁移工具

- [ ] `[AUTO]` `openagi migrate --from claude` 完成后，`GET /api/v1/memory/dna` 包含从 CLAUDE.md 导入的条目
- [ ] `[AUTO]` 迁移报告包含 `total`、`success`、`failed`、`errors`（数组）4个字段，数值之和逻辑正确（`success + failed = total`）

---

## 首页 ★★★（P1）

### 14.1 导航栏

- [ ] `[MANUAL]` 4个标签页（深度聊天/AI团队群聊/记忆宫殿/设置）全部可点击跳转，当前标签高亮
- [ ] `[AUTO]` 心绪指示灯颜色通过 CSS class 验证（calm=`status-green` / crisis=`status-red`），class 与 API status 值一致

### 14.2 左侧边栏

- [ ] `[AUTO]` 点击"新建会话"，`GET /api/v1/sessions` 返回的列表顶部出现新条目，ID 唯一
- [ ] `[AUTO]` 会话分组边界以**客户端本地时区** 00:00 为准；验证用例：23:59 创建的会话归"今天"，下一分钟（00:01）创建的归"今天"（新的一天），前一条移到"昨天"
- [ ] `[MANUAL]` 右键菜单四个操作（重命名/置顶/归档/删除）均可执行，执行后列表状态立即更新
- [ ] `[AUTO]` 搜索框输入词，只显示标题或摘要含该词的会话（精确字符串匹配，非语义）

### 14.3 主区域

- [ ] `[MANUAL]` 新会话欢迎屏按本地时间显示：6-12 时"早上好☀️"，12-18 时"下午好"，18-24 时"晚上好🌙"
- [ ] `[AUTO]` 点击快捷卡片，`document.querySelector('textarea').value` 等于卡片文字，消息列表条数不增加

### 14.4 右侧面板

- [ ] `[MANUAL]` 深度聊天时，右侧面板含 1/2/3/4 核切换按钮，点击后核心数配置即时生效（下次发送使用新核数）
- [ ] `[AUTO]` 面板折叠后，主区域宽度 CSS 计算值增加 ≥ 面板宽度 × 0.9

### 14.5 底部状态栏

- [ ] `[AUTO]` 对后端执行 `kill -9` 后，前端连接指示符在 5s 内变为断线状态（自动化截图 diff 验证）
- [ ] `[AUTO]` 刷新页面后，Token 用量从 `GET /api/v1/usage/today` 重新获取，不归零
- [ ] `[AUTO]` 巡检 AI 开启时，倒计时每秒递减 1，误差 ≤ 1s（JS `performance.now()` 验证）

---

## 模块间集成测试（新增，P1）

> 外审指出：跨模块链路完全缺失，以下为补充。

### I1. 心绪引擎 → LLM 路由

- [ ] `[AUTO]` 从 calm 切换到 crisis，下一次 LLM 请求的 `temperature` 参数值升高，`max_tokens` 降低（日志两次请求对比）

### I2. 巡检 AI → 技能调用链路

- [ ] `[AUTO]` 巡检 AI 识别到可自动执行的 L0 任务，自动调用对应技能，技能返回结果写入巡检报告，端到端日志可追踪

### I3. 浏览器搜索 → 记忆系统

- [ ] `[AUTO]` 搜索完成后查 L1，相同 query 的结果已写入；重复相同搜索，L1 命中，CDP 请求日志中无新 Chrome 调用

### I4. 权限系统 → 工具注册表

- [ ] `[AUTO]` L1 权限用户调用 `get_available_tools()`，返回列表不含任何 L2+ 工具的名称（精确排除）

### I5. 记忆系统 → 聊天系统

- [ ] `[AUTO]` 新对话中提及上个对话出现过的主题（如"上次讨论的项目名"），系统从 L1 检索后注入当前 prompt，AI 回复包含正确项目名

---

## 汇总统计

| 模块 | 优先级 | 本文件条目 | AUTO | MANUAL |
|------|--------|-----------|------|--------|
| Layer 1 LLM大脑层 | P1 | 14 | 12 | 2 |
| Layer 2 Agent引擎（补充） | P0 | 3 | 3 | 0 |
| Layer 3 记忆系统（补充） | P0 | 2 | 2 | 0 |
| Layer 4 永生分布式层 | P1 | 9 | 8 | 1 |
| Layer 5 工具扩展层 | P1 | 15 | 14 | 1 |
| 巡检AI | P1 | 9 | 8 | 1 |
| 人格系统 | P1 | 6 | 3 | 3 |
| 聊天系统 | P0 | 见P0文件 | — | — |
| 技能系统 | P1 | 9 | 8 | 1 |
| 浏览器搜索引擎 | P1 | 9 | 7 | 2 |
| 宪法与权限系统 | P1 | 9 | 8 | 1 |
| 数字伴侣系统 | P1 | 10 | 6 | 4 |
| 用户触达层 | P2 | 6 | 5 | 1 |
| 首页 | P1 | 14 | 8 | 6 |
| 模块间集成（新增） | P1 | 5 | 5 | 0 |
| **P1-P3 合计** | — | **130** | **97** | **23** |

> **P0 另有 49 条**（见 `docs/P0_completion_criteria.md`）
> **全项目合计：179 条验收标准**（72h AUTO 可执行 126 条，MANUAL 53 条）

---

*v2 修复清单（v1→v2 共解决 20 个外审问题）：*
- *新增：并发场景（LLM路由、WebSocket多连接）*
- *新增：失败降级（Chrome失败、STT/TTS无设备、SD不可用）*
- *新增：模块间集成测试章节（5条）*
- *新增：越权拦截、权限撤销、用户触达鉴权*
- *新增：技能冲突（同名409）、技能依赖缺失*
- *修复：supervisord 5s 计时起点明确为 `kill -9`，连续3次*
- *修复："纯文本"改为正则排除 HTML 标签*
- *修复：巡检报告改为 JSON 结构字段断言*
- *修复：人格模式改为 Jaccard 相似度 < 0.5*
- *修复："同一操作"明确为 action_type + 24h 窗口*
- *修复：技能优先级"提升"改为精确数值对比*
- *修复：L3 权限与 hook 的边界划分*
- *修复：连接状态测试明确为 `kill -9` + 截图 diff*
- *修复：会话分组边界明确为客户端时区 + 边界用例*

*对应思维导图：`docs/openagi骨架树/OpenAGI-MVP核心骨架树-思维导图.html`*
*m4 版本产出后进行 PK 合并*
