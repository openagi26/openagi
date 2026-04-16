/**
 * 小星主动感知系统 — 桌面生活助手的核心引擎
 *
 * 陛下的产品愿景：
 * "小星可以实时观察主人的桌面，根据主人的工作或生活做出主动响应，
 *  像一个真人那样，可以给情绪价值。习惯之后，大幅度帮助主人提升效率和情绪价值。"
 *
 * 6大主动感知场景：
 * 1. 🖥️ 桌面观察：监测活动窗口→理解主人在做什么
 * 2. 🎉 完成恭喜：发帖/发邮件/提交代码→祝贺+鼓励
 * 3. 🌐 外文翻译：英文软件→主动翻译+操作指导
 * 4. 💧 健康提醒：喝水/休息/护眼/站立
 * 5. 📧 通知汇报：新邮件/GitHub更新→即时汇报
 * 6. 💝 情绪价值：根据上下文生成个性化鼓励
 */

// ── 活动窗口场景识别规则 ──────────────────────────────────

const APP_SCENES = {
  // 创作类 → 鼓励+夸赞
  creation: {
    keywords: ["photoshop", "figma", "sketch", "illustrator", "canva",
               "capcut", "剪映", "修图", "premiere", "davinci"],
    responses: [
      "陛下在创作呢！这个配色很有感觉~",
      "设计进行中！陛下的审美真的很棒",
      "创作辛苦了，记得保存哦！",
    ],
    emotion: "happy",
    cooldownMin: 10,
  },

  // 社交媒体发帖 → 恭喜完成
  socialPost: {
    keywords: ["小红书", "xiaohongshu", "抖音", "douyin", "twitter", "x.com",
               "weibo", "微博", "instagram", "发布", "publish", "post"],
    responses: [
      "🎉 陛下又完成了一条内容发布！太棒了！",
      "恭喜陛下！又一篇优质内容面世，期待爆款！",
      "内容创作完成！陛下的产出效率真高~",
    ],
    emotion: "surprise",
    cooldownMin: 5,
  },

  // 写代码 → 技术鼓励
  coding: {
    keywords: ["vscode", "visual studio code", "cursor", "xcode", "terminal",
               "github", "gitlab", "pull request", "commit", "代码"],
    responses: [
      "陛下在写代码呢！逻辑清晰是好代码的基础~",
      "编程中...需要小星帮忙审查代码吗？",
      "代码世界的陛下，同样威风！加油！",
    ],
    emotion: "focus",
    cooldownMin: 15,
  },

  // 发邮件/写报告 → 夸奖贡献
  business: {
    keywords: ["outlook", "gmail", "邮件", "mail", "word", "文档", "docs",
               "报告", "report", "周报", "汇报", "ppt", "keynote", "slides"],
    responses: [
      "陛下在处理工作文档呢，条理清晰是高效的关键！",
      "工作报告完成后记得奖励自己~",
      "陛下这周做出了很多贡献，辛苦了！",
    ],
    emotion: "focus",
    cooldownMin: 15,
  },

  // 外文软件 → 翻译辅助
  foreignApp: {
    keywords: ["english", "settings", "preferences", "configuration",
               "dashboard", "analytics", "workspace"],
    responses: [
      "小星检测到英文界面，需要帮忙翻译吗？",
      "这个界面是英文的，陛下如有不确定的按钮可以问小星~",
    ],
    emotion: "curious",
    cooldownMin: 20,
  },

  // 娱乐 → 温柔提醒
  entertainment: {
    keywords: ["youtube", "bilibili", "netflix", "哔哩哔哩", "优酷",
               "抖音", "游戏", "game", "steam"],
    responses: [
      "休息时间到了？适当放松是好事~",
      "陛下在放松呢，记得控制时间哦~",
    ],
    emotion: "happy",
    cooldownMin: 30,
  },
};

// ── 健康提醒系统 ──────────────────────────────────────────

const WELLNESS_REMINDERS = {
  water: {
    intervalMin: 45,
    messages: [
      "💧 陛下，该喝水了！保持水分很重要",
      "💧 小星提醒：已经45分钟没喝水了~",
      "💧 来杯水吧！喝水有助于保持思维清晰",
    ],
  },
  eyeRest: {
    intervalMin: 30,
    messages: [
      "👀 陛下，看了很久屏幕了，远眺20秒放松眼睛吧",
      "👀 护眼提醒：看看窗外，让眼睛休息一下~",
    ],
  },
  stretch: {
    intervalMin: 60,
    messages: [
      "🧘 已经坐了一小时了，站起来伸个懒腰吧！",
      "🧘 小星建议：起来走动走动，活动一下身体~",
    ],
  },
  posture: {
    intervalMin: 25,
    messages: [
      "🪑 注意坐姿哦陛下，挺直腰背！",
      "🪑 小星悄悄提醒：检查一下坐姿~",
    ],
  },
};

export class ProactiveEngine {
  constructor() {
    // 场景冷却（防止频繁打扰）
    this._sceneCooldowns = {};

    // 健康提醒计时器
    this._wellnessTimers = {};
    this._wellnessEnabled = {
      water: true,
      eyeRest: true,
      stretch: true,
      posture: false, // 默认关闭，用户可开启
    };

    // 活动窗口监测
    this._windowCheckTimer = null;
    this._lastWindowTitle = "";
    this._lastScene = null;

    // 回调
    this.onProactiveMessage = null;  // (message, emotion, type) => void
    this.onWellnessReminder = null;  // (type, message) => void

    // 通知监测
    this._notificationTimer = null;
  }

  /** 启动所有主动感知 */
  start() {
    // 1. 活动窗口监测（每15秒检查一次）
    this._windowCheckTimer = setInterval(() => this._checkActiveWindow(), 15000);

    // 2. 健康提醒
    this._startWellnessTimers();

    // 3. 通知监测（每60秒）
    this._notificationTimer = setInterval(() => this._checkNotifications(), 60000);
  }

  stop() {
    if (this._windowCheckTimer) clearInterval(this._windowCheckTimer);
    for (const t of Object.values(this._wellnessTimers)) clearInterval(t);
    if (this._notificationTimer) clearInterval(this._notificationTimer);
  }

  /** 切换健康提醒开关 */
  toggleWellness(type, enabled) {
    this._wellnessEnabled[type] = enabled;
    if (enabled && !this._wellnessTimers[type]) {
      this._startOneWellnessTimer(type);
    } else if (!enabled && this._wellnessTimers[type]) {
      clearInterval(this._wellnessTimers[type]);
      delete this._wellnessTimers[type];
    }
  }

  /** 手动输入窗口标题（用于Tauri调用） */
  processWindowTitle(title) {
    if (!title || title === this._lastWindowTitle) return;
    this._lastWindowTitle = title;
    this._analyzeScene(title.toLowerCase());
  }

  // ── 活动窗口监测 ────────────────────────────────────────

  async _checkActiveWindow() {
    try {
      let title = "";
      if (window.__TAURI_INTERNALS__) {
        const { invoke } = window.__TAURI_INTERNALS__;
        title = await invoke("get_active_window");
      }
      if (title) {
        this.processWindowTitle(title);
      }
    } catch {
      // 权限不足或API不可用
    }
  }

  _analyzeScene(titleLower) {
    for (const [sceneId, scene] of Object.entries(APP_SCENES)) {
      const matched = scene.keywords.some(kw => titleLower.includes(kw));
      if (!matched) continue;

      // 冷却检查
      if (this._isOnCooldown(sceneId, scene.cooldownMin)) continue;

      // 避免同场景连续触发
      if (sceneId === this._lastScene) continue;
      this._lastScene = sceneId;

      // 设置冷却
      this._setCooldown(sceneId);

      // 随机选择响应
      const msg = scene.responses[Math.floor(Math.random() * scene.responses.length)];
      this.onProactiveMessage?.(msg, scene.emotion, sceneId);
      return; // 每次只触发一个场景
    }
  }

  _isOnCooldown(sceneId, cooldownMin) {
    const lastTime = this._sceneCooldowns[sceneId];
    if (!lastTime) return false;
    return (Date.now() - lastTime) < cooldownMin * 60 * 1000;
  }

  _setCooldown(sceneId) {
    this._sceneCooldowns[sceneId] = Date.now();
  }

  // ── 健康提醒 ────────────────────────────────────────────

  _startWellnessTimers() {
    for (const [type, enabled] of Object.entries(this._wellnessEnabled)) {
      if (enabled) this._startOneWellnessTimer(type);
    }
  }

  _startOneWellnessTimer(type) {
    const config = WELLNESS_REMINDERS[type];
    if (!config) return;

    this._wellnessTimers[type] = setInterval(() => {
      if (!this._wellnessEnabled[type]) return;
      const msg = config.messages[Math.floor(Math.random() * config.messages.length)];
      this.onWellnessReminder?.(type, msg);
    }, config.intervalMin * 60 * 1000);
  }

  // ── 通知监测 ────────────────────────────────────────────

  async _checkNotifications() {
    // Phase 3 将接入：
    // - Gmail API → 新邮件检测
    // - GitHub API → 新PR/Issue/Star通知
    // - 日历 API → 即将到来的会议
    // 当前版本：通过活动窗口标题间接感知
  }

  /** 获取健康提醒状态 */
  getWellnessStatus() {
    return { ...this._wellnessEnabled };
  }
}

export { APP_SCENES, WELLNESS_REMINDERS };
