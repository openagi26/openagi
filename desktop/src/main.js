/**
 * OpenAGI Desktop Companion - 主入口
 * 星灵(小灵) + 气泡对话 + 后端通信
 */

import { StarSpirit } from "./star-spirit.js";

// ── 全局状态 ──────────────────────────────────────────────

let spirit = null;
let backendOnline = false;
let isWaiting = false;

// ── 初始化 ────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  // 初始化星灵渲染
  const canvas = document.getElementById("star-spirit");
  spirit = new StarSpirit(canvas);

  // 绑定事件
  const input = document.getElementById("message-input");
  const sendBtn = document.getElementById("send-btn");

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  sendBtn.addEventListener("click", handleSend);

  // 检查后端连接
  await checkBackend();
  setInterval(checkBackend, 15000); // 每15秒检查一次

  // 获取问候语
  await showGreeting();
});

// ── 后端通信 ──────────────────────────────────────────────

async function checkBackend() {
  const statusDot = document.getElementById("backend-status");
  const statusText = document.getElementById("status-text");

  try {
    // 尝试使用 Tauri command
    if (window.__TAURI_INTERNALS__) {
      const { invoke } = window.__TAURI_INTERNALS__;
      backendOnline = await invoke("check_backend");
    } else {
      // 浏览器环境 fallback
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
      // 浏览器 fallback
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) greeting = "早上好陛下! 新的一天开始了!";
      else if (hour < 14) greeting = "陛下该休息了! 中午好好吃饭!";
      else if (hour < 18) greeting = "下午好陛下! 保持专注!";
      else if (hour < 22) greeting = "晚上好陛下! 辛苦了一天!";
      else greeting = "夜深了陛下，注意休息!";
    }
    addMessage("ai", greeting);
    spirit?.setEmotion("happy");
    setTimeout(() => spirit?.setEmotion("neutral"), 3000);
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
    addMessage("ai", "后端暂时离线，请确保 OpenAGI 运行在 localhost:8888");
    spirit?.setEmotion("sad");
    return;
  }

  // 显示思考中
  isWaiting = true;
  spirit?.setEmotion("think");
  const typingEl = showTyping();

  try {
    let reply;
    if (window.__TAURI_INTERNALS__) {
      const { invoke } = window.__TAURI_INTERNALS__;
      reply = await invoke("send_message", { message: text });
    } else {
      // 浏览器 fallback
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
    spirit?.setEmotion("happy");
    setTimeout(() => spirit?.setEmotion("neutral"), 2000);
  } catch (err) {
    removeTyping(typingEl);
    addMessage("ai", `Error: ${err.message || err}`);
    spirit?.setEmotion("sad");
    setTimeout(() => spirit?.setEmotion("neutral"), 3000);
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
