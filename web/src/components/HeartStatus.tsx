'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { fetchStatus } from '@/lib/api';

// mood 类型 → 颜色映射
const MOOD_COLORS: Record<string, { color: string; bg: string; border: string; label: string }> = {
  calm:    { color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.35)',  label: '平静' },
  focused: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.35)',  label: '专注' },
  anxious: { color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.35)',  label: '焦虑' },
  crisis:  { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)', label: '危机' },
};

function getMoodStyle(moodType?: string) {
  if (!moodType) return MOOD_COLORS.calm;
  const key = moodType.toLowerCase();
  return MOOD_COLORS[key] ?? MOOD_COLORS.calm;
}

interface HeartApiResponse {
  version?: string;
  uptime?: number;
  activeAgents?: number;
  totalRequests?: number;
  mood?: {
    label?: string;
    emoji?: string;
    level?: number;
    type?: string;     // calm | focused | anxious | crisis
    entropy?: number;  // 熵值（混乱度），0-1
  };
}

export default function HeartStatus() {
  const { state, dispatch } = useStore();
  const { heartMood } = state;
  const [showDetail, setShowDetail] = useState(false);
  const [moodType, setMoodType] = useState<string>('calm');
  const [entropy, setEntropy] = useState<number | null>(null);
  const [uptime, setUptime] = useState<number>(0);

  useEffect(() => {
    const loadStatus = () => {
      fetchStatus().then((data: HeartApiResponse) => {
        if (!data) return;

        // 更新全局 heartMood
        if (data.mood) {
          const type = data.mood.type ?? moodType;
          const style = getMoodStyle(type);
          setMoodType(type);

          // entropy
          if (data.mood.entropy != null) {
            setEntropy(data.mood.entropy);
          }

          dispatch({
            type: 'SET_HEART_MOOD',
            payload: {
              label: data.mood.label ?? style.label,
              emoji: data.mood.emoji ?? heartMood.emoji,
              color: style.color,
              level: data.mood.level ?? heartMood.level,
            },
          });
        }

        if (data.uptime != null) setUptime(data.uptime);
      }).catch(() => {
        // 保持上次状态
      });
    };

    loadStatus();
    const timer = setInterval(loadStatus, 15000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const style = getMoodStyle(moodType);

  // 格式化运行时间
  function formatUptime(seconds: number): string {
    if (seconds < 60) return `${Math.floor(seconds)}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}小时${m > 0 ? m + '分' : ''}`;
  }

  return (
    <div className="relative">
      <button
        className="flex items-center gap-1.5 cursor-pointer select-none"
        onClick={() => setShowDetail(!showDetail)}
        aria-label={`当前心绪：${heartMood.label}`}
        title="心绪状态"
        style={{ background: 'none', border: 'none', padding: 0 }}
      >
        {/* 状态灯 — 根据 mood 变色 */}
        <span
          className="animate-heart-beat inline-block"
          style={{
            fontSize: 14,
            filter: `drop-shadow(0 0 4px ${style.color})`,
          }}
          aria-hidden="true"
        >
          {heartMood.emoji}
        </span>
        <span
          className="text-xs hidden md:inline font-medium"
          style={{ color: style.color }}
        >
          {heartMood.label}
        </span>
      </button>

      {/* 详情浮窗 */}
      {showDetail && (
        <div
          className="absolute right-0 top-8 z-50 rounded-xl p-4 shadow-xl border animate-fade-in-up"
          style={{
            width: 220,
            background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
            borderColor: style.border,
          }}
          role="tooltip"
          aria-label="AI心绪详情"
        >
          <div className="text-xs font-semibold mb-2" style={{ color: style.color }}>
            AI 心绪状态
          </div>

          {/* emoji + 标签 */}
          <div className="flex items-center gap-2 mb-3">
            <span style={{ fontSize: 22 }}>{heartMood.emoji}</span>
            <div>
              <div className="text-sm font-bold text-white">{heartMood.label}</div>
              <div className="text-xs capitalize" style={{ color: style.color }}>{moodType}</div>
            </div>
          </div>

          {/* 活力进度条 */}
          <div className="mb-2">
            <div className="flex justify-between text-xs mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <span>活力</span>
              <span style={{ color: style.color }}>{heartMood.level}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${heartMood.level}%`, background: style.color }}
              />
            </div>
          </div>

          {/* 熵值 */}
          {entropy != null && (
            <div className="mb-2">
              <div className="flex justify-between text-xs mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <span>熵值（混乱度）</span>
                <span style={{ color: '#fb923c' }}>{(entropy * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${entropy * 100}%`, background: '#fb923c' }}
                />
              </div>
            </div>
          )}

          {/* 运行时长 */}
          {uptime > 0 && (
            <div className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              在线时长：{formatUptime(uptime)}
            </div>
          )}

          {/* 颜色指示块（四种mood说明） */}
          <div className="mt-3 grid grid-cols-2 gap-1">
            {Object.entries(MOOD_COLORS).map(([key, cfg]) => (
              <div
                key={key}
                className="flex items-center gap-1 rounded px-1.5 py-1 text-xs"
                style={{
                  background: key === moodType ? cfg.bg : 'transparent',
                  border: `1px solid ${key === moodType ? cfg.border : 'transparent'}`,
                  color: cfg.color,
                  opacity: key === moodType ? 1 : 0.45,
                }}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ background: cfg.color }}
                />
                {cfg.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
