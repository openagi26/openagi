'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore, Theme } from '@/lib/store';
import HeartStatus from './HeartStatus';

const TABS = [
  { label: '深度聊天', href: '/', icon: '💬' },
  { label: 'AI群聊', href: '/group', icon: '👥' },
  { label: '记忆宫殿', href: '/memory', icon: '🧠' },
  { label: '设置', href: '/settings', icon: '⚙️' },
];

export default function TopNavWrapper() {
  const { state, dispatch } = useStore();
  const { theme, currentModel, fullscreen } = state;
  const pathname = usePathname();

  // 主题切换 → 同步到html标签
  useEffect(() => {
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    if (theme === 'custom' && state.customBgUrl) {
      document.body.style.setProperty('--custom-bg', `url("${state.customBgUrl}")`);
    }
  }, [theme, state.customBgUrl]);

  // ESC退出全屏
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fullscreen) {
        dispatch({ type: 'TOGGLE_FULLSCREEN' });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fullscreen, dispatch]);

  if (fullscreen) return null;

  const setTheme = (t: Theme) => dispatch({ type: 'SET_THEME', payload: t });

  return (
    <nav
      className="flex items-center gap-4 px-5 flex-shrink-0 select-none"
      style={{
        height: 52,
        background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
      }}
      role="navigation"
      aria-label="主导航"
    >
      {/* Logo */}
      <Link
        href="/"
        className="logo-gradient text-lg font-bold tracking-wide flex-shrink-0 cursor-pointer"
        aria-label="OpenAGI 首页"
        style={{ textDecoration: 'none' }}
      >
        OpenAGI
      </Link>

      {/* 分隔线 */}
      <div className="w-px h-6 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }} aria-hidden="true" />

      {/* 导航标签 */}
      <div className="flex gap-1" role="tablist">
        {TABS.map(tab => {
          const active = pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              role="tab"
              aria-selected={active}
              className="px-3.5 py-1.5 rounded-lg text-sm border transition-all flex items-center gap-1.5"
              style={{
                color: active ? '#fff' : 'rgba(255,255,255,0.6)',
                background: active ? 'rgba(124,58,237,0.35)' : 'transparent',
                borderColor: active ? 'rgba(124,58,237,0.5)' : 'transparent',
                textDecoration: 'none',
              }}
            >
              {tab.icon && <span style={{ fontSize: 13 }}>{tab.icon}</span>}
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* 右侧区域 */}
      <div className="ml-auto flex items-center gap-3.5">
        {/* 模型徽章 */}
        <button
          className="text-xs px-2.5 py-1 rounded-full border transition-all cursor-pointer"
          style={{
            background: 'rgba(96,165,250,0.12)',
            color: '#93c5fd',
            borderColor: 'rgba(96,165,250,0.3)',
          }}
          title="当前模型"
          aria-label={`当前模型：${currentModel}`}
        >
          {currentModel}
        </button>

        {/* 心绪状态 */}
        <HeartStatus />

        {/* 主题切换 */}
        <div className="flex items-center gap-1" role="group" aria-label="主题切换">
          {(['light', 'dark', 'custom'] as Theme[]).map(t => (
            <button
              key={t}
              onClick={() => {
                if (t === 'custom') {
                  const url = window.prompt('请输入背景图片URL：', state.customBgUrl);
                  if (url) dispatch({ type: 'SET_CUSTOM_BG', payload: url });
                } else {
                  setTheme(t);
                }
              }}
              className="px-2 py-0.5 rounded text-xs border transition-all"
              style={{
                background: theme === t ? 'rgba(124,58,237,0.35)' : 'transparent',
                color: theme === t ? '#fff' : 'rgba(255,255,255,0.55)',
                borderColor: theme === t ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.15)',
              }}
              aria-pressed={theme === t}
              aria-label={`切换到${t === 'light' ? '浅色' : t === 'dark' ? '深色' : '自定义背景'}主题`}
            >
              {t === 'light' ? '☀' : t === 'dark' ? '☾' : '✦'}
            </button>
          ))}
        </div>

        {/* 头像 */}
        <button
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white font-semibold cursor-pointer flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}
          title="用户菜单"
          aria-label="用户头像"
        >
          陛
        </button>
      </div>
    </nav>
  );
}
