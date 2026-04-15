'use client';

import React from 'react';
import { useStore, CoreStatus } from '@/lib/store';

interface CorePanelProps {
  open: boolean;
  onToggle: () => void;
}

const STATUS_LABELS: Record<CoreStatus['status'], string> = {
  idle: '待机',
  thinking: '思考中',
  done: '完成',
  error: '错误',
};

const STATUS_COLORS: Record<CoreStatus['status'], string> = {
  idle: '#9ca3af',
  thinking: '#7c3aed',
  done: '#059669',
  error: '#dc2626',
};

export default function CorePanel({ open, onToggle }: CorePanelProps) {
  const { state } = useStore();
  const { cores, isAIThinking, thinkingSeconds } = state;

  const activeCount = cores.filter(c => c.status === 'thinking').length;
  const doneCount = cores.filter(c => c.status === 'done').length;

  return (
    <>
      {/* 折叠时的小按钮 */}
      {!open && (
        <button
          onClick={onToggle}
          className="fixed z-40 flex items-center justify-center rounded-lg border transition-all"
          style={{
            top: 62,
            right: 6,
            width: 28,
            height: 28,
            background: 'rgba(124,58,237,0.12)',
            backdropFilter: 'blur(8px)',
            borderColor: 'rgba(124,58,237,0.25)',
            color: '#7c3aed',
          }}
          title="展开多核面板"
          aria-label="展开右侧多核面板"
        >
          ‹
        </button>
      )}

      {/* 面板主体 */}
      <aside
        className="sidebar-transition flex flex-col flex-shrink-0 overflow-hidden"
        style={{
          width: open ? 280 : 0,
          opacity: open ? 1 : 0,
          background: 'var(--panel-bg)',
          borderLeft: open ? '1px solid var(--panel-border)' : 'none',
        }}
        aria-label="多核状态面板"
      >
        {/* 面板头 */}
        <div
          className="px-4 py-3 flex items-center justify-between border-b"
          style={{ borderColor: 'var(--panel-border)' }}
        >
          <div>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              多核状态
            </span>
            <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
              {activeCount > 0 ? `${activeCount}核活跃` : `${cores.length}核就绪`}
            </span>
          </div>
          <button
            onClick={onToggle}
            className="text-base cursor-pointer hover:text-violet-500 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            aria-label="折叠右侧栏"
          >
            ›
          </button>
        </div>

        {/* 核心列表 */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {cores.map(core => (
            <CoreCard key={core.id} core={core} isAIThinking={isAIThinking} />
          ))}
        </div>

        {/* 审计摘要 */}
        {doneCount > 0 && (
          <div
            className="mx-3 mb-3 p-3 rounded-lg text-xs"
            style={{
              background: 'rgba(5,150,105,0.08)',
              border: '1px solid rgba(5,150,105,0.25)',
              color: '#059669',
            }}
          >
            <div className="font-semibold mb-1">审计完成</div>
            <div style={{ color: 'var(--text-secondary)' }}>
              {doneCount}/{cores.length} 核完成审计，结果已综合
            </div>
          </div>
        )}

        {/* 底部统计 */}
        <div
          className="px-4 py-2.5 border-t flex justify-between text-xs"
          style={{ borderColor: 'var(--panel-border)', color: 'var(--text-muted)' }}
        >
          <span>当前模型</span>
          <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
            {state.currentModel}
          </span>
        </div>
      </aside>
    </>
  );
}

function CoreCard({ core, isAIThinking }: { core: CoreStatus; isAIThinking: boolean }) {
  const statusColor = STATUS_COLORS[isAIThinking && core.id <= 2 ? 'thinking' : core.status];
  const statusLabel = STATUS_LABELS[isAIThinking && core.id <= 2 ? 'thinking' : core.status];
  const isActive = isAIThinking && core.id <= 2;

  return (
    <div
      className="rounded-xl p-3 transition-all"
      style={{
        background: isActive ? 'rgba(124,58,237,0.06)' : 'var(--card-bg)',
        border: `1px solid ${isActive ? 'rgba(124,58,237,0.3)' : 'var(--card-border)'}`,
      }}
      role="listitem"
      aria-label={`${core.name} - ${statusLabel}`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {/* 核心颜色标识 */}
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{
              background: core.color,
              boxShadow: isActive ? `0 0 6px ${core.color}` : 'none',
            }}
          />
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            {core.name}
          </span>
        </div>
        {/* 状态指示 */}
        <span
          className="text-xs px-1.5 py-0.5 rounded-full"
          style={{
            background: `${statusColor}15`,
            color: statusColor,
            border: `1px solid ${statusColor}30`,
          }}
        >
          {statusLabel}
          {isActive && (
            <span className="ml-0.5 inline-flex gap-0.5">
              {[0,1,2].map(i => (
                <span
                  key={i}
                  className="inline-block w-0.5 h-0.5 rounded-full bg-current"
                  style={{ animation: `dot-bounce 1.4s ease-in-out infinite`, animationDelay: `${i * 0.16}s` }}
                />
              ))}
            </span>
          )}
        </span>
      </div>

      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>{core.role}</span>
        <span className="mx-1">·</span>
        <span>{core.model}</span>
      </div>

      {/* 评分（如果有） */}
      {core.score !== undefined && (
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--card-border)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${core.score}%`, background: core.color }}
            />
          </div>
          <span className="text-xs font-mono" style={{ color: core.color }}>{core.score}</span>
        </div>
      )}
    </div>
  );
}
