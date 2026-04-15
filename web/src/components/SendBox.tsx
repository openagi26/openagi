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
  const { activeSessionId, isAIThinking, currentModel } = state;
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
      const resp = await sendMessage(sessionId, text, currentModel);
      dispatch({ type: 'SET_AI_THINKING', payload: false });
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
  }, [value, isAIThinking, activeSessionId, currentModel, dispatch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div
      className="border-t px-4 py-3"
      style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
    >
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
