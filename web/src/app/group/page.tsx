'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useStore, Message } from '@/lib/store';
import Sidebar from '@/components/Sidebar';

// AI团队成员配置
const TEAM_MEMBERS = [
  { id: 'ceo', name: 'CEO主核', model: 'claude-opus-4', role: '决策与协调', color: '#7c3aed', emoji: '👑', online: true },
  { id: 'auditor-a', name: '审计-外A', model: 'claude-sonnet-4', role: '质量审计', color: '#2563eb', emoji: '🔍', online: true },
  { id: 'auditor-b', name: '审计-外B', model: 'claude-haiku-4', role: '快速校验', color: '#059669', emoji: '⚡', online: true },
  { id: 'auditor-c', name: '审计-外C', model: 'claude-opus-4', role: '深度审计', color: '#d97706', emoji: '🧠', online: true },
  { id: 'executor', name: '执行代理', model: 'claude-sonnet-4', role: '任务执行', color: '#dc2626', emoji: '🚀', online: false },
];

type ChatMode = 'deep' | 'group';
type WorkMode = 'discuss' | 'work';

// 示例消息
const DEMO_MESSAGES: Message[] = [
  {
    id: '1', role: 'assistant', content: '陛下，我是CEO主核。团队已就位，请指示工作方向。',
    agentName: 'CEO主核', agentColor: '#7c3aed', model: 'claude-opus-4', timestamp: Date.now() - 60000,
  },
  {
    id: '2', role: 'assistant', content: '审计-外A就绪，将对CEO产出进行六维质量评分。',
    agentName: '审计-外A', agentColor: '#2563eb', model: 'claude-sonnet-4', timestamp: Date.now() - 50000,
  },
  {
    id: '3', role: 'assistant', content: '审计-外B就绪，快速校验通道开启。',
    agentName: '审计-外B', agentColor: '#059669', model: 'claude-haiku-4', timestamp: Date.now() - 40000,
  },
];

export default function GroupPage() {
  const { state, dispatch } = useStore();
  const { leftSidebarOpen } = state;

  const [chatMode, setChatMode] = useState<ChatMode>('group');
  const [workMode, setWorkMode] = useState<WorkMode>('discuss');
  const [messages, setMessages] = useState<Message[]>(DEMO_MESSAGES);
  const [input, setInput] = useState('');
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 检测@触发
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    const lastAt = val.lastIndexOf('@');
    if (lastAt >= 0 && lastAt === val.length - 1) {
      setShowMentionPicker(true);
      setMentionFilter('');
    } else if (lastAt >= 0 && showMentionPicker) {
      const after = val.slice(lastAt + 1);
      if (!after.includes(' ')) {
        setMentionFilter(after);
      } else {
        setShowMentionPicker(false);
      }
    } else {
      setShowMentionPicker(false);
    }
  };

  const insertMention = (name: string) => {
    const lastAt = input.lastIndexOf('@');
    const newVal = input.slice(0, lastAt) + `@${name} `;
    setInput(newVal);
    setShowMentionPicker(false);
    inputRef.current?.focus();
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // 模拟AI回复
    setTimeout(() => {
      const member = TEAM_MEMBERS[Math.floor(Math.random() * 3)];
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `收到陛下指令：「${text.slice(0, 40)}${text.length > 40 ? '...' : ''}」，正在处理中...`,
        agentName: member.name,
        agentColor: member.color,
        model: member.model,
        timestamp: Date.now(),
      }]);
    }, 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const filteredMembers = TEAM_MEMBERS.filter(m =>
    m.name.includes(mentionFilter) || m.role.includes(mentionFilter)
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* 左侧边栏 */}
      <Sidebar
        open={leftSidebarOpen}
        onToggle={() => dispatch({ type: 'TOGGLE_LEFT_SIDEBAR' })}
      />

      {/* 中间聊天区 */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--center-bg)' }}>
        {/* 群聊头部 */}
        <div
          className="px-4 py-2.5 flex items-center gap-3 border-b flex-shrink-0"
          style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
        >
          {/* 成员头像堆叠 */}
          <div className="flex items-center">
            {TEAM_MEMBERS.slice(0, 4).map((m, i) => (
              <div
                key={m.id}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white font-semibold border-2 border-white"
                style={{
                  background: m.color,
                  marginLeft: i === 0 ? 0 : -8,
                  zIndex: 4 - i,
                }}
                title={m.name}
              >
                {m.emoji}
              </div>
            ))}
          </div>

          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              OpenAGI 多核团队
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {TEAM_MEMBERS.filter(m => m.online).length} 位在线
            </div>
          </div>

          {/* 模式切换 */}
          <div className="ml-auto flex items-center gap-2">
            {/* 聊天模式 */}
            <div
              className="flex rounded-lg overflow-hidden border"
              style={{ borderColor: 'var(--card-border)' }}
              role="group"
              aria-label="聊天模式"
            >
              <ModeBtn active={chatMode === 'deep'} onClick={() => setChatMode('deep')} label="💬 深度聊天" />
              <ModeBtn active={chatMode === 'group'} onClick={() => setChatMode('group')} label="👥 AI群聊" />
            </div>

            {/* 工作模式 */}
            <div
              className="flex rounded-lg overflow-hidden border"
              style={{ borderColor: 'var(--card-border)' }}
              role="group"
              aria-label="工作模式"
            >
              <ModeBtn active={workMode === 'discuss'} onClick={() => setWorkMode('discuss')} label="讨论" />
              <ModeBtn active={workMode === 'work'} onClick={() => setWorkMode('work')} label="工作" />
            </div>
          </div>
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
          {messages.map(msg => {
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex justify-end animate-fade-in-up">
                  <div
                    className="max-w-[65%] px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed text-white"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            }
            return (
              <div key={msg.id} className="flex gap-3 animate-fade-in-up">
                {/* AI头像 */}
                <div
                  className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm"
                  style={{ background: msg.agentColor || '#7c3aed' }}
                >
                  {TEAM_MEMBERS.find(m => m.name === msg.agentName)?.emoji || '✦'}
                </div>
                <div className="max-w-[70%]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold" style={{ color: msg.agentColor }}>
                      {msg.agentName}
                    </span>
                    {msg.model && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.2)' }}
                      >
                        {msg.model}
                      </span>
                    )}
                  </div>
                  <div
                    className="px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm leading-relaxed"
                    style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区 */}
        <div
          className="border-t px-4 py-3 flex-shrink-0"
          style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
        >
          <div
            className="rounded-xl overflow-hidden input-focus-ring relative"
            style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)' }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="输入消息，用 @ 提及成员..."
              rows={2}
              className="w-full px-4 py-2.5 text-sm resize-none outline-none"
              style={{ background: 'transparent', color: 'var(--text-primary)' }}
              aria-label="群聊消息输入"
            />

            {/* @提及选择器 */}
            {showMentionPicker && (
              <div
                className="absolute bottom-full left-0 mb-1 w-56 rounded-xl shadow-xl overflow-hidden animate-fade-in-up z-50"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
                role="listbox"
                aria-label="选择要提及的成员"
              >
                <div className="px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                  提及成员
                </div>
                {filteredMembers.map(member => (
                  <button
                    key={member.id}
                    onClick={() => insertMention(member.name)}
                    className="w-full px-3 py-2 flex items-center gap-2.5 text-left transition-all"
                    style={{ color: 'var(--text-primary)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--session-hover)'}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                    role="option"
                    aria-selected={false}
                  >
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0"
                      style={{ background: member.color }}
                    >
                      {member.emoji}
                    </span>
                    <div>
                      <div className="text-xs font-medium">{member.name}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{member.role}</div>
                    </div>
                    {member.online && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400" />
                    )}
                  </button>
                ))}
              </div>
            )}

            <div
              className="flex items-center justify-between px-3 py-1.5 border-t"
              style={{ borderColor: 'var(--panel-border)' }}
            >
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                输入 @ 提及成员
              </span>
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="px-4 py-1 rounded-lg text-xs font-medium text-white transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}
                aria-label="发送消息"
              >
                发送
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧团队成员面板 */}
      <TeamPanel members={TEAM_MEMBERS} />
    </div>
  );
}

function ModeBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-xs transition-all"
      style={{
        background: active ? '#7c3aed' : 'var(--card-bg)',
        color: active ? '#fff' : 'var(--text-secondary)',
      }}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function TeamPanel({ members }: { members: typeof TEAM_MEMBERS }) {
  return (
    <aside
      className="flex-shrink-0 flex flex-col overflow-hidden"
      style={{
        width: 220,
        background: 'var(--panel-bg)',
        borderLeft: '1px solid var(--panel-border)',
      }}
      aria-label="团队成员"
    >
      <div
        className="px-4 py-3 border-b text-sm font-semibold"
        style={{ borderColor: 'var(--panel-border)', color: 'var(--text-primary)' }}
      >
        AI团队成员
      </div>
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        {members.map(m => (
          <div
            key={m.id}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all cursor-pointer"
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--session-hover)'}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
            role="listitem"
            aria-label={`${m.name} - ${m.role}`}
          >
            {/* 头像 */}
            <div
              className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm relative"
              style={{ background: m.color }}
            >
              {m.emoji}
              {/* 在线状态 */}
              <span
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
                style={{ background: m.online ? '#34d399' : '#9ca3af' }}
                aria-label={m.online ? '在线' : '离线'}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {m.name}
              </div>
              <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                {m.role}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div
        className="px-4 py-2 border-t text-xs"
        style={{ borderColor: 'var(--panel-border)', color: 'var(--text-muted)' }}
      >
        {members.filter(m => m.online).length}/{members.length} 在线
      </div>
    </aside>
  );
}
