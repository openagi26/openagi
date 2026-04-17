'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import Sidebar from '@/components/Sidebar';
import CorePanel from '@/components/CorePanel';
import ChatBubble from '@/components/ChatBubble';
import SendBox from '@/components/SendBox';
import RadarAnimation from '@/components/RadarAnimation';

// 欢迎屏快捷卡片
const QUICK_CARDS = [
  { icon: '🧠', label: '深度分析', desc: '多核并行分析复杂问题' },
  { icon: '💻', label: '编写代码', desc: '生成、调试、优化代码' },
  { icon: '📊', label: '数据洞察', desc: '解读数据，发现规律' },
  { icon: '🚀', label: '战略规划', desc: '制定目标与执行路径' },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return '夜深了，陛下还在奋斗';
  if (h < 12) return '早上好，陛下';
  if (h < 18) return '下午好，陛下';
  return '晚上好，陛下';
}

export default function HomePage() {
  const { state, dispatch } = useStore();
  const {
    leftSidebarOpen, rightPanelOpen, fullscreen,
    messages, isAIThinking, thinkingSeconds,
    activeSessionId,
  } = state;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [seconds, setSeconds] = useState(0);

  // 思考计时器
  useEffect(() => {
    if (!isAIThinking) { setSeconds(0); return; }
    const timer = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, [isAIThinking]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 过滤掉thinking占位（只显示一个）
  const displayMessages = messages.filter((m, i) => {
    if (!m.thinking) return true;
    // 只保留最后一个thinking消息
    const lastThinkingIdx = messages.map(x => x.thinking).lastIndexOf(true);
    return i === lastThinkingIdx;
  });

  const showWelcome = displayMessages.length === 0 && !isAIThinking;

  return (
    <div className="flex h-full overflow-hidden">
      {/* 左侧边栏 */}
      <Sidebar
        open={leftSidebarOpen}
        onToggle={() => dispatch({ type: 'TOGGLE_LEFT_SIDEBAR' })}
      />

      {/* 中间主区域 */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        style={{ background: 'var(--center-bg)' }}
      >
        {showWelcome ? (
          // ===== 欢迎屏 =====
          <WelcomeScreen onQuickCard={(label) => {
            // 点击快捷卡片时填入输入框（通过自定义事件）
            const ev = new CustomEvent('quick-card', { detail: label });
            window.dispatchEvent(ev);
          }} />
        ) : (
          // ===== 聊天消息列表 =====
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            {displayMessages.map(msg => (
              <ChatBubble key={msg.id} message={msg} />
            ))}

            {/* AI思考动画 */}
            {isAIThinking && (
              <div className="flex justify-center py-4 animate-fade-in-up" role="status" aria-live="polite">
                <RadarAnimation seconds={seconds} size={110} />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* 发送框 */}
        <SendBox />

        {/* 底部状态栏 */}
        <BottomBar thinking={isAIThinking} seconds={seconds} />
      </div>

      {/* 右侧多核面板 */}
      <CorePanel
        open={rightPanelOpen}
        onToggle={() => dispatch({ type: 'TOGGLE_RIGHT_PANEL' })}
      />

      {/* 全屏切换按钮 */}
      {!fullscreen && (
        <button
          onClick={() => dispatch({ type: 'TOGGLE_FULLSCREEN' })}
          className="fixed z-40 flex items-center justify-center rounded-lg border transition-all"
          style={{
            top: 62,
            left: leftSidebarOpen ? 272 : 40,
            width: 28,
            height: 28,
            background: 'rgba(124,58,237,0.1)',
            backdropFilter: 'blur(8px)',
            borderColor: 'rgba(124,58,237,0.2)',
            color: '#7c3aed',
            fontSize: 13,
          }}
          title="全屏模式（ESC退出）"
          aria-label="切换全屏模式"
        >
          ⛶
        </button>
      )}
    </div>
  );
}

// ===== 欢迎屏子组件 =====
function WelcomeScreen({ onQuickCard }: { onQuickCard: (label: string) => void }) {
  const { state } = useStore();

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-5 px-6"
      style={{ overflowY: 'auto' }}
    >
      {/* AI头像 */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center text-4xl animate-pulse-glow"
        style={{
          background: 'linear-gradient(135deg, #7c3aed, #2563eb, #06b6d4)',
        }}
        role="img"
        aria-label="OpenAGI头像"
      >
        ✦
      </div>

      {/* 问候语 */}
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          {getGreeting()}
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          OpenAGI 多核AI就绪，{state.coreCount}核协同待命
        </p>
      </div>

      {/* 快捷卡片 */}
      <div className="flex flex-wrap gap-3 justify-center max-w-2xl">
        {QUICK_CARDS.map(card => (
          <button
            key={card.label}
            onClick={() => onQuickCard(card.label)}
            className="px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 transition-all"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = '#7c3aed';
              el.style.color = '#7c3aed';
              el.style.boxShadow = '0 2px 8px rgba(124,58,237,0.12)';
              el.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = 'var(--card-border)';
              el.style.color = 'var(--text-secondary)';
              el.style.boxShadow = 'none';
              el.style.transform = 'translateY(0)';
            }}
            aria-label={`快捷功能：${card.label} - ${card.desc}`}
          >
            <span className="text-base" aria-hidden="true">{card.icon}</span>
            <span className="font-medium">{card.label}</span>
          </button>
        ))}
      </div>

      {/* 状态迷你面板 */}
      <div
        className="flex gap-5 px-5 py-2.5 rounded-xl mt-2"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
        }}
        role="status"
        aria-label="系统状态"
      >
        {[
          { dot: '#34d399', label: `${state.coreCount}核就绪`, val: '' },
          { dot: '#60a5fa', label: '会话', val: `${state.sessions.length}` },
          { dot: '#a78bfa', label: '心绪', val: state.heartMood.label },
          { dot: '#fbbf24', label: '巡检', val: state.inspectionEnabled ? '开启' : '关闭' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: item.dot }}
              aria-hidden="true"
            />
            <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
            {item.val && (
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{item.val}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== 底部状态栏 =====
function BottomBar({ thinking, seconds }: { thinking: boolean; seconds: number }) {
  return (
    <div
      className="px-4 py-1 flex items-center justify-between text-xs border-t flex-shrink-0"
      style={{
        borderColor: 'var(--panel-border)',
        color: 'var(--text-muted)',
        background: 'var(--panel-bg)',
      }}
      role="status"
      aria-live="polite"
    >
      <span>
        {thinking ? (
          <span className="text-violet-400">
            AI思考中... {seconds}s
          </span>
        ) : (
          'OpenAGI 就绪'
        )}
      </span>
      <span>后端：http://localhost:8888</span>
    </div>
  );
}
