'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useStore, Message } from '@/lib/store';
import Sidebar from '@/components/Sidebar';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8888';

// AI团队成员配置
const DEFAULT_MEMBERS = [
  { id: 'ceo', name: 'CEO主核', model: 'claude-opus-4', role: '决策与协调', color: '#7c3aed', emoji: '👑', online: true },
  { id: 'auditor-a', name: '审计-外A', model: 'claude-sonnet-4', role: '质量审计', color: '#2563eb', emoji: '🔍', online: true },
  { id: 'auditor-b', name: '审计-外B', model: 'claude-haiku-4', role: '快速校验', color: '#059669', emoji: '⚡', online: true },
  { id: 'auditor-c', name: '审计-外C', model: 'claude-opus-4', role: '深度审计', color: '#d97706', emoji: '🧠', online: true },
  { id: 'executor', name: '执行代理', model: 'claude-sonnet-4', role: '任务执行', color: '#dc2626', emoji: '🚀', online: false },
];

// 预设团队模板（借鉴 OpenTeams 的 Team Protocol 设计）
const TEAM_PRESETS = [
  {
    key: 'default',
    label: 'OpenAGI标配',
    icon: '🤖',
    desc: 'CEO + 三审计 + 执行',
    members: DEFAULT_MEMBERS,
    protocol: {
      leader: 'ceo',
      rules: ['CEO负责决策和任务分配', '审计核独立评分不互相影响', '执行代理接收CEO指令后执行', '所有成员消息控制在500字以内'],
      mentionRules: 'open', // open=自由@, leader_only=只有leader能@, structured=按定义
      maxRounds: 3,
    },
  },
  {
    key: 'fullstack',
    label: '全栈交付团队',
    icon: '💻',
    desc: '产品+前端+后端+QA+安全（学习OpenTeams fullstack_delivery_team协议）',
    members: [
      { id: 'pm', name: '产品经理', model: 'claude-opus-4', role: '需求分析与计划', color: '#7c3aed', emoji: '📋', online: true },
      { id: 'ux', name: 'UX设计师', model: 'claude-sonnet-4', role: 'UI/UX设计', color: '#db2777', emoji: '🎨', online: true },
      { id: 'fe', name: '前端工程师', model: 'claude-sonnet-4', role: 'React/Vue/UI', color: '#2563eb', emoji: '💻', online: true },
      { id: 'be', name: '后端工程师', model: 'claude-sonnet-4', role: 'API/数据库', color: '#059669', emoji: '⚙️', online: true },
      { id: 'qa', name: 'QA测试员', model: 'claude-haiku-4', role: '测试与质量', color: '#d97706', emoji: '🧪', online: true },
      { id: 'reviewer', name: '代码审查员', model: 'claude-opus-4', role: '代码审查', color: '#dc2626', emoji: '🔍', online: false },
    ],
    protocol: {
      leader: 'pm',
      rules: [
        '仅产品经理和UX设计师可直接在用户处@提及',
        '计划文件位于 .openteams/plan.md，所有成员可读，仅产品经理可编辑',
        '产品经理必须指派任务至具体成员，完成后成员通知产品经理更新状态',
        '所有代码产出保存在各成员工作区，避免在群聊中发送大段代码',
        '群组消息简洁扼要，控制在500字符以内',
      ],
      mentionRules: 'structured',
      maxRounds: 5,
    },
  },
  {
    key: 'marketing',
    label: '增长营销团队',
    icon: '📣',
    desc: '策略+文案+设计+数据+投放（学习OpenTeams growth_marketing_team协议）',
    members: [
      { id: 'strategist', name: '增长策略师', model: 'claude-opus-4', role: '增长策略', color: '#7c3aed', emoji: '🎯', online: true },
      { id: 'copy', name: '文案策划', model: 'claude-sonnet-4', role: '内容创作', color: '#db2777', emoji: '✍️', online: true },
      { id: 'design', name: '视觉设计师', model: 'claude-sonnet-4', role: '视觉/品牌', color: '#2563eb', emoji: '🎭', online: true },
      { id: 'data', name: '数据分析师', model: 'claude-sonnet-4', role: '数据洞察', color: '#059669', emoji: '📊', online: true },
      { id: 'ads', name: '投放专员', model: 'claude-haiku-4', role: '广告投放', color: '#d97706', emoji: '📱', online: true },
    ],
    protocol: {
      leader: 'strategist',
      rules: ['增长策略师制定整体方案并分配任务', '文案和设计产出需经策略师审核', '数据分析师每轮提供效果数据支持决策', '所有产出需符合品牌调性'],
      mentionRules: 'open',
      maxRounds: 4,
    },
  },
  {
    key: 'research',
    label: '研究创新团队',
    icon: '🔬',
    desc: '首席研究员+分析+写作+评审（学习OpenTeams research_innovation_team协议）',
    members: [
      { id: 'lead', name: '首席研究员', model: 'claude-opus-4', role: '课题设计', color: '#7c3aed', emoji: '🔭', online: true },
      { id: 'analyst', name: '数据科学家', model: 'claude-sonnet-4', role: '数据分析', color: '#2563eb', emoji: '📈', online: true },
      { id: 'writer', name: '技术作家', model: 'claude-sonnet-4', role: '报告撰写', color: '#059669', emoji: '📝', online: true },
      { id: 'reviewer', name: '同行评审', model: 'claude-opus-4', role: '质量把关', color: '#d97706', emoji: '⚖️', online: false },
    ],
    protocol: {
      leader: 'lead',
      rules: ['首席研究员定义研究方向和假设', '数据科学家负责实验设计和数据验证', '技术作家整理研究成果为可发布格式', '同行评审独立审查，确保学术严谨性'],
      mentionRules: 'structured',
      maxRounds: 5,
    },
  },
  {
    key: 'content',
    label: '内容工作室',
    icon: '🎬',
    desc: '主编+撰稿+编辑+SEO（学习OpenTeams content_studio_team协议）',
    members: [
      { id: 'editor', name: '主编', model: 'claude-opus-4', role: '选题与终审', color: '#7c3aed', emoji: '📰', online: true },
      { id: 'author', name: '撰稿人', model: 'claude-sonnet-4', role: '原创写作', color: '#2563eb', emoji: '✏️', online: true },
      { id: 'proofreader', name: '校对编辑', model: 'claude-haiku-4', role: '校对润色', color: '#059669', emoji: '📖', online: true },
      { id: 'seo', name: 'SEO专家', model: 'claude-haiku-4', role: '搜索优化', color: '#d97706', emoji: '🔎', online: true },
    ],
    protocol: {
      leader: 'editor',
      rules: ['主编选题后分配给撰稿人', '撰稿人完成初稿后@校对编辑和SEO专家', 'SEO专家在发布前优化标题和关键词', '最终发布由主编审核确认'],
      mentionRules: 'structured',
      maxRounds: 4,
    },
  },
  {
    key: 'bugfix',
    label: '快速修复团队',
    icon: '🔧',
    desc: '分诊+调试+修复+验证（学习OpenTeams rapid_bugfix_team协议）',
    members: [
      { id: 'triage', name: '分诊负责人', model: 'claude-opus-4', role: '问题分类', color: '#dc2626', emoji: '🚨', online: true },
      { id: 'debugger', name: '调试工程师', model: 'claude-sonnet-4', role: '根因分析', color: '#2563eb', emoji: '🔬', online: true },
      { id: 'fixer', name: '修复工程师', model: 'claude-sonnet-4', role: '代码修复', color: '#059669', emoji: '🛠️', online: true },
      { id: 'verifier', name: '验证工程师', model: 'claude-haiku-4', role: '回归测试', color: '#d97706', emoji: '✅', online: true },
    ],
    protocol: {
      leader: 'triage',
      rules: ['分诊负责人评估优先级并分配给调试工程师', '调试工程师定位根因后@修复工程师', '修复完成后自动触发验证工程师回归测试', '紧急bug跳过排队直接处理'],
      mentionRules: 'structured',
      maxRounds: 6,
    },
  },
  {
    key: 'architecture',
    label: '架构治理团队',
    icon: '🏗️',
    desc: '首席架构+领域专家+安全+性能（学习OpenTeams architecture_governance_team协议）',
    members: [
      { id: 'chief', name: '首席架构师', model: 'claude-opus-4', role: '架构决策', color: '#7c3aed', emoji: '🏛️', online: true },
      { id: 'domain', name: '领域专家', model: 'claude-sonnet-4', role: '领域建模', color: '#2563eb', emoji: '🧩', online: true },
      { id: 'security', name: '安全架构师', model: 'claude-sonnet-4', role: '安全设计', color: '#dc2626', emoji: '🛡️', online: true },
      { id: 'perf', name: '性能工程师', model: 'claude-haiku-4', role: '性能优化', color: '#059669', emoji: '⚡', online: true },
    ],
    protocol: {
      leader: 'chief',
      rules: ['首席架构师主持ADR（架构决策记录）', '重大变更需安全架构师和性能工程师双重审查', '领域专家验证业务逻辑一致性', 'ADR文件由首席架构师最终签发'],
      mentionRules: 'leader_only',
      maxRounds: 3,
    },
  },
  {
    key: 'product',
    label: '产品发现团队',
    icon: '🎯',
    desc: '产品+用研+原型+验证（学习OpenTeams product_discovery_team协议）',
    members: [
      { id: 'product', name: '产品负责人', model: 'claude-opus-4', role: '产品方向', color: '#7c3aed', emoji: '🧭', online: true },
      { id: 'ux_researcher', name: '用户研究员', model: 'claude-sonnet-4', role: '用户洞察', color: '#2563eb', emoji: '🔍', online: true },
      { id: 'prototype', name: '原型设计师', model: 'claude-sonnet-4', role: '快速原型', color: '#db2777', emoji: '✨', online: true },
      { id: 'validator', name: '验证分析师', model: 'claude-haiku-4', role: '数据验证', color: '#059669', emoji: '📋', online: true },
    ],
    protocol: {
      leader: 'product',
      rules: ['产品负责人定义假设和验证标准', '用户研究员设计实验并收集反馈', '原型设计师快速出可测试原型', '验证分析师用数据验证或否定假设'],
      mentionRules: 'open',
      maxRounds: 4,
    },
  },
];

type WorkMode = 'discuss' | 'work';
type ActivePreset = string;

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

function renderContentWithMentions(content: string, members: typeof DEFAULT_MEMBERS) {
  const parts = content.split(/(@[\u4e00-\u9fa5\w\-]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const name = part.slice(1);
      const member = members.find(m => m.name === name);
      if (member) {
        return (
          <span key={i} className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold"
            style={{ background: `${member.color}18`, color: member.color }}>
            {part}
          </span>
        );
      }
    }
    return <span key={i}>{part}</span>;
  });
}

export default function GroupPage() {
  const { state, dispatch } = useStore();
  const { leftSidebarOpen } = state;

  const [workMode, setWorkMode] = useState<WorkMode>('discuss');
  const [activePreset, setActivePreset] = useState<ActivePreset>('default');
  const [teamMembers, setTeamMembers] = useState(DEFAULT_MEMBERS);
  // 🚨 陛下 2026-04-17 亲定：伪证零容忍 — 页面打开不得展示假数据
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [showPresets, setShowPresets] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [tokenStats, setTokenStats] = useState({ in: 0, out: 0, rounds: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    const lastAt = val.lastIndexOf('@');
    if (lastAt >= 0 && lastAt === val.length - 1) {
      setShowMentionPicker(true);
      setMentionFilter('');
    } else if (lastAt >= 0 && showMentionPicker) {
      const after = val.slice(lastAt + 1);
      if (!after.includes(' ')) setMentionFilter(after);
      else setShowMentionPicker(false);
    } else {
      setShowMentionPicker(false);
    }
  };

  const insertMention = (name: string) => {
    const lastAt = input.lastIndexOf('@');
    setInput(input.slice(0, lastAt) + `@${name} `);
    setShowMentionPicker(false);
    inputRef.current?.focus();
  };

  const switchPreset = (presetKey: string) => {
    const preset = TEAM_PRESETS.find(p => p.key === presetKey);
    if (!preset) return;
    setActivePreset(presetKey);
    setTeamMembers(preset.members);
    setRoomId(null);
    setShowPresets(false);
    const sysMsg: Message = {
      id: Date.now().toString(), role: 'system' as const,
      content: `团队已切换为「${preset.label}」（${preset.desc}），共 ${preset.members.length} 位成员就绪。`,
      timestamp: Date.now(),
    };
    setMessages([sysMsg]);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    const userMsg: Message = {
      id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsSending(true);
    setSendError(null);

    try {
      let currentRoomId = roomId;
      if (!currentRoomId) {
        const createRes = await fetch(`${BASE_URL}/api/v1/chat/group/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'OpenAGI 多核团队',
            members: teamMembers.map(m => ({ name: m.name, model: m.model })),
          }),
        });
        const createData = await createRes.json();
        if (!createData.success) throw new Error(createData.message || '创建群聊失败');
        currentRoomId = createData.data.room_id;
        setRoomId(currentRoomId);
      }

      const sendRes = await fetch(`${BASE_URL}/api/v1/chat/group/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: currentRoomId, message: text, mentions: [] }),
      });
      const sendData = await sendRes.json();
      if (!sendData.success) throw new Error(sendData.message || '发送失败');

      const replies: { member: string; content: string }[] = sendData.data?.replies || [];
      const now = Date.now();
      const replyMsgs: Message[] = replies.map((r, i) => {
        const member = teamMembers.find(m => m.name === r.member);
        return {
          id: `${now}-${i}`, role: 'assistant' as const, content: r.content,
          agentName: r.member, agentColor: member?.color, model: member?.model, timestamp: now + i,
        };
      });
      if (replyMsgs.length > 0) setMessages(prev => [...prev, ...replyMsgs]);
      setTokenStats(prev => ({ in: prev.in + text.length * 2, out: prev.out + 100, rounds: prev.rounds + 1 }));
    } catch (err) {
      // 🚨 陛下 2026-04-17 亲定：伪证零容忍 — 严禁 demo fallback 吞错
      // 真错误必须真显示，才能定位是"后端没启"还是"LLM 超时"还是"网络问题"
      const msg = err instanceof Error ? err.message : '未知错误';
      setSendError(`后端调用失败：${msg}。请检查 make dev 是否已启动，Ollama 服务是否可达 http://localhost:11434`);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const filteredMembers = teamMembers.filter(m =>
    m.name.includes(mentionFilter) || m.role.includes(mentionFilter)
  );

  const onlineCount = teamMembers.filter(m => m.online).length;
  const currentPreset = TEAM_PRESETS.find(p => p.key === activePreset);

  return (
    <div className="flex h-full overflow-hidden">
      {/* 左侧边栏 */}
      <Sidebar open={leftSidebarOpen} onToggle={() => dispatch({ type: 'TOGGLE_LEFT_SIDEBAR' })} />

      {/* 中间聊天区 */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--center-bg)' }}>
        {/* 群聊头部 */}
        <div className="px-4 py-2.5 flex items-center gap-3 border-b flex-shrink-0"
          style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}>
          {/* 成员头像堆叠 */}
          <div className="flex items-center">
            {teamMembers.slice(0, 4).map((m, i) => (
              <div key={m.id} className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white font-semibold border-2 border-white"
                style={{ background: m.color, marginLeft: i === 0 ? 0 : -8, zIndex: 4 - i }} title={m.name}>
                {m.emoji}
              </div>
            ))}
            {teamMembers.length > 4 && (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 border-white"
                style={{ background: '#9ca3af', marginLeft: -8, color: '#fff', zIndex: 0 }}>
                +{teamMembers.length - 4}
              </div>
            )}
          </div>

          <div>
            <div className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
              {currentPreset?.icon} {currentPreset?.label || 'OpenAGI 多核团队'}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {onlineCount}/{teamMembers.length} 在线 · {workMode === 'discuss' ? '讨论模式' : '工作模式'}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* 预设团队 */}
            <div className="relative">
              <button onClick={() => setShowPresets(!showPresets)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                style={{
                  background: showPresets ? 'var(--session-active)' : 'var(--card-bg)',
                  color: showPresets ? '#7c3aed' : 'var(--text-secondary)',
                  borderColor: showPresets ? '#7c3aed30' : 'var(--card-border)',
                }}>
                📋 预设团队
              </button>
              {showPresets && (
                <div className="absolute top-full right-0 mt-1 w-52 rounded-xl shadow-xl overflow-hidden z-50 animate-fade-in-up"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                  {TEAM_PRESETS.map(preset => (
                    <button key={preset.key} onClick={() => switchPreset(preset.key)}
                      className="w-full px-4 py-2.5 flex items-center gap-2.5 text-left transition-all"
                      style={{
                        background: activePreset === preset.key ? 'var(--session-active)' : 'transparent',
                        color: 'var(--text-primary)',
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--session-hover)'}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background =
                        activePreset === preset.key ? 'var(--session-active)' : 'transparent'}>
                      <span style={{ fontSize: 18 }}>{preset.icon}</span>
                      <div>
                        <div className="text-xs font-semibold">{preset.label}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{preset.desc}</div>
                      </div>
                      {activePreset === preset.key && <span className="ml-auto text-xs" style={{ color: '#7c3aed' }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 工作模式切换 */}
            <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--card-border)' }} role="group" aria-label="工作模式">
              <ModeBtn active={workMode === 'discuss'} onClick={() => setWorkMode('discuss')} label="💬 讨论" />
              <ModeBtn active={workMode === 'work'} onClick={() => setWorkMode('work')} label="⚡ 工作" />
            </div>
          </div>
        </div>

        {/* 工作模式下的进度面板 */}
        {workMode === 'work' && (
          <div className="mx-4 mt-3 mb-1 px-4 py-3 rounded-xl flex-shrink-0"
            style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <div className="text-xs font-semibold mb-2" style={{ color: '#166534' }}>工作进度</div>
            <div className="flex flex-col gap-1.5">
              {teamMembers.slice(0, 3).map((m, i) => (
                <div key={m.id} className="flex items-center gap-2 text-xs">
                  <span style={{ fontSize: 14 }}>{i === 0 ? '⏳' : i === 1 ? '✅' : '🔵'}</span>
                  <span className="font-medium w-20 truncate" style={{ color: '#374151' }}>{m.name}</span>
                  <span className="flex-1 truncate" style={{ color: '#6b7280' }}>
                    {i === 0 ? '正在分析任务...' : i === 1 ? '质量审计完成' : '等待指令'}
                  </span>
                  <span style={{ color: '#059669', fontWeight: 500 }}>{i === 0 ? '2s' : i === 1 ? '完成' : '-'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
          {messages.map(msg => {
            if (msg.role === 'system') {
              return (
                <div key={msg.id} className="flex justify-center">
                  <div className="text-xs px-3 py-1.5 rounded-full"
                    style={{ background: 'var(--card-bg)', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}>
                    {msg.content}
                  </div>
                </div>
              );
            }
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex justify-end animate-fade-in-up">
                  <div className="max-w-[65%] px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed text-white"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
                    {msg.content}
                  </div>
                </div>
              );
            }
            return (
              <div key={msg.id} className="flex gap-3 animate-fade-in-up">
                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm"
                  style={{ background: msg.agentColor || '#7c3aed' }}>
                  {teamMembers.find(m => m.name === msg.agentName)?.emoji || '✦'}
                </div>
                <div className="max-w-[70%]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold" style={{ color: msg.agentColor }}>{msg.agentName}</span>
                    {msg.model && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.2)' }}>
                        {msg.model}
                      </span>
                    )}
                  </div>
                  <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm leading-relaxed"
                    style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }}>
                    {renderContentWithMentions(msg.content, teamMembers)}
                  </div>
                </div>
              </div>
            );
          })}
          {isSending && (
            <div className="flex items-center gap-2 px-4">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#7c3aed' }} />
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#7c3aed', animationDelay: '0.2s' }} />
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#7c3aed', animationDelay: '0.4s' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>AI 正在回复...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区 */}
        <div className="border-t px-4 py-3 flex-shrink-0"
          style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}>
          <div className="rounded-xl overflow-hidden input-focus-ring relative"
            style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)' }}>
            <textarea
              ref={inputRef} value={input} onChange={handleInputChange} onKeyDown={handleKeyDown}
              placeholder="输入消息，用 @ 提及成员... (Enter 发送，Shift+Enter 换行)"
              rows={2} className="w-full px-4 py-2.5 text-sm resize-none outline-none"
              style={{ background: 'transparent', color: 'var(--text-primary)' }}
              aria-label="群聊消息输入" />

            {/* @提及选择器 */}
            {showMentionPicker && (
              <div className="absolute bottom-full left-0 mb-1 w-56 rounded-xl shadow-xl overflow-hidden animate-fade-in-up z-50"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
                role="listbox" aria-label="选择要提及的成员">
                <div className="px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>提及成员</div>
                {filteredMembers.map(member => (
                  <button key={member.id} onClick={() => insertMention(member.name)}
                    className="w-full px-3 py-2 flex items-center gap-2.5 text-left transition-all"
                    style={{ color: 'var(--text-primary)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--session-hover)'}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                    role="option" aria-selected={false}>
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0"
                      style={{ background: member.color }}>{member.emoji}</span>
                    <div>
                      <div className="text-xs font-medium">{member.name}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{member.role}</div>
                    </div>
                    {member.online && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400" />}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between px-3 py-1.5 border-t"
              style={{ borderColor: 'var(--panel-border)' }}>
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: sendError ? '#ef4444' : 'var(--text-muted)' }}>
                  {sendError ? `错误：${sendError}` : '@ 提及 · Enter 发送'}
                </span>
                {tokenStats.rounds > 0 && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    轮次 {tokenStats.rounds}
                  </span>
                )}
              </div>
              <button onClick={handleSend} disabled={!input.trim() || isSending}
                className="px-4 py-1 rounded-lg text-xs font-medium text-white transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}
                aria-label="发送消息">
                {isSending ? '发送中...' : '发送'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧团队成员面板 */}
      <TeamPanel
        members={teamMembers}
        tokenStats={tokenStats}
        workMode={workMode}
        onAddMember={() => {}}
      />
    </div>
  );
}

function ModeBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="px-3 py-1.5 text-xs transition-all"
      style={{
        background: active ? '#7c3aed' : 'var(--card-bg)',
        color: active ? '#fff' : 'var(--text-secondary)',
      }}
      aria-pressed={active}>{label}</button>
  );
}

function TeamPanel({
  members,
  tokenStats,
  workMode,
  onAddMember,
}: {
  members: typeof DEFAULT_MEMBERS;
  tokenStats: { in: number; out: number; rounds: number };
  workMode: WorkMode;
  onAddMember: () => void;
}) {
  const onlineCount = members.filter(m => m.online).length;

  return (
    <aside className="flex-shrink-0 flex flex-col overflow-hidden"
      style={{ width: 230, background: 'var(--panel-bg)', borderLeft: '1px solid var(--panel-border)' }}
      aria-label="团队成员">
      <div className="px-4 py-3 border-b text-sm font-semibold flex items-center justify-between"
        style={{ borderColor: 'var(--panel-border)', color: 'var(--text-primary)' }}>
        <span>AI团队成员</span>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#ecfdf5', color: '#059669' }}>
          {onlineCount}/{members.length} 在线
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        {members.map(m => (
          <div key={m.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all cursor-pointer"
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--session-hover)'}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
            role="listitem" aria-label={`${m.name} - ${m.role}`}>
            <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm relative"
              style={{ background: m.color }}>
              {m.emoji}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
                style={{ background: m.online ? '#34d399' : '#9ca3af' }}
                aria-label={m.online ? '在线' : '离线'} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{m.name}</div>
              <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{m.role}</div>
            </div>
            <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
              style={{ background: m.online ? '#34d399' : 'transparent' }} />
          </div>
        ))}
      </div>

      {/* 添加成员 */}
      <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--panel-border)' }}>
        <button onClick={onAddMember}
          className="w-full py-1.5 text-xs rounded-lg transition-all"
          style={{ border: '1px dashed var(--card-border)', color: 'var(--text-muted)' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#7c3aed';
            (e.currentTarget as HTMLButtonElement).style.color = '#7c3aed';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--card-border)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
          }}>
          + 添加AI成员
        </button>
        <div className="flex gap-1.5 mt-1.5">
          <button className="flex-1 text-xs py-1 rounded-md transition-all"
            style={{ background: 'var(--center-bg)', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}>
            162专家
          </button>
          <button className="flex-1 text-xs py-1 rounded-md transition-all"
            style={{ background: 'var(--center-bg)', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}>
            技能市场
          </button>
        </div>
      </div>

      {/* 快捷设置说明 */}
      <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--panel-border)' }}>
        <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>快捷设置</div>
        <div className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          · 点击成员名 → 独立配置<br />
          · AI互@最多 3 轮（可调）<br />
          · 未被@成员自动旁听
        </div>
      </div>

      {/* 本次讨论统计 */}
      {tokenStats.rounds > 0 && (
        <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--panel-border)' }}>
          <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>本次讨论统计</div>
          <div className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            💬 消息总数：{tokenStats.rounds * 3}条<br />
            🔄 AI互@轮次：{tokenStats.rounds}/3<br />
            📊 Token：入{tokenStats.in} / 出{tokenStats.out}<br />
            ⏱ 模式：{workMode === 'discuss' ? '讨论' : '工作'}
          </div>
        </div>
      )}
    </aside>
  );
}
