# OpenAGI 致谢与参考应用吸收记录

> 版本：2026-04-16 | 15个对标项目 | 吸收状态实时更新

## 致谢 (Acknowledgments)

OpenAGI 的诞生离不开以下优秀开源项目的启发和贡献：

### 核心架构参考
- **[Claude Code](https://github.com/anthropics/claude-code)** by Anthropic — 工具系统标准、上下文压缩、Hook框架、MCP协议、计划模式和子代理架构的参考蓝本
- **[Claw Code](https://github.com/ultraworkers/claw-code)** by UltraWorkers — 确定性测试框架的灵感来源
- **[Hermes Agent](https://github.com/NousResearch/hermes-agent)** by Nous Research — 闭合学习循环、技能自进化、多终端后端和用户建模的核心灵感

### 多智能体协作
- **[OpenTeams](https://github.com/openteams-lab/openteams)** by OpenTeams Lab — AI团队群聊、@沟通机制、讨论/工作模式切换和技能系统的参考设计

### 记忆系统
- **[MemPalace](https://github.com/MemPalace/mempalace)** — 分层蒸馏永久记忆架构的理论基础和设计灵感

### 浏览器能力
- **[bb-browser](https://github.com/epiral/bb-browser)** by Epiral — 免API浏览器搜索引擎的核心技术（CDP + Cookie复用 + 36平台103命令）

### 数字伴侣
- **[Project AIRI](https://github.com/moeru-ai/airi)** by Moeru AI — 五感数字生命系统、Live2D/VRM形象和语音交互的参考架构
- **[Clawra](https://github.com/SumeLabs/clawra)** by Sume Labs — AI自拍系统和视觉伴侣交互的灵感来源

### AI人格
- **[Agency Agents](https://github.com/msitarzewski/agency-agents)** by Matt Sitarzewski — 206位专家AI人格模板库

### 自动化变现
- **[MoneyPrinterV2](https://github.com/FujiwaraChoki/MoneyPrinterV2)** by FujiwaraChoki — YouTube Shorts全自动生产+Twitter机器人+联盟营销变现闭环

### 全平台搜索
- **[Agent Reach](https://github.com/Panniantong/Agent-Reach)** by Panniantong — 16+平台零API费用互联网访问能力（含小红书/抖音/B站/微博）

### 工程最佳实践
- **[claude-code-best-practice](https://github.com/shanraisshan/claude-code-best-practice)** by shanraisshan — CLAUDE.md分层管理+子代理隔离+50%上下文compact触发

---

## 吸收状态总览

| # | 项目 | 吸收状态 | 落地代码 | 核心成果 |
|---|------|---------|---------|---------|
| 1 | NewClaw v6 | ✅ 深度融入 | trinity/+constitution/+permissions/ | Trinity引擎+宪法+熔断矩阵 |
| 2 | OpenAGI_m2 | ✅ 深度融入 | heart/+llm/+memory/+ghost/ | 心绪引擎+LLM路由+记忆+调度 |
| 3 | OpenClaw | ✅ 深度融入 | memory/+tools/hooks/+tools/mcp/ | 蒸馏+Hook+MCP+混合检索 |
| 4 | Hermes Agent | ✅ 已评估超越 | chat/skills/ | 技能引擎+学习循环+市场 |
| 5 | Claude Code | ✅ 深度融入 | tools/+cortex/loop/ | 23工具+ReAct+压缩+Hook |
| 6 | Claw Code | ✅ 已融入 | tests/ (765个) | 确定性测试框架 |
| 7 | OpenTeams | ✅ 已吸收 | group/page.tsx+chat/group/ | 8个团队协议+@提及+模式切换 |
| 8 | bb-browser | ✅ 已吸收 | tools/browser/+skills/ | CDP引擎+36平台适配+技能注册 |
| 9 | MemPalace | ✅ 已评估覆盖 | memory/ 四层架构 | L0-L3分层已实现 |
| 10 | AIRI | ✅ 已吸收 | companion/+skills/ | 五感系统+9情绪+技能注册 |
| 11 | Clawra | ✅ 已吸收 | companion/+skills/ | 自拍系统+灵魂注入+技能注册 |
| 12 | Agency Agents | ✅ 已吸收 | persona/agents_206.json | 191个专家人格（去重后） |
| 13 | MoneyPrinterV2 | 📋 已登记 | skills/市场目录 | 自动化变现闭环（视频+社媒+联盟） |
| 14 | Agent Reach | 📋 已登记 | skills/市场目录 | 16+平台搜索+零API费用 |
| 15 | claude-code-best-practice | 📋 已登记 | skills/市场目录+工程规范 | 分层管理+compact触发+子代理隔离 |

## 量化成果

| 指标 | 数值 |
|------|------|
| 后端代码 | 15,587 行 Python |
| 前端代码 | 4,668 行 TypeScript |
| 测试 | 765 个（8,179行测试代码） |
| 人格模板 | 191 个（16个领域） |
| 技能市场 | 24 个技能 |
| 团队模板 | 8 个（含Team Protocol） |
| API端点 | 20 个（全部HTTP 200） |
| 前端路由 | 7 个（全部编译通过） |

---

*所有参考项目的使用均遵循其各自的开源许可证。OpenAGI 采用 Apache-2.0 协议。*
