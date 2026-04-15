# OpenAGI

> 开源的多核AI治理框架——让多个AI互相审计、协作、进化，产出比单AI更可靠的结果。

## 核心特性

- **可配置1-4核治理引擎**：执行CEO + 审计A/B/C，每个核心可选不同模型和人格
- **永远记忆系统**：四层记忆（热/温/冷/核心DNA）+ 三阶段梦境蒸馏
- **心绪引擎**：双轴情绪（熵+效价）驱动全系统自适应行为
- **巡检AI**：定时+事件智能触发，代替用户自主规划下一步
- **95+位专家AI人格**：12个域全覆盖，全部中文
- **动态工具系统**：14+内置工具，权限分级，可扩展
- **权限熔断矩阵**：L0-L4分级安全治理，权限自动升核

## 快速开始

```bash
# 安装
git clone https://github.com/openagi/openagi.git
cd openagi
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

# 运行
uvicorn openagi.api.main:app --reload --port 8888

# 测试
python -m pytest tests/ -v

# Docker
docker compose up -d
```

## API端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| POST | `/api/v1/chat/send` | 发送消息（经多核治理） |
| POST | `/api/v1/trinity/run` | 运行Trinity流水线 |
| GET | `/api/v1/memory/search` | 搜索记忆 |
| GET | `/api/v1/heart/status` | 心绪状态 |
| GET | `/api/v1/personas` | 人格列表 |
| GET | `/api/v1/tools` | 工具列表 |
| GET | `/api/v1/commander/stats` | 巡检AI状态 |
| GET | `/api/v1/models` | 可用模型列表 |
| WS | `/ws/chat` | WebSocket实时聊天 |

## 测试

```
110 passed in 3.10s
```

## 致谢

- [Claude Code](https://github.com/anthropics/claude-code) by Anthropic
- [Claw Code](https://github.com/ultraworkers/claw-code) by UltraWorkers
- [Hermes Agent](https://github.com/NousResearch/hermes-agent) by Nous Research
- [OpenTeams](https://github.com/openteams-lab/openteams)
- [MemPalace](https://github.com/MemPalace/mempalace)
- [bb-browser](https://github.com/epiral/bb-browser)
- [Project AIRI](https://github.com/moeru-ai/airi)
- [Clawra](https://github.com/SumeLabs/clawra)
- [Agency Agents](https://github.com/msitarzewski/agency-agents)

## 协议

Apache-2.0
