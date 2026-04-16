/**
 * 小星的真正眼睛 — 摄像头视觉系统
 *
 * 通过M4电脑的摄像头看外面的世界（不是截屏！）
 * 参考 RobotDuck 的视觉问答功能
 *
 * 功能：
 * 1. 摄像头实时预览（可选显示）
 * 2. 拍照 → 发送到多模态LLM → 视觉问答
 * 3. 定时拍照分析（了解主人的环境）
 * 4. 手势检测预留接口（MediaPipe）
 */

export class CameraVision {
  constructor() {
    this.stream = null;
    this.videoElement = null;
    this.canvasElement = null;
    this.isActive = false;
    this._previewVisible = false;

    // 回调
    this.onVisionResult = null;  // (answer, emotion) => void
  }

  /** 初始化摄像头 */
  async init() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        }
      });

      // 创建隐藏的video元素用于捕获帧
      this.videoElement = document.createElement("video");
      this.videoElement.srcObject = this.stream;
      this.videoElement.playsInline = true;
      this.videoElement.muted = true;
      await this.videoElement.play();

      // 创建canvas用于截帧
      this.canvasElement = document.createElement("canvas");
      this.canvasElement.width = 640;
      this.canvasElement.height = 480;

      this.isActive = true;
      return true;
    } catch (err) {
      console.warn("摄像头访问失败:", err);
      return false;
    }
  }

  /** 拍一张照片，返回base64 */
  capture() {
    if (!this.isActive || !this.videoElement) return null;

    const ctx = this.canvasElement.getContext("2d");
    ctx.drawImage(this.videoElement, 0, 0, 640, 480);
    return this.canvasElement.toDataURL("image/jpeg", 0.7).split(",")[1];
  }

  /** 拍照并提问（视觉问答） */
  async ask(question) {
    const imageBase64 = this.capture();
    if (!imageBase64) {
      return "摄像头未开启，请先点击摄像头按钮";
    }

    try {
      let answer;
      if (window.__TAURI_INTERNALS__) {
        const { invoke } = window.__TAURI_INTERNALS__;
        answer = await invoke("vision_ask", {
          imageBase64,
          question: question || "描述你看到了什么",
        });
      } else {
        const resp = await fetch("http://localhost:8888/api/v1/vision/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_base64: imageBase64,
            question: question || "描述你看到了什么",
          }),
        });
        const json = await resp.json();
        answer = json?.data?.answer || "抱歉，视觉分析暂时不可用";
      }

      // 不在这里触发回调，由调用者负责显示（防止重复）
      return answer;
    } catch (err) {
      return `视觉分析失败: ${err.message || err}`;
    }
  }

  /** 显示/隐藏摄像头预览 */
  togglePreview(container) {
    if (this._previewVisible) {
      // 隐藏
      const preview = document.getElementById("camera-preview");
      if (preview) preview.remove();
      this._previewVisible = false;
    } else if (this.videoElement && container) {
      // 显示小预览窗
      const preview = document.createElement("div");
      preview.id = "camera-preview";
      preview.style.cssText = `
        position: absolute; top: 40px; right: 8px;
        width: 120px; height: 90px; border-radius: 12px;
        overflow: hidden; border: 1px solid rgba(124,92,252,0.3);
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 100;
      `;
      const video = this.videoElement.cloneNode();
      video.srcObject = this.stream;
      video.style.cssText = "width:100%;height:100%;object-fit:cover;transform:scaleX(-1);";
      video.playsInline = true;
      video.muted = true;
      video.play();
      preview.appendChild(video);
      container.appendChild(preview);
      this._previewVisible = true;
    }
  }

  /** 关闭摄像头 */
  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.isActive = false;
    const preview = document.getElementById("camera-preview");
    if (preview) preview.remove();
  }
}
