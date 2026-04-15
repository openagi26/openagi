FROM python:3.12-slim-bookworm

WORKDIR /app

# 系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Python依赖
COPY pyproject.toml README.md ./
RUN pip install --no-cache-dir -e ".[dev]"

# 应用代码
COPY . .

# 数据目录
RUN mkdir -p /app/data

# 环境变量
ENV OPENAGI_PORT=8888
ENV OPENAGI_DATA_DIR=/app/data
ENV OPENAGI_LOG_LEVEL=INFO

EXPOSE 8888

CMD ["uvicorn", "openagi.api.main:app", "--host", "0.0.0.0", "--port", "8888"]
