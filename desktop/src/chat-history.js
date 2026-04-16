/**
 * 聊天历史持久化 — 小星的记忆
 *
 * 聊天记录保存到localStorage，关闭窗口不丢失。
 * 支持：
 * - 自动保存每条消息
 * - 启动时恢复历史
 * - 按日期分组
 * - 最多保留500条（防止存储膨胀）
 */

const STORAGE_KEY = "xiaoxing-chat-history";
const MAX_MESSAGES = 500;

export class ChatHistory {
  constructor() {
    this.messages = [];
    this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.messages = JSON.parse(raw);
        // 限制数量
        if (this.messages.length > MAX_MESSAGES) {
          this.messages = this.messages.slice(-MAX_MESSAGES);
          this._save();
        }
      }
    } catch {
      this.messages = [];
    }
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.messages));
    } catch {}
  }

  /** 添加消息 */
  add(type, text) {
    const msg = {
      type,         // "ai" | "user" | "system"
      text,
      time: Date.now(),
    };
    this.messages.push(msg);

    // 超出限制时裁剪
    if (this.messages.length > MAX_MESSAGES) {
      this.messages = this.messages.slice(-MAX_MESSAGES);
    }

    this._save();
    return msg;
  }

  /** 获取所有历史 */
  getAll() {
    return this.messages;
  }

  /** 获取最近N条 */
  getRecent(n = 50) {
    return this.messages.slice(-n);
  }

  /** 获取今日消息 */
  getToday() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const ts = todayStart.getTime();
    return this.messages.filter(m => m.time >= ts);
  }

  /** 清空历史 */
  clear() {
    this.messages = [];
    this._save();
  }

  /** 消息总数 */
  get count() {
    return this.messages.length;
  }
}
