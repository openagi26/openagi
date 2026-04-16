/**
 * OpenAGI Desktop Companion - 主入口 (Phase 2)
 * 星灵(小灵) + Live2D + 情绪引擎 + 语音对话 + 气泡对话
 */

import { StarSpirit } from "./star-spirit.js";
import { EmotionEngine } from "./emotion-engine.js";
import { VoiceSystem } from "./voice.js";
import { Live2DAvatar } from "./live2d-avatar.js";

// ── 全局状态 ──────────────────────────────────────────────

let spirit = null;
let live2d = null;
let emotionEngine = null;
let voice = null;
let backendOnline = false;
let isWaiting = false;
let currentAvatar = "star-spirit"; // "star-spirit" | "live2d"
let autoSpeak = true; // AI回复是否自动朗读

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

  // 5. 绑定控制按钮
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

  // 语音识别结果 → 发送
  voice.onResult = (text, isFinal) => {
    const input = document.getElementById("message-input");
    input.value = text;
    if (isFinal) {
      handleSend();
    }
  };

  // 麦克风状态视觉反馈
  voice.onListenStart = () => {
    micBtn.classList.add("listening");
    emotionEngine?.setEmotion("curious");
  };

  voice.onListenEnd = () => {
    micBtn.classList.remove("listening");
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
