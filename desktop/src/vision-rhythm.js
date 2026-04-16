/**
 * 视觉节奏系统 — AI自主控制拍照频率
 *
 * 陛下的设计："每隔5秒拍一张图作为AI辅助的环境信息分析，
 *  间隔由AI自己调整，跟随聊天内容和节奏。"
 *
 * 核心：不是固定间隔，而是根据对话上下文动态调整：
 * - 视觉相关对话 → 高频（3-5秒）
 * - 普通对话中 → 中频（15秒）
 * - 闲置/静默 → 低频（60秒）
 * - 连续对话模式 → 每轮对话自动附带最新一帧
 *
 * AI不需要每次都分析图片，只是保持"最新一帧"在内存中，
 * 当对话需要时直接使用，无需等待拍照。
 */

export class VisionRhythm {
  constructor(camera) {
    this.camera = camera;       // CameraVision实例
    this.enabled = false;
    this.latestFrame = null;    // 最新一帧base64（随时可用）
    this.latestFrameTime = 0;

    // 动态间隔参数
    this._interval = 15000;     // 当前间隔（毫秒）
    this._minInterval = 3000;   // 最小3秒
    this._maxInterval = 60000;  // 最大60秒
    this._timer = null;

    // 对话上下文感知
    this._lastMessageTime = 0;
    this._conversationActive = false;
    this._visionTopicActive = false;
  }

  /** 启动视觉节奏 */
  start() {
    if (!this.camera?.isActive) return;
    this.enabled = true;
    this._captureFrame(); // 立即拍一张
    this._scheduleNext();
  }

  stop() {
    this.enabled = false;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  /** 获取最新帧（如果太旧就立即拍新的） */
  getLatestFrame(maxAgeMs = 10000) {
    if (!this.camera?.isActive) return null;

    const age = Date.now() - this.latestFrameTime;
    if (age > maxAgeMs || !this.latestFrame) {
      this._captureFrame();
    }
    return this.latestFrame;
  }

  /**
   * 通知：有新消息（AI根据消息内容调整拍照节奏）
   * 这就是"AI自己知道什么时候该看"的核心
   */
  onNewMessage(text, isUser) {
    this._lastMessageTime = Date.now();
    this._conversationActive = true;

    if (isUser) {
      // 分析用户消息是否涉及视觉
      const visionWords = ["看", "见", "外面", "周围", "这里", "那里",
        "什么样", "环境", "颜色", "光", "人", "东西", "桌上", "房间"];
      this._visionTopicActive = visionWords.some(w => text.includes(w));
    }

    // 根据上下文动态调整间隔
    this._adjustInterval();

    // 如果话题涉及视觉，立即刷新一帧
    if (this._visionTopicActive) {
      this._captureFrame();
    }
  }

  /** 通知：对话进入静默 */
  onSilence() {
    this._conversationActive = false;
    this._visionTopicActive = false;
    this._adjustInterval();
  }

  /** AI自主调整拍照间隔 */
  _adjustInterval() {
    if (this._visionTopicActive) {
      // 视觉话题 → 高频拍照
      this._interval = this._minInterval; // 3秒
    } else if (this._conversationActive) {
      // 普通对话 → 中频
      this._interval = 15000; // 15秒
    } else {
      // 闲置 → 低频保持感知
      this._interval = this._maxInterval; // 60秒
    }

    // 重新调度
    this._scheduleNext();
  }

  _captureFrame() {
    if (!this.camera?.isActive) return;
    try {
      const frame = this.camera.capture();
      if (frame) {
        this.latestFrame = frame;
        this.latestFrameTime = Date.now();
      }
    } catch {}
  }

  _scheduleNext() {
    if (!this.enabled) return;
    if (this._timer) clearTimeout(this._timer);

    this._timer = setTimeout(() => {
      if (!this.enabled) return;
      this._captureFrame();
      this._scheduleNext(); // 递归调度
    }, this._interval);
  }
}
