'use client';

import React from 'react';
import { Message } from '@/lib/store';
import { ThinkingDots } from './RadarAnimation';

interface ChatBubbleProps {
  message: Message;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in-up" role="article" aria-label="用户消息">
        <div className="max-w-[70%] md:max-w-[60%]">
          <div
            className="px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed text-white"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}
          >
            {message.content}
          </div>
          <div className="text-right text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {formatTime(message.timestamp)}
          </div>
        </div>
      </div>
    );
  }

  // AI消息
  return (
    <div className="flex gap-3 animate-fade-in-up" role="article" aria-label={`${message.agentName || 'AI'}的消息`}>
      {/* AI头像 */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
        style={{ background: message.agentColor || 'linear-gradient(135deg, #7c3aed, #2563eb)' }}
        aria-hidden="true"
      >
        {message.agentName ? message.agentName[0] : '✦'}
      </div>

      <div className="flex-1 max-w-[75%]">
        {/* 名称+模型标签 */}
        {message.agentName && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold" style={{ color: message.agentColor || '#7c3aed' }}>
              {message.agentName}
            </span>
            {message.model && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full"
                style={{
                  background: 'rgba(124,58,237,0.1)',
                  color: '#7c3aed',
                  border: '1px solid rgba(124,58,237,0.2)',
                }}
              >
                {message.model}
              </span>
            )}
          </div>
        )}

        {/* 消息气泡 */}
        <div
          className="px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm leading-relaxed"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            color: 'var(--text-primary)',
          }}
        >
          {message.thinking ? (
            <ThinkingDots />
          ) : (
            <div className="whitespace-pre-wrap">{message.content}</div>
          )}
        </div>

        <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
}
