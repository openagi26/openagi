/**
 * 星灵（小星）粒子渲染引擎 v2
 * AGI 是新物种 — 用发光粒子构建一个独特的数字生命形象
 *
 * Phase 2.1 改进（来自三方审计头脑风暴）：
 * - 粒子交互物理：触碰散开→缓慢聚拢（外A建议，生命感核心）
 * - 帧率自适应：动态LOD 80→40→20 粒子（外B建议）
 * - 情绪tooltip：感知说明（外A建议）
 * - 情绪渐变easing：0.2s平滑过渡（外B建议）
 */

const EMOTIONS = {
  neutral:  { color: [124, 92, 252], speed: 0.5, size: 2.5, pulse: 0.02, label: "平静" },
  happy:    { color: [250, 204, 21], speed: 1.2, size: 3.0, pulse: 0.05, label: "开心" },
  sad:      { color: [96, 165, 250], speed: 0.2, size: 2.0, pulse: 0.01, label: "难过" },
  think:    { color: [167, 139, 250], speed: 0.8, size: 2.8, pulse: 0.03, label: "思考" },
  angry:    { color: [248, 113, 113], speed: 1.5, size: 3.2, pulse: 0.06, label: "警觉" },
  surprise: { color: [52, 211, 153],  speed: 1.8, size: 3.5, pulse: 0.07, label: "惊喜" },
  focus:    { color: [59, 130, 246],  speed: 0.4, size: 2.2, pulse: 0.015, label: "专注" },
  curious:  { color: [232, 121, 249], speed: 1.0, size: 2.6, pulse: 0.04, label: "好奇" },
  awkward:  { color: [251, 191, 36],  speed: 0.6, size: 2.3, pulse: 0.025, label: "困惑" },
};

// 情绪感知提示文案
const EMOTION_TOOLTIPS = {
  neutral: "",
  happy: "小星感知到好消息，开心中~",
  sad: "小星有点低落...",
  think: "小星正在深度思考...",
  angry: "小星检测到异常，进入警戒！",
  surprise: "小星发现了新东西！",
  focus: "小星感知到陛下正在专注工作",
  curious: "小星对陛下在做的事很好奇~",
  awkward: "小星有点不确定...",
};

export class StarSpirit {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.particles = [];
    this.emotion = "neutral";
    this.prevEmotion = "neutral";
    this.targetEmotion = EMOTIONS.neutral;
    this.currentEmotion = { ...EMOTIONS.neutral };
    this.time = 0;
    this.eyeBlink = 0;
    this.mouseOver = false;

    // 粒子交互物理
    this.mouseX = canvas.width / 2;
    this.mouseY = canvas.height / 2;
    this.isMouseDown = false;
    this.repelForce = 0;       // 排斥力（触碰时增大）
    this.returnSpeed = 0.03;   // 聚拢回弹速度

    // 帧率自适应
    this._lastFrameTime = performance.now();
    this._frameCount = 0;
    this._fps = 60;
    this._targetParticles = 80;
    this._fpsCheckInterval = 0;

    // 情绪tooltip
    this._tooltipTimer = null;

    this._initParticles(80);
    this._bindEvents();
    this._animate();
  }

  /** 初始化粒子 */
  _initParticles(count) {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    this.particles = [];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const yBias = (Math.random() - 0.5) * 2;
      const radius = 30 + Math.random() * 25;
      const bodyRadius = radius * (1 - Math.abs(yBias) * 0.3);

      this.particles.push({
        x: cx + Math.cos(angle) * bodyRadius * 0.6,
        y: cy + yBias * radius * 0.5,
        baseX: cx + Math.cos(angle) * bodyRadius * 0.6,
        baseY: cy + yBias * radius * 0.5,
        // 交互物理：独立速度
        vx: 0,
        vy: 0,
        size: 1.5 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
        orbitSpeed: 0.3 + Math.random() * 0.7,
        orbitRadius: 2 + Math.random() * 8,
        alpha: 0.4 + Math.random() * 0.6,
      });
    }

    // 眼睛粒子
    for (let i = 0; i < 6; i++) {
      const eyeX = i < 3 ? cx - 14 : cx + 14;
      const eyeY = cy - 8 + (i % 3 - 1) * 4;
      this.particles.push({
        x: eyeX, y: eyeY,
        baseX: eyeX, baseY: eyeY,
        vx: 0, vy: 0,
        size: 2.5,
        phase: Math.random() * Math.PI * 2,
        orbitSpeed: 0.2, orbitRadius: 1,
        alpha: 0.9, isEye: true,
      });
    }
  }

  _bindEvents() {
    // 鼠标移入/移出 → 好奇/恢复
    this.canvas.addEventListener("mouseenter", () => {
      this.mouseOver = true;
    });
    this.canvas.addEventListener("mouseleave", () => {
      this.mouseOver = false;
      this.repelForce = 0;
    });

    // 鼠标位置跟踪（交互物理核心）
    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      this.mouseY = (e.clientY - rect.top) * (this.canvas.height / rect.height);
      // 鼠标经过时轻微排斥
      if (this.mouseOver) {
        this.repelForce = 0.8;
      }
    });

    // 点击 → 粒子强力散开 + 开心
    this.canvas.addEventListener("mousedown", () => {
      this.isMouseDown = true;
      this.repelForce = 3.0; // 强力排斥
    });
    this.canvas.addEventListener("mouseup", () => {
      this.isMouseDown = false;
      this.repelForce = this.mouseOver ? 0.8 : 0;
    });

    // 点击触发开心
    this.canvas.addEventListener("click", () => {
      this._showTooltip("小星被戳到了，好开心！");
    });
  }

  setEmotion(emotion) {
    if (EMOTIONS[emotion] && emotion !== this.emotion) {
      this.prevEmotion = this.emotion;
      this.emotion = emotion;
      this.targetEmotion = EMOTIONS[emotion];

      // 更新UI标签（中文）
      const label = document.getElementById("emotion-label");
      if (label) label.textContent = `${EMOTIONS[emotion].label}`;

      // 情绪变化时显示tooltip（非neutral时）
      if (emotion !== "neutral" && emotion !== this.prevEmotion) {
        const tip = EMOTION_TOOLTIPS[emotion];
        if (tip) this._showTooltip(tip);
      }
    }
  }

  /** 显示情绪感知tooltip */
  _showTooltip(text) {
    let tooltip = document.getElementById("emotion-tooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "emotion-tooltip";
      tooltip.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: rgba(124,92,252,0.9); color: white; padding: 8px 16px;
        border-radius: 20px; font-size: 12px; pointer-events: none;
        opacity: 0; transition: opacity 0.3s; z-index: 9999;
        white-space: nowrap; backdrop-filter: blur(8px);
      `;
      document.body.appendChild(tooltip);
    }
    tooltip.textContent = text;
    tooltip.style.opacity = "1";

    if (this._tooltipTimer) clearTimeout(this._tooltipTimer);
    this._tooltipTimer = setTimeout(() => {
      tooltip.style.opacity = "0";
    }, 2500);
  }

  _lerp(a, b, t) {
    return a + (b - a) * t;
  }

  _animate() {
    const now = performance.now();
    const dt = Math.min((now - this._lastFrameTime) / 1000, 0.05); // cap at 50ms
    this._lastFrameTime = now;
    this.time += dt;

    // ── 帧率自适应 (每2秒检查) ──
    this._frameCount++;
    this._fpsCheckInterval += dt;
    if (this._fpsCheckInterval >= 2) {
      this._fps = this._frameCount / this._fpsCheckInterval;
      this._frameCount = 0;
      this._fpsCheckInterval = 0;

      // 动态调整粒子数
      if (this._fps < 25 && this._targetParticles > 20) {
        this._targetParticles = Math.max(20, this._targetParticles - 20);
        this._initParticles(this._targetParticles);
      } else if (this._fps > 55 && this._targetParticles < 80) {
        this._targetParticles = Math.min(80, this._targetParticles + 10);
        this._initParticles(this._targetParticles);
      }
    }

    // ── 平滑情绪过渡 (easing 0.05 ≈ 0.2s) ──
    const t = this.targetEmotion;
    const c = this.currentEmotion;
    const ease = 5 * dt; // ~0.05 per frame at 60fps
    c.color = c.color.map((v, i) => this._lerp(v, t.color[i], ease));
    c.speed = this._lerp(c.speed, t.speed, ease);
    c.size = this._lerp(c.size, t.size, ease);
    c.pulse = this._lerp(c.pulse, t.pulse, ease);

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 呼吸发光
    const breathe = 1 + Math.sin(this.time * 2) * c.pulse * 3;

    // 排斥力衰减
    if (!this.isMouseDown && this.repelForce > 0) {
      this.repelForce *= 0.95;
      if (this.repelForce < 0.01) this.repelForce = 0;
    }

    // 眨眼逻辑
    this.eyeBlink -= dt;
    if (this.eyeBlink <= 0) {
      this.eyeBlink = 3 + Math.random() * 3;
    }
    const isBlinking = this.eyeBlink > 0 && this.eyeBlink < 0.15;

    // ── 绘制粒子 ──
    for (const p of this.particles) {
      // 轨道运动
      const orbX = Math.cos(this.time * p.orbitSpeed + p.phase) * p.orbitRadius * c.speed;
      const orbY = Math.sin(this.time * p.orbitSpeed * 0.7 + p.phase) * p.orbitRadius * c.speed;

      // 目标位置（基础 + 轨道）
      const targetX = p.baseX + orbX;
      const targetY = p.baseY + orbY;

      // ── 交互物理：排斥力 ──
      if (this.repelForce > 0) {
        const dx = p.x - this.mouseX;
        const dy = p.y - this.mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;
        const force = this.repelForce * 50 / (dist * dist + 100);
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
      }

      // 弹性回弹到目标位置
      p.vx += (targetX - p.x) * this.returnSpeed;
      p.vy += (targetY - p.y) * this.returnSpeed;

      // 阻尼
      p.vx *= 0.85;
      p.vy *= 0.85;

      // 更新位置
      p.x += p.vx;
      p.y += p.vy;

      const size = p.size * c.size / 2.5 * breathe;
      const [r, g, b] = c.color;
      let alpha = p.alpha;

      if (p.isEye && isBlinking) alpha = 0.1;

      // 核心发光点
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.fill();

      // 外发光
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 3);
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha * 0.3})`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.beginPath();
      ctx.arc(p.x, p.y, size * 3, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // 中心光晕
    const cx = w / 2;
    const cy = h / 2;
    const [r, g, b] = c.color;
    const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 50 * breathe);
    coreGlow.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.15)`);
    coreGlow.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.05)`);
    coreGlow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.beginPath();
    ctx.arc(cx, cy, 50 * breathe, 0, Math.PI * 2);
    ctx.fillStyle = coreGlow;
    ctx.fill();

    requestAnimationFrame(() => this._animate());
  }

  /** 销毁渲染器 */
  destroy() {
    // 停止动画（通过flag）
    this.canvas = null;
  }
}
