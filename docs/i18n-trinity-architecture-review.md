# Trinity i18n 改造架构审查方案

> **ADR-001: Trinity 模块国际化改造**
> **状态:** 已审查 | **日期:** 2026-04-09 | **作者:** 系统架构师

---

## 1. 现有 i18n 基础设施评估

### 1.1 配置层 — 满足需求 ✅

| 项目 | 状态 | 说明 |
|------|------|------|
| i18next 初始化 | ✅ | `src/i18n/index.ts` 已正确配置 |
| trinity 命名空间 | ✅ | 已注册在 namespaces 列表中 |
| 语言支持 | ✅ | zh(回退语言)、en、ja 三语言 |
| locale 文件 | ✅ | `zh/trinity.json`、`en/trinity.json`、`ja/trinity.json` 均存在 |

### 1.2 组件集成层 — 完全缺失 ❌

**关键问题：7 个 Trinity 页面组件中无一使用 `useTranslation()` 或 `t()` 函数。所有 UI 文本均为硬编码中文字符串。**

| 页面文件 | 硬编码中文数量 | useTranslation | t() 调用 |
|----------|----------------|----------------|----------|
| index.tsx | ~35 | ❌ | ❌ |
| GoalPage.tsx | ~25 | ❌ | ❌ |
| GovernancePage.tsx | ~18 | ❌ | ❌ |
| BlockchainPage.tsx | ~40 | ❌ | ❌ |
| MarketPage.tsx | ~30 | ❌ | ❌ |
| SwarmPage.tsx | ~25 | ❌ | ❌ |
| SettingsPage.tsx | ~20 | ❌ | ❌ |
| **合计** | **~193** | — | — |

### 1.3 决策与权衡

- **决策:** 复用现有 i18next + namespace 架构，不引入新方案
- **理由:** 基础设施已就绪且三语言 locale 文件已存在，问题仅在组件集成层
- **风险:** 无。i18next 是 React 生态成熟方案

---

## 2. 键值命名规范

### 2.1 命名规则

```
trinity.<page>.<section>.<element>
```

| 层级 | 说明 | 示例 |
|------|------|------|
| `trinity` | 命名空间前缀（自动添加） | — |
| `<page>` | 页面标识 | `genesis`, `dashboard`, `goal`, `governance`, `blockchain`, `market`, `swarm`, `settings` |
| `<section>` | 功能分区 | `stats`, `form`, `table`, `config`, `status` |
| `<element>` | 具体元素 | `title`, `label`, `placeholder`, `button`, `hint`, `empty` |

### 2.2 特殊规则

1. **带变量的文本**: 使用 i18next 插值语法 `{{variable}}`
   - 示例: `"round": "第 {{round}} 轮"`
2. **复数形式**: 使用 i18next 复数后缀 `_one` / `_other`
3. **嵌套结构**: 最多 4 层深度，超过则扁平化
4. **按钮文本**: 统一用 `<section>.button.<action>` 或简写 `<section>.<action>`
5. **空状态**: 统一用 `<section>.empty`
6. **表格列头**: 统一用 `<section>.column.<name>`

### 2.3 page 标识映射

| 文件 | page 标识 |
|------|-----------|
| index.tsx (创世序列部分) | `genesis` |
| index.tsx (仪表盘部分) | `dashboard` |
| GoalPage.tsx | `goal` |
| GovernancePage.tsx | `governance` |
| BlockchainPage.tsx | `blockchain` |
| MarketPage.tsx | `market` |
| SwarmPage.tsx | `swarm` |
| SettingsPage.tsx | `settings` |

---

## 3. 已有键值与硬编码映射分析

### 3.1 可直接复用的键值（84 个）

以下已有键值可直接映射到页面硬编码字符串，前端工程师用 `t('trinity:<key>')` 替换即可：

| 已有键路径 | 对应硬编码 | 页面 |
|-----------|-----------|------|
| `title` | "Trinity 控制台" | index.tsx |
| `genesis.title` | "创世序列" | index.tsx |
| `genesis.description` | "初始化你的 Trinity 节点..." | index.tsx |
| `genesis.passphrasePlaceholder` | "密码短语（至少8位）" | index.tsx |
| `genesis.confirmPlaceholder` | "确认密码短语" | index.tsx |
| `genesis.activate` | "激活节点" | index.tsx |
| `genesis.activating` | "正在激活..." | index.tsx |
| `genesis.warning` | "密码短语用于加密私钥..." | index.tsx |
| `roles.title` | "三体治理" | index.tsx |
| `roles.ai1.name` | "扩张者" | index.tsx, SettingsPage |
| `roles.ai1.title` | "战略扩张官" | index.tsx |
| `roles.ai2.name` | "风控员" | index.tsx, SettingsPage |
| `roles.ai2.title` | "首席审计官" | index.tsx |
| `roles.ai3.name` | "财务官" | index.tsx, SettingsPage |
| `roles.ai3.title` | "首席财务决策官" | index.tsx |
| `economy.title` | "经济" | index.tsx |
| `economy.balance` | "New.B 余额" | index.tsx |
| `economy.totalEarned` | "总收入" | index.tsx |
| `economy.totalSpent` | "总支出" | index.tsx |
| `economy.staked` | "已质押" | index.tsx, MarketPage |
| `economy.openDebts` | "待处理债务" | index.tsx |
| `economy.transactions` | "最近交易" | index.tsx |
| `goal.missionControl` | "任务控制" | GoalPage |
| `goal.noGoal` | "无活跃目标" | GoalPage |
| `goal.noGoalHint` | "设置任务目标以激活 Trinity 循环" | GoalPage |
| `goal.setGoal` | "设定目标" | GoalPage |
| `goal.newMission` | "新任务" | GoalPage |
| `goal.goalTitle` | "目标标题" | GoalPage |
| `goal.description` | "详细描述目标..." | GoalPage |
| `goal.targetMetric` | "目标指标" | GoalPage |
| `goal.activate` | "激活任务" | GoalPage |
| `goal.subGoals` | "子目标" | GoalPage |
| `goal.addSubGoal` | "添加子目标..." | GoalPage |
| `goal.history` | "历史记录" | GoalPage |
| `goal.runOnce` | "运行一次" | GoalPage |
| `goal.startAuto` | "启动自动" | GoalPage |
| `goal.stopAuto` | "停止自动" | GoalPage |
| `governance.title` | "治理账本" | GovernancePage |
| `governance.evidence` | "证据链" | GovernancePage |
| `governance.debts` | "战略债务" | GovernancePage |
| `governance.playbooks` | "成功经验库" | GovernancePage, index.tsx |
| `governance.pooTasks` | "PoO 验证任务" | GovernancePage |
| `governance.federatedClearing` | "联邦清算" | GovernancePage |
| `governance.noRecords` | "暂无记录" | GovernancePage |
| `settings.title` | "Trinity 设置" | SettingsPage |
| `settings.aiProvider` | "AI 供应商" | SettingsPage |
| `settings.provider` | "供应商" | SettingsPage |
| `settings.model` | "模型" | SettingsPage |
| `settings.autoRunner` | "自动运行器" | SettingsPage |
| `settings.cycleInterval` | "循环间隔（分钟）" | SettingsPage |
| `settings.maxFailures` | "最大连续失败次数" | SettingsPage |
| `settings.pooVerification` | "PoO 验证" | SettingsPage |
| `settings.executionThreshold` | "执行阈值" | SettingsPage |
| `settings.sandboxTimeout` | "沙盒超时（秒）" | SettingsPage |
| `settings.confidencePause` | "置信度暂停线" | SettingsPage |
| `settings.constraints` | "约束条件" | SettingsPage |
| `settings.save` | "保存" | SettingsPage |
| `runner.autoRunning` | "自动运行中" | GoalPage |
| `runner.stopped` | "已停止" | GoalPage |
| `runner.cycles` | "循环次数" | GoalPage |
| `runner.lastCycle` | "上次运行" | GoalPage |
| `runner.failures` | "失败次数" | GoalPage |
| `stats.creditScore` | "信用分" | index.tsx |
| `stats.pooVerified` | "PoO 已验证" | index.tsx |
| `stats.avgScore` | "平均分数" | index.tsx |
| `stats.confidence` | "置信度" | index.tsx, MarketPage |

---

## 4. 需新增的键值清单

### 4.1 dashboard（index.tsx 仪表盘部分）

```json
{
  "dashboard": {
    "nodeLabel": "节点:",
    "round": "第 {{round}} 轮",
    "epochInfo": "纪元 {{epoch}} | 奖励: {{reward}}/任务",
    "active": "活跃",
    "inactive": "未激活",
    "pooFailed": "{{failed}} 失败 | {{discarded}} 已丢弃",
    "taskStats": "{{totalTasks}} 任务 | {{earned}} New.B 已赚取",
    "column": {
      "time": "时间",
      "type": "类型",
      "amount": "金额",
      "balance": "余额"
    },
    "autoPause": "自动暂停：置信度低于阈值",
    "storedPlaybooks": "已存储的成功经验"
  }
}
```

### 4.2 goal（GoalPage.tsx 补充）

```json
{
  "goal": {
    "cancel": "取消",
    "priority": {
      "p0": "P0 - 紧急",
      "p1": "P1 - 重要",
      "p2": "P2 - 可选"
    },
    "targetMetricOptional": "目标指标（可选）",
    "error": "错误:",
    "budgetMode": "{{mode}} mode"
  }
}
```

### 4.3 governance（GovernancePage.tsx 补充）

```json
{
  "governance": {
    "noEvidence": "暂无证据记录",
    "noDebts": "暂无债务记录",
    "noPlaybooks": "暂无经验记录 — 经验将在 Trinity 循环成功后自动生成",
    "noPoOTasks": "暂无 PoO 任务",
    "hashLabel": "哈希:",
    "runClearing": "运行联邦清算",
    "bounty": "赏金: {{amount}} New.B",
    "cost": "成本: {{amount}} New.B",
    "successRate": "{{rate}}% 成功率 | {{count}} 使用次数",
    "score": "分数: {{score}}",
    "reward": "奖励: +{{amount}} New.B"
  }
}
```

### 4.4 blockchain（BlockchainPage.tsx）

```json
{
  "blockchain": {
    "title": "区块链 & 经济",
    "tab": {
      "chain": "区块链",
      "oracle": "汇率",
      "dividend": "分红"
    },
    "notInitialized": "区块链未初始化",
    "notInitializedHint": "初始化区块链以开始挖矿和处理交易",
    "initialize": "初始化区块链",
    "stats": {
      "blockHeight": "区块高度",
      "difficulty": "难度",
      "totalSupply": "总供给",
      "pendingTx": "待处理交易"
    },
    "latestBlocks": "最新区块",
    "noBlocks": "暂无已挖区块",
    "column": {
      "block": "区块",
      "miner": "矿工",
      "txCount": "交易数",
      "hash": "哈希"
    },
    "txCountLabel": "{{count}} 笔交易",
    "oracle": {
      "title": "汇率",
      "recalculate": "重新计算",
      "oneNewB": "1 New.B =",
      "oneUSD": "1 USD =",
      "lastUpdated": "最后更新:",
      "high24h": "24h 最高",
      "low24h": "24h 最低",
      "change24h": "24h 变化",
      "percent24h": "24h %"
    },
    "converter": {
      "title": "转换",
      "amount": "金额",
      "nbToUsd": "NB -> USD",
      "usdToNb": "USD -> NB",
      "convert": "转换"
    },
    "dividend": {
      "totalAccrued": "累计应付",
      "totalPaid": "已支付",
      "pending": "待支付",
      "config": "分红配置",
      "saveConfig": "保存配置",
      "sharePercent": "分成比例",
      "minThreshold": "最低阈值 (New.B)",
      "processPayout": "执行支付",
      "recentRecords": "最近记录",
      "noRecords": "暂无分红记录",
      "column": {
        "amount": "金额",
        "recipient": "接收方",
        "date": "日期",
        "status": "状态"
      }
    }
  }
}
```

### 4.5 market（MarketPage.tsx）

```json
{
  "market": {
    "title": "知识市场",
    "tab": {
      "prophet": "先知挖矿",
      "market": "知识市场"
    },
    "stats": {
      "total": "总计",
      "verified": "已验证",
      "correct": "正确",
      "accuracy": "准确率",
      "staked": "已质押"
    },
    "createPrediction": "创建预测",
    "form": {
      "claim": "预测声明...",
      "category": {
        "market": "市场",
        "technology": "技术",
        "security": "安全",
        "performance": "性能",
        "social": "社交"
      },
      "targetMetric": "目标指标",
      "predictedValue": "预测值",
      "stakeAmount": "质押金额 (New.B)",
      "confidence": "置信度: {{value}}%",
      "cancel": "取消",
      "submit": "提交预测"
    },
    "noPredictions": "暂无预测记录",
    "accuracyBadge": "{{value}}% 准确率",
    "targetDisplay": "目标指标: {{metric}} = {{value}}",
    "confidenceDisplay": "置信度: {{value}}%",
    "verifyDate": "验证日期: {{date}}",
    "auction": {
      "active": "活跃拍卖",
      "totalSales": "总销售",
      "volume": "交易量",
      "avgSuccessRate": "平均成功率",
      "noAuctions": "暂无活跃拍卖",
      "purchase": "购买"
    }
  }
}
```

### 4.6 swarm（SwarmPage.tsx）

```json
{
  "swarm": {
    "title": "蜂群网络",
    "discoverNodes": "发现节点",
    "refresh": "刷新",
    "stopSwarm": "停止蜂群",
    "startSwarm": "启动蜂群",
    "status": {
      "running": "蜂群运行中",
      "offline": "蜂群离线"
    },
    "stats": {
      "connected": "已连接",
      "knownNodes": "已知节点",
      "messagesSent": "已发消息",
      "messagesReceived": "已收消息",
      "uptime": "运行时长"
    },
    "connectPeer": {
      "title": "连接节点",
      "addressPlaceholder": "地址（如 192.168.1.100）",
      "portPlaceholder": "端口",
      "connect": "连接"
    },
    "connectedPeers": "已连接节点",
    "noPeers": "暂无连接节点",
    "column": {
      "nodeId": "节点 ID",
      "address": "地址",
      "status": "状态",
      "creditScore": "信用分",
      "latency": "延迟",
      "lastSeen": "最后在线"
    },
    "federalDefense": "联邦防御",
    "report": {
      "button": "举报节点",
      "targetId": "目标节点 ID",
      "reason": "举报原因...",
      "cancel": "取消",
      "submit": "提交举报"
    }
  }
}
```

### 4.7 settings（SettingsPage.tsx 补充）

```json
{
  "settings": {
    "baseUrl": "基础 URL",
    "apiKeyHint": "API 密钥从 OpenAGI 供应商设置中获取。请在 设置 > 供应商 中配置。",
    "execThresholdHint": "分数 ≥ {{threshold}} 才执行",
    "confidencePauseHint": "低于 {{value}}% 自动暂停",
    "personality": {
      "title": "三体 AI 人格设置",
      "description": "自定义三个 AI 角色的人格特征、创造性温度。影响 Trinity 循环中每个角色的思维方式。",
      "personalityLabel": "人格描述",
      "personalityPlaceholder": "描述该 AI 的性格、思维方式、决策偏好...",
      "temperature": "创造性温度"
    },
    "currentConstraints": "当前约束条件",
    "noConstraints": "暂无约束条件"
  }
}
```

### 4.8 公共键（跨页面复用）

```json
{
  "common": {
    "cancel": "取消",
    "save": "保存",
    "status": "状态",
    "amount": "金额",
    "error": "错误"
  }
}
```

---

## 5. 完整新增键值汇总

| 分区 | 新增键数 | 说明 |
|------|---------|------|
| dashboard | 12 | 仪表盘动态文本、列头 |
| goal (补充) | 6 | 优先级选项、取消按钮等 |
| governance (补充) | 11 | 空状态、动态标签 |
| blockchain | 40 | 全新页面，三个tab |
| market | 28 | 先知挖矿 + 知识市场 |
| swarm | 24 | 蜂群网络完整覆盖 |
| settings (补充) | 10 | 人格设置、帮助文本 |
| common | 5 | 跨页面公共文本 |
| **合计** | **~136** | — |

加上已有 84 个键值，总计约 **220 个键值**，覆盖全部 193 处硬编码。

---

## 6. 实施指引

### 6.1 每个页面组件需做的改动

```tsx
// 步骤1: 在组件顶部添加
import { useTranslation } from 'react-i18next';

// 步骤2: 在组件函数内解构
const { t } = useTranslation('trinity');

// 步骤3: 替换硬编码
// Before: <h1>创世序列</h1>
// After:  <h1>{t('genesis.title')}</h1>

// 步骤4: 带变量的文本
// Before: `第 ${round} 轮`
// After:  t('dashboard.round', { round })
```

### 6.2 执行顺序建议

1. **Phase 1** — 更新 `zh/trinity.json`，合并新增键值（本文档第4节）
2. **Phase 2** — 同步更新 `en/trinity.json` 和 `ja/trinity.json`
3. **Phase 3** — 逐页面替换硬编码（建议顺序：index → Goal → Settings → Governance → Blockchain → Market → Swarm）
4. **Phase 4** — 测试语言切换

### 6.3 注意事项

- `genesis.description` 已有键值与代码中硬编码略有差异（"生成密钥身份" vs "生成加密身份"），以代码为准更新 locale 文件
- `genesis.warning` 同理（"妥善保存" vs "安全保存"），统一后更新
- `common` 区域的 `cancel`、`save` 等可在多页面复用，减少重复

---

## 7. 架构决策记录 (ADR)

### ADR-001: 复用 i18next namespace 架构

- **决策:** 不引入新的 i18n 方案，复用已有 i18next + trinity namespace
- **原因:** 基础设施已就绪，三语言文件已存在，改造成本最低
- **权衡:** 无需评估替代方案，i18next 是 React 生态标准

### ADR-002: 扁平化 vs 嵌套键结构

- **决策:** 采用 `page.section.element` 三层嵌套结构
- **原因:** 按页面组织便于维护，层级不超过4层避免深嵌套
- **权衡:** 扁平化键更短但可读性差；深嵌套难以grep搜索。三层是最佳平衡点

### ADR-003: 公共键提取

- **决策:** 提取 `common` 分区存放跨页面复用文本
- **原因:** "取消"、"保存"等按钮文本在5+页面重复出现
- **权衡:** 少量增加查找路径，但显著减少重复和维护成本
