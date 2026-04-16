/**
 * 小星的眼睛 — 屏幕截图感知系统
 *
 * 定时截图桌面 → 发送到AI分析 → 理解用户在做什么 → 主动响应
 * 配合 proactive-engine.js 的窗口标题检测，形成双层感知：
 *   Layer 1: 窗口标题（轻量，15秒）— 知道用户在用什么App
 *   Layer 2: 屏幕截图（深度，60秒）— 理解用户在做什么具体内容
 */

export class ScreenObserver {
  constructor() {
    this.enabled = false;
    this.interval = 60000;  // 默认60秒截一次
    this._timer = null;
    this._analyzing = false;
    this._lastAnalysis = "";
    this._cooldown = 0;

    // 回调
    this.onObservation = null;  // (analysis, emotion) => void
  }

  /** 开启屏幕观察 */
  start(intervalMs) {
    if (intervalMs) this.interval = intervalMs;
    this.enabled = true;
    this._timer = setInterval(() => this._observe(), this.interval);
  }

  stop() {
    this.enabled = false;
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  async _observe() {
    if (this._analyzing || this._cooldown > 0) {
      this._cooldown = Math.max(0, this._cooldown - 1);
      return;
    }

    this._analyzing = true;
    try {
      // 1. 通过Tauri截图
      let screenshotBase64 = null;
      if (window.__TAURI_INTERNALS__) {
        const { invoke } = window.__TAURI_INTERNALS__;
        screenshotBase64 = await invoke("capture_screenshot");
      }

      if (!screenshotBase64) {
        this._analyzing = false;
        return;
      }

      // 2. 发送到后端AI分析
      const analysis = await this._analyzeScreenshot(screenshotBase64);

      if (analysis && analysis !== this._lastAnalysis) {
        this._lastAnalysis = analysis;

        // 3. 解析AI分析结果，决定是否主动响应
        const response = this._parseAnalysis(analysis);
        if (response) {
          this.onObservation?.(response.message, response.emotion);
          // 响应后冷却5轮（5分钟不再截图分析）
          this._cooldown = 5;
        }
      }
    } catch (err) {
      console.warn("屏幕观察异常:", err);
    } finally {
      this._analyzing = false;
    }
  }

  async _analyzeScreenshot(base64) {
    try {
      if (window.__TAURI_INTERNALS__) {
        const { invoke } = window.__TAURI_INTERNALS__;
        return await invoke("analyze_screenshot", { imageBase64: base64 });
      } else {
        const resp = await fetch("http://localhost:8888/api/v1/screen/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_base64: base64 }),
        });
        const json = await resp.json();
        return json?.data?.analysis || "";
      }
    } catch {
      return null;
    }
  }

  _parseAnalysis(analysis) {
    const lower = analysis.toLowerCase();

    // 关键场景识别（基于AI分析文本）
    if (lower.includes("疲劳") || lower.includes("tired") || lower.includes("久坐")) {
      return { message: "陛下看起来工作很久了，要不要休息一下？💆", emotion: "curious" };
    }
    if (lower.includes("成功") || lower.includes("完成") || lower.includes("发布")) {
      return { message: "恭喜陛下！看起来完成了一项工作！🎉", emotion: "happy" };
    }
    if (lower.includes("错误") || lower.includes("error") || lower.includes("bug")) {
      return { message: "小星注意到有报错信息，需要帮忙排查吗？🔍", emotion: "think" };
    }
    if (lower.includes("英文") || lower.includes("english") || lower.includes("foreign")) {
      return { message: "这个界面有英文内容，需要小星帮忙翻译吗？🌐", emotion: "curious" };
    }

    // 默认不响应（避免打扰）
    return null;
  }
}
