# OpenAGI 项目开发规则

## 硬件环境（永久记住，不得搞混）
- **M4**：MacBook Air M4，陛下的主力开发机，当前这台电脑
- **M2**：MacBook Air M2，陛下的第二台电脑，用于双机协作
- GitHub 协作仓库：`openagi26/openagi415`（私有，双机共用）
- GitHub 未来公开仓库：`openagi26/openagi`

## 安全启动规则（强制执行，无例外）

### 禁止事项
- **禁止** 运行 `uvicorn ... --reload` 不带 `--reload-dir openagi`。此操作会监控 node_modules + .venv 共4万+文件，导致内存爆炸（已发生74GB事故）
- **禁止** 在 Claude Code 内启动前端 dev server（已导致84GB+85GB两次事故）。前端只做 `next build` 验证。`next dev`、`pnpm dev`、`npx next dev` 全部禁止，无任何例外，包括"快速测试一下"也不行
- **禁止** 在 Claude Code 内同时启动2个以上后台服务器进程
- **禁止** 在包含 node_modules 的目录下运行任何 file-watcher 工具
- **禁止** 不经 `make pre-check` 直接启动开发服务器

### 正确做法
- 后端启动：`make dev`（已内置 `--reload-dir openagi` 和前置检查）
- 前端启动：`make web`（已内置 `NODE_OPTIONS` 内存限制）
- 联调测试：用 `httpx` 脚本直接测 API，不在 Claude Code 内同时跑前后端
- 启动前清理：`make kill` 或 `make pre-check`
- 需要浏览器验证时：只启动后端，告知用户手动在另一个终端运行 `make web`

### ChromaDB 注意事项
- ChromaDB 初始化会加载嵌入模型（~1GB），uvicorn --reload 每次重启会重新加载
- 测试中使用临时目录，避免 ChromaDB 持久化数据干扰

## 上下文预算系统（防崩溃，强制执行）

### 背景
已发生3次内存爆炸事故（74GB/ECONNRESET/84GB），全部因子代理+后台进程过多导致。

### 子代理铁律（2026-04-16 陛下裁定）
- **编码子代理最多同时2个**（加CEO主进程=3个并发连接，第2次崩溃证明5个会ECONNRESET）
- **审计子代理（三核模式）不受此限制**，因为只读摘要返回评分，资源极低
- 审计代理 prompt ≤ 500 token，返回 ≤ 200 token
- **宁可慢，不可崩** —— 这是陛下的明确指示

### 上下文节约规则
- **Read 文件必须用 offset/limit**，禁止全量读取 >100 行的文件
- 陛下说"直接回答"时，跳过三核博弈（合规豁免）
- 审计子代理返回限制在 200 token 以内
- 每 5 轮交互后，CEO 主动评估是否需要 /compact

### /compact 触发纪律
- CEO 感知到回复变慢或内容重复 → 建议陛下执行 /compact
- 大批量子代理任务完成后 → 立即建议 /compact
- 新的重大任务开始前 → 建议先 /compact 清空历史

### MEMORY.md 持久化
- 每完成一个里程碑 → 写入 MEMORY.md
- 关键决策、文件路径、进度状态 → 写入 MEMORY.md
- 确保即使开新会话也能无缝接续

## 项目结构
- 后端：`openagi/`（Python，FastAPI）
- 前端：`web/`（Next.js 16，TypeScript）
- 测试：`tests/`（pytest）
- 文档：`docs/`
