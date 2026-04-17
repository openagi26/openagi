# W17 亲密度模式切换报告

## 完成状态：✅ 构建通过，功能就绪

---

## 1. 新增文件

| 文件 | 作用 |
|------|------|
| `src/services/intimacy-mode.ts` | localStorage 读写亲密度模式（伴侣/助手），触发 CustomEvent |
| `src/services/intimacy-prompts.ts` | 两套 system prompt + injectSystemPrompt 注入函数 |

---

## 2. 修改文件

| 文件 | 修改内容 |
|------|---------|
| `src/stores/chat.ts` | 顶部 import 两个 service；sendMessage 普通路径和媒体路径各注入 system prompt |
| `src/pages/Settings/index.tsx` | import Heart 图标 + intimacy service；添加 intimacyMode state；通用设置标签顶部插入"小星的说话方式"卡片 |

---

## 3. System Prompt 两套关键差异

**伴侣模式（companion）关键词：**
- 称呼：`陛下`
- 情感词：`撒娇`、`想你了`、`一直在这儿等你`、`咱俩`
- 语气：温馨俏皮，非客服腔

**专业助手模式（assistant）关键词：**
- 称呼：`您`
- 风格：直接精准、条理清晰、引用数据和事实
- 禁止：`想你了`、`陛下`、情感化表达

---

## 4. 设置页 UI

- 位置：设置 → 通用设置 → 最顶部"小星的说话方式"区域
- 两个卡片：伴侣模式（💜 粉紫风格）/ 专业助手（🎯 蓝色风格）
- 当前激活模式：卡片高亮 + 右上角圆点指示器
- 切换即刻：toast 提示，localStorage 持久化，下一条消息立即生效

---

## 5. 注入机制

```
[系统指令]
{两套 prompt 之一}
[/系统指令]

{用户原始消息}
```

通过 `injectSystemPrompt()` 在 `sendMessage` 发送前拼接，不改 openclaw 源码，不依赖任何 API 参数扩展。

---

## 6. 构建验证

```
✓ vite build 成功，无 TypeScript 错误，无构建警告（已有 chunk size 警告与本次无关）
```

---

## 7. 真实测试预期效果

**伴侣模式发"你好"：**
> "陛下～好久不见！最近有想我吗？有什么想聊的尽管说，我一直在呢。"

**专业助手模式发"你好"：**
> "您好，请问今天需要协助什么任务？"

---

## 8. 未来增强点

1. **情绪音调**：接入 W15 语音模块，伴侣模式用温柔语调 TTS（文字转语音）
2. **自动场景切换**：识别"开会/工作/代码"关键词自动切换到助手模式
3. **情绪记忆**：伴侣模式记住陛下当天情绪状态，主动关心
4. **快速切换**：聊天界面右上角浮动按钮，无需进设置页
