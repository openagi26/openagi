/**
 * TextToSpeech（文字转语音）服务
 * 封装浏览器原生 speechSynthesis（语音合成）API
 * 自动选中文女声：macOS 优先 Tingting / Mei-Jia，Windows 优先 Xiaoxiao
 * W15 语音聊天 MVP
 */

export interface TTSOptions {
  lang?: string;   // 语言，默认 'zh-CN'
  voice?: SpeechSynthesisVoice;  // 指定声音，不传则自动选
  rate?: number;   // 语速，0.1~10，默认 1.0
  pitch?: number;  // 音调，0~2，默认 1.0
  volume?: number; // 音量，0~1，默认 1.0
}

// macOS 中文女声优先顺序
const MACOS_CN_VOICES = ['Tingting', 'Mei-Jia', 'Ting-Ting'];
// Windows 中文女声优先顺序
const WINDOWS_CN_VOICES = ['Microsoft Xiaoxiao Online', 'Xiaoxiao', 'Microsoft Huihui'];
// 通用中文女声关键词（作兜底）
const GENERIC_CN_KEYWORDS = ['zh-CN', 'zh_CN', 'Chinese', '中文'];

let cachedVoice: SpeechSynthesisVoice | null = null;
let voiceLoadAttempted = false;

/**
 * 获取最佳中文女声
 * 首次调用时加载 voices 列表并缓存结果
 */
export function getBestChineseVoice(): Promise<SpeechSynthesisVoice | null> {
  return new Promise((resolve) => {
    if (cachedVoice && voiceLoadAttempted) {
      resolve(cachedVoice);
      return;
    }

    const trySelect = () => {
      const voices = speechSynthesis.getVoices();
      if (voices.length === 0) return null;

      voiceLoadAttempted = true;

      // 优先 macOS 中文女声
      for (const name of MACOS_CN_VOICES) {
        const v = voices.find(v => v.name === name);
        if (v) { cachedVoice = v; return v; }
      }
      // 其次 Windows 中文女声
      for (const name of WINDOWS_CN_VOICES) {
        const v = voices.find(v => v.name.includes(name));
        if (v) { cachedVoice = v; return v; }
      }
      // 通用中文关键词兜底
      for (const kw of GENERIC_CN_KEYWORDS) {
        const v = voices.find(v => v.lang.includes(kw) || v.name.includes(kw));
        if (v) { cachedVoice = v; return v; }
      }
      return null;
    };

    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(trySelect());
    } else {
      // voices 列表异步加载，监听 onvoiceschanged 事件
      speechSynthesis.onvoiceschanged = () => {
        resolve(trySelect());
      };
      // 2 秒超时兜底
      setTimeout(() => {
        if (!voiceLoadAttempted) {
          voiceLoadAttempted = true;
          resolve(trySelect());
        }
      }, 2000);
    }
  });
}

/**
 * 播放文字语音
 * @param text 要朗读的文字
 * @param options 选项
 * @returns Promise，播放完成后 resolve，错误时 reject
 */
export async function speak(text: string, options: TTSOptions = {}): Promise<void> {
  if (!('speechSynthesis' in window)) {
    throw new Error('浏览器不支持语音合成（speechSynthesis）');
  }

  // 先停止正在播放的内容
  speechSynthesis.cancel();

  const voice = options.voice ?? await getBestChineseVoice();

  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options.lang ?? 'zh-CN';
    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;

    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = (e) => {
      // 'interrupted' 是主动 cancel() 导致的，不算错误
      if (e.error === 'interrupted' || e.error === 'canceled') {
        resolve();
      } else {
        reject(new Error(`语音合成错误：${e.error}`));
      }
    };

    speechSynthesis.speak(utterance);
  });
}

/**
 * 停止当前正在播放的语音
 */
export function cancelSpeech(): void {
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
}

/**
 * 检测浏览器是否支持语音合成
 */
export function isTTSSupported(): boolean {
  return 'speechSynthesis' in window;
}
