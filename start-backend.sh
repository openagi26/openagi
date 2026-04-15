#!/bin/bash
# OpenAGI 后端启动脚本（一键运行，无需激活虚拟环境）

set -e

# 切换到项目目录
cd "$(dirname "$0")"
echo "📁 项目目录: $(pwd)"

# 检查虚拟环境
if [ ! -f ".venv/bin/uvicorn" ]; then
    echo "❌ 找不到虚拟环境！请先运行："
    echo "   python3 -m venv .venv && .venv/bin/pip install -e '.[dev]'"
    exit 1
fi

# 释放端口
echo "🔍 清理残留进程..."
lsof -ti:8888 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

# 检查.env
if [ -f ".env" ]; then
    echo "✅ 找到 .env 配置文件"
else
    echo "⚠️  未找到 .env，将使用演示模式"
fi

echo ""
echo "🚀 启动后端服务... (按 Ctrl+C 停止)"
echo "📡 访问地址: http://localhost:8888"
echo "🏥 健康检查: http://localhost:8888/health"
echo "────────────────────────────────────────"

# 启动
.venv/bin/uvicorn openagi.api.main:app \
    --host 0.0.0.0 \
    --port 8888 \
    --reload \
    --reload-dir openagi \
    --log-level info
