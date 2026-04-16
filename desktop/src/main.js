/**
 * OpenAGI Desktop Companion - 主入口 (Phase 2)
 * 星灵(小星) + Live2D + 情绪引擎 + 语音对话 + 主动感知
 */

import { StarSpirit } from "./star-spirit.js";
import { EmotionEngine } from "./emotion-engine.js";
import { VoiceSystem } from "./voice.js";
import { Live2DAvatar } from "./live2d-avatar.js";
import { FocusGuard, FOCUS_PRESETS } from "./focus-guard.js";
import { ProactiveEngine } from "./proactive-engine.js";
import { ScreenObserver } from "./screen-observer.js";
import { CameraVision } from "./camera-vision.js";
import { ContinuousVoice } from "./continuous-voice.js";
import { VisionRhythm } from "./vision-rhythm.js";

// ── 全局状态 ──────────────────────────────────────────────

let spirit = null;
let live2d = null;
let emotionEngine = null;
let voice = null;
let backendOnline = false;
let isWaiting = false;
let currentAvatar = "star-spirit"; // "star-spirit" | "live2d"
let autoSpeak = true; // AI回复是否自动朗读
let focusGuard = null; // 专注模式看护
let proactive = null;  // 主动感知引擎
let screenObserver = null; // 屏幕截图感知
let camera = null;         // 摄像头视觉
let convoMode = null;      // 连续对话模式
let visionRhythm = null;   // 视觉节奏系统

// ── 初始化 ────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  // 1. 初始化星灵渲染（默认形象）
  const canvas = document.getElementById("star-spirit");
  spirit = new StarSpirit(canvas);

  // 2. 初始化情绪引擎
  emotionEngine = new EmotionEngine();
  emotionEngine.onEmotionChange((emotion, live2dParams) => {
    // 同步情绪到当前形象
    if (currentAvatar === "star-spirit" && spirit) {
      spirit.setEmotion(emotion);
    } else if (currentAvatar === "live2d" && live2d?.loaded) {
      live2d.setExpression(emotion, live2dParams);
    }
    // 更新情绪标签
    const label = document.getElementById("emotion-label");
    if (label) label.textContent = emotion;
  });
  emotionEngine.startPolling();

  // 3. 初始化语音系统
  voice = new VoiceSystem();
  setupVoice();

  // 4. 绑定输入事件
  const input = document.getElementById("message-input");
  const sendBtn = document.getElementById("send-btn");

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  sendBtn.addEventListener("click", handleSend);

  // 5. 初始化专注模式
  focusGuard = new FocusGuard();
  setupFocusGuard();

  // 6. 初始化主动感知引擎
  proactive = new ProactiveEngine();
  setupProactive();
  proactive.start();

  // 7. 初始化屏幕截图感知（小星的眼睛）
  screenObserver = new ScreenObserver();
  screenObserver.onObservation = (message, emotion) => {
    addMessage("ai", message);
    emotionEngine?.setEmotion(emotion);
    if (autoSpeak && voice?.ttsAvailable) {
      voice.speak(message);
    }
    setTimeout(() => emotionEngine?.setEmotion("neutral"), 3000);
  };
  // 默认关闭，用户可在设置中开启（隐私考虑）
  // screenObserver.start(60000);

  // 8. 绑定控制按钮
  setupControls();

  // 6. 检查后端连接
  await checkBackend();
  setInterval(checkBackend, 15000);

  // 7. 获取问候语
  await showGreeting();
});

// ── 语音系统 ──────────────────────────────────────────────

function setupVoice() {
  const micBtn = document.getElementById("mic-btn");
  if (!micBtn) return;

  // 语音识别结果 → 填入输入框或发送
  voice.onResult = (text, isFinal) => {
    const input = document.getElementById("message-input");
    if (isFinal && text.trim()) {
      input.value = text.trim();
      handleSend();
    } else if (!isFinal) {
      input.value = text; // 中间状态显示
    }
  };

  // 录音进度
  voice.onRecordingProgress = (seconds) => {
    micBtn.textContent = `${seconds}s`;
  };

  // 麦克风状态视觉反馈
  voice.onListenStart = () => {
    micBtn.classList.add("listening");
    emotionEngine?.setEmotion("curious");
  };

  voice.onListenEnd = () => {
    micBtn.classList.remove("listening");
    micBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
  };

  // TTS 说话时情绪
  voice.onSpeakStart = () => {
    emotionEngine?.setEmotion("happy");
    // Live2D 唇同步（简单版：说话时张嘴）
    if (live2d?.loaded) {
      live2d.setMouthOpen(0.5);
    }
  };

  voice.onSpeakEnd = () => {
    emotionEngine?.setEmotion("neutral");
    if (live2d?.loaded) {
      live2d.setMouthOpen(0);
    }
  };

  // 麦克风按钮点击
  micBtn.addEventListener("click", () => {
    if (!voice.sttAvailable) {
      addMessage("system", "语音识别不可用（需要麦克风权限）");
      return;
    }
    voice.toggleListening();
  });
}

// ── 控制按钮 ──────────────────────────────────────────────

function setupControls() {
  // 语音开关
  const speakerBtn = document.getElementById("speaker-btn");
  if (speakerBtn) {
    speakerBtn.addEventListener("click", () => {
      autoSpeak = !autoSpeak;
      speakerBtn.classList.toggle("active", autoSpeak);
      if (!autoSpeak && voice?.isSpeaking) {
        voice.stopSpeaking();
      }
    });
    speakerBtn.classList.toggle("active", autoSpeak);
  }

  // 连续对话按钮
  const convoBtn = document.getElementById("convo-btn");
  if (convoBtn) {
    convoBtn.addEventListener("click", async () => {
      if (convoMode?.isActive) {
        // 关闭连续对话
        convoMode.stop();
        convoBtn.classList.remove("active");
        convoBtn.textContent = "🎙️";
        addMessage("system", "连续对话已关闭");
      } else {
        // 开启连续对话
        if (!convoMode) {
          convoMode = new ContinuousVoice();
          setupContinuousVoice();
        }
        const ok = await convoMode.start();
        if (ok) {
          convoBtn.classList.add("active");
          addMessage("system", "🎙️ 连续对话已开启！直接说话，小星在听...");
        } else {
          addMessage("system", "麦克风访问失败");
        }
      }
    });
  }

  // 摄像头按钮
  const cameraBtn = document.getElementById("camera-btn");
  if (cameraBtn) {
    cameraBtn.addEventListener("click", async () => {
      if (!camera) {
        camera = new CameraVision();
        camera.onVisionResult = (answer, emotion) => {
          addMessage("ai", answer);
          emotionEngine?.setEmotion(emotion);
          if (autoSpeak && voice?.ttsAvailable) voice.speak(answer);
        };
      }

      if (camera.isActive) {
        camera.togglePreview(document.getElementById("app"));
      } else {
        const ok = await camera.init();
        if (ok) {
          addMessage("system", "📷 摄像头已开启！小星现在能看到外面的世界了");
          camera.togglePreview(document.getElementById("app"));
          cameraBtn.classList.add("active");
          // 启动视觉节奏（AI自主控制拍照频率）
          visionRhythm = new VisionRhythm(camera);
          visionRhythm.start();
        } else {
          addMessage("system", "摄像头访问失败，请检查权限");
        }
      }
    });
  }

  // 形象切换按钮
  const avatarBtn = document.getElementById("avatar-btn");
  if (avatarBtn) {
    avatarBtn.addEventListener("click", toggleAvatar);
  }
}

/** 切换星灵 / Live2D 形象 */
function toggleAvatar() {
  const canvas = document.getElementById("star-spirit");
  const avatarBtn = document.getElementById("avatar-btn");

  if (currentAvatar === "star-spirit") {
    // 尝试切换到 Live2D
    if (!live2d) {
      live2d = new Live2DAvatar(canvas);
    }
    // 检查是否有模型文件
    const modelPath = localStorage.getItem("live2d-model-path");
    if (modelPath) {
      live2d.load(modelPath).then((ok) => {
        if (ok) {
          currentAvatar = "live2d";
          spirit?.destroy?.();
          avatarBtn.textContent = "✦";
          avatarBtn.title = "切换到星灵";
        }
      });
    } else {
      addMessage("system", "Live2D 模型未配置。请在设置中指定 .model3.json 路径");
    }
  } else {
    // 切换回星灵
    if (live2d) {
      live2d.destroy();
      live2d = null;
    }
    spirit = new StarSpirit(canvas);
    currentAvatar = "star-spirit";
    avatarBtn.textContent = "🎭";
    avatarBtn.title = "切换到 Live2D";
    // 恢复当前情绪
    spirit.setEmotion(emotionEngine?.currentEmotion || "neutral");
  }
}

// ── 连续对话模式 ──────────────────────────────────────────

function setupContinuousVoice() {
  const convoBtn = document.getElementById("convo-btn");

  // 用户开始说话
  convoMode.onUserSpeechStart = () => {
    emotionEngine?.setEmotion("curious");
  };

  // 用户说完→发送录音→转写→AI回复→小星说
  convoMode.onUserSpeechEnd = async (audioBlob, duration) => {
    // 1. 转写语音
    const text = await transcribeBlob(audioBlob);
    if (!text || !text.trim()) {
      if (convoMode.isActive) convoMode._setState("listening");
      return;
    }

    // 2. 显示用户消息
    addMessage("user", text.trim());

    // 3. 获取AI回复（自动附带最新视觉帧）
    emotionEngine?.setEmotion("think");
    // 通知视觉节奏：有新消息
    visionRhythm?.onNewMessage(text.trim(), true);
    let reply;
    try {
      if (camera?.isActive && visionRhythm) {
        // 用视觉节奏系统的最新帧（不用每次都重新拍照）
        reply = await camera.ask(text.trim());
      }
      if (!reply || reply.includes("暂不可用")) {
        // 普通文字对话
        if (window.__TAURI_INTERNALS__) {
          const { invoke } = window.__TAURI_INTERNALS__;
          reply = await invoke("send_message", { message: text.trim() });
        } else {
          const resp = await fetch("http://localhost:8888/api/v1/chat/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text.trim(), core_count: 1 }),
          });
          const json = await resp.json();
          reply = json?.data?.reply || json?.data?.response || "...";
        }
      }
    } catch (err) {
      reply = "抱歉陛下，我没有听清";
    }

    // 4. 显示AI回复
    addMessage("ai", reply);
    emotionEngine?.setEmotion("happy");

    // 5. 小星说出回复（连续对话模式用convoMode.speak，支持打断）
    if (convoMode.isActive) {
      convoMode.speak(reply);
    }

    setTimeout(() => emotionEngine?.setEmotion("neutral"), 2000);
  };

  // 状态变化→更新按钮显示
  convoMode.onStateChange = (state) => {
    if (!convoBtn) return;
    const labels = {
      listening: "👂",
      thinking: "🤔",
      speaking: "🗣️",
      idle: "🎙️",
    };
    convoBtn.textContent = labels[state] || "🎙️";
  };

  // 音量电平→星灵粒子大小脉动
  convoMode.onVolumeLevel = (volume) => {
    // 可以用来驱动粒子大小变化（未来增强）
  };
}

/** 录音blob转文字（复用STT后端） */
async function transcribeBlob(audioBlob) {
  try {
    const buffer = await audioBlob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    if (window.__TAURI_INTERNALS__) {
      const { invoke } = window.__TAURI_INTERNALS__;
      return await invoke("transcribe_audio", {
        audioBase64: base64,
        format: audioBlob.type.includes("mp4") ? "mp4" : "webm",
      });
    } else {
      const resp = await fetch("http://localhost:8888/api/v1/stt/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_base64: base64, format: "webm" }),
      });
      const json = await resp.json();
      return json?.data?.text || "";
    }
  } catch {
    return "";
  }
}

// ── 主动感知 ──────────────────────────────────────────────

function setupProactive() {
  // 场景识别 → 主动消息
  proactive.onProactiveMessage = (message, emotion, sceneType) => {
    addMessage("ai", message);
    emotionEngine?.setEmotion(emotion);
    if (autoSpeak && voice?.ttsAvailable) {
      voice.speak(message);
    }
    setTimeout(() => emotionEngine?.setEmotion("neutral"), 3000);
  };

  // 健康提醒
  proactive.onWellnessReminder = (type, message) => {
    addMessage("ai", message);
    emotionEngine?.setEmotion("curious");
    if (autoSpeak && voice?.ttsAvailable) {
      voice.speak(message);
    }
    setTimeout(() => emotionEngine?.setEmotion("neutral"), 3000);
  };
}

// ── 专注模式 ──────────────────────────────────────────────

function setupFocusGuard() {
  const focusBtn = document.getElementById("focus-btn");
  if (!focusBtn) return;

  focusGuard.onStart = ({ minutes }) => {
    emotionEngine?.setEmotion("focus");
    addMessage("system", `🎯 专注模式开启！${minutes}分钟后提醒你`);
    focusBtn.classList.add("active");
    focusBtn.title = "点击结束专注";
  };

  focusGuard.onTick = ({ remaining }) => {
    const focusBtn = document.getElementById("focus-btn");
    if (focusBtn) focusBtn.textContent = remaining;
  };

  focusGuard.onMilestone = (pct) => {
    const msgs = {
      25: "已完成25%，继续加油陛下！💪",
      50: "一半了！陛下坚持得很好！🔥",
      75: "还剩最后25%，冲刺！⚡",
    };
    if (msgs[pct]) addMessage("system", msgs[pct]);
  };

  focusGuard.onIdleWarning = (seconds) => {
    const min = Math.round(seconds / 60);
    addMessage("ai", `陛下，已经${min}分钟没有操作了，还在专注吗？😊`);
    if (autoSpeak && voice?.ttsAvailable) {
      voice.speak(`陛下，已经${min}分钟没有操作了`);
    }
  };

  focusGuard.onEnd = ({ completed, actualMinutes, todaySessions, streak }) => {
    focusBtn.classList.remove("active");
    focusBtn.textContent = "🎯";
    focusBtn.title = "开启专注模式";

    if (completed) {
      emotionEngine?.setEmotion("happy");
      const msg = `🎉 太棒了！专注${actualMinutes}分钟完成！今日第${todaySessions}次，${streak > 1 ? `连续${streak}次！` : "继续保持！"}`;
      addMessage("ai", msg);
      if (autoSpeak && voice?.ttsAvailable) {
        voice.speak(`太棒了陛下！专注${actualMinutes}分钟完成！`);
      }
    } else {
      emotionEngine?.setEmotion("neutral");
      addMessage("system", `专注已中断，完成了${actualMinutes}分钟`);
    }
  };

  // 点击按钮开始/结束
  focusBtn.addEventListener("click", () => {
    if (focusGuard.isActive) {
      focusGuard.stop(false);
    } else {
      focusGuard.start(25); // 默认番茄钟25分钟
    }
  });

  // 记录用户活动
  document.addEventListener("mousemove", () => focusGuard.recordActivity());
  document.addEventListener("keydown", () => focusGuard.recordActivity());
}

// ── 后端通信 ──────────────────────────────────────────────

async function checkBackend() {
  const statusDot = document.getElementById("backend-status");
  const statusText = document.getElementById("status-text");

  try {
    if (window.__TAURI_INTERNALS__) {
      const { invoke } = window.__TAURI_INTERNALS__;
      backendOnline = await invoke("check_backend");
    } else {
      const resp = await fetch("http://localhost:8888/health", {
        signal: AbortSignal.timeout(3000),
      });
      backendOnline = resp.ok;
    }
  } catch {
    backendOnline = false;
  }

  if (backendOnline) {
    statusDot.className = "status-dot online";
    statusText.textContent = "connected to OpenAGI";
  } else {
    statusDot.className = "status-dot offline";
    statusText.textContent = "backend offline";
  }
}

async function showGreeting() {
  try {
    let greeting;
    if (window.__TAURI_INTERNALS__) {
      const { invoke } = window.__TAURI_INTERNALS__;
      greeting = await invoke("get_greeting");
    } else {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) greeting = "早上好陛下! 新的一天开始了，今天要完成什么目标呢？";
      else if (hour < 14) greeting = "陛下该休息了! 中午好好吃饭，下午继续加油!";
      else if (hour < 18) greeting = "下午好陛下! 保持专注，你做得很棒!";
      else if (hour < 22) greeting = "晚上好陛下! 辛苦了一天，要注意休息哦!";
      else greeting = "夜深了陛下，要注意身体! 早点休息吧!";
    }
    addMessage("ai", greeting);
    emotionEngine?.setEmotion("happy");
    if (autoSpeak && voice?.ttsAvailable) {
      voice.speak(greeting);
    }
    setTimeout(() => emotionEngine?.setEmotion("neutral"), 3000);
  } catch (err) {
    addMessage("system", "Companion started");
  }
}

// ── 消息处理 ──────────────────────────────────────────────

async function handleSend() {
  const input = document.getElementById("message-input");
  const text = input.value.trim();
  if (!text || isWaiting) return;

  input.value = "";
  addMessage("user", text);

  // 通知视觉节奏系统
  visionRhythm?.onNewMessage(text, true);

  // 摄像头开启时：每次对话都"睁着眼睛"——自动拍照+消息一起发给AI
  // AI自己判断是否需要用视觉信息回答，不需要关键词触发
  if (camera?.isActive) {
    emotionEngine?.setEmotion("curious");
    isWaiting = true;
    const typingEl = showTyping();
    try {
      const answer = await camera.ask(text);
      removeTyping(typingEl);
      if (answer && !answer.includes("暂不可用")) {
        addMessage("ai", answer);
        emotionEngine?.setEmotion("happy");
        if (autoSpeak && voice?.ttsAvailable) voice.speak(answer);
        setTimeout(() => emotionEngine?.setEmotion("neutral"), 3000);
        isWaiting = false;
        return; // 视觉回答成功，不再走普通文字路径
      }
    } catch {
      removeTyping(typingEl);
    }
    isWaiting = false;
    // 视觉API失败时才降级到下面的普通文字对话
  }

  if (!backendOnline) {
    const msg = "后端暂时离线，请确保 OpenAGI 运行在 localhost:8888";
    addMessage("ai", msg);
    emotionEngine?.setEmotion("sad");
    return;
  }

  // 显示思考中
  isWaiting = true;
  emotionEngine?.setEmotion("think");
  const typingEl = showTyping();

  try {
    let reply;
    if (window.__TAURI_INTERNALS__) {
      const { invoke } = window.__TAURI_INTERNALS__;
      reply = await invoke("send_message", { message: text });
    } else {
      const resp = await fetch("http://localhost:8888/api/v1/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, core_count: 1 }),
      });
      const json = await resp.json();
      reply = json?.data?.reply || json?.data?.response || JSON.stringify(json);
    }

    removeTyping(typingEl);
    addMessage("ai", reply);
    emotionEngine?.setEmotion("happy");

    // 自动朗读AI回复
    if (autoSpeak && voice?.ttsAvailable) {
      voice.speak(reply);
    }

    setTimeout(() => emotionEngine?.setEmotion("neutral"), 2000);
  } catch (err) {
    removeTyping(typingEl);
    addMessage("ai", `Error: ${err.message || err}`);
    emotionEngine?.setEmotion("sad");
    setTimeout(() => emotionEngine?.setEmotion("neutral"), 3000);
  } finally {
    isWaiting = false;
  }
}

// ── DOM 工具函数 ──────────────────────────────────────────

function addMessage(type, text) {
  const container = document.getElementById("messages");
  const msg = document.createElement("div");
  msg.className = `message ${type}`;
  msg.textContent = text;
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

function showTyping() {
  const container = document.getElementById("messages");
  const msg = document.createElement("div");
  msg.className = "message typing";
  msg.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
  return msg;
}

function removeTyping(el) {
  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
  }
}
