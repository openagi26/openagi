'use client';

import React, { useEffect, useState } from 'react';

interface RadarAnimationProps {
  seconds: number;
  size?: number;
}

export default function RadarAnimation({ seconds, size = 120 }: RadarAnimationProps) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-label={`AI思考中，已用时 ${seconds} 秒`}
      role="status"
    >
      {/* 外圈扩散波 */}
      <div
        className="absolute rounded-full border border-violet-400/40 animate-radar-ping"
        style={{ width: size * 0.85, height: size * 0.85 }}
      />
      <div
        className="absolute rounded-full border border-violet-400/25 animate-radar-ping"
        style={{ width: size * 0.85, height: size * 0.85, animationDelay: '0.5s' }}
      />

      {/* 底圆背景 */}
      <div
        className="absolute rounded-full"
        style={{
          width: size * 0.65,
          height: size * 0.65,
          background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, rgba(124,58,237,0.02) 100%)',
          border: '1px solid rgba(124,58,237,0.2)',
        }}
      />

      {/* 雷达扫描线 */}
      <div
        className="absolute animate-radar-spin"
        style={{ width: size * 0.65, height: size * 0.65 }}
      >
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '50%',
            height: '2px',
            transformOrigin: '0 50%',
            background: 'linear-gradient(90deg, rgba(124,58,237,0.8), transparent)',
            borderRadius: '1px',
          }}
        />
      </div>

      {/* 中心圆点 */}
      <div
        className="absolute rounded-full bg-violet-500"
        style={{ width: 6, height: 6, boxShadow: '0 0 8px rgba(124,58,237,0.8)' }}
      />

      {/* 秒数 */}
      <div
        className="absolute bottom-1 text-center"
        style={{ fontSize: 11 }}
      >
        <span className="text-violet-400 font-mono font-semibold">{seconds}s</span>
      </div>
    </div>
  );
}

// 打点等待动画（小版本，用于消息气泡内）
export function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 px-1" aria-label="思考中">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400"
          style={{
            animation: 'dot-bounce 1.4s ease-in-out infinite',
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </span>
  );
}
