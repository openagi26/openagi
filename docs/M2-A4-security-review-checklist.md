# M2-A4 安全审查清单

> 审查人：代码审查（Reviewer）
> 状态：初稿（待 A1 完成后执行最终审查）
> 预计最终审查时长：30-45 分钟

## 审查范围

基于 M1 A5 架构审查期间对以下模块源码的完整阅读：

| 模块 | 文件路径 | 行数 | 核心安全面 |
|---|---|---|---|
| Identity | `electron/identity/index.ts` | 190 | 密钥生成、加密存储、签名 |
| New.B | `electron/newb/index.ts` | 368 | 账本完整性、HMAC |
| PoO | `electron/poo/index.ts` | 293 | 评分公式、沙盒执行 |
| Governance | `electron/governance/index.ts` | 395 | 证据等级、持久化策略 |
| Trinity | `electron/trinity/index.ts` | 650 | AI 解析器、fallback 安全性 |
| Blockchain | `electron/trinity/blockchain.ts` | 511 | PoW、HMAC、链完整性 |
| Swarm | `electron/trinity/swarm.ts` | 434 | P2P 加密、消息签名 |
| AI Executor | `electron/trinity/ai-executor.ts` | 263 | API 密钥处理 |
| Docker Sandbox | `electron/trinity/docker-sandbox.ts` | 274 | 沙盒隔离、降级安全 |
| API Routes | `electron/api/routes/trinity.ts` | 969 | 输入验证、认证 |

## 安全域 1：密钥存储（Identity 模块）— 核心

- [ ] **K1-01** Ed25519 密钥对生成使用 `generateKeyPairSync('ed25519')` — 确认 Node.js 内置实现
- [ ] **K1-02** 私钥加密算法为 AES-256-GCM — 确认使用 GCM 而非 CBC/ECB
- [ ] **K1-03** 密钥派生使用 `scryptSync(passphrase, salt, 32)` — 确认 scrypt 参数（salt 长度=32 bytes）
- [ ] **K1-04** authTag 验证：解密时 `decipher.setAuthTag(authTag)` — 确认 GCM 认证标签正确验证
- [ ] **K1-05** 私钥内存生命周期：`unlock()` 加载到 `this.privateKey`，`lock()` 设置为 `null` — 确认无其他引用泄漏
- [ ] **K1-06** keystore.json 存储路径：`join(dataDir, 'identity', 'keystore.json')` — 确认不在用户可访问目录
- [ ] **K1-07** passphrase 最小长度：API 路由层校验 `body.passphrase.length < 8` — 确认 Identity 模块内部是否也有校验
- [ ] **K1-08** 重复 genesis 防护：`hasGenesis()` 检查 keystore.json 存在性 — 确认无竞态条件

## 安全域 2：密钥派生参数

- [ ] **K2-01** salt 使用 `randomBytes(32)` — 确认 256 位随机盐
- [ ] **K2-02** IV 使用 `randomBytes(16)` — 确认 128 位随机初始化向量
- [ ] **K2-03** scrypt 输出长度 32 bytes (256 bit) — 满足 AES-256 要求
- [ ] **K2-04** scrypt 未指定 cost 参数 — 使用 Node.js 默认值（N=16384），确认是否满足 v7.0 安全要求
- [ ] **K2-05** authTag 长度 16 bytes — GCM 标准 128 位标签

## 安全域 3：完整性保护（HMAC）

- [ ] **I3-01** New.B ledger HMAC-SHA256：key 为 `ledger.nodeId` — 评估密钥强度（是否应使用独立密钥）
- [ ] **I3-02** Blockchain HMAC-SHA256：key 为 `chain[0].miner`（genesis miner ID）— 同上评估
- [ ] **I3-03** 加载时验证：`loadChain()` 和 `loadLedger()` 均检查 HMAC — 确认验证失败时行为（当前为 warn + tamperDetected 标记）
- [ ] **I3-04** tamperDetected 标记后无阻断行为 — 确认是否有后续处理（当前仅标记，不阻止操作）
- [ ] **I3-05** HMAC 文件缺失时降级：`console.warn` + `tamperDetected = true` — 评估是否应更严格

## 安全域 4：输入验证

- [ ] **V4-01** Genesis passphrase：API 层 `length < 8` 校验 — 确认 Identity 模块内部无重复校验或缺失校验
- [ ] **V4-02** Goal priority 枚举：`body.priority as any` — 确认无类型安全校验
- [ ] **V4-03** Game mode 枚举：`body.mode` 直接传入 `setGameMode` — 确认枚举校验
- [ ] **V4-04** JSON 解析异常：`parseProposal/parseAudit/parseDecision` 均有 try/catch + fallback — 确认 fallback 值的安全性（所有 fallback 均为 `approved: false`）
- [ ] **V4-05** parseJsonBody 错误处理：确认空 body / malformed JSON 的处理
- [ ] **V4-06** EvidenceGrade 反转后（H1=最高）的安全断言一致性 — **关键检查点**

## 安全域 5：会话安全

- [ ] **S5-01** `unlock()` 成功后 `this.privateKey` 持有 PEM 字符串 — 确认无意外序列化
- [ ] **S5-02** `sign()` 检查 `this.privateKey !== null` — 确认锁定后无法签名
- [ ] **S5-03** `deactivate()` 将 creditScore 设为 0 — 确认 deactivated 节点无法执行操作
- [ ] **S5-04** 私钥零化：当前仅设 `null`，未使用 `Buffer.fill(0)` 或 `zeroFill` — 评估是否需要更安全的内存清除（JS 限制下 `null` 已是最佳实践）

## 安全域 6：沙盒隔离

- [ ] **X6-01** Docker 不可用时降级为子进程 — 确认降级后权限隔离是否充分
- [ ] **X6-02** 沙盒超时：`sandboxTimeoutMs: 30000` — 确认 v7.0 要求（30s）
- [ ] **X6-03** 资源限制：进程降级模式下无 CPU/内存限制 — 确认 v7.0 要求（1核/512MB）
- [ ] **X6-04** 网络访问：Docker 模式 `networkEnabled: false`，进程模式无网络隔离 — 评估风险
- [ ] **X6-05** PoW 最大 nonce `1_000_000`：超出后接受非合规 hash — 评估是否为安全风险

## 安全域 7：网络通信安全（Swarm）

- [ ] **N7-01** 消息签名：`signMessage()` 使用 `SHA256(payload + nodeId)` — 非真实签名，评估 MVP 可接受性
- [ ] **N7-02** 加密：`encryptPayload()` 使用 `AES-256-CBC` + 对称密钥派生 — 评估 IV 重用风险
- [ ] **N7-03** 密钥派生：`SHA256(peerPublicKey + selfNodeId)` — 非标准密钥协商，评估 MVP 可接受性
- [ ] **N7-04** P2P 当前为模拟模式（`connections: Map<string, any>`）— Phase 2 实现时需替换

## 安全域 8：信息泄露防护

- [ ] **L8-01** API 响应：`GET /api/trinity/identity` 返回完整 `NodeIdentity`（含 publicKey）— 确认不包含加密私钥
- [ ] **L8-02** 日志中密钥：`AIExecutor` 的 `resolveApiKey()` — 确认 API key 不出现在日志中
- [ ] **L8-03** 错误消息：`catch` 块中 `err.message` 直接返回前端 — 评估是否泄露内部信息
- [ ] **L8-04** keystore.json 文件权限：当前使用 `writeFileSync` 默认权限 — 评估是否应设 0600

## EvidenceGrade 反转一致性检查（关键）

> CEO 决策：H1=最高（机器可复现验证），H4=最低（未验证假说）。A队原代码 H1=Hearsay（最低）已反转。

- [ ] **E-01** `governance/index.ts` EvidenceLevel 枚举值：确认 H1-H4 注释已更新
- [ ] **E-02** `governance/index.ts` 持久化逻辑：确认 `persisted` 条件为 H1 || H2（原为 H3 || H4）
- [ ] **E-03** `poo/index.ts` evidenceLevel 数值映射：确认 H1=100, H2=75, H3=50, H4=25
- [ ] **E-04** `trinity/index.ts` Genesis 证据等级：确认创世事件使用 H1（最高）而非 H4
- [ ] **E-05** `trinity/ai-executor.ts` fallback 证据等级：确认 API 错误时使用 H4（最低）而非 H1
- [ ] **E-06** 测试断言：确认所有涉及 evidenceLevel 的测试用例已同步更新

## 最终审查执行流程

1. 确认 A1（TrinityRole 命名对齐 + EvidenceGrade 反转）已合并
2. 重跑 `pnpm run typecheck` 确认 0 错误
3. 重跑 `pnpm test` 确认 625/625 通过
4. 逐项执行上述清单
5. 产出审查结论（Pass / Return for Fixes）
