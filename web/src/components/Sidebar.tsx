'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore, Session } from '@/lib/store';
import { fetchSessions, fetchHistory } from '@/lib/api';

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

export default function Sidebar({ open, onToggle }: SidebarProps) {
  const { state, dispatch } = useStore();
  const { sessions, activeSessionId } = state;
  const [search, setSearch] = useState('');
  const pathname = usePathname();

  const filtered = sessions.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  // 按group分组
  const groups = Array.from(new Set(filtered.map(s => s.group || '其他')));

  // Load sessions from backend on mount
  useEffect(() => {
    fetchSessions().then(sessions => {
      if (sessions.length > 0) {
        dispatch({ type: 'SET_SESSIONS', payload: sessions });
      }
    }).catch(() => {
      // fallback: keep empty list, no crash
    });
  }, [dispatch]);

  const handleSessionClick = (sessionId: string) => {
    dispatch({ type: 'SET_ACTIVE_SESSION', payload: sessionId });
    fetchHistory(sessionId).then(history => {
      const messages = history.map((m, i) => ({
        id: `${sessionId}-${i}`,
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        timestamp: Date.now() - (history.length - i) * 1000,
      }));
      dispatch({ type: 'SET_MESSAGES', payload: messages });
    }).catch(() => {
      // fallback: keep empty messages on error
    });
  };

  const handleNewChat = () => {
    dispatch({ type: 'NEW_SESSION' });
  };

  return (
    <>
      {/* 折叠状态下的小按钮 */}
      {!open && (
        <button
          onClick={onToggle}
          className="fixed z-40 flex items-center justify-center rounded-lg border transition-all"
          style={{
            top: 62,
            left: 6,
            width: 28,
            height: 28,
            background: 'rgba(124,58,237,0.12)',
            backdropFilter: 'blur(8px)',
            borderColor: 'rgba(124,58,237,0.25)',
            color: '#7c3aed',
          }}
          title="展开会话列表"
          aria-label="展开左侧栏"
        >
          ›
        </button>
      )}

      {/* 侧边栏主体 */}
      <aside
        className="sidebar-transition flex flex-col flex-shrink-0 overflow-hidden"
        style={{
          width: open ? 260 : 0,
          opacity: open ? 1 : 0,
          background: 'var(--sidebar-bg)',
          borderRight: open ? '1px solid var(--sidebar-border)' : 'none',
        }}
        aria-label="会话列表"
      >
        {/* 新建对话 */}
        <div className="px-3 pt-3 pb-1">
          <button
            onClick={handleNewChat}
            className="w-full py-2 rounded-lg text-sm transition-all"
            style={{
              border: '1px dashed var(--card-border)',
              background: 'transparent',
              color: 'var(--text-muted)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#7c3aed';
              (e.currentTarget as HTMLButtonElement).style.color = '#7c3aed';
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,58,237,0.05)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--card-border)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            + 新对话
          </button>
        </div>

        {/* 搜索框 */}
        <div className="px-3 pb-2">
          <input
            type="search"
            placeholder="搜索对话..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 rounded-md text-xs outline-none"
            style={{
              background: 'var(--toolbar-hover)',
              border: '1px solid var(--sidebar-border)',
              color: 'var(--text-primary)',
            }}
            aria-label="搜索会话"
          />
        </div>

        {/* 快捷导航 */}
        <div className="px-3 pb-2">
          <Link
            href="/memory"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all w-full"
            style={{
              background: pathname === '/memory' ? 'var(--session-active)' : 'transparent',
              borderLeft: pathname === '/memory' ? '3px solid #7c3aed' : '3px solid transparent',
              color: pathname === '/memory' ? '#7c3aed' : 'var(--text-secondary)',
              textDecoration: 'none',
            }}
          >
            <span>🧠</span>
            <span>记忆</span>
          </Link>
        </div>

        {/* 会话列表 */}
        <div className="flex-1 overflow-y-auto">
          {groups.map(group => {
            const groupSessions = filtered.filter(s => (s.group || '其他') === group);
            return (
              <div key={group}>
                <div
                  className="px-4 py-1.5 text-xs font-medium uppercase tracking-wide"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {group}
                </div>
                {groupSessions.map(session => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    active={session.id === activeSessionId}
                    onClick={() => handleSessionClick(session.id)}
                  />
                ))}
              </div>
            );
          })}
        </div>

        {/* 底部快捷栏 */}
        <div
          className="border-t p-3 flex gap-2"
          style={{ borderColor: 'var(--sidebar-border)' }}
        >
          {['群聊', '设置', '帮助'].map(label => (
            <button
              key={label}
              className="flex-1 py-1.5 rounded-md text-xs transition-all"
              style={{
                border: '1px solid var(--sidebar-border)',
                color: 'var(--text-secondary)',
                background: 'transparent',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#7c3aed';
                (e.currentTarget as HTMLButtonElement).style.color = '#7c3aed';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--sidebar-border)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 折叠按钮（展开状态内部） */}
        <div
          className="px-4 py-2 flex items-center justify-between text-xs border-t"
          style={{ borderColor: 'var(--sidebar-border)', color: 'var(--text-muted)' }}
        >
          <span>OpenAGI v0.1</span>
          <button
            onClick={onToggle}
            className="text-base cursor-pointer hover:text-violet-500 transition-colors"
            aria-label="折叠左侧栏"
          >
            ‹
          </button>
        </div>
      </aside>
    </>
  );
}

function SessionItem({
  session,
  active,
  onClick,
}: {
  session: Session;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="px-4 py-2 cursor-pointer transition-all"
      style={{
        borderLeft: active ? '3px solid #7c3aed' : '3px solid transparent',
        background: active ? 'var(--session-active)' : 'transparent',
      }}
      onMouseEnter={e => {
        if (!active) (e.currentTarget as HTMLDivElement).style.background = 'var(--session-hover)';
      }}
      onMouseLeave={e => {
        if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
      }}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      aria-current={active ? 'page' : undefined}
      aria-label={`会话：${session.title}`}
    >
      <div
        className="text-sm font-medium truncate"
        style={{ color: 'var(--text-primary)' }}
      >
        {session.title}
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-xs truncate flex-1" style={{ color: 'var(--text-muted)' }}>
          {session.lastMessage || '暂无消息'}
        </span>
        <span className="text-xs ml-2 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
          {session.messageCount}
        </span>
      </div>
    </div>
  );
}
