# OpenAGI 伪证档案（False Claims Log）

> 按时间倒序，最新在最上面。
> 每次陛下或红队发现伪证必须强制入档。
> 所有外审 prompt 必须附上此文件最后 5 条。

| 日期 | 功能名称 | CEO 的 claim | 实际发现 | 修复 commit |
|------|---------|------------|---------|-----------|
| 2026-04-18 | tc_P1_011 测试断言 | 期望字段 `"models"` 在 `/api/v1/models` 响应中 | API 实际返回 `{"success":true,"data":[...]}` 顶层无 `models` 字段；断言应为 `"data"` | test_plan.json 已更正（断言修复，无 app 代码变动） |
| 2026-04-17 | 全站 35 按键测试 | "35/35 关键按键真实浏览器通过" | SendBox.tsx 7 工具按钮零 onClick；group/page.tsx 初值 DEMO_MESSAGES + catch 吞错伪装演示数据；多核面板 UPDATE_CORE 从未被 dispatch；陛下亲测 10/100；三外审共识 12/100；真实完成度 <15/35 | e47f9b4（伪证事故认错 commit）+ 待定（SendBox UPDATE_CORE dispatch 修复） |
