/**
 * SpeechToText（语音转文字）服务
 * 封装浏览器原生 SpeechRecognition（语音识别）API
 * 支持 WebKit（苹果/Safari 前缀）兼容
 * W15 语音聊天 MVP
 */

// 浏览器 SpeechRecognition（语音识别）类型声明
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

// 获取 SpeechRecognition（语音识别）构造器，兼容 WebKit 前缀
function getSpeechRecognitionClass(): (new () => SpeechRecognitionInstance) | null {
  const w = window as unknown as Record<string, unknown>;
  return (
    (w['SpeechRecognition'] as (new () => SpeechRecognitionInstance)) ||
    (w['webkitSpeechRecognition'] as (new () => SpeechRecognitionInstance)) ||
    null
  );
}

export interface STTOptions {
  lang?: string;       // 语言，默认 'zh-CN'（中文普通话）
  continuous?: boolean; // 是否持续录音，默认 false（单次识别）
}

/**
 * 开始语音监听
 * @param onResult 识别结果回调，传入识别到的文字
 * @param onError 错误回调，传入错误信息
 * @param options 选项（语言、是否持续）
 * @returns stop 函数，调用可手动停止录音
 */
export function startListening(
  onResult: (text: string) => void,
  onError: (msg: string) => void,
  options: STTOptions = {}
): () => void {
  const SpeechRecognitionClass = getSpeechRecognitionClass();

  if (!SpeechRecognitionClass) {
    onError('浏览器不支持语音识别（SpeechRecognition），请升级到最新版本');
    return () => {};
  }

  const recognition = new SpeechRecognitionClass();
  recognition.lang = options.lang ?? 'zh-CN';
  recognition.continuous = options.continuous ?? false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    const results = event.results;
    if (results && results.length > 0) {
      const transcript = results[results.length - 1][0].transcript.trim();
      if (transcript) {
        onResult(transcript);
      }
    }
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    const errorMessages: Record<string, string> = {
      'network': '请检查网络连接，语音识别需要联网',
      'not-allowed': '麦克风权限被拒绝，请在系统设置中允许麦克风访问',
      'no-speech': '没有检测到说话声音',
      'aborted': '语音识别已取消',
      'audio-capture': '无法访问麦克风设备',
      'service-not-allowed': '语音识别服务不可用',
    };
    const msg = errorMessages[event.error] ?? `语音识别错误：${event.error}`;
    onError(msg);
  };

  try {
    recognition.start();
  } catch (e) {
    onError(`无法启动语音识别：${e instanceof Error ? e.message : String(e)}`);
    return () => {};
  }

  return () => {
    try {
      recognition.stop();
    } catch {
      // 已停止，忽略错误
    }
  };
}

/**
 * 检测浏览器是否支持语音识别
 */
export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionClass() !== null;
}
