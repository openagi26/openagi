'use client';

import React, { useState, useCallback } from 'react';
import { Message } from '@/lib/store';
import { ThinkingDots } from './RadarAnimation';

interface ChatBubbleProps {
  message: Message;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

// ======== 纯函数 Markdown → HTML 转换（无外部依赖）========

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 简易 Markdown 渲染：
 * - 代码块（```lang\n...\n```）→ <pre><code>
 * - 行内代码（`code`）→ <code>
 * - 标题 # ## ###
 * - 粗体 **text** / __text__
 * - 斜体 *text* / _text_
 * - 删除线 ~~text~~
 * - 无序列表 - / * / +
 * - 有序列表 1.
 * - 分割线 ---
 * - 换行
 */
function markdownToHtml(raw: string): string {
  // 1. 提取代码块，防止内部内容被其他规则处理
  const codeBlocks: string[] = [];
  let text = raw.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    const escaped = escapeHtml(code.trimEnd());
    const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : '';
    codeBlocks.push(
      `<pre style="background:rgba(0,0,0,0.35);border-radius:8px;padding:12px 14px;overflow-x:auto;margin:8px 0;font-size:12px;line-height:1.6"><code${langAttr} style="font-family:ui-monospace,monospace;color:#e2e8f0">${escaped}</code></pre>`
    );
    return `\x00CODE${idx}\x00`;
  });

  // 2. 逐行处理
  const lines = text.split('\n');
  const result: string[] = [];
  let listBuffer: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  function flushList() {
    if (listBuffer.length === 0) return;
    const tag = listType === 'ol' ? 'ol' : 'ul';
    const style =
      listType === 'ol'
        ? 'list-style:decimal;padding-left:1.4em;margin:4px 0'
        : 'list-style:disc;padding-left:1.4em;margin:4px 0';
    result.push(
      `<${tag} style="${style}">${listBuffer
        .map(li => `<li style="margin:2px 0">${li}</li>`)
        .join('')}</${tag}>`
    );
    listBuffer = [];
    listType = null;
  }

  for (const rawLine of lines) {
    const line = rawLine;

    // 分割线
    if (/^---+$/.test(line.trim())) {
      flushList();
      result.push('<hr style="border:none;border-top:1px solid rgba(255,255,255,0.12);margin:8px 0"/>');
      continue;
    }

    // 标题
    const hMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (hMatch) {
      flushList();
      const level = hMatch[1].length;
      const sizes = ['1.2em', '1.05em', '0.95em'];
      const content = inlineMarkdown(hMatch[2]);
      result.push(
        `<div style="font-weight:700;font-size:${sizes[level - 1]};margin:10px 0 4px;color:var(--text-primary)">${content}</div>`
      );
      continue;
    }

    // 无序列表
    const ulMatch = line.match(/^[\s]*[-*+]\s+(.+)/);
    if (ulMatch) {
      if (listType === 'ol') flushList();
      listType = 'ul';
      listBuffer.push(inlineMarkdown(ulMatch[1]));
      continue;
    }

    // 有序列表
    const olMatch = line.match(/^[\s]*\d+\.\s+(.+)/);
    if (olMatch) {
      if (listType === 'ul') flushList();
      listType = 'ol';
      listBuffer.push(inlineMarkdown(olMatch[1]));
      continue;
    }

    flushList();

    // 空行
    if (line.trim() === '') {
      result.push('<br/>');
      continue;
    }

    result.push(`<span>${inlineMarkdown(line)}</span><br/>`);
  }

  flushList();

  // 3. 还原代码块占位
  let html = result.join('');
  codeBlocks.forEach((block, idx) => {
    html = html.replace(`\x00CODE${idx}\x00`, block);
  });

  return html;
}

function inlineMarkdown(text: string): string {
  // 行内代码（先处理避免被其他规则干扰）
  const inlineCodes: string[] = [];
  let t = text.replace(/`([^`]+)`/g, (_, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(
      `<code style="background:rgba(124,58,237,0.18);border-radius:4px;padding:1px 5px;font-family:ui-monospace,monospace;font-size:0.88em;color:#c4b5fd">${escapeHtml(code)}</code>`
    );
    return `\x00IC${idx}\x00`;
  });

  // 粗体
  t = t.replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a, b) =>
    `<strong style="font-weight:700">${escapeHtml(a ?? b)}</strong>`
  );

  // 斜体
  t = t.replace(/\*([^*]+)\*|_([^_]+)_/g, (_, a, b) =>
    `<em style="font-style:italic">${escapeHtml(a ?? b)}</em>`
  );

  // 删除线
  t = t.replace(/~~([^~]+)~~/g, (_, a) =>
    `<del style="text-decoration:line-through;opacity:0.6">${escapeHtml(a)}</del>`
  );

  // 还原行内代码
  inlineCodes.forEach((code, idx) => {
    t = t.replace(`\x00IC${idx}\x00`, code);
  });

  // 对普通文本做 html 转义（已经转义的标签不再处理）
  // 注意：此处只转义未被包裹在标签内的裸文本
  // 简单做法：转义不在 <...> 内的 & < > 字符
  // 由于我们前面已经对 escapeHtml 过的内容进行了标签包裹，这里仅转义剩余裸文本
  t = t.replace(/(^|>)([^<]*?)(<|$)/g, (_, pre, content, post) => {
    return pre + escapeHtml(content) + post;
  });

  return t;
}

// ======== 复制按钮 ========

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select + execCommand
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="text-xs flex items-center gap-1 transition-all hover:opacity-80 select-none"
      style={{ color: copied ? '#34d399' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
      title={copied ? '已复制' : '复制内容'}
      aria-label={copied ? '已复制' : '复制消息内容'}
    >
      {copied ? '✓ 已复制' : '⎘ 复制'}
    </button>
  );
}

// ======== 主组件 ========

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const [auditOpen, setAuditOpen] = useState(false);

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
          <div className="flex justify-end items-center gap-2 mt-1">
            <CopyButton text={message.content} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {formatTime(message.timestamp)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // AI 消息
  const htmlContent = message.thinking ? null : markdownToHtml(message.content ?? '');

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
            <div
              className="markdown-body"
              dangerouslySetInnerHTML={{ __html: htmlContent ?? '' }}
              style={{ lineHeight: 1.65 }}
            />
          )}
        </div>

        {/* 元信息栏：时间 + tokens + 模型 + 复制 + 审计 */}
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {formatTime(message.timestamp)}
          </span>
          {message.tokens != null && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}
            >
              {message.tokens} tokens
            </span>
          )}
          {message.model && !message.agentName && (
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
          {!message.thinking && <CopyButton text={message.content ?? ''} />}
          {message.audit && (
            <button
              onClick={() => setAuditOpen(o => !o)}
              className="text-xs flex items-center gap-1 transition-opacity hover:opacity-80"
              style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              审计 {auditOpen ? '▲' : '▼'}
            </button>
          )}
        </div>

        {/* 审计展开区 */}
        {message.audit && auditOpen && (
          <div
            className="mt-1 px-3 py-2 rounded-xl text-xs leading-relaxed"
            style={{
              background: 'rgba(124,58,237,0.06)',
              border: '1px solid rgba(124,58,237,0.15)',
              color: 'var(--text-muted)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {message.audit}
          </div>
        )}
      </div>
    </div>
  );
}
