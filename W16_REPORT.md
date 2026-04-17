# W16 视频按需拍照 MVP 实施报告

## 完成时间
2026-04-18 03:39

## 任务状态：✅ 完成

---

## 1. camera-capture.ts 来源
**W15 已写好**，直接复用。
- 路径：`src/services/camera-capture.ts`
- 功能完整：`captureSnapshot()`、`stopCamera()`、`isCameraSupported()`
- 注：W16 的 VideoButton.tsx 未使用 `captureSnapshot()`，而是直接在组件内操作 stream + canvas，以便保持 video 元素实时预览同步

## 2. 摄像头权限申请
- **位置**：`electron/main/index.ts` → `app.whenReady()` 内
- **已加**：紧跟 W15 麦克风权限申请块后面
- **逻辑**：检查 `getMediaAccessStatus('camera')` ≠ 'granted' 才调用 `askForMediaAccess('camera')`
- 仅在 `process.platform === 'darwin'` 条件下执行

## 3. VideoButton 预览面板
- **文件**：`src/pages/Spirit/VideoButton.tsx`（新建，约 220 行）
- UI：摄像头图标按钮（圆形，36×36px，与语音按钮并排）
- 点击 → 打开摄像头流到 `<video>` 预览（100×140px 小面板，浮出按钮上方）
- 面板包含：实时预览 + "📷 拍一张" 按钮 + "✕ 关闭" 按钮
- 组件卸载时自动调用 `stopCamera()` 释放设备

## 4. 端到端流程
拍一张 → IPC `spirit:photo-input` → 主进程 → `gateway.rpc('chat.send', {images:[base64]})` → LLM 视觉回复 → TTS 播放

**降级处理**：
- 网关未连接：提示"等网关修好才能告诉你我看到什么～"
- LLM 不支持视觉（images 参数抛错）：提示"去设置里换个能看图的模型吧～"

## 5. 摄像头释放
- 点"📷 拍一张"：`closeCamera()` 在截图后立即调用（先截图，马上释放 → 传给 LLM）
- 点"✕ 关闭"：直接调用 `closeCamera()`
- `stream.getTracks().forEach(t => t.stop())` → macOS 菜单栏摄像头绿灯立即熄灭

## 6. 修改文件清单

| 文件 | 变更内容 |
|------|---------|
| `electron/main/index.ts` | +11行：摄像头权限申请（W16） |
| `electron/main/ipc-handlers.ts` | +55行：`spirit:photo-input` handler（含视觉降级） |
| `electron/preload/index.ts` | +4行：`spirit:photo-input`、`spirit:photo-reply` 加入白名单 |
| `src/pages/Spirit/VideoButton.tsx` | 新建，约220行 |
| `src/pages/Spirit/Spirit.tsx` | +4行：导入 VideoButton，并排 VoiceButton 集成 |

## 7. 构建验证
- `tsc --noEmit`：**零错误**
- `vite build`（renderer + main + preload 三目标）：**全部 ✓ built**
- 应用启动：Gateway 状态 **运行中**，小星浮窗可见

## 8. 截图路径
`docs/test-runs/w16_video_20260418_033740/01_video_button_visible.png`

**截图观察**：小星浮窗右下角，麦克风图标（语音）+ 摄像头图标（视频）并排显示。
