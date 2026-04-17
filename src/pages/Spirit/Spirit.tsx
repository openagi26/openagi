/**
 * 小星（Spirit）桌面伴侣组件
 * 4 个情绪状态：idle（待机）/ listening（聆听）/ thinking（思考）/ replying（回复）
 * W10：新增重逢问候气泡（greeting bubble）
 * W15：新增语音按钮（VoiceButton）
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import './spirit.css';
import { VoiceButton } from './VoiceButton';
import { VideoButton } from './VideoButton';

type SpiritMood = 'idle' | 'listening' | 'thinking' | 'replying' | 'recording' | 'previewing';

const MOOD_BUBBLES: Record<SpiritMood, string> = {
  idle: '随时叫我哦～',
  listening: '我在听…',
  thinking: '想一想…',
  replying: '来了来了！',
  recording: '说吧说吧～',
  previewing: '让我看看～',
};

export function Spirit() {
  const [mood, setMood] = useState<SpiritMood>('idle');
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // W10：重逢问候气泡状态
  const [greetingText, setGreetingText] = useState<string | null>(null);
  const [greetingVisible, setGreetingVisible] = useState(false);
  const greetingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 清理 timer（定时器）
  const clearReplyTimer = useCallback(() => {
    if (replyTimerRef.current) {
      clearTimeout(replyTimerRef.current);
      replyTimerRef.current = null;
    }
  }, []);

  // W10：展示问候气泡 5 秒后淡出
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
    // 监听来自主进程的 spirit:mood 事件
    const unsubscribeMood = window.electron?.ipcRenderer?.on?.('spirit:mood', (...args: unknown[]) => {
      const newMood = args[0] as SpiritMood;
      clearReplyTimer();
      setMood(newMood);

      // 回复态 1.5 秒后自动恢复 idle
      if (newMood === 'replying') {
        replyTimerRef.current = setTimeout(() => {
          setMood('idle');
        }, 1500);
      }
    });

    // W10：监听重逢问候事件（主进程在浮窗加载完成后发送）
    const unsubscribeGreeting = window.electron?.ipcRenderer?.on?.('spirit:greeting', (...args: unknown[]) => {
      const text = args[0] as string;
      if (text) showGreeting(text);
    });

    return () => {
      clearReplyTimer();
      if (greetingTimerRef.current) clearTimeout(greetingTimerRef.current);
      if (typeof unsubscribeMood === 'function') unsubscribeMood();
      if (typeof unsubscribeGreeting === 'function') unsubscribeGreeting();
    };
  }, [clearReplyTimer, showGreeting]);

  // 点击小星 → 通知主进程唤起主窗口
  const handleClick = useCallback(() => {
    window.electron?.ipcRenderer?.invoke?.('spirit:focus-main').catch(() => {
      // 降级：忽略错误
    });
  }, []);

  return (
    <div
      className={`spirit-container ${mood}`}
      onClick={handleClick}
      title="小星 · 点击唤起 OpenAGI"
    >
      {/* W10：重逢问候气泡（greeting bubble）— 比状态气泡优先级更高，独立展示 */}
      {greetingText && (
        <div className={`spirit-greeting-bubble ${greetingVisible ? 'visible' : ''}`}>
          {greetingText}
        </div>
      )}

      {/* 状态提示气泡（hover 时显示） */}
      <div className="spirit-bubble">{MOOD_BUBBLES[mood]}</div>

      <div className="spirit-body">
        {/* 思考时头顶三点 */}
        {mood === 'thinking' && (
          <div className="thinking-dots">
            <div className="thinking-dot" />
            <div className="thinking-dot" />
            <div className="thinking-dot" />
          </div>
        )}

        {/* SVG 小星形象 */}
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
        </svg>
      </div>

      {/* 名字标签 */}
      <div className="spirit-name">小 星</div>

      {/* W15/W16：语音按钮 + 视频按钮（并排显示在小星旁边） */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 4 }}>
        <VoiceButton
          onMoodChange={(voiceMood) => {
            clearReplyTimer();
            setMood(voiceMood);
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
  );
}
