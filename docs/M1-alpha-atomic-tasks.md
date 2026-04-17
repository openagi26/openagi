# OpenAGI 里程碑1 Alpha轨道 — 原子任务清单

> 编制：高级项目经理（GLM-5.1）
> 日期：2026-04-10
> 依据：里程碑0探针评审结论 + 计划B M1门控标准 + M1-B3接口协议草案（99 API）
> 目标：`pnpm dev` 可正常启动，v6.0 模块无编译错误，现有功能不回退

---

## 里程碑0评审结论（决策依据）

**5/5 探针全部通过（S3 触发 Plan B1 降级为进程隔离，已确认）。8/8 任务全部完成。**

| 探针 | 结果 | 影响 |
|------|------|------|
| S1 typecheck | 0 错误 | ✅ 代码质量极高，M1-A1 无需执行 |
| S2 lint+test | lint 28 错误，测试 94.56% 通过（34 失败因 localStorage 未 mock） | ⚠️ 需修复 lint 错误 + 测试 mock 问题 |
| S3 Docker | 不可用，已回退进程隔离（Plan B1 生效） | ✅ 进程隔离路径需确认稳定性 |
| S4 Trinity | 完整通过（Score=100, Balance 100→110） | ✅ 核心循环无问题 |
| S5 Identity | 端到端全绿（Ed25519+AES-256-GCM+scrypt） | ✅ 身份系统完整可用 |

**Beta 轨道交付物**：
- M1-B1 Trinity 管理页面交互原型（`docs/prototypes/trinity-management-wireframe.html`）
- M1-B2 Economy 仪表盘页面原型（`docs/M1-B2-economy-dashboard-prototype.md`）
- M1-B3 IPC 接口协议草案（`.openteams/M1-B3-ipc-interface-draft.md`）：**99 个 API，全部标记 ✅ 已实现，通过 Host API HTTP 模式（非 Direct IPC）**

---

## 任务清单

### M1-A1 ~~修复 typecheck 错误~~ → **跳过**（S1=0错误）

### M1-A2 修复 lint 28 个错误

**负责人**：后端
**估算时间**：45 分钟
**优先级**：P0（阻塞 M1 门控）

**描述**：运行 `pnpm run lint` 发现 28 个 lint 错误。需按严重程度排序逐一修复，确保 `lint --fix` 无法自动修复的手动处理完毕。

**验收标准**：
- `pnpm run lint` 输出 0 errors（warnings 可接受）
- 修复过程不引入新的 typecheck 错误
- 所有现有测试仍然通过

**涉及文件**：
- 待 `pnpm run lint` 输出确认具体文件列表
- 预期集中在 `electron/trinity/*.ts`、`electron/governance/index.ts`、`electron/newb/index.ts`、`electron/poo/index.ts` 等新增模块

**依赖**：无

---

### M1-A3 修复 34 个 localStorage mock 失败的测试

**负责人**：后端
**估算时间**：60 分钟
**优先级**：P0（阻塞 M1 门控）

**描述**：测试通过率 94.56%，34 个失败用例均因 localStorage 未 mock。需在 `tests/setup.ts` 或对应测试文件中添加 localStorage mock，使测试通过率达到 M1 门控标准（>80% 已满足，但应修复已知问题以稳固基线）。

**验收标准**：
- `pnpm test` 通过率 ≥ 98%
- 新增 mock 不影响已通过的测试
- 不引入新的 lint 错误

**涉及文件**：
- `tests/setup.ts`（全局 mock 配置）
- 具体失败的 34 个测试文件（需逐个确认）

**依赖**：M1-A2（先修 lint 再跑测试，避免 lint 错误干扰）

---

### M1-A4 确保 v1.1.0 功能无回退（冒烟测试）

**负责人**：质检
**估算时间**：45 分钟
**优先级**：P0（M1 门控核心项）

**描述**：在 `feature/trinity-v6-phase0` 分支上运行 `pnpm dev`，验证以下 v1.1.0 核心功能不受 v6.0 新增代码影响：
1. 应用正常启动（窗口打开，无崩溃）
2. Chat 页面可正常加载
3. Models 页面可正常加载
4. Settings 页面可正常加载
5. 导航菜单可正常切换
6. Gateway 连接状态正常显示

**验收标准**：
- `pnpm dev` 启动成功，无运行时错误
- 上述 6 个功能点全部通过
- 记录测试结果（通过/失败 + 截图证据）

**涉及文件**：
- 无代码修改，纯验证任务

**依赖**：M1-A2、M1-A3（修复完成后再做冒烟验证）

---

### M1-A5 初始代码审查（架构一致性）

**负责人**：代码审查
**估算时间**：60 分钟
**优先级**：P1

**描述**：审查 v6.0 新增的 5 个核心模块（identity/governance/newb/poo/trinity）的架构一致性，重点检查：
1. 模块间依赖关系是否合理（trinity 依赖 identity/governance/newb/poo 是否形成循环）
2. 数据持久化路径是否统一（dataDir 约定）
3. 错误处理模式是否一致
4. `require('node:crypto')` 在 `identity/index.ts:142` 的动态导入是否应改为顶层 import
5. 类型导出是否完整

**验收标准**：
- 输出架构审查报告（含问题清单和建议）
- 每个问题标注严重程度（critical/warning/info）
- Critical 问题 ≤ 3 个（探针已验证核心功能可用）

**涉及文件**：
- `electron/identity/index.ts`（191 行）
- `electron/governance/index.ts`（395 行）
- `electron/newb/index.ts`（369 行）
- `electron/poo/index.ts`（293 行）
- `electron/trinity/index.ts`（650 行）
- `electron/trinity/ai-executor.ts`（263 行）
- `electron/trinity/docker-sandbox.ts`（275 行）

**依赖**：S1（已完成，typecheck 无错误说明代码结构基本合规）

---

### M1-A6 Docker 沙盒降级方案确认与加固

**负责人**：后端
**估算时间**：30 分钟
**优先级**：P1

**描述**：S3 确认 Docker 不可用，Plan B1（进程隔离）已生效。需确认 `electron/trinity/docker-sandbox.ts` 中的 `executeInProcess` 降级路径在生产环境下足够安全：
1. 确认进程隔离有超时保护（已有 timeoutMs + 1000）
2. 确认资源限制是否足够（无 cgroup 隔离的风险）
3. 确认降级路径的错误处理完整
4. 在 `isDockerAvailable()` 返回 false 时，日志是否清晰提示用户

**验收标准**：
- 降级路径代码审查无 critical 问题
- 添加用户可见日志：Docker 不可用时提示已降级到进程隔离
- 确认超时机制工作正常

**涉及文件**：
- `electron/trinity/docker-sandbox.ts`（275 行，重点：`executeInProcess` 方法）

**依赖**：无（可与 M1-A2 并行）

---

### M1-A7 接口协议前后端对齐（基于 M1-B3 99 API 草案）

**负责人**：后端 + 前端
**估算时间**：45 分钟
**优先级**：P1（M2 前置，接口冻结越早越好）

**描述**：M1-B3 接口草案已确认：99 个 API 全部通过 Host API HTTP 模式（`hostApiFetch` → IPC `hostapi:fetch` → 主进程 HTTP 代理 → localhost:13220），无需为每个子模块单独注册 Direct IPC。本任务需后端和前端共同确认：
1. 草案中 6 项待对齐事项的决策（响应体结构、分页参数、事件推送、WS 需求、文件上传、错误码规范）
2. 确认 `hostApiFetch` 在 `feature/trinity-v6-phase0` 分支上的连通性
3. 确认草案中列出的 7 个实时事件推送通道（`trinity:cycle-complete` 等）是否需要在 M2 实现

**验收标准**：
- 6 项待对齐事项产出明确决策文档
- `hostApiFetch('/api/trinity/dashboard')` 可正常返回数据
- 决定 M2 是否需要实现 SSE/IPC 事件推送

**涉及文件**：
- `.openteams/M1-B3-ipc-interface-draft.md`（对齐基准）
- `src/lib/host-api.ts`（前端调用入口）
- `electron/main/ipc-handlers.ts`（Host API 代理注册）

**依赖**：M1-A2（lint 修复后验证连通性）

---

## 任务依赖关系

```
M1-A2 (lint修复) ──┬──→ M1-A3 (测试mock修复) ──→ M1-A4 (冒烟测试)
                    └──→ M1-A7 (接口对齐)
M1-A5 (代码审查) ──────→ 无依赖，可随时启动
M1-A6 (沙盒降级确认) ──→ 无依赖，可与A2并行
```

## M1 门控标准

| 指标 | 标准 | 当前状态 |
|------|------|---------|
| typecheck | 0 错误 | ✅ 已达标 |
| lint errors | 0 | ❌ 28 个，待 M1-A2 修复 |
| `pnpm dev` 启动 | 成功 | ⏳ 待 M1-A4 验证 |
| v1.1.0 无回退 | 6 项功能全通过 | ⏳ 待 M1-A4 验证 |
| 接口协议对齐 | 6 项待决事项有结论 | ⏳ 待 M1-A7 |

## 资源分配建议

**后端**（M1-A2 → M1-A3 → M1-A6 → M1-A7）：预计总耗时 180 分钟（3 小时）
**前端**（参与 M1-A7 接口对齐）：预计 20 分钟
**质检**（等待 M1-A3 完成后执行 M1-A4）：预计 45 分钟
**代码审查**（M1-A5 独立进行）：预计 60 分钟

**最短关键路径**：M1-A2(45min) → M1-A3(60min) → M1-A4(45min) = **150 分钟**

---

## 备注

1. S1 typecheck 0 错误说明代码质量基线很高，M1-A1 原计划可跳过
2. S4 Trinity 完整通过证明核心架构无问题，M1 的重点应放在 lint/测试修复和功能回退验证上
3. **关键发现**：99 个 API 全部已通过 Host API HTTP 实现，无需注册 Direct IPC，M1-A7 从"IPC注册"调整为"接口对齐"
4. M1-B3 草案中 7 个实时事件推送通道的优先级需在此轮确认，影响 M2 前端架构决策
5. `identity/index.ts:142` 的 `require('node:crypto')` 建议代码审查时一并处理
