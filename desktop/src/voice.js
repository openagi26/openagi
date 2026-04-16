/**
 * 语音系统 — STT(语音识别) + TTS(语音合成)
 *
 * Phase 2 MVP: 使用 Web Speech API（浏览器原生，零依赖）
 * Phase 3 升级: Whisper.cpp(本地STT) + Piper(本地TTS)
 */

export class VoiceSystem {
  constructor() {
    this.isListening = false;
    this.isSpeaking = false;
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.onResult = null;       // 语音识别结果回调
    this.onListenStart = null;  // 开始听回调
    this.onListenEnd = null;    // 停止听回调
    this.onSpeakStart = null;   // 开始说回调
    this.onSpeakEnd = null;     // 停止说回调
    this.preferredVoice = null; // 首选语音

    this._initSTT();
    this._initTTS();
  }

  // ── STT 语音识别 ──────────────────────────────────────

  _initSTT() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("浏览器不支持 SpeechRecognition");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = "zh-CN";        // 中文优先
    this.recognition.continuous = false;      // 单次识别
    this.recognition.interimResults = true;   // 实时中间结果

    this.recognition.onstart = () => {
      this.isListening = true;
      this.onListenStart?.();
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.onListenEnd?.();
    };

    this.recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      if (finalText) {
        this.onResult?.(finalText, true);
      } else if (interimText) {
        this.onResult?.(interimText, false);
      }
    };

    this.recognition.onerror = (event) => {
      console.warn("语音识别错误:", event.error);
      this.isListening = false;
      this.onListenEnd?.();
    };
  }

  /** 开始语音识别 */
  startListening() {
    if (!this.recognition) {
      console.warn("STT 不可用");
      return false;
    }
    if (this.isListening) return true;

    // 如果正在说话，先停止
    if (this.isSpeaking) {
      this.stopSpeaking();
    }

    try {
      this.recognition.start();
      return true;
    } catch (e) {
      console.warn("启动语音识别失败:", e);
      return false;
    }
  }

  /** 停止语音识别 */
  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  /** 切换语音识别 */
  toggleListening() {
    if (this.isListening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  get sttAvailable() {
    return !!this.recognition;
  }

  // ── TTS 语音合成 ──────────────────────────────────────

  _initTTS() {
    if (!this.synthesis) {
      console.warn("浏览器不支持 SpeechSynthesis");
      return;
    }

    // 等待 voices 加载（部分浏览器异步加载）
    const loadVoices = () => {
      const voices = this.synthesis.getVoices();
      // 优先选择中文女声
      this.preferredVoice =
        voices.find(v => v.lang.startsWith("zh") && v.name.includes("Ting")) ||
        voices.find(v => v.lang.startsWith("zh") && v.name.includes("female")) ||
        voices.find(v => v.lang.startsWith("zh-CN")) ||
        voices.find(v => v.lang.startsWith("zh")) ||
        voices[0] || null;
    };

    loadVoices();
    if (this.synthesis.onvoiceschanged !== undefined) {
      this.synthesis.onvoiceschanged = loadVoices;
    }
  }

  /** 语音朗读文本 */
  speak(text) {
    if (!this.synthesis) return;

    // 停止当前朗读
    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 1.0;
    utterance.pitch = 1.1;  // 略高音调，更可爱
    utterance.volume = 0.9;

    if (this.preferredVoice) {
      utterance.voice = this.preferredVoice;
    }

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.onSpeakStart?.();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.onSpeakEnd?.();
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      this.onSpeakEnd?.();
    };

    this.synthesis.speak(utterance);
  }

  /** 停止朗读 */
  stopSpeaking() {
    if (this.synthesis) {
      this.synthesis.cancel();
      this.isSpeaking = false;
    }
  }

  get ttsAvailable() {
    return !!this.synthesis;
  }

  /** 获取可用语音列表 */
  getVoices() {
    if (!this.synthesis) return [];
    return this.synthesis.getVoices().filter(v => v.lang.startsWith("zh"));
  }
}
