# OpenAGI

**English** | [中文](#chinese)

> An open-source AI assistant framework with multi-model governance, local Ollama support, and persistent memory — run entirely on your own machine.

---

## What is OpenAGI?

OpenAGI is a self-hosted AI chat platform that lets you run multiple AI models simultaneously, compare their answers through a three-model governance engine, and maintain a persistent memory that grows smarter over time. It works with local Ollama models (no API key needed), OpenAI-compatible APIs, and Anthropic Claude — your data stays on your machine.

**Key differentiators vs ChatGPT / Claude.ai:**
- **Trinity governance engine** — three AI models debate and cross-audit every response, reducing hallucinations
- **Local-first with Ollama** — fully air-gapped operation, zero data leaves your machine
- **Persistent semantic memory** — ChromaDB-backed long-term memory that survives session restarts

---

## Core Features

| Feature | Description |
|---------|-------------|
| Multi-model chat | Switch between Ollama, Anthropic, OpenRouter in one UI |
| Trinity governance | Three-AI debate engine for higher-quality, audited responses |
| Group chat | Spawn multiple AI agents in one conversation |
| Persistent memory | Semantic search over full conversation history (ChromaDB) |
| Workflow engine | Chain AI tasks into automated pipelines |
| Desktop app | Tauri-based native desktop companion (macOS / Windows / Linux) |
| Settings panel | Model selection, persona configuration, API key management |

---

## Standing on the shoulders of giants

OpenAGI did not emerge from a vacuum. We owe a deep debt to the following open-source projects and communities:

| Project | What we borrowed |
|---------|-----------------|
| **[OpenTeams](https://github.com/openteams-lab/openteams)** | Group-chat core UX, `@mention` communication pattern, discussion↔work mode switching, automatic task dispatch, skill system |
| **Hermes Agent** | Closed learning loop design, multi-terminal backend architecture |
| **[Claude Code](https://github.com/anthropics/claude-code) / Claw Code** | 23-tool standard toolset, Hook system, MCP integration patterns |
| **bb-browser** | 36-platform API-free browser search engine |
| **MemPalace** | Hierarchical distillation memory architecture |
| **OpenClaw** | L1 warm-memory layer, knowledge distillation pipeline, hybrid retrieval |
| **NewClaw v6** | Trinity governance engine, three-core debate mechanism |
| **openagi_m2** | Biological metaphor for module naming (cortex / heart / ghost / soul / flesh) |
| **[ChromaDB](https://github.com/chroma-core/chroma)** | Vector store for persistent semantic memory |
| **[LiteLLM](https://github.com/BerriAI/litellm)** | Unified multi-provider LLM adapter layer |
| **[Ollama](https://github.com/ollama/ollama)** | Local model runtime enabling fully air-gapped operation |

> See `/docs/MVP_CORE_ARCHITECTURE.md` Section 20 for full acknowledgments.

**致谢（中文）**：OpenAGI 站在众多开源项目的肩膀上——从 OpenTeams 的群聊交互模式，到 Hermes Agent 的闭合学习循环，再到 NewClaw 的三核博弈引擎。我们对所有原始作者致以最深的敬意。

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12 + FastAPI + LiteLLM |
| Frontend | Next.js 16 + TypeScript + Tailwind CSS |
| AI runtime | Ollama (local) + Anthropic Claude + OpenRouter |
| Memory | ChromaDB (vector store) + SQLite |
| Desktop | Tauri (Rust) |
| Task scheduling | APScheduler |

---

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 20+ / pnpm
- [Ollama](https://ollama.ai) (optional, for local models)

### 1. Clone & install

```bash
git clone https://github.com/openagi26/openagi.git
cd openagi
cp .env.example .env   # fill in at least one API key, or use Ollama (no key needed)
pip install -e .
cd web && pnpm install && cd ..
```

### 2. Start backend

```bash
make dev
# Backend runs on http://localhost:8888
```

### 3. Start frontend (separate terminal)

```bash
make web
# Frontend runs on http://localhost:3000
```

### 4. (Optional) Pull a local model

```bash
ollama pull qwen2.5:0.5b   # lightweight, runs on any laptop
```

Open `http://localhost:3000` and start chatting.

---

## Environment Variables

Copy `.env.example` to `.env`:

```env
# At least one of these (or use Ollama with no key)
ANTHROPIC_API_KEY=sk-ant-xxx
OPENROUTER_API_KEY=sk-or-xxx

# Server
HOST=0.0.0.0
PORT=8888
FRONTEND_URL=http://localhost:3000
```

---

## Project Structure

```
openagi/
├── openagi/              # Backend (Python / FastAPI)
│   ├── api/              # HTTP routes
│   ├── chat/             # Chat session management
│   ├── cortex/           # Governance engine (Trinity)
│   │   ├── trinity/      # Three-model debate & audit
│   │   ├── commander/    # Agent orchestration
│   │   └── llm/          # LiteLLM model adapters
│   ├── memory/           # Persistent semantic memory (ChromaDB)
│   └── tools/            # MCP tools, browser, executor
├── web/                  # Frontend (Next.js 16)
│   └── src/app/
│       ├── chat/         # Main chat UI
│       ├── group/        # Group chat (multi-agent)
│       ├── memory/       # Memory browser
│       ├── workflow/     # Workflow builder
│       └── settings/     # Model & API configuration
├── desktop/              # Tauri desktop app
├── tests/                # pytest test suite
├── docs/                 # Documentation & evidence screenshots
└── Makefile              # Dev commands (make dev / make web / make test)
```

---

## Screenshots

<!-- Screenshots from docs/screenshots-2026-04-17/ -->
> Real browser screenshots from E2E validation (35/35 tests passing).

![Chat UI](docs/screenshots-2026-04-17/EVIDENCE-REPORT.md)

---

## Development Commands

```bash
make dev          # Start backend (safe: --reload-dir constrained)
make web          # Start frontend with memory limits
make test         # Run pytest suite
make kill         # Kill all dev servers
make pre-check    # Safety check before starting servers
make docker-up    # Run full stack in Docker
```

---

## Roadmap

### v1.0 — Current (April 2026)
- [x] Multi-model chat with real LLM responses
- [x] Trinity three-model governance engine
- [x] Ollama local model support
- [x] Persistent memory (ChromaDB)
- [x] Group chat (multi-agent)
- [x] Workflow engine (basic)
- [x] Desktop companion app (Tauri)
- [x] Full E2E test suite (35/35 passing)

### v1.1 — Next
- [ ] MCP (Model Context Protocol) tool integrations
- [ ] Voice input / output
- [ ] Plugin marketplace
- [ ] Mobile companion app

### Vision
Reach 1 million users as a credible open-source alternative to ChatGPT and Claude.ai — privacy-first, locally runnable, and governance-verified.

---

## Docker

```bash
docker-compose up -d
# Backend: http://localhost:8888
# Frontend: http://localhost:3000
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding standards, and PR guidelines.

---

## License

[MIT License](LICENSE) — Copyright (c) 2026 OpenAGI Contributors

---

<a name="chinese"></a>

## 中文说明

OpenAGI 是一个自托管 AI 聊天平台，核心特性：

- **三核博弈引擎**：三个 AI 模型互相审计每一条回复，降低幻觉率
- **本地 Ollama 优先**：完全离线运行，数据不离开本机
- **持久化语义记忆**：基于 ChromaDB 的长期记忆，关闭窗口不丢失上下文

**两步启动：**

```bash
make dev    # 启动后端（:8888）
make web    # 启动前端（:3000）
```

**支持模型**：Ollama 本地模型 / Anthropic Claude / OpenRouter 全系列模型

详见英文文档，所有命令和配置同样适用。
