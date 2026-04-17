# OpenAGI v6.0 Task Kanban

> Maintained by: 工作流程管家
> Last updated: 2026-04-10
> Plan reference: `docs/project-plan-B.md`

---

## Lane: TO DO

### Milestone 0 — Technical Spikes (Day 1-3)

| ID | Task | Assignee | Success Criteria | Failure Contingency | Status |
|----|------|----------|-----------------|---------------------|--------|
| ~~S1~~ | ~~typecheck 验证~~ | ~~后端~~ | ~~零类型错误~~ | ~~评估重写成本~~ | ~~🟢 DONE — 见 DONE 区域~~ |
| ~~S2~~ | ~~lint 和测试验证~~ | ~~质检~~ | ~~lint < 50, pass > 80%~~ | ~~制定修复优先级清单~~ | ~~🟢 DONE — 见 DONE 区域~~ |
| ~~S3~~ | ~~Docker 沙盒本机启动验证~~ | ~~后端~~ | ~~容器正常运行~~ | ~~切换子进程方案~~ | ~~🟢 DONE — 见 DONE 区域~~ |
| ~~S4~~ | ~~Trinity 三AI协作完整循环验证~~ | ~~后端~~ | ~~三AI循环跑通~~ | ~~简化单AI+规则引擎~~ | ~~🟢 DONE — 见 DONE 区域~~ |
| ~~S5~~ | ~~密钥生成 + 身份绑定端到端验证~~ | ~~后端~~ | ~~本地生成密钥并派生地址~~ | ~~接入现有加密库~~ | ~~🟢 DONE — 见 DONE 区域~~ |

### Milestone 1 — Beta Track (parallel with M0/M1-Alpha)

| ID | Task | Assignee | Depends On | Status |
|----|------|----------|------------|--------|
| ~~M1-B1~~ | ~~Trinity 管理页面交互原型~~ | ~~用户体验和界面设计师~~ | ~~无~~ | ~~🟢 DONE — 见 DONE 区域~~ |
| M1-B2 | Economy 仪表盘页面交互原型 | 界面设计师 | 无 | 🟢 DONE — 见 DONE 区域 |
| M1-B3 | 前后端接口协议草案（IPC Channel 定义） | 前端 | 无 | 🟢 DONE — 见 DONE 区域 |

### Milestone 1 — Alpha Track (stabilization)

> Note: M1-A1 (typecheck fix) skipped — S1 spike showed 0 errors, no fix needed.
> **✅ MILESTONE 1 COMPLETE** — All 11 cards done (5 spikes + 3 Beta + 6 Alpha, A1 skipped).

| ID | Task | Assignee | Depends On | Type | Status |
|----|------|----------|------------|------|--------|
| ~~M1-A2~~ | ~~lint 修复~~ | ~~后端~~ | ~~S2~~ | ~~🐛 bugfix~~ | ~~🟢 DONE~~ |
| ~~M1-A3~~ | ~~测试 mock 修复~~ | ~~后端~~ | ~~S2~~ | ~~🐛 bugfix~~ | ~~🟢 DONE~~ |
| ~~M1-A4~~ | ~~冒烟验证~~ | ~~质检~~ | ~~M1-A2 + M1-A3~~ | ~~🧪 test~~ | ~~🟢 DONE~~ |
| ~~M1-A5~~ | ~~架构审查~~ | ~~代码审查~~ | ~~S1~~ | ~~♻️ review~~ | ~~🟢 DONE~~ |
| ~~M1-A6~~ | ~~沙盒降级确认~~ | ~~后端~~ | ~~S3~~ | ~~🔧 config~~ | ~~🟢 DONE~~ |
| ~~M1-A7~~ | ~~Identity IPC 注册~~ | ~~后端~~ | ~~S5 + M1-B3~~ | ~~✨ feature~~ | ~~🟢 DONE~~ |

---

## Lane: IN PROGRESS

### Milestone 2 — Core Identity & Governance (Day 8-14)

> **Status: 🟢 IN PROGRESS** — M2 正式启动，14 张任务卡片已就绪。
> **Gate**: identity + governance E2E 测试通过、安全审查无高危
> **⚠️ 接口冻结截止日：Day 7** — 此日期后 IPC 接口变更需经双方架构师审批
> **CEO 决策**：EvidenceGrade 采用 B 队定义（H1=最高，H4=最低），A 队适配

| ID | Task | Assignee | Est. | Depends On | Status |
|----|------|----------|------|------------|--------|
| A1 | Identity 密钥生成、身份绑定、持久化 | 后端 | — | S5 | 🔵 TODO |
| A2 | Governance EVIDENCE.jsonl 读写、证据等级 | 后端 | — | S1 | 🔵 TODO |
| A3 | Identity + Governance 单元测试 | 质检 | — | A1 + A2 | 🔵 TODO |
| A4 | 安全审查（密钥存储、加密强度） | 代码审查 | — | A1 | 🟡 准备中 |
| A5 | Trinity 页面实现（连接 identity IPC） | 前端 | — | A1 + M1-B1 | 🔵 TODO |
| A6 | Economy Overview 页面实现（连接 governance IPC） | 前端 | — | A2 + M1-B2 | 🔵 TODO |
| A7 | 视觉设计稿交付 | 界面设计师 | — | M1-B1 + M1-B2 | 🔵 TODO |
| A8 | Governance IPC 接口实现 | 后端 | — | A2 + M1-B3 | 🔵 TODO |
| A9 | IPC 类型契约对齐（A/B 双方） | 后端 + 前端 | — | M1-B3 | 🔵 TODO |
| A10 | B队代码文件级整合（identity + governance） | 后端 | — | A1 + A2 | 🔵 TODO |
| A11 | Identity + Governance E2E 测试 | 质检 | — | A1-A4, A8-A10 | 🔵 TODO |
| **A12** | **adapter.ts 桥接层** | **前端** | **45min** | **A9** | **🔵 TODO** |
| **A13** | **Host API Token 认证通道** | **后端** | **30min** | **A4** | **🔵 TODO** |
| **A14** | **设计语言一致性审查** | **UX** | **30min** | **A7** | **🔵 TODO** |

> **任务总数：14**（原 11 + 新增 A12/A13/A14）

---

## Lane: DONE

| ID | Assignee | Completed | Result |
|----|----------|-----------|--------|
| S1 | 后端 | 2026-04-10 | **PASS** — typecheck 0 错误（完美达标，阈值 < 20） |
| S2 | 质检 | 2026-04-10 | **PASS** — 28 lint errors (< 50), 94.56% test pass rate (> 80%) |
| S3 | 后端 | 2026-04-10 | **PASS (降级)** — Docker 不可用，已回退至子进程方案（Plan B1），子进程方案验证 OK |
| S4 | 后端 | 2026-04-10 | **PASS** — Trinity 三AI协作循环完整通过（AI-1提案→AI-2审计→AI-3决策） |
| S5 | 后端 | 2026-04-10 | **PASS** — Identity 端到端全绿（密钥生成 + 身份绑定 + 地址派生） |
| M1-B2 | 界面设计师 | 2026-04-10 | Economy 仪表盘页面交互原型已交付 |
| M1-B3 | 前端 | 2026-04-10 | 前后端接口协议草案已交付（99 个 IPC 接口定义） |
| M1-B1 | 用户体验和界面设计师 | 2026-04-10 | Trinity 管理页面交互原型已交付（`docs/prototypes/trinity-management-wireframe.html`） |
| M1-A2 | 后端 | 2026-04-10 | lint 修复完成（28 errors 全部清零） |
| M1-A3 | 后端 | 2026-04-10 | 测试 mock 修复完成（通过率提升至 > 95%） |
| M1-A4 | 质检 | 2026-04-10 | 冒烟验证通过（v1.1.0 功能无回退） |
| M1-A5 | 代码审查 | 2026-04-10 | 架构审查完成（v6.0 架构一致性确认） |
| M1-A6 | 后端 | 2026-04-10 | 沙盒降级确认（子进程方案正式采用） |
| M1-A7 | 后端 | 2026-04-10 | Identity IPC 注册完成（已接入 IPC 协议） |

---

## Spike Review Gate (Day 3 EOD)

- [x] S1 has clear pass/fail conclusion — **PASS** (0 typecheck errors)
- [x] S2 has clear pass/fail conclusion — **PASS** (28 lint errors, 94.56% test pass rate)
- [x] S3 has clear pass/fail conclusion — **PASS (降级)** (Docker 不可用, 子进程回退 OK)
- [x] S4 has clear pass/fail conclusion — **PASS** (Trinity 三AI循环完整通过)
- [x] S5 has clear pass/fail conclusion — **PASS** (Identity 端到端全绿)
- [ ] Project coordinator has convened spike review meeting
- [x] Milestone 1 scope confirmed based on spike results
- [x] **MILESTONE 1 COMPLETE** — all tasks done

---

## Cross-Team Collaboration (A/B Teams)

### B-Team Assets — Receipt Tracker

| Asset | Description | Expected From | Status | Blocking |
|-------|-------------|---------------|--------|----------|
| v6.ts 类型定义 | v6.0 框架 TypeScript 类型声明文件 | B队 | ✅ RECEIVED (`v6-types-contract.ts`) | M2 模块开发 |
| 资产清单 | B队已完成代码/模块/文档的完整清单 | B队 | ✅ RECEIVED (`b-team-asset-manifest.md`) | 范围确认 |
| Sprint 3 计划 | B队下一迭代的工作计划 | B队 | ✅ RECEIVED (`b-team-sprint-3-plan.md`) | A/B 对齐 |
| 集成策略文档 | A/B 代码合并策略详细方案 | B队架构师 | ✅ RECEIVED (`ab-integration-strategy.md`) | 整合执行 |
| v7.0 说明书 | OpenAGI v7.0 软件开发说明书 | B队 | ✅ RECEIVED (`docs/OpenAGI-v7.0-软件开发说明书.md`) | 全局参考 |

> **代码合并策略**：独立仓库 + 文件级整合（已由 `ab-integration-strategy.md` 正式确认）
> **B队风险回应**：B队已回应高级项目经理提出的 3 个风险（合并方向 / API 兼容 / 设计一致性）
> **EvidenceGrade 标准**：✅ RESOLVED — 正式确认方案B（H1=最高，H4=最低），A队适配完毕

### A-Team Module Ownership

| Module | Owner | Status | Notes |
|--------|-------|--------|-------|
| Identity（身份系统） | 后端 | 🟢 M1 完成 | M1-A7 IPC 注册已完成 |
| Docker 沙盒（降级为子进程） | 后端 | 🟢 M1 完成 | M1-A6 降级确认，子进程方案正式采用 |
| New.B（经济系统） | 后端 | ⬜ 待启动 | M3-1，依赖 M2 完成 |
| PoO（验证引擎） | 后端 | ⬜ 待启动 | M3-2，依赖 M2 完成 |
| 蜂群通信（Swarm） | 后端 | ⬜ 待启动 | M3-3，双节点通信 PoC |
| UX 设计 | 用户体验和界面设计师 + 界面设计师 | 🟢 原型已交付 | M1-B1 + M1-B2 已完成 |

### Interface Contract Alignment

| Interface | A-Team Side | B-Team Side | Alignment Status |
|-----------|-------------|-------------|------------------|
| IPC Channel（99 接口） | M1-B3 草案已交付 | ⏳ 待 B队确认 | 🟡 A队就绪，等待 B队评审 |
| Identity IPC | M1-A7 已完成 | ✅ 类型定义已接收 | 🟢 已对齐 |
| Docker/子进程 IPC | M1-A6 已确认 | ✅ 降级方案已确认 | 🟢 已对齐 |
| Governance IPC | ⬜ 待 M2 阶段 | ⏳ 待 B队 | ⬜ 未启动 |

---

## Notes

- All tasks in this kanban originate from Plan B (`docs/project-plan-B.md`)
- Status legend: 🔵 TODO | 🟡 IN PROGRESS | 🟢 DONE | 🔴 BLOCKED
- Each task should be linked to a Jira ID once the Jira project is configured
- Alpha track M1-A2 through M1-A7 created after spike review. A1 skipped (S1 showed 0 errors).
