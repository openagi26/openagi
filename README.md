<p align="center">
  <img src="src/assets/logo.svg" width="128" height="128" alt="OpenAGI Logo" />
</p>

<h1 align="center">OpenAGI</h1>
<p align="center">个人 AI 超级助手桌面应用</p>

---

## 简介

OpenAGI 是一款面向中国市场的个人 AI 超级助手桌面应用，具备：

- 🎨 精美的桌面 GUI 界面
- 🧠 多渠道 AI 消息编排引擎（微信/钉钉/飞书/QQ/WhatsApp/Telegram 等）
- ⚡ Claude Code 代码编写和自主执行能力
- 🚀 17+ AI 模型服务商支持（含国产大模型）
- 🧩 53 个内置技能 + OpenAGIHub 技能市场

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发模式
pnpm dev

# TypeScript 类型检查
pnpm typecheck

# 构建生产版本
pnpm build

# 打包 macOS 安装包
pnpm package:mac
```

## 支持的 AI 模型

| 分类 | 服务商 | 模型 |
|------|--------|------|
| 🌍 国际 | Anthropic | Claude Opus/Sonnet/Haiku |
| 🌍 国际 | OpenAI | GPT-5/4 |
| 🌍 国际 | Google | Gemini |
| 🇨🇳 国产 | DeepSeek | DeepSeek-Chat |
| 🇨🇳 国产 | 智谱 AI | GLM-4-Plus |
| 🇨🇳 国产 | 百度 | 文心一言 ERNIE-4.5 |
| 🇨🇳 国产 | 通义千问 | Qwen-3.5 |
| 🇨🇳 国产 | 月之暗面 | Kimi K2.5 |
| 🇨🇳 国产 | 字节跳动 | 豆包 |
| 🇨🇳 国产 | 讯飞 | 星火 |
| 🇨🇳 国产 | MiniMax | MiniMax-M2.7 |
| 🔄 中转 | OpenRouter | 多模型中转 |
| 🔄 中转 | SiliconFlow | 硅基流动 |
| 🏠 本地 | Ollama | 本地运行模型 |

## 支持的消息渠道

微信 · 钉钉 · 飞书 · QQ · WhatsApp · Telegram · Slack · Discord · Signal · iMessage · Matrix · Line · MS Teams

## 技术栈

| 组件 | 技术 |
|------|------|
| 桌面框架 | Electron 40 |
| 界面 | React 19 + TypeScript |
| 样式 | Tailwind CSS + Shadcn UI |
| 状态管理 | Zustand |
| AI 内核 | OpenClaw 2026.4 |
| 代码引擎 | Claude Code (Rust FFI) |
| 构建 | Vite 7 + pnpm |
| 测试 | Vitest + Playwright |

## 项目结构

```
openagi/
├── electron/           # Electron 主进程
│   ├── main/           # 应用入口、窗口管理
│   ├── gateway/        # OpenClaw 网关管理
│   ├── code-engine/    # Claude Code 引擎集成
│   ├── intent-router/  # 统一意图路由器
│   ├── api/            # Host API 服务器
│   └── services/       # 后端服务
├── src/                # React 渲染进程
│   ├── pages/          # 页面组件
│   ├── stores/         # Zustand 状态管理
│   ├── components/     # 可复用组件
│   ├── i18n/           # 多语言（默认中文）
│   └── lib/            # 工具库
├── resources/          # 应用资源（图标、二进制）
└── scripts/            # 构建脚本
```

## 许可证

MIT
