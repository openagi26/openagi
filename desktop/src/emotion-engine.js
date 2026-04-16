/**
 * 情绪引擎 — 连接 HeartEngine API 到所有形象渲染器
 * HeartEngine 输出 (entropy, valence, state) → 映射为 9 种情绪
 */

const HEART_API = "http://localhost:8888/health";
const POLL_INTERVAL = 10000; // 10秒轮询

/**
 * HeartEngine state → 星灵/Live2D 情绪映射
 *
 * HeartEngine 四状态：calm / focused / anxious / crisis
 * 结合 entropy + valence 细分为 9 种情绪
 */
function mapHeartToEmotion(heartState, entropy, valence) {
  // crisis → angry (高危)
  if (heartState === "crisis") return "angry";

  // anxious 根据 valence 细分
  if (heartState === "anxious") {
    if (valence > 0.5) return "surprise";   // 焦虑但正面 → 惊喜
    if (valence < -0.3) return "sad";       // 焦虑且负面 → 难过
    return "awkward";                        // 焦虑中性 → 尴尬
  }

  // focused → think 或 focus
  if (heartState === "focused") {
    if (entropy > 0.6) return "think";      // 高熵思考
    return "focus";                          // 低熵专注
  }

  // calm 根据 valence 细分
  if (heartState === "calm") {
    if (valence > 0.6) return "happy";      // 平静+高正面 → 开心
    if (valence > 0.2) return "curious";    // 平静+微正面 → 好奇
    return "neutral";                        // 纯平静
  }

  return "neutral";
}

/**
 * Live2D 表情参数映射
 * 每种情绪对应 Live2D Cubism 的 Parameter 值
 */
const LIVE2D_EXPRESSION_MAP = {
  neutral:  { ParamEyeLOpen: 1.0, ParamEyeROpen: 1.0, ParamMouthOpenY: 0.0, ParamBrowLY: 0.0, ParamBrowRY: 0.0 },
  happy:    { ParamEyeLOpen: 0.8, ParamEyeROpen: 0.8, ParamMouthOpenY: 0.3, ParamBrowLY: 0.3, ParamBrowRY: 0.3 },
  sad:      { ParamEyeLOpen: 0.5, ParamEyeROpen: 0.5, ParamMouthOpenY: 0.0, ParamBrowLY: -0.5, ParamBrowRY: -0.5 },
  angry:    { ParamEyeLOpen: 1.2, ParamEyeROpen: 1.2, ParamMouthOpenY: 0.2, ParamBrowLY: -0.8, ParamBrowRY: -0.8 },
  think:    { ParamEyeLOpen: 0.7, ParamEyeROpen: 0.9, ParamMouthOpenY: 0.0, ParamBrowLY: 0.2, ParamBrowRY: -0.2 },
  surprise: { ParamEyeLOpen: 1.3, ParamEyeROpen: 1.3, ParamMouthOpenY: 0.6, ParamBrowLY: 0.8, ParamBrowRY: 0.8 },
  awkward:  { ParamEyeLOpen: 0.6, ParamEyeROpen: 0.8, ParamMouthOpenY: 0.1, ParamBrowLY: 0.1, ParamBrowRY: -0.3 },
  curious:  { ParamEyeLOpen: 1.1, ParamEyeROpen: 1.1, ParamMouthOpenY: 0.1, ParamBrowLY: 0.4, ParamBrowRY: 0.4 },
  focus:    { ParamEyeLOpen: 0.9, ParamEyeROpen: 0.9, ParamMouthOpenY: 0.0, ParamBrowLY: -0.2, ParamBrowRY: -0.2 },
};

export class EmotionEngine {
  constructor() {
    this.currentEmotion = "neutral";
    this.heartState = "calm";
    this.entropy = 0.37;
    this.valence = 0.0;
    this.listeners = [];
    this._pollTimer = null;
  }

  /** 注册情绪变化监听器 */
  onEmotionChange(callback) {
    this.listeners.push(callback);
  }

  /** 手动设置情绪（对话触发等） */
  setEmotion(emotion) {
    if (emotion !== this.currentEmotion) {
      this.currentEmotion = emotion;
      this._notify();
    }
  }

  /** 获取当前 Live2D 表情参数 */
  getLive2DParams() {
    return LIVE2D_EXPRESSION_MAP[this.currentEmotion] || LIVE2D_EXPRESSION_MAP.neutral;
  }

  /** 开始轮询 HeartEngine */
  startPolling() {
    this._poll(); // 立即执行一次
    this._pollTimer = setInterval(() => this._poll(), POLL_INTERVAL);
  }

  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  async _poll() {
    try {
      let data;
      if (window.__TAURI_INTERNALS__) {
        const { invoke } = window.__TAURI_INTERNALS__;
        const result = await invoke("get_heart_status");
        data = JSON.parse(result);
      } else {
        const resp = await fetch(HEART_API, { signal: AbortSignal.timeout(3000) });
        data = await resp.json();
      }

      if (data && data.heart) {
        this.heartState = data.heart;
        this.entropy = data.entropy ?? 0.37;
        // valence 目前后端未直接暴露，用 entropy 推算
        this.valence = 1.0 - this.entropy * 2; // 高entropy → 低valence

        const newEmotion = mapHeartToEmotion(this.heartState, this.entropy, this.valence);
        if (newEmotion !== this.currentEmotion) {
          this.currentEmotion = newEmotion;
          this._notify();
        }
      }
    } catch {
      // 后端不可用时保持当前情绪
    }
  }

  _notify() {
    for (const fn of this.listeners) {
      try { fn(this.currentEmotion, this.getLive2DParams()); } catch {}
    }
  }
}

// 导出映射供测试使用
export { mapHeartToEmotion, LIVE2D_EXPRESSION_MAP };
