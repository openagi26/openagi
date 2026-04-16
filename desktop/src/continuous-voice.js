/**
 * 小星连续语音对话系统 — 面对面式自然交流
 *
 * 陛下的需求："语音一直开着，实时识别和发送，小星也实时回复，
 *  小星说话可以被打断，用户说完后会继续接着说。
 *  像面对面的智能交流，而不是输入框式的简单沟通。"
 *
 * 核心机制：
 * 1. VAD（Voice Activity Detection）：检测有人说话
 * 2. 静默检测：1.5秒没声音→自动发送
 * 3. 打断：用户说话时→立即停止TTS→开始听
 * 4. 续接：AI说完→继续监听→无缝对话
 */

export class ContinuousVoice {
  constructor() {
    this.isActive = false;       // 连续对话模式是否开启
    this.isListening = false;    // 当前是否在录音
    this.isSpeaking = false;     // 小星是否在说话
    this.stream = null;
    this.audioContext = null;
    this.analyser = null;

    // VAD 参数
    this._silenceThreshold = 0.015;  // 静默阈值（低于此=没人说话）
    this._silenceDuration = 1500;     // 静默多久算说完（ms）
    this._silenceStart = 0;
    this._isSpeechDetected = false;

    // 录音
    this._mediaRecorder = null;
    this._audioChunks = [];
    this._recordingStartTime = 0;

    // TTS
    this.synthesis = window.speechSynthesis;
    this._currentUtterance = null;

    // 回调
    this.onUserSpeechStart = null;   // 用户开始说话
    this.onUserSpeechEnd = null;     // 用户说完（带录音数据）
    this.onTranscript = null;        // 语音识别结果
    this.onAIResponse = null;        // AI回复文字
    this.onStateChange = null;       // 状态变化（listening/thinking/speaking/idle）
    this.onVolumeLevel = null;       // 音量电平（用于可视化）
  }

  /** 开启连续对话模式 */
  async start() {
    if (this.isActive) return true;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      // 创建音频分析器（VAD用）
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.8;
      source.connect(this.analyser);

      this.isActive = true;
      this._setState("listening");

      // 开始VAD监听循环
      this._startVADLoop();
      return true;
    } catch (err) {
      console.warn("连续语音启动失败:", err);
      return false;
    }
  }

  /** 关闭连续对话 */
  stop() {
    this.isActive = false;
    this._stopRecording();
    this._stopSpeaking();
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this._setState("idle");
  }

  /** 小星说话（可被打断） */
  speak(text) {
    if (!this.synthesis || !this.isActive) return;

    this._stopSpeaking(); // 停掉之前的

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 1.05;
    utterance.pitch = 1.1;
    utterance.volume = 0.9;

    // 找中文女声
    const voices = this.synthesis.getVoices();
    const zhVoice = voices.find(v => v.lang.startsWith("zh-CN")) || voices[0];
    if (zhVoice) utterance.voice = zhVoice;

    utterance.onstart = () => {
      this.isSpeaking = true;
      this._setState("speaking");
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      if (this.isActive) {
        // 说完后继续听
        this._setState("listening");
      }
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      if (this.isActive) this._setState("listening");
    };

    this._currentUtterance = utterance;
    this.synthesis.speak(utterance);
  }

  /** 打断小星说话 */
  interrupt() {
    if (this.isSpeaking) {
      this._stopSpeaking();
      this._setState("listening");
    }
  }

  // ── VAD 检测循环 ──────────────────────────────────────

  _startVADLoop() {
    if (!this.isActive || !this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const check = () => {
      if (!this.isActive) return;

      this.analyser.getByteFrequencyData(dataArray);

      // 计算音量电平 (0~1)
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const volume = sum / (dataArray.length * 255);

      this.onVolumeLevel?.(volume);

      const isSpeech = volume > this._silenceThreshold;

      if (isSpeech) {
        // 有人说话
        if (!this._isSpeechDetected) {
          // 新一段话开始
          this._isSpeechDetected = true;
          this._silenceStart = 0;

          // 如果小星在说话，打断它
          if (this.isSpeaking) {
            this.interrupt();
          }

          // 开始录音
          if (!this.isListening) {
            this._startRecording();
            this.onUserSpeechStart?.();
          }
        }
        this._silenceStart = 0;
      } else {
        // 静默
        if (this._isSpeechDetected) {
          if (this._silenceStart === 0) {
            this._silenceStart = Date.now();
          } else if (Date.now() - this._silenceStart > this._silenceDuration) {
            // 静默超过阈值→用户说完了
            this._isSpeechDetected = false;
            this._silenceStart = 0;

            if (this.isListening) {
              this._stopRecording(); // 会触发 onUserSpeechEnd
            }
          }
        }
      }

      requestAnimationFrame(check);
    };

    check();
  }

  // ── 录音控制 ──────────────────────────────────────────

  _startRecording() {
    if (this.isListening || !this.stream) return;

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    this._mediaRecorder = new MediaRecorder(this.stream, { mimeType });
    this._audioChunks = [];
    this._recordingStartTime = Date.now();

    this._mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this._audioChunks.push(e.data);
    };

    this._mediaRecorder.onstop = async () => {
      const duration = Date.now() - this._recordingStartTime;
      this.isListening = false;

      // 太短的录音忽略（<500ms可能是噪音）
      if (duration < 500 || this._audioChunks.length === 0) {
        if (this.isActive) this._setState("listening");
        return;
      }

      const audioBlob = new Blob(this._audioChunks, { type: mimeType });
      this._audioChunks = [];

      this._setState("thinking");
      this.onUserSpeechEnd?.(audioBlob, duration);
    };

    this._mediaRecorder.start(500); // 每500ms收集一次
    this.isListening = true;
    this._setState("listening");
  }

  _stopRecording() {
    if (this._mediaRecorder && this.isListening) {
      try {
        this._mediaRecorder.stop();
      } catch {}
    }
    this.isListening = false;
  }

  _stopSpeaking() {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
    this.isSpeaking = false;
    this._currentUtterance = null;
  }

  _setState(state) {
    this.onStateChange?.(state);
  }
}
