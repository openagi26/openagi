/**
 * 专注模式看护 — 效率型杀手场景
 *
 * 来自审计-外C（opus）的核心建议：
 * "纯陪伴无法驱动增长，必须让用户觉得没有小灵效率会降"
 *
 * 功能：
 * 1. 用户开启专注模式 → 设定专注时长（25/45/60分钟）
 * 2. 专注中小灵变为蓝色focus状态，安静陪伴
 * 3. 检测用户离开（无操作>60秒）→ 温柔提醒
 * 4. 专注结束 → 庆祝动画 + 统计报告
 * 5. 连续专注记录 → 成就系统
 */

const FOCUS_PRESETS = [
  { name: "番茄钟", minutes: 25, emoji: "🍅" },
  { name: "深度工作", minutes: 45, emoji: "🧠" },
  { name: "马拉松", minutes: 60, emoji: "🏃" },
  { name: "自定义", minutes: 0, emoji: "⏱️" },
];

export class FocusGuard {
  constructor() {
    this.isActive = false;
    this.startTime = null;
    this.duration = 25 * 60 * 1000; // 默认25分钟
    this.elapsed = 0;
    this.idleSeconds = 0;
    this._timer = null;
    this._idleTimer = null;
    this._lastActivity = Date.now();

    // 统计
    this.todaySessions = 0;
    this.todayMinutes = 0;
    this.streak = 0; // 连续完成次数

    // 回调
    this.onStart = null;      // 开始专注
    this.onEnd = null;        // 结束（完成或中断）
    this.onTick = null;       // 每秒更新
    this.onIdleWarning = null; // 闲置提醒
    this.onMilestone = null;   // 里程碑（25%/50%/75%）

    this._loadStats();
    this._setupIdleDetection();
  }

  /** 开始专注 */
  start(minutes) {
    if (this.isActive) return;

    this.isActive = true;
    this.duration = (minutes || 25) * 60 * 1000;
    this.startTime = Date.now();
    this.elapsed = 0;
    this._lastActivity = Date.now();

    this.onStart?.({ minutes, preset: FOCUS_PRESETS.find(p => p.minutes === minutes) });

    // 每秒更新
    this._timer = setInterval(() => this._tick(), 1000);
  }

  /** 结束专注 */
  stop(completed = false) {
    if (!this.isActive) return;

    this.isActive = false;
    clearInterval(this._timer);
    this._timer = null;

    const actualMinutes = Math.round(this.elapsed / 60000);

    if (completed) {
      this.todaySessions++;
      this.todayMinutes += actualMinutes;
      this.streak++;
      this._saveStats();
    } else {
      this.streak = 0;
    }

    this.onEnd?.({
      completed,
      actualMinutes,
      todaySessions: this.todaySessions,
      todayMinutes: this.todayMinutes,
      streak: this.streak,
    });
  }

  /** 记录用户活动（键盘/鼠标事件调用） */
  recordActivity() {
    this._lastActivity = Date.now();
    this.idleSeconds = 0;
  }

  /** 获取剩余时间字符串 */
  getTimeRemaining() {
    if (!this.isActive) return "";
    const remaining = Math.max(0, this.duration - this.elapsed);
    const min = Math.floor(remaining / 60000);
    const sec = Math.floor((remaining % 60000) / 1000);
    return `${min}:${sec.toString().padStart(2, "0")}`;
  }

  /** 获取进度百分比 */
  getProgress() {
    if (!this.isActive || this.duration === 0) return 0;
    return Math.min(1, this.elapsed / this.duration);
  }

  _tick() {
    this.elapsed = Date.now() - this.startTime;
    const progress = this.getProgress();

    this.onTick?.({
      remaining: this.getTimeRemaining(),
      progress,
      elapsed: this.elapsed,
    });

    // 里程碑提醒
    const pct = Math.round(progress * 100);
    if (pct === 25 || pct === 50 || pct === 75) {
      this.onMilestone?.(pct);
    }

    // 完成
    if (this.elapsed >= this.duration) {
      this.stop(true);
    }
  }

  _setupIdleDetection() {
    // 每10秒检测闲置
    this._idleTimer = setInterval(() => {
      if (!this.isActive) return;

      this.idleSeconds = Math.round((Date.now() - this._lastActivity) / 1000);

      // 闲置超过60秒 → 温柔提醒
      if (this.idleSeconds >= 60 && this.idleSeconds % 60 === 0) {
        this.onIdleWarning?.(this.idleSeconds);
      }
    }, 10000);
  }

  _loadStats() {
    try {
      const today = new Date().toDateString();
      const saved = JSON.parse(localStorage.getItem("focus-stats") || "{}");
      if (saved.date === today) {
        this.todaySessions = saved.sessions || 0;
        this.todayMinutes = saved.minutes || 0;
        this.streak = saved.streak || 0;
      }
    } catch {}
  }

  _saveStats() {
    try {
      localStorage.setItem("focus-stats", JSON.stringify({
        date: new Date().toDateString(),
        sessions: this.todaySessions,
        minutes: this.todayMinutes,
        streak: this.streak,
      }));
    } catch {}
  }

  destroy() {
    if (this._timer) clearInterval(this._timer);
    if (this._idleTimer) clearInterval(this._idleTimer);
  }
}

export { FOCUS_PRESETS };
