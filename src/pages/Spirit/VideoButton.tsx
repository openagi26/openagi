/**
 * VideoButton（视频按钮）组件
 * 小星的摄像头按钮：点击打开预览 → 拍一张 → 传给 LLM（大语言模型）→ TTS 播放描述
 * W16 视频聊天 MVP（按需拍照版）
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { speak, cancelSpeech } from '../../services/text-to-speech';

type VideoMood = 'idle' | 'previewing' | 'thinking' | 'replying';

interface VideoButtonProps {
  onMoodChange?: (mood: VideoMood) => void;
}

export function VideoButton({ onMoodChange }: VideoButtonProps) {
  const [state, setState] = useState<VideoMood>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const setMood = useCallback((mood: VideoMood) => {
    setState(mood);
    onMoodChange?.(mood);
  }, [onMoodChange]);

  // 打开摄像头流到 video 元素
  const openCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {/* 忽略自动播放限制 */});
      }
      setMood('previewing');
      setErrorMsg(null);
    } catch (e) {
      setErrorMsg('摄像头打开失败，请检查权限设置');
      setMood('idle');
    }
  }, [setMood]);

  // 关闭摄像头，释放设备占用
  const closeCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setMood('idle');
    setErrorMsg(null);
  }, [setMood]);

  // 组件卸载时释放摄像头
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // 拍一张 → 传给主进程 → TTS 播放回复
  const handleCapture = useCallback(async () => {
    if (!videoRef.current || !streamRef.current) return;

    // 画到 canvas（画布）获取 base64
    const canvas = document.createElement('canvas');
    const video = videoRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setErrorMsg('截图失败，Canvas（画布）不可用');
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);

    // 关闭摄像头（macOS 菜单栏绿灯熄灭）
    closeCamera();
    cancelSpeech();
    setMood('thinking');
    setErrorMsg(null);

    try {
      // 通过 IPC（进程间通信）发给主进程
      const reply = await window.electron?.ipcRenderer?.invoke?.(
        'spirit:photo-input',
        imageBase64
      ) as string | undefined;

      const replyText = reply || '我看到了你，但还在回味刚才的画面，稍后再试试吧～';
      setMood('replying');
      await speak(replyText, { lang: 'zh-CN', rate: 1.0 });
    } catch (e) {
      const fallback = '我拍到了你，但大脑暂时短路了，稍后再试试吧～';
      setMood('replying');
      try {
        await speak(fallback, { lang: 'zh-CN' });
      } catch {
        // TTS 也失败了，静默降级
      }
    } finally {
      setMood('idle');
    }
  }, [closeCamera, setMood]);

  const isPreviewing = state === 'previewing';
  const isThinking = state === 'thinking';
  const isReplying = state === 'replying';
  const isActive = isPreviewing || isThinking || isReplying;

  return (
    <div
      className="video-button-wrapper"
      style={{ position: 'relative', display: 'inline-block' }}
    >
      {/* 摄像头图标按钮 */}
      <button
        className={`video-button ${state}`}
        onClick={isPreviewing ? undefined : openCamera}
        title={isPreviewing ? '预览中' : '点击拍一张照片'}
        aria-label="视频拍照"
        style={{
          background: isPreviewing ? '#7c3aed' : isActive ? '#a78bfa' : 'rgba(255,255,255,0.15)',
          border: `2px solid ${isActive ? '#a78bfa' : 'rgba(255,255,255,0.3)'}`,
          borderRadius: '50%',
          width: 36,
          height: 36,
          cursor: isPreviewing ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          outline: 'none',
          transition: 'all 0.15s ease',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        {/* 思考中：旋转小圈 */}
        {isThinking && (
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            style={{ animation: 'video-spin 0.8s linear infinite' }}
          >
            <circle
              cx="12" cy="12" r="10"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeDasharray="31 31"
              strokeLinecap="round"
            />
          </svg>
        )}

        {/* 默认/预览/回复：摄像头图标 */}
        {!isThinking && (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            {/* 摄像头机身 */}
            <rect x="2" y="7" width="15" height="11" rx="2"
              fill={isActive ? 'white' : 'rgba(255,255,255,0.85)'}
            />
            {/* 镜头 */}
            <circle cx="9.5" cy="12.5" r="3"
              fill={isActive ? '#7c3aed' : 'rgba(124,58,237,0.7)'}
            />
            {/* 取景器三角 */}
            <path d="M17 9.5L22 7v10l-5-2.5V9.5z"
              fill={isActive ? 'white' : 'rgba(255,255,255,0.85)'}
            />
          </svg>
        )}
      </button>

      {/* 预览面板（100×130px，位于按钮上方） */}
      {isPreviewing && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            bottom: 44,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 140,
            background: 'rgba(17,17,27,0.95)',
            borderRadius: 10,
            border: '1px solid rgba(167,139,250,0.4)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            overflow: 'hidden',
            zIndex: 100,
          }}
        >
          {/* 实时预览（video 元素） */}
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: '100%',
              height: 100,
              objectFit: 'cover',
              display: 'block',
              background: '#000',
            }}
          />

          {/* 按钮区 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '6px 8px',
            gap: 6,
          }}>
            {/* 拍一张 */}
            <button
              onClick={handleCapture}
              title="拍一张"
              style={{
                flex: 1,
                background: '#7c3aed',
                border: 'none',
                borderRadius: 6,
                color: 'white',
                fontSize: 11,
                padding: '4px 0',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              📷 拍一张
            </button>

            {/* 关闭 */}
            <button
              onClick={closeCamera}
              title="关闭摄像头"
              style={{
                width: 28,
                background: 'rgba(255,255,255,0.12)',
                border: 'none',
                borderRadius: 6,
                color: 'rgba(255,255,255,0.7)',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {errorMsg && (
        <div
          style={{
            position: 'absolute',
            bottom: 44,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(239,68,68,0.9)',
            color: 'white',
            fontSize: 10,
            borderRadius: 6,
            padding: '4px 8px',
            whiteSpace: 'nowrap',
            maxWidth: 160,
            textAlign: 'center',
            zIndex: 101,
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* CSS 动画注入 */}
      <style>{`
        @keyframes video-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
