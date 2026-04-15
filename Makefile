.PHONY: dev test api web install clean kill pre-check docker-build docker-up docker-down docker-logs

install:
	pip install -e ".[dev]"
	cd web && pnpm install

# ⚠️ 安全启动前置检查：清理残留进程 + 缓存
pre-check:
	@echo "🔍 检查残留进程..."
	-pkill -f "uvicorn openagi" 2>/dev/null || true
	-pkill -f "next-server" 2>/dev/null || true
	-pkill -f "pnpm dev" 2>/dev/null || true
	-pkill -f "python.*pytest" 2>/dev/null || true
	@echo "🧹 清理缓存..."
	@rm -rf web/.next/cache 2>/dev/null || true
	@echo "✅ 环境就绪"

# 后端：必须指定 --reload-dir，避免监控 node_modules/.venv 导致内存爆炸
# 严禁直接运行 uvicorn --reload 不带 --reload-dir
dev: pre-check
	NODE_OPTIONS="--max-old-space-size=512" \
	uvicorn openagi.api.main:app --reload --reload-dir openagi --port 8888

# 前端：限制 Node 内存上限为 1GB，独立终端运行
web:
	NODE_OPTIONS="--max-old-space-size=1024" pnpm dev --port 3000

test:
	python -m pytest tests/ -v --tb=short

test-quick:
	python -m pytest tests/ -x -q --tb=line

lint:
	ruff check openagi/ tests/

# 清理所有后台进程（防内存泄漏）——包括 pytest 残留
kill:
	-pkill -f "uvicorn openagi" 2>/dev/null || true
	-pkill -f "next-server" 2>/dev/null || true
	-pkill -f "pnpm dev" 2>/dev/null || true
	-pkill -f "python.*pytest" 2>/dev/null || true
	@echo "✅ 所有开发进程已停止"

clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name .pytest_cache -exec rm -rf {} +
	rm -rf web/.next/cache 2>/dev/null || true

# ─── Docker 部署 ─────────────────────────────────────────────────────────────
docker-build:
	@echo "🐳 构建 OpenAGI Docker 镜像..."
	docker compose build --no-cache
	@echo "✅ 镜像构建完成"

docker-up:
	@echo "🚀 启动 OpenAGI 容器..."
	docker compose --env-file .env up -d
	@echo "✅ 服务已启动，访问 http://localhost:8888/health 检查状态"

docker-down:
	@echo "🛑 停止 OpenAGI 容器..."
	docker compose down
	@echo "✅ 容器已停止"

docker-logs:
	docker compose logs -f openagi
