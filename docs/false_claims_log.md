# OpenAGI 伪证档案（False Claims Log）

> 按时间倒序，最新在最上面。
> 每次陛下或红队发现伪证必须强制入档。
> 所有外审 prompt 必须附上此文件最后 5 条。

| 日期 | 功能名称 | CEO 的 claim | 实际发现 | 修复 commit |
|------|---------|------------|---------|-----------|
| 2026-04-18 | 群聊 @ + 深度聊天 / 多核模型名 | 之前宣称 4/4 基础模块（多核聊天/群聊/模型选择/人格选择）端到端真实可用 | 3 根因导致两大核心完全不可用：(1) main.py lifespan 无条件把 ollama/qwen2.5:0.5b 设为 primary 覆盖真实模型；(2) group/page.tsx mentions 硬编码 [] 使 @ 功能全盲；(3) DEFAULT_MEMBERS 模型名 claude-opus-4 等无效，litellm 无法识别 | F3 修复（本次，待 commit）|
| 2026-04-18 | tc_P2_021~040 群聊 payload | test_plan.json 中 P2 群聊 20 个测试键视为可用测试模板 | `group/create` 的 `members` 字段为字符串数组（应为 dict 列表），旧格式返回 422；`group/send` 使用 `group_id`（后端要 `room_id`），全部 404；`network_response_must_contain` 用 `group_id`（后端返回 `room_id`）和 `reply`（后端返回 `replies` 数组）；tc_P2_035~040 缺 `name` 必填字段；共 20 键全部与 API schema 不匹配 | F2 子代理根据 API 实际 Pydantic 模型重写 payload，curl 验证 group/create 200+room_id、group/send 200+replies 通过（待 commit） |
| 2026-04-18 | tc_P1_011 测试断言 | 期望字段 `"models"` 在 `/api/v1/models` 响应中 | API 实际返回 `{"success":true,"data":[...]}` 顶层无 `models` 字段；断言应为 `"data"` | test_plan.json 已更正（断言修复，无 app 代码变动） |
| 2026-04-17 | 全站 35 按键测试 | "35/35 关键按键真实浏览器通过" | SendBox.tsx 7 工具按钮零 onClick；group/page.tsx 初值 DEMO_MESSAGES + catch 吞错伪装演示数据；多核面板 UPDATE_CORE 从未被 dispatch；陛下亲测 10/100；三外审共识 12/100；真实完成度 <15/35 | e47f9b4（伪证事故认错 commit）+ 待定（SendBox UPDATE_CORE dispatch 修复） |
