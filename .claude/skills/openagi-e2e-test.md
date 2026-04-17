# OpenAGI 端到端真实浏览器测试 Skill

**陛下 2026-04-17 亲定蒸馏**。本次测试硬仗得到的方法论，防止下次重蹈覆辙。

---

## 零、核心原则（血泪教训）

1. **证据铁律**：API 200 ≠ 通过；只有**真实浏览器回复截图**算数
2. **不中断铁律**：不问陛下"a/b"选择题；遇阻自己换方案
3. **务实汇报**：发送成功 ≠ 收到回复；只有完整回复才能说"通过"
4. **使命校准**：每 5 轮问自己「这推进 100 万用户目标吗？」

---

## 一、测试栈决策树

```
任务：前端按钮功能 / 静态渲染 / DOM 查询
  → 用 Claude Preview（headless，不冻）

任务：陛下要实时观看 / 需要视觉证据 / 长时 LLM 等待
  → 用 Claude in Chrome（Chrome extension 控制陛下本机 Chrome）
  → 搭配 Computer Use screenshot（陛下能看到 + 截图存档）

任务：多核 LLM 调用耗时 > 45 秒
  → 用 curl 后台（--max-time + run_in_background），不在浏览器 fetch
  → 浏览器 fetch 等待超过 45s 会触发 CDP Runtime timeout 冻住 tab
```

---

## 二、LLM 基础设施选择

```
首选：Ollama 本地模型（qwen2.5:0.5b 397MB 最小最快）
  • 稳定、零延迟、无网络依赖、免 API key
  • 本地 1.2s 秒回；多核累积几十秒可接受
  • 主模型设置：main.py 启动时 router.set_primary("ollama/qwen2.5:0.5b", ...)

禁用：GLM relay / Claude 中转（connection error 偶发）
禁用：本地 Claude Code CLI（-p 模式需要订阅升级）
```

---

## 三、后端启动铁律

```
❌ 禁止：uvicorn --reload 不带 --reload-dir（监控 node_modules → 内存爆）
❌ 禁止：测试中修改后端代码（--reload 会 kill 正在处理的 LLM 请求）
❌ 禁止：多次 kill -9 python（可能残留僵尸进程）

✅ 正确启动：
  lsof -ti:8888 | xargs -r kill -9
  pkill -9 -f "uvicorn openagi" 2>/dev/null
  sleep 1.5
  nohup bash -c "source .venv/bin/activate && uvicorn openagi.api.main:app --host 0.0.0.0 --port 8888 --reload --reload-dir openagi" > /tmp/openagi-backend.log 2>&1 &
  # 等 ready：curl -s http://localhost:8888/health
```

---

## 四、前端改动铁律

```
前端是 next start（prod build），源改动不自动生效

改前端后必须：
  cd web && NODE_OPTIONS='--max-old-space-size=4096' npx next build
  lsof -ti:3000 | xargs -r kill -9
  nohup npx next start --port 3000 > /tmp/openagi-web.log 2>&1 &

禁止 next dev（陛下 CLAUDE.md 明文禁止，会内存爆）
```

---

## 五、多核测试矩阵模板

| 核数 | 预期耗时 | LLM 调用次数 | 关键验证点 |
|------|---------|-------------|-----------|
| 1 | 1-3s | 1 次 CEO 直通 | audit="1核直通，无审计" |
| 2 | 8-15s | 3 次（CEO+外A+综合） | 外A 加权分出现 |
| 3 | 30-60s | 4 次（CEO+外A+外B+综合） | 两外审分差列出 |
| 4 | 60-120s | 5 次（CEO+外A+外B+外C+综合） | roles 包含 auditor_c |
| 5 | 80-150s | 6 次（+ 执行者） | execution_plan 字段非空 |

curl 测试脚本：

```bash
for core in 1 2 3 4 5; do
  curl -s -X POST http://localhost:8888/api/v1/chat/send \
    -H "Content-Type: application/json" --max-time 180 \
    -d "{\"message\":\"用30字介绍OpenAGI\",\"session_id\":\"c$core\",\"core_count\":$core}" \
    -o /tmp/c$core.json -w "核=$core HTTP=%{http_code} T=%{time_total}s\n"
done
```

---

## 六、Chrome 真实浏览器测试流程

```javascript
// 1. 创建专用 tab（不用已有的避免冻住）
tabs_create_mcp → tabId
navigate(tabId, 'http://localhost:3000/')

// 2. 安装错误监听（首次必做）
javascript_tool(tabId, `
  window.__errors = [];
  window.addEventListener('error', e => window.__errors.push(String(e.error||e.message)));
  window.addEventListener('unhandledrejection', e => window.__errors.push('P:'+String(e.reason)));
`)

// 3. 发送消息（用 PUT settings + textarea setter）
javascript_tool(tabId, `
  fetch('/api/v1/settings/', {method:'PUT', body:JSON.stringify({multicore:{core_count:N}})});
  const ta = document.querySelector('textarea');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, '问题');
  ta.dispatchEvent(new Event('input', {bubbles:true}));
  document.querySelector('button[aria-label="发送消息"]').click();
`)

// 4. 等待（外部 wait，不是 in-browser 长 await 会冻 CDP）
computer-use wait(duration: 30)

// 5. 读结果
javascript_tool(tabId, `
  const articles = [...document.querySelectorAll('[role="article"]')];
  const ai = articles.filter(a => a.getAttribute('aria-label')?.includes('OpenAGI'));
  return {
    thinking: document.body.innerText.includes('思考中'),
    lastReply: ai[ai.length-1]?.innerText,
    errors: window.__errors,
  };
`)

// 6. 截图（computer-use screenshot save_to_disk:true）
```

---

## 七、常见 Bug 诊断对照表

| 症状 | 根因 | 解法 |
|------|------|------|
| 页面空白/「此页无法加载」 | React error #31（object rendered as children） | 检查 message.tokens 是否对象 |
| 2-5核永远思考中 | GLM relay connection error 连续重试 | 切 Ollama 本地 |
| Tab CDP timeout（45s） | 浏览器 fetch 未完成阻塞 Runtime.evaluate | 关闭 tab 重开 |
| "core_count 总是5" | 前端 store 未从后端 settings 拉取 | StoreProvider useEffect fetch |
| 快捷按钮点击无反应 | SendBox 没监听 quick-card CustomEvent | addEventListener('quick-card') |
| 硬编码"5核就绪" | UI 字符串写死 | 绑定 state.coreCount |
| litellm "LLM Provider NOT provided" | model 没有 openai/、ollama/、anthropic/ 前缀 | 加 provider 前缀 |
| 'str' object has no attribute session_id | 历史数据混入 str | isinstance 防御 |

---

## 八、典型工作流（硬仗套路）

```
第一层：冒烟（5 分钟）
  - curl 全站 26 个 GET 端点
  - curl 1 核 /api/v1/chat/send
  ✓ Pass → 第二层
  ✗ Fail → 查 /tmp/openagi-backend.log，找 5xx

第二层：多核博弈（20 分钟）
  - curl 2/3/4/5 核依次
  - 检查 model 字段为 "governance-v2/N核/..."
  - 检查 audit 字段含六维评分/冲突笔记
  ✓ Pass → 第三层
  ✗ Fail → 查 orchestrator 日志，修 prompts 或解析

第三层：真实浏览器（30 分钟）
  - Chrome 发消息 + computer-use 截图
  - 验证 UI 显示 core_count = 设置值
  - 验证 CEO/外A/外B/外C 实时切换"思考中/待机"
  ✓ Pass → 完工
  ✗ Fail → store sync / 硬编码 / CSP

第四层：按钮全遍历（15 分钟）
  - 每页 querySelectorAll('button') + 逐个 click
  - 收集 bodyDelta / modalDelta / errorDelta
  - 发现点击无反应的报告给陛下
```

---

## 九、给未来 Claude 的叮嘱

- **陛下最恨中断** → 遇阻换方案不问选择题
- **API 200 ≠ 通过** → 没截图 = 没做
- **诚实汇报** → "发送成功" 不等于 "收到回复"
- **多核博弈是 AI 诚实/持续/高效的制度解法** → 这是 OpenAGI 核心价值，保护它
- **本地 Ollama 是基础设施** → 别指望任何在线 relay 永远稳
- **每次沟通自问使命五问** → 走错方向的博弈无意义

---

**版本**: 1.0.0-2026-04-17-05:05AM  
**蒸馏自**: 2026-04-17 晚 11 小时硬仗（陛下睡觉时段）  
**关联文档**: CLAUDE.md 证据铁律 / 使命驱动 / 不中断铁律三条
