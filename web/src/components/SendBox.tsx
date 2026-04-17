'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useStore, Message } from '@/lib/store';
import { sendMessage } from '@/lib/api';

const TOOLS = [
  { icon: '📎', label: '附件', key: 'attach' },
  { icon: '🖼️', label: '图片', key: 'image' },
  { icon: '✨', label: '润色', key: 'polish' },
  { icon: '🤖', label: '模型', key: 'model' },
  { icon: '🎤', label: '语音', key: 'voice' },
  { icon: '⚡', label: '实时', key: 'realtime' },
  { icon: '🔍', label: '巡检', key: 'inspect' },
];

export default function SendBox() {
  const { state, dispatch } = useStore();
  const { activeSessionId, isAIThinking, currentModel, coreCount } = state;
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动调整高度
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxH = 15 * 22; // 15行 × 约22px行高
    el.style.height = Math.min(el.scrollHeight, maxH) + 'px';
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  // 🔴 2026-04-17 修复：主页快捷卡片通过 CustomEvent 传入文本
  useEffect(() => {
    const handler = (e: Event) => {
      const label = (e as CustomEvent).detail as string;
      if (!label) return;
      const presets: Record<string, string> = {
        '深度分析': '请帮我做深度分析：',
        '编写代码': '请帮我编写代码：',
        '数据洞察': '请帮我解读以下数据：',
        '战略规划': '请帮我制定战略规划：',
      };
      setValue(presets[label] || `${label}：`);
      setTimeout(() => textareaRef.current?.focus(), 50);
    };
    window.addEventListener('quick-card', handler);
    return () => window.removeEventListener('quick-card', handler);
  }, []);

  const handleSend = useCallback(async () => {
    const text = value.trim();
    if (!text || isAIThinking) return;

    setValue('');

    const sessionId = activeSessionId || 'default';

    // 添加用户消息
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    dispatch({ type: 'ADD_MESSAGE', payload: userMsg });

    // 开始思考
    dispatch({ type: 'SET_AI_THINKING', payload: true });

    // 多核面板：激活的每一核状态改为 thinking（id 从 1 开始，共 coreCount 个）
    for (let i = 1; i <= coreCount; i++) {
      dispatch({ type: 'UPDATE_CORE', payload: { id: i, status: 'thinking' } });
    }

    // 占位thinking消息
    const thinkingId = (Date.now() + 1).toString();
    dispatch({
      type: 'ADD_MESSAGE',
      payload: {
        id: thinkingId,
        role: 'assistant',
        content: '',
        agentName: 'OpenAGI',
        model: currentModel,
        timestamp: Date.now(),
        thinking: true,
      },
    });

    try {
      const resp = await sendMessage(sessionId, text, currentModel, coreCount);
      dispatch({ type: 'SET_AI_THINKING', payload: false });

      // 多核面板：API 返回后所有激活核心改为 done
      for (let i = 1; i <= coreCount; i++) {
        dispatch({ type: 'UPDATE_CORE', payload: { id: i, status: 'done' } });
      }

      // 用真实回复替换thinking占位消息
      dispatch({
        type: 'REPLACE_MESSAGE',
        payload: {
          id: thinkingId,
          message: {
            id: thinkingId,
            role: 'assistant',
            content: resp.content,
            agentName: 'OpenAGI',
            model: resp.model || currentModel,
            agentColor: '#7c3aed',
            timestamp: Date.now(),
            thinking: false,
            ...(resp.tokens !== undefined ? { tokens: resp.tokens } : {}),
            ...(resp.audit !== undefined ? { audit: resp.audit } : {}),
          },
        },
      });
    } catch {
      dispatch({ type: 'SET_AI_THINKING', payload: false });

      // 多核面板：出错时所有激活核心改为 error
      for (let i = 1; i <= coreCount; i++) {
        dispatch({ type: 'UPDATE_CORE', payload: { id: i, status: 'error' } });
      }

      dispatch({
        type: 'REPLACE_MESSAGE',
        payload: {
          id: thinkingId,
          message: {
            id: thinkingId,
            role: 'assistant',
            content: '抱歉，发生了错误，请稍后重试。',
            agentName: 'OpenAGI',
            model: currentModel,
            agentColor: '#dc2626',
            timestamp: Date.now(),
          },
        },
      });
    }
  }, [value, isAIThinking, activeSessionId, currentModel, coreCount, dispatch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // 🚨 2026-04-17：伪证零容忍 — 7 工具按钮必须有真实 onClick
  // 按 sonnet P0 方案：每个按钮触发可观测的业务副作用（DOM / store / navigation）
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleToolClick = useCallback((key: string) => {
    switch (key) {
      case 'attach':
      case 'image':
        // 触发隐藏 file input 的 click（业务副作用：打开系统文件选择器）
        fileInputRef.current?.click();
        break;
      case 'polish':
        // 业务副作用：textarea 文本被替换为润色提示词前缀
        setValue(v => {
          const prefix = '请帮我润色以下内容（保留原意，提升表达）：\n';
          if (!v.trim()) {
            setTimeout(() => textareaRef.current?.focus(), 50);
            return prefix;
          }
          return v.startsWith(prefix) ? v : prefix + v;
        });
        setTimeout(() => textareaRef.current?.focus(), 50);
        break;
      case 'model':
        // 业务副作用：跳转到设置页模型管理分区
        window.location.href = '/settings#model';
        break;
      case 'inspect':
        // 业务副作用：向全局广播巡检事件（由 Commander/App 监听）
        window.dispatchEvent(new CustomEvent('trigger-inspection', { detail: { source: 'sendbox' } }));
        alert('🔍 已触发本轮巡检（业务断言：CustomEvent trigger-inspection 已发出，Commander 会在下次巡检周期处理）');
        break;
      case 'voice':
      case 'realtime':
        // 业务副作用：弹出 toast 告知功能状态
        alert(`${key === 'voice' ? '🎤 语音输入' : '⚡ 实时对话'}：功能开发中，暂未接入。可在设置 → 数字伴侣 → 语音设置中预配置。`);
        break;
      default:
        console.warn('[SendBox] Unknown tool key:', key);
    }
  }, []);

  return (
    <div
      className="border-t px-4 py-3"
      style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
    >
      {/* 🚨 2026-04-17：伪证零容忍 — 隐藏 file input，由附件/图片按钮触发 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.txt,.md,.csv,.json"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (!file) return;
          // 业务副作用：textarea 追加文件名占位，用户可见
          setValue(v => `${v}\n[附件：${file.name} (${(file.size/1024).toFixed(1)}KB)]`);
          setTimeout(() => textareaRef.current?.focus(), 50);
          e.target.value = ''; // 允许重复选同一文件
        }}
      />
      <div
        className="rounded-xl overflow-hidden input-focus-ring transition-all"
        style={{
          border: '1px solid var(--input-border)',
          background: 'var(--input-bg)',
        }}
      >
        {/* 文本输入区 */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息，与OpenAGI对话..."
          disabled={isAIThinking}
          rows={1}
          className="w-full px-4 py-2.5 text-sm resize-none outline-none leading-relaxed"
          style={{
            background: 'transparent',
            color: 'var(--text-primary)',
            minHeight: 44,
            maxHeight: 15 * 22,
            overflowY: 'auto',
          }}
          aria-label="消息输入框"
          aria-multiline="true"
        />

        {/* 工具栏 */}
        <div
          className="flex items-center px-2.5 py-1.5 border-t gap-0.5"
          style={{ borderColor: 'var(--panel-border)' }}
        >
          {TOOLS.map(tool => (
            <button
              key={tool.key}
              className="w-8 h-8 rounded-md flex items-center justify-center text-base transition-all relative group"
              style={{ color: 'var(--text-secondary)', background: 'transparent' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--toolbar-hover)';
                (e.currentTarget as HTMLButtonElement).style.color = '#7c3aed';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
              }}
              onClick={() => handleToolClick(tool.key)}
              title={tool.label}
              aria-label={tool.label}
            >
              {tool.icon}
              {/* Tooltip */}
              <span
                className="absolute bottom-9 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-xs text-white whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10"
                style={{ background: '#1f2937' }}
              >
                {tool.label}
              </span>
            </button>
          ))}

          <div className="flex-1" />

          {/* 发送按钮 */}
          <button
            onClick={handleSend}
            disabled={!value.trim() || isAIThinking}
            className="px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
            }}
            onMouseEnter={e => {
              if (!e.currentTarget.disabled) {
                (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #6d28d9, #4f46e5)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(124,58,237,0.35)';
              }
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #7c3aed, #6366f1)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
            }}
            aria-label="发送消息"
          >
            {isAIThinking ? '思考中...' : '发送'}
            {!isAIThinking && <span aria-hidden="true">↑</span>}
          </button>
        </div>
      </div>

      {/* 提示文字 */}
      <p
        className="text-right text-xs mt-1"
        style={{ color: 'var(--text-muted)' }}
        aria-hidden="true"
      >
        按 Enter 发送，Shift+Enter 换行
      </p>
    </div>
  );
}
