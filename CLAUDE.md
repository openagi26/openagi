# OpenAGI 项目开发规则

## 安全启动规则（强制执行，无例外）

### 禁止事项
- **禁止** 运行 `uvicorn ... --reload` 不带 `--reload-dir openagi`。此操作会监控 node_modules + .venv 共4万+文件，导致内存爆炸（已发生74GB事故）
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

## 项目结构
- 后端：`openagi/`（Python，FastAPI）
- 前端：`web/`（Next.js 16，TypeScript）
- 测试：`tests/`（pytest）
- 文档：`docs/`
