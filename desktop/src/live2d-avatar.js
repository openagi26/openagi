/**
 * Live2D 形象渲染器
 *
 * 基于 pixi-live2d-display（AIRI 同款），支持：
 * - .moc3 模型加载
 * - 9种表情 BlendShape 控制
 * - 自动眨眼 / 注视鼠标 / 空闲动作
 * - 唇同步（音频驱动口型）
 *
 * Phase 2 MVP: 框架就绪 + 模型加载器
 * 用户放入自己的 Live2D 模型即可使用
 */

export class Live2DAvatar {
  constructor(container) {
    this.container = container;
    this.app = null;
    this.model = null;
    this.loaded = false;
    this.emotion = "neutral";

    // 自动眨眼定时器
    this._blinkTimer = null;
    this._idleTimer = null;
  }

  /**
   * 加载 Live2D 模型
   * @param {string} modelPath - model.json 或 .model3.json 的路径
   */
  async load(modelPath) {
    try {
      // 动态导入 pixi.js 和 pixi-live2d-display
      // 这些库在 npm install 后可用
      const PIXI = await import("pixi.js").catch(() => null);
      const { Live2DModel } = await import("pixi-live2d-display").catch(() => ({}));

      if (!PIXI || !Live2DModel) {
        console.warn("Live2D 依赖未安装。运行: npm install pixi.js pixi-live2d-display");
        this._showPlaceholder("Live2D 依赖未安装\n请运行 npm install pixi.js pixi-live2d-display");
        return false;
      }

      // 创建 PIXI 应用
      this.app = new PIXI.Application({
        view: this.container,
        transparent: true,
        autoStart: true,
        width: this.container.width,
        height: this.container.height,
      });

      // 加载模型
      this.model = await Live2DModel.from(modelPath);
      this.model.anchor.set(0.5, 0.5);
      this.model.scale.set(0.3);
      this.model.x = this.container.width / 2;
      this.model.y = this.container.height / 2;

      this.app.stage.addChild(this.model);
      this.loaded = true;

      // 启动自动行为
      this._startAutoBlink();
      this._startIdleMotion();
      this._setupMouseTracking();

      return true;
    } catch (err) {
      console.warn("Live2D 加载失败:", err);
      this._showPlaceholder(`模型加载失败: ${err.message}`);
      return false;
    }
  }

  /** 设置表情 */
  setExpression(emotion, params) {
    this.emotion = emotion;
    if (!this.model) return;

    try {
      // 方法1: 使用预设表情文件
      if (this.model.internalModel?.motionManager) {
        const expressionName = emotion.charAt(0).toUpperCase() + emotion.slice(1);
        this.model.expression(expressionName);
      }

      // 方法2: 直接设置参数（更精确）
      if (params && this.model.internalModel?.coreModel) {
        const core = this.model.internalModel.coreModel;
        for (const [param, value] of Object.entries(params)) {
          try {
            const index = core.getParameterIndex(param);
            if (index >= 0) {
              core.setParameterValueById(param, value);
            }
          } catch {}
        }
      }
    } catch (err) {
      console.warn("设置表情失败:", err);
    }
  }

  /** 唇同步 — 根据音量驱动口型 */
  setMouthOpen(value) {
    if (!this.model?.internalModel?.coreModel) return;
    try {
      const core = this.model.internalModel.coreModel;
      core.setParameterValueById("ParamMouthOpenY", Math.min(1, Math.max(0, value)));
    } catch {}
  }

  /** 自动眨眼 */
  _startAutoBlink() {
    const blink = () => {
      if (!this.model?.internalModel?.coreModel) return;
      const core = this.model.internalModel.coreModel;

      // 闭眼
      try {
        core.setParameterValueById("ParamEyeLOpen", 0);
        core.setParameterValueById("ParamEyeROpen", 0);
      } catch {}

      // 150ms 后睁眼
      setTimeout(() => {
        try {
          core.setParameterValueById("ParamEyeLOpen", 1);
          core.setParameterValueById("ParamEyeROpen", 1);
        } catch {}
      }, 150);

      // 3-6秒后再眨
      this._blinkTimer = setTimeout(blink, 3000 + Math.random() * 3000);
    };

    this._blinkTimer = setTimeout(blink, 2000);
  }

  /** 空闲小动作 */
  _startIdleMotion() {
    const idle = () => {
      if (this.model?.internalModel?.motionManager) {
        try {
          this.model.motion("Idle");
        } catch {}
      }
      this._idleTimer = setTimeout(idle, 8000 + Math.random() * 4000);
    };

    this._idleTimer = setTimeout(idle, 5000);
  }

  /** 鼠标注视跟踪 */
  _setupMouseTracking() {
    if (!this.container) return;

    this.container.addEventListener("mousemove", (e) => {
      if (!this.model) return;

      const rect = this.container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width * 2 - 1;  // -1 ~ 1
      const y = (e.clientY - rect.top) / rect.height * 2 - 1;

      try {
        this.model.focus(x * rect.width, y * rect.height);
      } catch {}
    });
  }

  /** 显示占位提示 */
  _showPlaceholder(message) {
    const ctx = this.container.getContext?.("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, this.container.width, this.container.height);
    ctx.fillStyle = "rgba(124, 92, 252, 0.3)";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";

    const lines = message.split("\n");
    lines.forEach((line, i) => {
      ctx.fillText(line, this.container.width / 2, this.container.height / 2 + i * 20);
    });
  }

  /** 销毁 */
  destroy() {
    if (this._blinkTimer) clearTimeout(this._blinkTimer);
    if (this._idleTimer) clearTimeout(this._idleTimer);
    if (this.app) {
      this.app.destroy(true);
      this.app = null;
    }
    this.model = null;
    this.loaded = false;
  }
}
