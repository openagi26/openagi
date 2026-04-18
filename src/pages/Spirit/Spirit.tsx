/**
 * 小星（Spirit）桌面伴侣组件
 * MVP：点击展开聊天框、持续对话、鼻子嘴巴、跳跃/奔跑/翻跟头动画
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import './spirit.css';
import { VoiceButton } from './VoiceButton';
import { VideoButton } from './VideoButton';

type SpiritMood =
  | 'idle' | 'listening' | 'thinking' | 'replying'
  | 'recording' | 'previewing'
  | 'running' | 'jumping' | 'flipping';

const MOOD_BUBBLES: Record<SpiritMood, string> = {
  idle: '随时叫我哦～',
  listening: '我在听…',
  thinking: '想一想…',
  replying: '来了来了！',
  recording: '说吧说吧～',
  previewing: '让我看看～',
  running: '冲冲冲！',
  jumping: '跳起来！',
  flipping: '翻个跟头～',
};

type SpiritMode = 'companion' | 'assistant';
type ChatMessage = { role: 'user' | 'ai'; text: string };

function loadMode(): SpiritMode {
  try {
    const stored = localStorage.getItem('spirit-mode');
    if (stored === 'assistant') return 'assistant';
  } catch { /* 忽略 */ }
  return 'companion';
}

function initFatigueLevel(): number {
  const h = new Date().getHours();
  if (h === 22) return 1;
  if (h === 23 || h === 0) return 2;
  if (h >= 1 && h < 6) return 3;
  return 0;
}

export function Spirit() {
  const [mood, setMood] = useState<SpiritMood>('idle');
  const [emotionMood, setEmotionMood] = useState<string>('idle');
  const [fatigue, setFatigue] = useState<number>(initFatigueLevel);
  const [hasRecentHappyEvent, setHasRecentHappyEvent] = useState(false);
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [spiritMode, setSpiritMode] = useState<SpiritMode>(loadMode);
  const [hideMenuOpen, setHideMenuOpen] = useState(false);

  // 聊天框状态
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // 摄像头预览状态
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  // 组件挂载时获取情绪状态
  useEffect(() => {
    window.electron?.ipcRenderer?.invoke?.('spirit:mood-get')
      .then((result: unknown) => {
        const r = result as { current?: string } | null;
        if (r?.current) setEmotionMood(r.current);
      })
      .catch(() => {});
    window.electron?.ipcRenderer?.invoke?.('spirit:last-positive-mood-event')
      .then((event: unknown) => {
        const e = event as { mood?: string; set_at?: string } | null;
        if (e?.mood === 'happy' && e?.set_at) {
          const elapsed = (Date.now() - new Date(e.set_at).getTime()) / (1000 * 60 * 60);
          if (elapsed < 36) setHasRecentHappyEvent(true);
        }
      })
      .catch(() => {});
  }, []);

  // W10：重逢问候气泡
  const [greetingText, setGreetingText] = useState<string | null>(null);
  const [greetingVisible, setGreetingVisible] = useState(false);
  const greetingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearReplyTimer = useCallback(() => {
    if (replyTimerRef.current) {
      clearTimeout(replyTimerRef.current);
      replyTimerRef.current = null;
    }
  }, []);

  const showGreeting = useCallback((text: string) => {
    setGreetingText(text);
    setGreetingVisible(true);
    if (greetingTimerRef.current) clearTimeout(greetingTimerRef.current);
    greetingTimerRef.current = setTimeout(() => {
      setGreetingVisible(false);
      greetingTimerRef.current = setTimeout(() => setGreetingText(null), 400);
    }, 5000);
  }, []);

  useEffect(() => {
    const unsubscribeMood = window.electron?.ipcRenderer?.on?.('spirit:mood', (...args: unknown[]) => {
      const newMood = args[0] as SpiritMood;
      clearReplyTimer();
      setMood(newMood);
      if (newMood === 'replying') {
        replyTimerRef.current = setTimeout(() => setMood('idle'), 1500);
      }
    });
    const unsubscribeGreeting = window.electron?.ipcRenderer?.on?.('spirit:greeting', (...args: unknown[]) => {
      const text = args[0] as string;
      if (text) showGreeting(text);
    });
    const unsubscribeFatigue = window.electron?.ipcRenderer?.on?.('spirit:fatigue', (...args: unknown[]) => {
      const payload = args[0] as { level: number };
      if (typeof payload?.level === 'number') setFatigue(payload.level);
    });
    return () => {
      clearReplyTimer();
      if (greetingTimerRef.current) clearTimeout(greetingTimerRef.current);
      if (typeof unsubscribeMood === 'function') unsubscribeMood();
      if (typeof unsubscribeGreeting === 'function') unsubscribeGreeting();
      if (typeof unsubscribeFatigue === 'function') unsubscribeFatigue();
    };
  }, [clearReplyTimer, showGreeting]);

  // 聊天消息自动滚动到底部
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, chatLoading]);

  // cameraStream 更新时同步到 video 元素
  useEffect(() => {
    if (videoPreviewRef.current && cameraStream) {
      videoPreviewRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  // 摄像头开关
  const toggleCamera = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (cameraOn) {
      cameraStream?.getTracks().forEach(t => t.stop());
      setCameraStream(null);
      setCameraOn(false);
    } else {
      await window.electron?.ipcRenderer?.invoke?.('spirit:set-focusable', true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 160, height: 120 },
          audio: false,
        });
        setCameraStream(stream);
        setCameraOn(true);
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }
      } catch {
        await window.electron?.ipcRenderer?.invoke?.('spirit:set-focusable', false);
      }
    }
  }, [cameraOn, cameraStream]);

  // 截取当前帧为 base64（仅用于未来扩展，当前 MVP 只附加文字上下文）
  const captureVideoFrame = useCallback((): string | null => {
    if (!videoPreviewRef.current || !cameraOn) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(videoPreviewRef.current, 0, 0, 160, 120);
    return canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
  }, [cameraOn]);

  const getIdleBubble = () => {
    if (mood !== 'idle') return MOOD_BUBBLES[mood];
    if (fatigue === 1) return '（揉揉眼睛）今天有点累呢～';
    if (fatigue === 2) return '陛下，已经很晚了，该休息了 💜';
    if (fatigue >= 3) return '陛下，凌晨了，我在等你去睡觉…';
    switch (emotionMood) {
      case 'happy': return hasRecentHappyEvent ? '今天心情很好～ 😊' : '随时叫我哦～';
      case 'thoughtful': return '在想一些事情...';
      case 'sad': return '陪着你呢 💜';
      default: return '随时叫我哦～';
    }
  };

  const handleHide = useCallback((type: 'session' | 'day' | 'permanent') => {
    window.electron?.ipcRenderer?.invoke?.('spirit:hide', type);
    setHideMenuOpen(false);
  }, []);

  const handleModeToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const nextMode: SpiritMode = spiritMode === 'companion' ? 'assistant' : 'companion';
    setSpiritMode(nextMode);
    try { localStorage.setItem('spirit-mode', nextMode); } catch { /* 忽略 */ }
    window.electron?.ipcRenderer?.invoke?.('spirit:set-mode', nextMode).catch(() => {});
  }, [spiritMode]);

  // 点击小星 → 切换聊天框
  const handleClick = useCallback(() => {
    const newOpen = !chatOpen;
    setChatOpen(newOpen);
    window.electron?.ipcRenderer?.invoke?.('spirit:chat-toggle', newOpen).catch(() => {});
    if (newOpen) {
      setTimeout(() => chatInputRef.current?.focus(), 350);
    }
  }, [chatOpen]);

  // 发送聊天消息
  const handleChatSend = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text }]);
    setChatLoading(true);
    clearReplyTimer();
    setMood('thinking');
    try {
      // 摄像头开启时，在文字前附加上下文提示（captureVideoFrame 预留供未来多模态扩展）
      void captureVideoFrame();
      const textToSend = cameraOn ? `[用户当前开着摄像头] ${text}` : text;
      const reply = await window.electron?.ipcRenderer?.invoke?.('spirit:chat-input', textToSend, spiritMode);
      clearReplyTimer();
      setMood('replying');
      setChatMessages(prev => [...prev, { role: 'ai', text: (reply as string) || '我在想…给我一点时间～' }]);
      replyTimerRef.current = setTimeout(() => setMood('idle'), 2000);
    } catch {
      setChatMessages(prev => [...prev, { role: 'ai', text: '大脑暂时短路了，稍后再试试吧～' }]);
      setMood('idle');
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, spiritMode, cameraOn, captureVideoFrame, clearReplyTimer]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  }, [handleChatSend]);

  // 放大全屏
  const handleExpandFullscreen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    window.electron?.ipcRenderer?.invoke?.('spirit:focus-main').catch(() => {});
  }, []);

  // 关闭聊天框
  const handleCloseChat = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // 关闭聊天框时同步关闭摄像头
    cameraStream?.getTracks().forEach(t => t.stop());
    setCameraStream(null);
    setCameraOn(false);
    setChatOpen(false);
    window.electron?.ipcRenderer?.invoke?.('spirit:chat-toggle', false).catch(() => {});
  }, [cameraStream]);

  return (
    <div
      className={`spirit-container ${mood}${chatOpen ? ' chat-open' : ''}`}
      onClick={handleClick}
      title={chatOpen ? '' : '小星 · 点击开始聊天'}
    >
      {/* 角色区域（固定高度，始终显示） */}
      <div className="spirit-character-area">
        {/* × 隐藏按钮 */}
        <button
          className="spirit-hide-btn"
          onClick={(e) => { e.stopPropagation(); setHideMenuOpen(true); }}
        >×</button>

        {hideMenuOpen && (
          <div className="spirit-hide-menu">
            <button onClick={() => handleHide('session')}>本次隐藏</button>
            <button onClick={() => handleHide('day')}>隐藏一天</button>
            <button onClick={() => handleHide('permanent')}>永久隐藏</button>
          </div>
        )}

        {greetingText && (
          <div className={`spirit-greeting-bubble ${greetingVisible ? 'visible' : ''}`}>
            {greetingText}
          </div>
        )}

        <div className="spirit-bubble">{getIdleBubble()}</div>

        <div className="spirit-body">
          {mood === 'thinking' && (
            <div className="thinking-dots">
              <div className="thinking-dot" />
              <div className="thinking-dot" />
              <div className="thinking-dot" />
            </div>
          )}

          <svg
            className="spirit-svg"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 100 100"
          >
            <defs>
              <radialGradient id="starGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.3"/>
                <stop offset="100%" stopColor="#7c3aed" stopOpacity="0"/>
              </radialGradient>
              <clipPath id="leftEyeClip">
                <rect id="leftEyeLid" x="33" y="38" width="14" height="14" rx="7"/>
              </clipPath>
              <clipPath id="rightEyeClip">
                <rect id="rightEyeLid" x="53" y="38" width="14" height="14" rx="7"/>
              </clipPath>
            </defs>

            {/* 光晕 */}
            <circle cx="50" cy="50" r="48" fill="url(#starGlow)"/>

            {/* 紫色五角星主体 */}
            <path
              d="M50,8 L61,36 L92,36 L68,54 L77,82 L50,65 L23,82 L32,54 L8,36 L39,36 Z"
              fill="#7c3aed"
              stroke="#a78bfa"
              strokeWidth="1.5"
            />

            {/* 内层高光 */}
            <path
              d="M50,15 L58,36 L80,36 L64,48 L71,70 L50,58 L29,70 L36,48 L20,36 L42,36 Z"
              fill="#8b5cf6"
              opacity="0.5"
            />

            {/* 左眼 */}
            <g clipPath="url(#leftEyeClip)">
              <circle cx="40" cy="45" r="7" fill="white"/>
              <circle cx="40" cy="45" r="3.5" fill="#1f2937"/>
              <circle cx="41.5" cy="43.5" r="1" fill="white" opacity="0.7"/>
            </g>

            {/* 右眼 */}
            <g clipPath="url(#rightEyeClip)">
              <circle cx="60" cy="45" r="7" fill="white"/>
              <circle cx="60" cy="45" r="3.5" fill="#1f2937"/>
              <circle cx="61.5" cy="43.5" r="1" fill="white" opacity="0.7"/>
            </g>

            {/* 回复态眼睛发光 */}
            {mood === 'replying' && (
              <>
                <circle cx="40" cy="45" r="7" fill="rgba(196,181,253,0.4)"/>
                <circle cx="60" cy="45" r="7" fill="rgba(196,181,253,0.4)"/>
              </>
            )}

            {/* 腮红 */}
            <circle cx="33" cy="52" r="4" fill="#f9a8d4" opacity="0.4"/>
            <circle cx="67" cy="52" r="4" fill="#f9a8d4" opacity="0.4"/>

            {/* 鼻子（MVP新增） */}
            <ellipse cx="50" cy="54" rx="2" ry="1.5" fill="#c084fc" opacity="0.7"/>

            {/* 嘴巴（MVP新增）— 根据情绪变化 */}
            {(mood === 'idle' || mood === 'listening' || mood === 'recording') && (
              <path d="M44,61 Q50,66 56,61" stroke="#c084fc" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.8"/>
            )}
            {mood === 'thinking' && (
              <path d="M46,62 Q50,64 54,62" stroke="#a78bfa" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.7"/>
            )}
            {(mood === 'replying' || mood === 'jumping' || mood === 'flipping') && (
              <path d="M43,60 Q50,69 57,60" stroke="#f9a8d4" strokeWidth="2" fill="rgba(249,168,212,0.15)" strokeLinecap="round"/>
            )}
            {mood === 'running' && (
              <path d="M44,62 Q50,67 56,62" stroke="#fb923c" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.9"/>
            )}
            {mood === 'previewing' && (
              <path d="M46,62 Q50,65 54,62" stroke="#c084fc" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.6"/>
            )}
          </svg>
        </div>

        {/* 名字标签 */}
        <div className="spirit-name" style={{ position: 'relative' }}>
          小 星
          <button
            className="spirit-mode-toggle"
            onClick={handleModeToggle}
            title={spiritMode === 'companion' ? '当前：伴侣模式，点击切换为助手模式' : '当前：助手模式，点击切换为伴侣模式'}
            style={{
              position: 'absolute',
              top: -6,
              right: -20,
              width: 18,
              height: 18,
              borderRadius: '50%',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 12,
              lineHeight: 1,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {spiritMode === 'companion' ? '💜' : '🎯'}
          </button>
        </div>

        {/* W15/W16：语音按钮 + 视频按钮 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 4 }}>
          <VoiceButton
            onMoodChange={(voiceMood) => {
              clearReplyTimer();
              setMood(voiceMood);
            }}
            onWakeWord={(remaining) => {
              // 检测到唤醒词"小星" → 打开聊天框
              if (!chatOpen) {
                setChatOpen(true);
                window.electron?.ipcRenderer?.invoke?.('spirit:chat-toggle', true).catch(() => {});
              }
              // "小星帮我查天气" → 自动填入"帮我查天气"
              if (remaining) setChatInput(remaining);
              setTimeout(() => chatInputRef.current?.focus(), 350);
            }}
          />
          <VideoButton
            onMoodChange={(videoMood) => {
              clearReplyTimer();
              setMood(videoMood);
            }}
          />
        </div>
      </div>

      {/* 聊天面板（点击小星后展开） */}
      {chatOpen && (
        <div className="spirit-chat-panel" onClick={e => e.stopPropagation()}>
          {/* 标题栏 */}
          <div className="spirit-chat-header">
            <span className="spirit-chat-title">💜 小星</span>
            <button
              className="spirit-chat-expand"
              onClick={handleExpandFullscreen}
              title="放大全屏"
            >⤢</button>
            <button
              className="spirit-chat-close"
              onClick={handleCloseChat}
            >×</button>
          </div>

          {/* 摄像头预览（条件渲染） */}
          {cameraOn && (
            <div className="spirit-chat-video-preview">
              <video
                ref={videoPreviewRef}
                autoPlay
                muted
                playsInline
                className="spirit-chat-video"
              />
              <span className="spirit-chat-video-label">摄像头</span>
            </div>
          )}

          {/* 消息列表 */}
          <div className="spirit-chat-messages" ref={chatScrollRef}>
            {chatMessages.length === 0 && (
              <div className="spirit-chat-empty">叫我小星，随时可以聊天～ 💜</div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`spirit-chat-msg spirit-chat-msg-${msg.role}`}>
                {msg.text}
              </div>
            ))}
            {chatLoading && (
              <div className="spirit-chat-msg spirit-chat-msg-ai spirit-chat-loading">
                <span className="dot">●</span>
                <span className="dot">●</span>
                <span className="dot">●</span>
              </div>
            )}
          </div>

          {/* 输入区域 */}
          <div className="spirit-chat-input-row">
            <button
              className={`spirit-chat-camera${cameraOn ? ' camera-on' : ''}`}
              onClick={toggleCamera}
              title={cameraOn ? '关闭摄像头' : '开启摄像头'}
            >
              {cameraOn ? '📷' : '🎥'}
            </button>
            <input
              ref={chatInputRef}
              className="spirit-chat-input"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="说点什么..."
              maxLength={500}
            />
            <button
              className="spirit-chat-send"
              onClick={handleChatSend}
              disabled={chatLoading || !chatInput.trim()}
            >↑</button>
          </div>
        </div>
      )}
    </div>
  );
}
