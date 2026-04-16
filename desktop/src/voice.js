/**
 * 语音系统 v2 — 真正可用的 STT + TTS
 *
 * STT方案：MediaRecorder录音 → 后端Whisper/API转写（兼容Tauri WKWebView）
 * TTS方案：Web Speech API（WKWebView支持）+ 后端TTS备选
 *
 * Web Speech API 的 SpeechRecognition 在 WKWebView 中不可用，
 * 所以用 MediaRecorder 录音 + 后端转写替代
 */

export class VoiceSystem {
  constructor() {
    this.isListening = false;
    this.isSpeaking = false;
    this.synthesis = window.speechSynthesis;
    this.preferredVoice = null;

    // 录音相关
    this._mediaRecorder = null;
    this._audioChunks = [];
    this._stream = null;

    // 回调
    this.onResult = null;       // (text, isFinal) => void
    this.onListenStart = null;
    this.onListenEnd = null;
    this.onSpeakStart = null;
    this.onSpeakEnd = null;
    this.onRecordingProgress = null; // (seconds) => void

    // 录音计时
    this._recordTimer = null;
    this._recordSeconds = 0;
    this._maxRecordSeconds = 30; // 最长录音30秒

    this._initTTS();
  }

  // ── STT: 录音 + 后端转写 ──────────────────────────────

  get sttAvailable() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /** 开始录音 */
  async startListening() {
    if (this.isListening) return true;

    // 停止正在播放的语音
    if (this.isSpeaking) this.stopSpeaking();

    try {
      // 请求麦克风权限
      this._stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      // 创建 MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "audio/webm";

      this._mediaRecorder = new MediaRecorder(this._stream, { mimeType });
      this._audioChunks = [];

      this._mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this._audioChunks.push(e.data);
        }
      };

      this._mediaRecorder.onstop = async () => {
        this._stopRecordTimer();
        this._releaseStream();

        if (this._audioChunks.length === 0) {
          this.onListenEnd?.();
          return;
        }

        // 合并音频数据
        const audioBlob = new Blob(this._audioChunks, { type: mimeType });
        this._audioChunks = [];

        // 转为 base64 发送给后端转写
        this.onResult?.("语音识别中...", false);
        const text = await this._transcribe(audioBlob);

        if (text && text.trim()) {
          this.onResult?.(text.trim(), true);
        } else {
          this.onResult?.("", true); // 空结果，清除"识别中"提示
        }
        this.onListenEnd?.();
      };

      // 开始录音（每秒收集一次数据）
      this._mediaRecorder.start(1000);
      this.isListening = true;
      this._recordSeconds = 0;
      this._startRecordTimer();
      this.onListenStart?.();
      return true;

    } catch (err) {
      console.warn("麦克风访问失败:", err);
      this.isListening = false;
      this.onListenEnd?.();
      return false;
    }
  }

  /** 停止录音 */
  stopListening() {
    if (this._mediaRecorder && this.isListening) {
      this.isListening = false;
      this._mediaRecorder.stop();
    }
  }

  /** 切换录音 */
  toggleListening() {
    if (this.isListening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  _startRecordTimer() {
    this._recordTimer = setInterval(() => {
      this._recordSeconds++;
      this.onRecordingProgress?.(this._recordSeconds);
      // 超时自动停止
      if (this._recordSeconds >= this._maxRecordSeconds) {
        this.stopListening();
      }
    }, 1000);
  }

  _stopRecordTimer() {
    if (this._recordTimer) {
      clearInterval(this._recordTimer);
      this._recordTimer = null;
    }
  }

  _releaseStream() {
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
  }

  /** 音频转文字：发送到后端转写 */
  async _transcribe(audioBlob) {
    try {
      // 转为 base64
      const buffer = await audioBlob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      // 通过 Tauri invoke 或 HTTP 发送
      if (window.__TAURI_INTERNALS__) {
        const { invoke } = window.__TAURI_INTERNALS__;
        return await invoke("transcribe_audio", {
          audioBase64: base64,
          format: audioBlob.type.includes("mp4") ? "mp4" : "webm",
        });
      } else {
        // 浏览器 fallback: 直接调后端API
        const resp = await fetch("http://localhost:8888/api/v1/stt/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio_base64: base64, format: "webm" }),
        });
        const json = await resp.json();
        return json?.data?.text || json?.text || "";
      }
    } catch (err) {
      console.warn("语音转写失败:", err);
      return "";
    }
  }

  // ── TTS: 语音合成 ──────────────────────────────────────

  _initTTS() {
    if (!this.synthesis) return;

    const loadVoices = () => {
      const voices = this.synthesis.getVoices();
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

  get ttsAvailable() {
    return !!this.synthesis;
  }

  /** 语音朗读 */
  speak(text) {
    if (!this.synthesis) return;
    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 1.0;
    utterance.pitch = 1.1;
    utterance.volume = 0.9;

    if (this.preferredVoice) {
      utterance.voice = this.preferredVoice;
    }

    utterance.onstart = () => { this.isSpeaking = true; this.onSpeakStart?.(); };
    utterance.onend = () => { this.isSpeaking = false; this.onSpeakEnd?.(); };
    utterance.onerror = () => { this.isSpeaking = false; this.onSpeakEnd?.(); };

    this.synthesis.speak(utterance);
  }

  stopSpeaking() {
    if (this.synthesis) {
      this.synthesis.cancel();
      this.isSpeaking = false;
    }
  }

  getVoices() {
    if (!this.synthesis) return [];
    return this.synthesis.getVoices().filter(v => v.lang.startsWith("zh"));
  }
}
