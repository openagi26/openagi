/**
 * 亲密度模式服务
 * 管理小星的说话风格：伴侣模式（默认）vs 专业助手模式
 */

export type IntimacyMode = 'companion' | 'assistant';

const STORAGE_KEY = 'openagi:intimacy_mode';

export function getIntimacyMode(): IntimacyMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'companion' || stored === 'assistant') {
      return stored;
    }
  } catch {
    // ignore
  }
  return 'companion'; // 默认伴侣模式
}

export function setIntimacyMode(mode: IntimacyMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
    // 触发自定义事件，让其他组件能够响应
    window.dispatchEvent(new CustomEvent('intimacy-mode-changed', { detail: { mode } }));
  } catch {
    // ignore
  }
}
