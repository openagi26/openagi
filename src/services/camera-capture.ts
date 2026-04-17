/**
 * CameraCapture（摄像头截图）服务
 * W16 视频聊天预备模块，W15 提前写好
 * 功能：打开摄像头 → 画到 canvas（画布）→ 返回 base64（图像编码）
 */

let videoStream: MediaStream | null = null;

/**
 * 截取摄像头当前帧，返回 base64 编码的 PNG 图像
 * @returns Promise<string> base64 格式的图像数据
 */
export async function captureSnapshot(): Promise<string> {
  // 请求摄像头权限
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });

  videoStream = stream;

  // 创建隐藏的 video（视频）元素
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => {
      video.play().then(resolve).catch(reject);
    };
    video.onerror = () => reject(new Error('摄像头视频加载失败'));
  });

  // 等待第一帧渲染
  await new Promise<void>((resolve) => setTimeout(resolve, 300));

  // 画到 canvas（画布）并导出 base64
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    stopCamera();
    throw new Error('无法创建 Canvas（画布）2D 上下文');
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const base64 = canvas.toDataURL('image/png');

  // 截完立即停止视频流
  stopCamera();

  return base64;
}

/**
 * 关闭摄像头，释放设备占用
 */
export function stopCamera(): void {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }
}

/**
 * 检测设备是否支持摄像头
 */
export async function isCameraSupported(): Promise<boolean> {
  if (!navigator.mediaDevices?.enumerateDevices) return false;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some(d => d.kind === 'videoinput');
  } catch {
    return false;
  }
}
