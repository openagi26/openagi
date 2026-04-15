FROM python:3.12-slim-bookworm

WORKDIR /app

# 系统依赖（仅curl用于healthcheck，绝大多数Python包使用预编译wheel）
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python依赖（先复制依赖文件，利用Docker层缓存）
COPY pyproject.toml README.md ./
RUN pip install --no-cache-dir -e ".[dev]"

# 应用代码
COPY openagi/ ./openagi/

# 数据目录（持久化挂载点）
RUN mkdir -p /app/data

# 环境变量
ENV OPENAGI_PORT=8888
ENV OPENAGI_DATA_DIR=/app/data
ENV OPENAGI_LOG_LEVEL=INFO

EXPOSE 8888

# 使用单进程模式（Docker内不需要--reload）
CMD ["uvicorn", "openagi.api.main:app", "--host", "0.0.0.0", "--port", "8888", "--workers", "1"]
