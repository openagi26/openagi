'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { fetchStatus } from '@/lib/api';

export default function HeartStatus() {
  const { state, dispatch } = useStore();
  const { heartMood } = state;
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    const loadStatus = () => {
      fetchStatus().then(data => {
        if (data && data.mood) {
          dispatch({
            type: 'SET_HEART_MOOD',
            payload: {
              label: data.mood.label ?? heartMood.label,
              emoji: data.mood.emoji ?? heartMood.emoji,
              color: heartMood.color,
              level: data.mood.level ?? heartMood.level,
            },
          });
        }
      }).catch(() => {
        // keep last known state on error
      });
    };

    loadStatus();
    const timer = setInterval(loadStatus, 15000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  return (
    <div className="relative">
      <button
        className="flex items-center gap-1.5 cursor-pointer select-none"
        onClick={() => setShowDetail(!showDetail)}
        aria-label={`当前心绪：${heartMood.label}`}
        title="心绪状态"
      >
        {/* 状态灯 */}
        <span
          className="animate-heart-beat inline-block"
          style={{ fontSize: 14 }}
          aria-hidden="true"
        >
          {heartMood.emoji}
        </span>
        <span className="text-xs hidden md:inline" style={{ color: heartMood.color }}>
          {heartMood.label}
        </span>
      </button>

      {/* 详情浮窗 */}
      {showDetail && (
        <div
          className="absolute right-0 top-8 z-50 rounded-xl p-3 shadow-xl border animate-fade-in-up"
          style={{
            width: 200,
            background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
            borderColor: 'rgba(124,58,237,0.4)',
          }}
          role="tooltip"
        >
          <div className="text-xs text-violet-200 font-semibold mb-2">AI心绪状态</div>
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontSize: 20 }}>{heartMood.emoji}</span>
            <span className="text-sm font-semibold text-white">{heartMood.label}</span>
          </div>
          {/* 进度条 */}
          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${heartMood.level}%`, background: heartMood.color }}
            />
          </div>
          <div className="text-xs text-violet-300 mt-1 text-right">{heartMood.level}%</div>
          <div className="mt-2 text-xs text-violet-400">
            AI状态良好，专注处理中
          </div>
        </div>
      )}
    </div>
  );
}
