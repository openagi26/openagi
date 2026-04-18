/**
 * VoiceButton（语音按钮）组件
 * 小星的麦克风按钮：按下录音 → 识别文字 → 发送给主进程 → TTS 播放回复
 * W15 语音聊天 MVP
 */
import { useState, useCallback, useRef } from 'react';
import { startListening, isSpeechRecognitionSupported } from '../../services/speech-to-text';
import { speak, cancelSpeech } from '../../services/text-to-speech';

type VoiceMood = 'idle' | 'listening' | 'thinking' | 'replying';

interface VoiceButtonProps {
  onMoodChange?: (mood: VoiceMood) => void;
  /** 检测到唤醒词"小星"时触发，参数是唤醒词之后的剩余文字（可能为空） */
  onWakeWord?: (remainingText: string) => void;
}

export function VoiceButton({ onMoodChange, onWakeWord }: VoiceButtonProps) {
  const [state, setState] = useState<VoiceMood>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const stopListeningRef = useRef<(() => void) | null>(null);
  const isSupported = isSpeechRecognitionSupported();

  const setMood = useCallback((mood: VoiceMood) => {
    setState(mood);
    onMoodChange?.(mood);
  }, [onMoodChange]);

  // 发送文字给主进程，获取回复并 TTS 播放
  const sendAndSpeak = useCallback(async (text: string) => {
    setErrorMsg(null);

    // 唤醒词检测：包含"小星"时触发 onWakeWord 回调
    if (onWakeWord && (text.includes('小星') || text.includes('小 星') || text.includes('xiǎo xīng'))) {
      const afterWake = text.replace(/小\s*星|xiǎo\s*xīng/gi, '').trim();
      setMood('idle');
      onWakeWord(afterWake);
      return;
    }

    setMood('thinking');

    try {
      // 通过 IPC（进程间通信）发送给主进程
      const reply = await window.electron?.ipcRenderer?.invoke?.(
        'spirit:voice-input',
        text
      ) as string | undefined;

      const replyText = reply || `我听到你说"${text}"了，但我现在还连不上大脑，等网关修好就能回答你～`;

      setMood('replying');
      await speak(replyText, { lang: 'zh-CN', rate: 1.0 });
    } catch (e) {
      const fallback = `我听到你说"${text}"了，但我现在还连不上大脑，等网关修好就能回答你～`;
      setMood('replying');
      try {
        await speak(fallback, { lang: 'zh-CN' });
      } catch {
        // TTS 也失败了，静默降级
      }
    } finally {
      setMood('idle');
    }
  }, [setMood]);

  // 按下麦克风：开始录音
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    if (state !== 'idle') return;
    setErrorMsg(null);
    cancelSpeech();
    setMood('listening');

    const stop = startListening(
      (text) => {
        stopListeningRef.current = null;
        sendAndSpeak(text);
      },
      (msg) => {
        stopListeningRef.current = null;
        setErrorMsg(msg);
        setMood('idle');
      },
      { lang: 'zh-CN', continuous: false }
    );
    stopListeningRef.current = stop;
  }, [state, setMood, sendAndSpeak]);

  // 松开麦克风：停止录音，等待识别结果
  const handlePointerUp = useCallback(() => {
    if (stopListeningRef.current) {
      stopListeningRef.current();
      stopListeningRef.current = null;
    }
    if (state === 'listening') {
      setMood('thinking');
    }
  }, [state, setMood]);

  if (!isSupported) {
    return (
      <div className="voice-button-unsupported" title="浏览器不支持语音识别">
        <span style={{ fontSize: 10, color: '#9ca3af' }}>不支持语音</span>
      </div>
    );
  }

  const isListening = state === 'listening';
  const isThinking = state === 'thinking';
  const isReplying = state === 'replying';
  const isActive = isListening || isThinking || isReplying;

  return (
    <div className="voice-button-wrapper">
      <button
        className={`voice-button ${state}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        title={isListening ? '松开发送' : '按住说话'}
        aria-label="语音输入"
        style={{
          background: isListening ? '#7c3aed' : isActive ? '#a78bfa' : 'rgba(255,255,255,0.15)',
          border: `2px solid ${isActive ? '#a78bfa' : 'rgba(255,255,255,0.3)'}`,
          borderRadius: '50%',
          width: 36,
          height: 36,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          outline: 'none',
          transition: 'all 0.15s ease',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'none',
        }}
      >
        {/* 录音中：涟漪动画（ripple animation） */}
        {isListening && (
          <span
            style={{
              position: 'absolute',
              inset: -6,
              borderRadius: '50%',
              border: '2px solid rgba(167,139,250,0.6)',
              animation: 'voice-ripple 1s ease-out infinite',
            }}
          />
        )}

        {/* 思考中：旋转小圈 */}
        {isThinking && (
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            style={{ animation: 'voice-spin 0.8s linear infinite' }}
          >
            <circle cx="12" cy="12" r="10" fill="none" stroke="white" strokeWidth="3" strokeDasharray="31 31" strokeLinecap="round"/>
          </svg>
        )}

        {/* 默认/录音/回复：麦克风图标 */}
        {!isThinking && (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <rect x="9" y="2" width="6" height="12" rx="3"
              fill={isActive ? 'white' : 'rgba(255,255,255,0.85)'}
            />
            <path
              d="M5 11a7 7 0 0 0 14 0"
              stroke={isActive ? 'white' : 'rgba(255,255,255,0.85)'}
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
            <line x1="12" y1="18" x2="12" y2="22"
              stroke={isActive ? 'white' : 'rgba(255,255,255,0.85)'}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line x1="8" y1="22" x2="16" y2="22"
              stroke={isActive ? 'white' : 'rgba(255,255,255,0.85)'}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>

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
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* CSS 动画注入 */}
      <style>{`
        @keyframes voice-ripple {
          0%   { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes voice-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
