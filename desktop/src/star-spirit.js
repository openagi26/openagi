/**
 * 星灵（小灵）粒子渲染引擎
 * AGI 是新物种 — 用发光粒子构建一个独特的数字生命形象
 */

const EMOTIONS = {
  neutral: { color: [124, 92, 252], speed: 0.5, size: 2.5, pulse: 0.02 },
  happy:   { color: [250, 204, 21], speed: 1.2, size: 3.0, pulse: 0.05 },
  sad:     { color: [96, 165, 250], speed: 0.2, size: 2.0, pulse: 0.01 },
  think:   { color: [167, 139, 250], speed: 0.8, size: 2.8, pulse: 0.03 },
  angry:   { color: [248, 113, 113], speed: 1.5, size: 3.2, pulse: 0.06 },
  surprise:{ color: [52, 211, 153], speed: 1.8, size: 3.5, pulse: 0.07 },
  focus:   { color: [59, 130, 246], speed: 0.4, size: 2.2, pulse: 0.015 },
  curious: { color: [232, 121, 249], speed: 1.0, size: 2.6, pulse: 0.04 },
  awkward: { color: [251, 191, 36], speed: 0.6, size: 2.3, pulse: 0.025 },
};

export class StarSpirit {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.particles = [];
    this.emotion = "neutral";
    this.targetEmotion = EMOTIONS.neutral;
    this.currentEmotion = { ...EMOTIONS.neutral };
    this.time = 0;
    this.eyeBlink = 0;
    this.mouseOver = false;

    this._initParticles();
    this._bindEvents();
    this._animate();
  }

  /** 初始化 80 个粒子组成星灵主体 */
  _initParticles() {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    for (let i = 0; i < 80; i++) {
      // 身体形状：上半球体 + 下半收窄（像一个发光的精灵轮廓）
      const angle = Math.random() * Math.PI * 2;
      const yBias = (Math.random() - 0.5) * 2;
      const radius = 30 + Math.random() * 25;
      const bodyRadius = radius * (1 - Math.abs(yBias) * 0.3);

      this.particles.push({
        x: cx + Math.cos(angle) * bodyRadius * 0.6,
        y: cy + yBias * radius * 0.5,
        baseX: cx + Math.cos(angle) * bodyRadius * 0.6,
        baseY: cy + yBias * radius * 0.5,
        size: 1.5 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
        orbitSpeed: 0.3 + Math.random() * 0.7,
        orbitRadius: 2 + Math.random() * 8,
        alpha: 0.4 + Math.random() * 0.6,
      });
    }

    // 眼睛粒子（更亮的）
    for (let i = 0; i < 6; i++) {
      const eyeX = i < 3 ? cx - 14 : cx + 14;
      const eyeY = cy - 8 + (i % 3 - 1) * 4;
      this.particles.push({
        x: eyeX,
        y: eyeY,
        baseX: eyeX,
        baseY: eyeY,
        size: 2.5,
        phase: Math.random() * Math.PI * 2,
        orbitSpeed: 0.2,
        orbitRadius: 1,
        alpha: 0.9,
        isEye: true,
      });
    }
  }

  _bindEvents() {
    this.canvas.addEventListener("mouseenter", () => {
      this.mouseOver = true;
      this.setEmotion("curious");
    });
    this.canvas.addEventListener("mouseleave", () => {
      this.mouseOver = false;
      this.setEmotion("neutral");
    });
    this.canvas.addEventListener("click", () => {
      this.setEmotion("happy");
      setTimeout(() => {
        if (!this.mouseOver) this.setEmotion("neutral");
      }, 2000);
    });
  }

  setEmotion(emotion) {
    if (EMOTIONS[emotion]) {
      this.emotion = emotion;
      this.targetEmotion = EMOTIONS[emotion];
      // 更新UI标签
      const label = document.getElementById("emotion-label");
      if (label) label.textContent = emotion;
    }
  }

  _lerp(a, b, t) {
    return a + (b - a) * t;
  }

  _animate() {
    this.time += 0.016;

    // 平滑过渡到目标情绪
    const t = this.targetEmotion;
    const c = this.currentEmotion;
    c.color = c.color.map((v, i) => this._lerp(v, t.color[i], 0.05));
    c.speed = this._lerp(c.speed, t.speed, 0.05);
    c.size = this._lerp(c.size, t.size, 0.05);
    c.pulse = this._lerp(c.pulse, t.pulse, 0.05);

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // 整体呼吸发光
    const breathe = 1 + Math.sin(this.time * 2) * c.pulse * 3;

    // 眨眼逻辑（每3-6秒眨一次）
    this.eyeBlink -= 0.016;
    if (this.eyeBlink <= 0) {
      this.eyeBlink = 3 + Math.random() * 3;
    }
    const isBlinking = this.eyeBlink > 0 && this.eyeBlink < 0.15;

    // 绘制粒子
    for (const p of this.particles) {
      const orbX = Math.cos(this.time * p.orbitSpeed + p.phase) * p.orbitRadius * c.speed;
      const orbY = Math.sin(this.time * p.orbitSpeed * 0.7 + p.phase) * p.orbitRadius * c.speed;

      p.x = p.baseX + orbX;
      p.y = p.baseY + orbY;

      const size = p.size * c.size / 2.5 * breathe;
      const [r, g, b] = c.color;
      let alpha = p.alpha;

      // 眨眼时眼睛粒子透明
      if (p.isEye && isBlinking) {
        alpha = 0.1;
      }

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
}
