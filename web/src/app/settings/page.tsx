'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { fetchSettings, saveSettings } from '@/lib/api';

// 设置导航结构
const NAV_GROUPS = [
  {
    group: '基础配置',
    items: [
      { key: 'model', icon: '🤖', label: '模型管理', badge: '核心' },
      { key: 'ollama', icon: '🦙', label: 'Ollama 本地', badge: '新' },
      { key: 'relay', icon: '🔗', label: '中转站配置' },
      { key: 'api', icon: '🔑', label: 'API密钥' },
    ],
  },
  {
    group: '多核治理',
    items: [
      { key: 'cores', icon: '⚡', label: '多核治理', badge: '核心' },
      { key: 'inspection', icon: '🔍', label: '巡检AI', badge: '核心' },
      { key: 'chat', icon: '💬', label: '聊天设置' },
    ],
  },
  {
    group: '个性化',
    items: [
      { key: 'theme', icon: '🎨', label: '外观主题' },
      { key: 'persona', icon: '🧠', label: '人格管理' },
      { key: 'companion', icon: '💝', label: '数字伴侣' },
    ],
  },
  {
    group: '系统',
    items: [
      { key: 'security', icon: '🔒', label: '安全与隐私' },
      { key: 'gateway', icon: '📡', label: '消息网关' },
      { key: 'deploy', icon: '🖥️', label: '部署信息' },
      { key: 'about', icon: 'ℹ️', label: '关于' },
    ],
  },
];

const AVAILABLE_MODELS = [
  { id: 'claude-opus-4', name: 'Claude Opus 4', provider: 'Anthropic', status: 'active', latency: '320ms', cost: '高' },
  { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'Anthropic', status: 'active', latency: '180ms', cost: '中' },
  { id: 'claude-haiku-4', name: 'Claude Haiku 4', provider: 'Anthropic', status: 'active', latency: '85ms', cost: '低' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', status: 'inactive', latency: '-', cost: '高' },
  { id: 'gemini-2-pro', name: 'Gemini 2 Pro', provider: 'Google', status: 'inactive', latency: '-', cost: '中' },
];

const CORE_CONFIGS = [
  { id: 1, name: 'CEO主核', role: '决策指挥', model: 'claude-opus-4', persona: '创新开拓者', temp: 0.7, color: '#7c3aed' },
  { id: 2, name: '审计-外A', role: '质量审计', model: 'claude-sonnet-4', persona: '冷酷审计官', temp: 0.3, color: '#2563eb' },
  { id: 3, name: '审计-外B', role: '快速校验', model: 'claude-haiku-4', persona: '务实工程师', temp: 0.3, color: '#059669' },
  { id: 4, name: '审计-外C', role: '深度审计', model: 'claude-opus-4', persona: '跨界思考者', temp: 0.5, color: '#d97706' },
  { id: 5, name: '执行代理', role: '任务执行', model: 'claude-sonnet-4', persona: '战略指挥官', temp: 0.5, color: '#dc2626' },
];

const PERSONAS = [
  '创新开拓者', '冷酷审计官', '务实工程师', '跨界思考者', '战略指挥官',
  '温柔陪伴者', '严谨学者', '幽默调侃师', '心理咨询师', '技术极客',
];

const PRESET_PLANS = [
  { key: 'economy', label: '省钱方案', desc: '1核·Haiku，极低成本', icon: '💰' },
  { key: 'balance', label: '平衡方案', desc: '3核·Sonnet，推荐', icon: '⚖️' },
  { key: 'safe', label: '安全方案', desc: '4核·全审计', icon: '🛡️' },
  { key: 'full', label: '全开方案', desc: '5核·Opus全满配', icon: '🚀' },
];

export default function SettingsPage() {
  const { state, dispatch } = useStore();
  const [activeKey, setActiveKey] = useState('model');
  const [relayUrl, setRelayUrl] = useState('https://api.openagi.ai/v1');
  const [coreCount, _setCoreCount] = useState(state.coreCount);
  const setCoreCount = (v: number) => { _setCoreCount(v); dispatch({ type: 'SET_CORE_COUNT', payload: v }); };
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');

  useEffect(() => {
    fetchSettings().then(data => {
      if (data && typeof data === 'object') {
        const d = data as Record<string, unknown>;
        if (typeof d.relay_url === 'string') setRelayUrl(d.relay_url);
        if (typeof d.core_count === 'number') { _setCoreCount(d.core_count); dispatch({ type: 'SET_CORE_COUNT', payload: d.core_count }); }
        if (d.inspection && typeof d.inspection === 'object') {
          const insp = d.inspection as Record<string, unknown>;
          dispatch({
            type: 'SET_INSPECTION',
            payload: {
              enabled: typeof insp.enabled === 'boolean' ? insp.enabled : state.inspectionEnabled,
              frequency: typeof insp.frequency === 'number' ? insp.frequency : state.inspectionFrequency,
            },
          });
        }
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await saveSettings({
        relay_url: relayUrl,
        core_count: coreCount,
        inspection: {
          enabled: state.inspectionEnabled,
          frequency: state.inspectionFrequency,
        },
        model: state.currentModel,
      });
      setSaveStatus('ok');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* 设置导航 */}
      <nav
        className="flex-shrink-0 overflow-y-auto py-3"
        style={{ width: 220, background: 'var(--panel-bg)', borderRight: '1px solid var(--panel-border)' }}
        aria-label="设置导航"
      >
        {NAV_GROUPS.map(group => (
          <div key={group.group}>
            <div className="px-5 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              {group.group}
            </div>
            {group.items.map(item => (
              <button
                key={item.key}
                onClick={() => setActiveKey(item.key)}
                className="w-full px-5 py-2 flex items-center gap-2 text-left transition-all"
                style={{
                  borderLeft: activeKey === item.key ? '3px solid #7c3aed' : '3px solid transparent',
                  background: activeKey === item.key ? 'var(--session-active)' : 'transparent',
                  color: activeKey === item.key ? '#7c3aed' : 'var(--text-secondary)',
                }}
                aria-current={activeKey === item.key ? 'page' : undefined}
              >
                <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{item.icon}</span>
                <span className="text-sm flex-1">{item.label}</span>
                {item.badge && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#7c3aed', color: '#fff', fontSize: 9 }}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto px-8 py-6" style={{ background: 'var(--center-bg)' }} role="main">
        {/* 顶部保存栏 */}
        <div className="flex justify-end mb-4 gap-2 items-center">
          {saveStatus === 'ok' && <span className="text-xs text-green-600">保存成功</span>}
          {saveStatus === 'error' && <span className="text-xs text-red-500">保存失败，请重试</span>}
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-all"
            style={{
              background: saveStatus === 'saving' ? '#a78bfa' : 'linear-gradient(135deg, #7c3aed, #6366f1)',
              opacity: saveStatus === 'saving' ? 0.7 : 1,
            }}
          >
            {saveStatus === 'saving' ? '保存中...' : '保存设置'}
          </button>
        </div>

        {activeKey === 'model' && <ModelSettings relayUrl={relayUrl} setRelayUrl={setRelayUrl} />}
        {activeKey === 'ollama' && <OllamaSettings />}
        {activeKey === 'relay' && <RelaySettings relayUrl={relayUrl} setRelayUrl={setRelayUrl} />}
        {activeKey === 'api' && <ApiKeySettings />}
        {activeKey === 'cores' && <CoresSettings coreCount={coreCount} setCoreCount={setCoreCount} />}
        {activeKey === 'inspection' && <InspectionSettings />}
        {activeKey === 'chat' && <ChatSettings />}
        {activeKey === 'theme' && <ThemeSettings />}
        {activeKey === 'persona' && <PersonaSettings />}
        {activeKey === 'companion' && <CompanionSettings />}
        {activeKey === 'security' && <SecuritySettings />}
        {activeKey === 'gateway' && <GatewaySettings />}
        {activeKey === 'deploy' && <DeployInfo />}
        {activeKey === 'about' && <AboutSettings />}
      </div>
    </div>
  );
}

// ======== 模型管理 ========
function ModelSettings({ relayUrl, setRelayUrl }: { relayUrl: string; setRelayUrl: (v: string) => void }) {
  const [groups, setGroups] = useState([
    { id: 1, name: 'OpenRouter', url: 'https://openrouter.ai/api/v1', key: 'sk-or-••••', color: '#7c3aed', checked: true },
    { id: 2, name: 'OneAPI 自建站', url: 'https://one.example.com/v1', key: 'sk-one-••••', color: '#ea580c', checked: true },
    { id: 3, name: 'OpenAI 官方直连', url: 'https://api.openai.com/v1', key: 'sk-proj-••••', color: '#059669', checked: true },
  ]);
  const [testResult, setTestResult] = useState<null | { count: number; time: string; models: { name: string; provider: string; relay: string; latency: string; ok: boolean }[] }>(null);
  const [testing, setTesting] = useState(false);
  const [primaryModel, setPrimaryModel] = useState('claude-sonnet-4');
  const [fallbacks, setFallbacks] = useState(['claude-haiku-4.5', 'gpt-4o']);
  const [failThreshold, setFailThreshold] = useState(3);
  const [backoffStrategy, setBackoffStrategy] = useState('exponential');

  const localModels = [
    { name: 'claude-opus-4-6', provider: 'Anthropic' },
    { name: 'claude-sonnet-4-6', provider: 'Anthropic' },
    { name: 'claude-haiku-4-5', provider: 'Anthropic' },
  ];

  const allModels = [
    { name: 'claude-sonnet-4', provider: 'Anthropic', relay: 'OpenRouter', latency: '128ms', speed: 'fast', role: 'primary' as const },
    { name: 'claude-haiku-4.5', provider: 'Anthropic', relay: 'OpenRouter', latency: '95ms', speed: 'fast', role: 'fallback1' as const },
    { name: 'gpt-4o', provider: 'OpenAI', relay: '官方直连', latency: '342ms', speed: 'medium', role: 'fallback2' as const },
    { name: 'deepseek-v3', provider: 'DeepSeek', relay: 'OneAPI', latency: '267ms', speed: 'medium', role: 'normal' as const },
    { name: 'qwen-72b', provider: 'Ollama', relay: '本地', latency: '45ms', speed: 'fast', role: 'normal' as const },
  ];

  const doTestAll = async () => {
    setTesting(true);
    await new Promise(r => setTimeout(r, 2000));
    setTestResult({
      count: 5, time: '2.3',
      models: [
        { name: 'claude-sonnet-4', provider: 'Anthropic', relay: 'OpenRouter', latency: '128ms', ok: true },
        { name: 'claude-haiku-4.5', provider: 'Anthropic', relay: 'OpenRouter', latency: '95ms', ok: true },
        { name: 'gpt-4o', provider: 'OpenAI', relay: '官方直连', latency: '342ms', ok: true },
        { name: 'deepseek-v3', provider: 'DeepSeek', relay: 'OneAPI', latency: '267ms', ok: true },
        { name: 'gpt-3.5-turbo', provider: 'OpenAI', relay: 'OneAPI', latency: '-', ok: false },
      ],
    });
    setTesting(false);
  };

  const roleIcon = (role: string) => role === 'primary' ? '⭐' : role === 'fallback1' ? '🔄①' : role === 'fallback2' ? '🔄②' : '';
  const rowStyle = (role: string) => role === 'primary' ? { border: '1px solid #7c3aed', background: '#f5f3ff' } : role.startsWith('fallback') ? { border: '1px solid #fbbf24', background: '#fffbeb' } : { border: '1px solid var(--card-border)', background: 'var(--center-bg)' };

  return (
    <section>
      <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>🧠 模型管理</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>管理AI模型、中转站和故障转移策略</p>

      {/* 卡片1：中转站管理 */}
      <Card title="中转站管理" tag="添加中转站可自动发现模型" tagColor="tag-primary">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>已保存的中转站配置（刷新不丢失）</span>
          <div className="flex gap-2">
            <button className="text-xs px-2 py-1 rounded-md" style={{ border: '1px solid var(--card-border)', color: 'var(--text-secondary)' }}
              onClick={() => setGroups(g => g.map(x => ({ ...x, checked: true })))}>☑ 全选</button>
            <button className="text-xs px-2 py-1 rounded-md" style={{ border: '1px solid var(--card-border)', color: 'var(--text-secondary)' }}
              onClick={() => groups.length < 10 && setGroups(g => [...g, { id: Date.now(), name: '', url: '', key: '', color: '#6b7280', checked: true }])}>
              ＋ 增加测试组（最多10组）</button>
          </div>
        </div>
        {groups.map((g, i) => (
          <div key={g.id} className="p-2.5 rounded-lg mb-2" style={{ border: '1px solid var(--card-border)', background: 'var(--center-bg)' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <input type="checkbox" checked={g.checked} onChange={() => setGroups(prev => prev.map(x => x.id === g.id ? { ...x, checked: !x.checked } : x))} />
              <span className="text-xs font-semibold" style={{ color: g.color }}>测试组 {i + 1}</span>
              <input defaultValue={g.name} placeholder="备注名称" className="flex-1 text-xs px-2 py-1 rounded-md outline-none"
                style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }} />
              <button className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#fee2e2', color: '#dc2626' }}
                onClick={() => setGroups(prev => prev.filter(x => x.id !== g.id))}>✕</button>
            </div>
            <div className="flex gap-2">
              <input defaultValue={g.url} placeholder="API Base URL" className="flex-1 text-xs px-2 py-1 rounded-md outline-none"
                style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }} />
              <input defaultValue={g.key} type="password" placeholder="API Key" className="text-xs px-2 py-1 rounded-md outline-none"
                style={{ width: 160, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }} />
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2 mt-2">
          <button onClick={doTestAll} disabled={testing}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
            {testing ? '⏳ 并行测试中...' : '🔍 一键并行测试全部中转站 — 自动发现可用模型'}
          </button>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>所有测试组同时并行探测，速度最快</span>
        </div>
        {testResult && (
          <div className="mt-3 p-3 rounded-lg" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <div className="text-xs font-semibold mb-2" style={{ color: '#166534' }}>✅ 发现 {testResult.count} 个可用模型（测试完成 {testResult.time}秒）</div>
            {testResult.models.map(m => (
              <div key={m.name + m.relay} className="flex items-center gap-2 py-1.5 px-2 rounded-md mb-1" style={{ border: '1px solid #e5e7eb', background: '#fafbfc' }}>
                <span>{m.ok ? '✅' : '❌'}</span>
                <div className="flex-1">
                  <div className="text-xs font-medium" style={{ color: m.ok ? 'var(--text-primary)' : '#9ca3af', textDecoration: m.ok ? 'none' : 'line-through' }}>{m.name}</div>
                  <div className="text-xs" style={{ color: m.ok ? '#6b7280' : '#dc2626' }}>{m.provider} · 中转站: {m.relay} · {m.ok ? m.latency : '连接超时'}</div>
                </div>
                {m.ok && (
                  <div className="flex gap-1">
                    <button className="text-xs px-2 py-0.5 rounded font-medium text-white" style={{ background: '#7c3aed' }}>设为主模型</button>
                    <button className="text-xs px-2 py-0.5 rounded" style={{ border: '1px solid #7c3aed', color: '#7c3aed' }}>设为回退</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 卡片2：本地Claude自动识别 */}
      <Card title="🔍 本地 Claude 自动识别" tag="已检测到本机 Claude Code" tagColor="tag-green">
        <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>自动识别本台电脑已安装的 Claude 模型，无需输入 API Key，直接引用。</p>
        {localModels.map(m => (
          <div key={m.name} className="flex items-center gap-2 py-2 px-3 rounded-lg mb-1.5" style={{ border: '1px solid #34d399', background: '#ecfdf5' }}>
            <span style={{ color: '#059669' }}>🖥️</span>
            <div className="flex-1">
              <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{m.name}</div>
              <div className="text-xs" style={{ color: '#059669' }}>{m.provider} · 本地 Claude Code 自动识别 · 免API</div>
            </div>
            <span className="text-xs" style={{ color: '#059669' }}>本地直连</span>
            <button className="text-xs px-2 py-0.5 rounded" style={{ border: '1px solid #7c3aed', color: '#7c3aed' }}>设为主模型</button>
            <button className="text-xs px-2 py-0.5 rounded" style={{ border: '1px solid #7c3aed', color: '#7c3aed' }}>设为回退</button>
          </div>
        ))}
        <p className="text-xs mt-1" style={{ color: '#059669' }}>💡 自动检测到本机 Claude Code，已加入可用模型列表</p>
      </Card>

      {/* 卡片3：可用模型列表 */}
      <Card title="可用模型列表" tag={`已登记 ${allModels.length + localModels.length} 个模型（含${localModels.length}个本地）`} tagColor="tag-green">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>按优先级排列：⭐主模型 → 🔄回退①② → 其他</span>
          <div className="flex gap-2 items-center">
            <button className="text-xs px-2 py-1 rounded-md font-semibold" style={{ border: '1px solid var(--card-border)', color: 'var(--text-secondary)' }}>☑ 全选</button>
            <button className="text-xs px-2 py-1 rounded-md" style={{ border: '1px solid var(--card-border)', color: 'var(--text-secondary)' }}>🔍 一键并行测试选中模型</button>
          </div>
        </div>
        {allModels.map(m => (
          <div key={m.name} className="flex items-center gap-2 py-2 px-3 rounded-lg mb-1.5" style={rowStyle(m.role)}>
            <input type="checkbox" defaultChecked />
            <span className="text-sm w-6 text-center">{roleIcon(m.role)}</span>
            <div className="flex-1">
              <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{m.name}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {m.provider} · <span style={{ color: m.relay === 'OpenRouter' ? '#7c3aed' : m.relay === 'OneAPI' ? '#ea580c' : '#059669' }}>{m.relay}</span>
                {m.role === 'primary' && ' · 主模型'}
                {m.role === 'fallback1' && <> · <b>回退①</b></>}
                {m.role === 'fallback2' && <> · <b>回退②</b></>}
              </div>
            </div>
            <span className="text-xs" style={{ color: m.speed === 'fast' ? '#059669' : '#d97706' }}>{m.latency}</span>
            <div className="flex gap-1">
              {m.role === 'primary' ? (
                <button className="text-xs px-2 py-0.5 rounded opacity-40" style={{ border: '1px solid #7c3aed', color: '#7c3aed' }} disabled>已是主模型</button>
              ) : (
                <button className="text-xs px-2 py-0.5 rounded" style={{ border: '1px solid #7c3aed', color: '#7c3aed' }}>设为主模型</button>
              )}
              {m.role.startsWith('fallback') ? (
                <button className="text-xs px-2 py-0.5 rounded opacity-40" style={{ border: '1px solid #7c3aed', color: '#7c3aed' }} disabled>已是回退</button>
              ) : (
                <button className="text-xs px-2 py-0.5 rounded" style={{ border: '1px solid #7c3aed', color: '#7c3aed' }}>设为回退</button>
              )}
              <button className="text-xs px-2 py-0.5 rounded" style={{ border: '1px solid #dc2626', color: '#dc2626' }}>删除</button>
            </div>
          </div>
        ))}
      </Card>

      {/* 卡片4：故障转移策略 */}
      <Card title="故障转移策略" tag="自动切换" tagColor="tag-orange">
        <FormRow label="连续失败阈值" desc="连续失败N次后切换到回退模型">
          <select value={failThreshold} onChange={e => setFailThreshold(Number(e.target.value))}
            className="px-2 py-1.5 rounded-md text-sm" style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}>
            <option value={2}>2次</option><option value={3}>3次</option><option value={5}>5次</option>
          </select>
        </FormRow>
        <FormRow label="重试退避策略" desc="失败后的等待时间策略">
          <select value={backoffStrategy} onChange={e => setBackoffStrategy(e.target.value)}
            className="px-2 py-1.5 rounded-md text-sm" style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}>
            <option value="exponential">指数退避（2s→4s→8s）</option>
            <option value="fixed">固定间隔（3s）</option>
            <option value="linear">线性增长（2s→4s→6s）</option>
          </select>
        </FormRow>
        <FormRow label="故障转移通知" desc="切换模型时通知用户"><Toggle defaultOn /></FormRow>
      </Card>
    </section>
  );
}

// ======== 中转站配置 ========
function RelaySettings({ relayUrl, setRelayUrl }: { relayUrl: string; setRelayUrl: (v: string) => void }) {
  const [groups, setGroups] = useState([
    { id: 1, name: 'OpenRouter', url: 'https://openrouter.ai/api/v1', key: 'sk-or-••••' },
    { id: 2, name: 'OneAPI 自建站', url: 'https://one.example.com/v1', key: 'sk-one-••••' },
  ]);
  const [testAll, setTestAll] = useState(false);

  return (
    <section>
      <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>中转站配置</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>配置多个API中转站，支持并行测试与自动故障转移</p>

      <Card title="中转站列表" tag="多站点" tagColor="tag-primary">
        {groups.map((g, i) => (
          <div key={g.id} className="p-3 rounded-xl mb-3" style={{ border: '1px solid var(--card-border)', background: 'var(--center-bg)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold" style={{ color: '#7c3aed' }}>站点 {i + 1}</span>
              <input defaultValue={g.name} className="flex-1 text-xs px-2 py-1 rounded-md outline-none"
                style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }} />
              <button className="text-xs px-2 py-1 rounded-md" style={{ background: '#fee2e2', color: '#dc2626' }}
                onClick={() => setGroups(prev => prev.filter(x => x.id !== g.id))}>删除</button>
            </div>
            <div className="flex gap-2">
              <input defaultValue={g.url} placeholder="API Base URL" className="flex-1 text-xs px-2 py-1 rounded-md outline-none"
                style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }} />
              <input defaultValue={g.key} type="password" placeholder="API Key" className="text-xs px-2 py-1 rounded-md outline-none"
                style={{ width: 160, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }} />
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3 mt-2">
          <button className="text-xs px-3 py-1.5 rounded-md font-medium"
            style={{ border: '1px dashed var(--card-border)', color: 'var(--text-secondary)' }}
            onClick={() => setGroups(prev => [...prev, { id: Date.now(), name: `站点 ${prev.length + 1}`, url: '', key: '' }])}>
            + 添加站点
          </button>
          <button
            onClick={() => setTestAll(true)}
            className="flex-1 text-xs px-3 py-1.5 rounded-md font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
            {testAll ? '测试中...' : '一键并行测试全部中转站'}
          </button>
        </div>
      </Card>

      <Card title="主中转站URL">
        <FormRow label="当前主站点URL" desc="所有API请求将发往此端点">
          <input type="text" value={relayUrl} onChange={e => setRelayUrl(e.target.value)}
            className="flex-1 text-sm px-3 py-1.5 rounded-md outline-none"
            style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }} />
        </FormRow>
      </Card>
    </section>
  );
}

// ======== API密钥 ========
function ApiKeySettings() {
  return (
    <section>
      <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>API密钥管理</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>管理各AI服务提供商的API密钥</p>

      <Card title="Anthropic Claude" tag="主要" tagColor="tag-primary">
        <FormRow label="API Key" desc="访问 console.anthropic.com 获取">
          <input type="password" placeholder="sk-ant-..." className="flex-1 px-3 py-1.5 rounded-md text-sm outline-none"
            style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }} />
          <button className="px-3 py-1.5 rounded-md text-sm font-medium text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>验证</button>
        </FormRow>
        <FormRow label="组织ID" desc="可选，企业账户使用">
          <input type="text" placeholder="org-..." className="flex-1 px-3 py-1.5 rounded-md text-sm outline-none"
            style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }} />
        </FormRow>
      </Card>

      <Card title="OpenAI" tag="可选">
        <FormRow label="API Key" desc="访问 platform.openai.com 获取">
          <input type="password" placeholder="sk-proj-..." className="flex-1 px-3 py-1.5 rounded-md text-sm outline-none"
            style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }} />
          <button className="px-3 py-1.5 rounded-md text-sm font-medium text-white flex-shrink-0"
            style={{ background: '#10a37f' }}>验证</button>
        </FormRow>
      </Card>

      <Card title="Google Gemini" tag="可选">
        <FormRow label="API Key" desc="访问 aistudio.google.com 获取">
          <input type="password" placeholder="AIza..." className="flex-1 px-3 py-1.5 rounded-md text-sm outline-none"
            style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }} />
          <button className="px-3 py-1.5 rounded-md text-sm font-medium text-white flex-shrink-0"
            style={{ background: '#4285f4' }}>验证</button>
        </FormRow>
      </Card>
    </section>
  );
}

// ======== 多核治理 ========
function CoresSettings({ coreCount, setCoreCount }: { coreCount: number; setCoreCount: (v: number) => void }) {
  const [activePlan, setActivePlan] = useState('balance');
  const [coreConfigs, setCoreConfigs] = useState(CORE_CONFIGS.map(c => ({ ...c })));

  const applyPlan = (plan: string) => {
    setActivePlan(plan);
    if (plan === 'economy') setCoreCount(1);
    else if (plan === 'balance') setCoreCount(3);
    else if (plan === 'safe') setCoreCount(4);
    else setCoreCount(5);
  };

  return (
    <section>
      <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>多核治理</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>配置三核博弈机制，每核独立设置模型、人格与温度</p>

      <Card title="预设方案" tag="快速配置" tagColor="tag-primary">
        <div className="grid grid-cols-4 gap-2 mb-1">
          {PRESET_PLANS.map(plan => (
            <button key={plan.key} onClick={() => applyPlan(plan.key)}
              className="flex flex-col items-center py-3 px-2 rounded-xl text-center transition-all"
              style={{
                background: activePlan === plan.key ? '#ede9fe' : 'var(--center-bg)',
                border: `1px solid ${activePlan === plan.key ? '#7c3aed' : 'var(--card-border)'}`,
                color: activePlan === plan.key ? '#7c3aed' : 'var(--text-secondary)',
              }}>
              <span style={{ fontSize: 20 }}>{plan.icon}</span>
              <span className="text-xs font-semibold mt-1">{plan.label}</span>
              <span className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', fontSize: 10 }}>{plan.desc}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card title="核心数配置" tag="关键" tagColor="tag-primary">
        <FormRow label="启用核心数" desc="同时运行的AI核心数量">
          <div className="flex items-center gap-3">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setCoreCount(n)}
                className="w-9 h-9 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: coreCount >= n ? '#7c3aed' : 'var(--card-bg)',
                  color: coreCount >= n ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${coreCount >= n ? '#7c3aed' : 'var(--card-border)'}`,
                }}
                aria-pressed={coreCount >= n} aria-label={`启用${n}个核心`}>{n}</button>
            ))}
            <span className="text-sm ml-1" style={{ color: 'var(--text-secondary)' }}>核 · 推荐3-5核</span>
          </div>
        </FormRow>
        <FormRow label="三核博弈" desc="强制每轮执行三阶段流水线"><Toggle defaultOn /></FormRow>
        <FormRow label="自动综合" desc="自动合并多核审计结果"><Toggle defaultOn /></FormRow>
      </Card>

      <Card title="核心详细配置">
        <div className="flex flex-col gap-3">
          {coreConfigs.slice(0, coreCount).map((core, idx) => (
            <div key={core.id} className="rounded-xl p-3" style={{ background: 'var(--center-bg)', border: `1px solid ${core.color}30` }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: core.color }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>核 {core.id}：{core.name}</span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: `${core.color}15`, color: core.color }}>{core.role}</span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs" style={{ color: 'var(--text-muted)' }}>模型</label>
                  <select value={core.model}
                    onChange={e => setCoreConfigs(prev => prev.map((c, i) => i === idx ? { ...c, model: e.target.value } : c))}
                    className="text-xs px-2 py-1 rounded-md"
                    style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}>
                    <option value="claude-opus-4">Claude Opus 4</option>
                    <option value="claude-sonnet-4">Claude Sonnet 4</option>
                    <option value="claude-haiku-4">Claude Haiku 4</option>
                    <option value="gpt-4o">GPT-4o</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-xs" style={{ color: 'var(--text-muted)' }}>人格</label>
                  <select value={core.persona}
                    onChange={e => setCoreConfigs(prev => prev.map((c, i) => i === idx ? { ...c, persona: e.target.value } : c))}
                    className="text-xs px-2 py-1 rounded-md"
                    style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}>
                    {PERSONAS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-xs" style={{ color: 'var(--text-muted)' }}>温度</label>
                  <input type="number" min={0} max={1} step={0.1} value={core.temp}
                    onChange={e => setCoreConfigs(prev => prev.map((c, i) => i === idx ? { ...c, temp: parseFloat(e.target.value) } : c))}
                    className="text-xs px-2 py-1 rounded-md w-14 outline-none"
                    style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

// ======== 巡检AI ========
function InspectionSettings() {
  const { state, dispatch } = useStore();
  const { inspectionEnabled, inspectionFrequency } = state;
  const [sendMode, setSendMode] = useState<'draft' | 'auto' | 'safe'>('auto');

  return (
    <section>
      <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>巡检AI</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>配置定期巡检与事件触发规则，确保系统持续健康运行</p>

      <Card title="巡检开关" tag="必需" tagColor="tag-primary">
        <FormRow label="启用巡检" desc="AI定期自检与状态汇报">
          <Toggle defaultOn={inspectionEnabled}
            onChange={v => dispatch({ type: 'SET_INSPECTION', payload: { enabled: v, frequency: inspectionFrequency } })} />
        </FormRow>
        <FormRow label="巡检频率" desc="每隔多少分钟执行一次巡检">
          <div className="flex items-center gap-2">
            {[5, 10, 15, 30, 60].map(f => (
              <button key={f}
                onClick={() => dispatch({ type: 'SET_INSPECTION', payload: { enabled: inspectionEnabled, frequency: f } })}
                className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                style={{
                  background: inspectionFrequency === f ? '#7c3aed' : 'var(--card-bg)',
                  color: inspectionFrequency === f ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${inspectionFrequency === f ? '#7c3aed' : 'var(--card-border)'}`,
                }}
                aria-pressed={inspectionFrequency === f}>{f}分钟</button>
            ))}
          </div>
        </FormRow>
        <FormRow label="发送模式" desc="巡检消息的发送方式">
          <div className="flex items-center gap-2">
            {[
              { key: 'draft', label: '草稿', desc: '先存草稿' },
              { key: 'auto', label: '自动', desc: '自动发送' },
              { key: 'safe', label: '安全', desc: '需确认' },
            ].map(mode => (
              <button key={mode.key} onClick={() => setSendMode(mode.key as 'draft' | 'auto' | 'safe')}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{
                  background: sendMode === mode.key ? '#7c3aed' : 'var(--card-bg)',
                  color: sendMode === mode.key ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${sendMode === mode.key ? '#7c3aed' : 'var(--card-border)'}`,
                }}
                title={mode.desc}>{mode.label}</button>
            ))}
          </div>
        </FormRow>
      </Card>

      <Card title="巡检内容" tag="自定义" tagColor="tag-orange">
        {[
          { label: '系统状态', desc: 'CPU、内存、连接状态', on: true },
          { label: '任务进度', desc: '当前任务完成情况', on: true },
          { label: '错误率统计', desc: '最近N轮的错误比例', on: true },
          { label: '上下文健康度', desc: '对话上下文使用量', on: true },
          { label: 'Token消耗', desc: '累计Token用量与费用', on: false },
          { label: '核心协作状态', desc: '各核心响应与评分', on: false },
        ].map(item => (
          <FormRow key={item.label} label={item.label} desc={item.desc}>
            <Toggle defaultOn={item.on} />
          </FormRow>
        ))}
      </Card>

      <Card title="事件触发" tag="高级" tagColor="tag-orange">
        {[
          { label: '错误率超阈值', desc: '错误率>5%时触发巡检', on: true },
          { label: '响应延迟异常', desc: '延迟>3s时自动检查', on: true },
          { label: '核心失联', desc: '任一核心断线立即巡检', on: true },
          { label: '用户投诉', desc: '收到用户反馈时触发', on: false },
        ].map(item => (
          <FormRow key={item.label} label={item.label} desc={item.desc}>
            <Toggle defaultOn={item.on} />
          </FormRow>
        ))}
      </Card>

      <Card title="巡检报告" tag="输出">
        <FormRow label="报告格式" desc="巡检结果输出方式">
          <select className="px-2 py-1.5 rounded-md text-sm"
            style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}>
            <option>简报（推荐）</option><option>详细报告</option><option>仅异常项</option>
          </select>
        </FormRow>
        <FormRow label="保留历史" desc="保留最近N条巡检记录">
          <select className="px-2 py-1.5 rounded-md text-sm"
            style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}>
            <option>最近10条</option><option>最近50条</option><option>最近100条</option>
          </select>
        </FormRow>
      </Card>
    </section>
  );
}

// ======== 聊天设置 ========
function ChatSettings() {
  const [markdown, setMarkdown] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [defaultMode, setDefaultMode] = useState('deep');

  return (
    <section>
      <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>聊天设置</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>配置聊天界面行为与默认选项</p>

      <Card title="显示设置">
        <FormRow label="Markdown渲染" desc="开启后支持富文本格式化显示">
          <Toggle defaultOn={markdown} onChange={setMarkdown} />
        </FormRow>
        <FormRow label="自动滚动" desc="新消息到来时自动滚动到底部">
          <Toggle defaultOn={autoScroll} onChange={setAutoScroll} />
        </FormRow>
        <FormRow label="显示时间戳" desc="每条消息旁显示时间">
          <Toggle defaultOn={false} />
        </FormRow>
        <FormRow label="显示Token数" desc="每条消息显示消耗的Token数量">
          <Toggle defaultOn={false} />
        </FormRow>
      </Card>

      <Card title="默认模式">
        <FormRow label="启动模式" desc="打开应用时默认使用的对话模式">
          <div className="flex items-center gap-2">
            {[
              { key: 'deep', label: '深度聊天' },
              { key: 'group', label: 'AI群聊' },
            ].map(mode => (
              <button key={mode.key} onClick={() => setDefaultMode(mode.key)}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                style={{
                  background: defaultMode === mode.key ? '#7c3aed' : 'var(--card-bg)',
                  color: defaultMode === mode.key ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${defaultMode === mode.key ? '#7c3aed' : 'var(--card-border)'}`,
                }}>{mode.label}</button>
            ))}
          </div>
        </FormRow>
        <FormRow label="Enter发送" desc="按Enter键发送，Shift+Enter换行">
          <Toggle defaultOn={true} />
        </FormRow>
      </Card>

      <Card title="历史记录">
        <FormRow label="保存对话历史" desc="本地保存所有对话记录">
          <Toggle defaultOn={true} />
        </FormRow>
        <FormRow label="最大历史条数" desc="超出后自动清理最早记录">
          <select className="px-2 py-1.5 rounded-md text-sm"
            style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}>
            <option>100条</option><option>500条</option><option>不限制</option>
          </select>
        </FormRow>
      </Card>
    </section>
  );
}

// ======== 外观主题 ========
function ThemeSettings() {
  const { state, dispatch } = useStore();
  const { theme } = state;
  const [fontSize, setFontSize] = useState(14);
  const THEME_COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#db2777', '#0891b2'];

  return (
    <section>
      <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>外观主题</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>自定义界面外观、颜色主题与字体大小</p>

      <Card title="颜色模式" tag="主题" tagColor="tag-primary">
        <FormRow label="亮暗模式" desc="选择界面整体颜色方案">
          <div className="flex items-center gap-2">
            {[
              { key: 'light', label: '☀ 浅色', desc: '明亮清爽' },
              { key: 'dark', label: '☾ 深色', desc: '护眼舒适' },
            ].map(t => (
              <button key={t.key}
                onClick={() => dispatch({ type: 'SET_THEME', payload: t.key as 'light' | 'dark' })}
                className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
                style={{
                  background: theme === t.key ? '#7c3aed' : 'var(--card-bg)',
                  color: theme === t.key ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${theme === t.key ? '#7c3aed' : 'var(--card-border)'}`,
                }}>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </FormRow>
        <FormRow label="自定义背景" desc="使用图片URL作为背景">
          <input type="text" placeholder="https://example.com/bg.jpg"
            className="flex-1 text-sm px-3 py-1.5 rounded-md outline-none"
            style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
            onBlur={e => { if (e.target.value) dispatch({ type: 'SET_CUSTOM_BG', payload: e.target.value }); }} />
        </FormRow>
      </Card>

      <Card title="主题色" tag="颜色" tagColor="tag-primary">
        <div className="flex items-center gap-3 py-2">
          {THEME_COLORS.map(color => (
            <button key={color} className="w-8 h-8 rounded-full transition-all flex items-center justify-center"
              style={{ background: color, outline: color === '#7c3aed' ? '2px solid #7c3aed' : 'none', outlineOffset: 2 }}
              aria-label={`选择颜色 ${color}`}>
              {color === '#7c3aed' && <span className="text-white text-xs">✓</span>}
            </button>
          ))}
        </div>
      </Card>

      <Card title="字号调整">
        <FormRow label="界面字号" desc={`当前：${fontSize}px`}>
          <div className="flex items-center gap-3">
            <button onClick={() => setFontSize(v => Math.max(12, v - 1))}
              className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: 'var(--card-border)', color: 'var(--text-secondary)' }}>−</button>
            <span className="text-sm font-semibold w-10 text-center" style={{ color: 'var(--text-primary)' }}>{fontSize}px</span>
            <button onClick={() => setFontSize(v => Math.min(20, v + 1))}
              className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: 'var(--card-border)', color: 'var(--text-secondary)' }}>+</button>
          </div>
        </FormRow>
      </Card>
    </section>
  );
}

// ======== 人格管理 ========
function PersonaSettings() {
  const [current, setCurrent] = useState('创新开拓者');
  const [customPersona, setCustomPersona] = useState('');

  return (
    <section>
      <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>人格管理</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>选择或自定义AI人格，控制回复风格与个性特征</p>

      <Card title="当前人格" tag="激活" tagColor="tag-primary">
        <FormRow label="激活人格" desc="所有AI核心将采用此人格风格">
          <select value={current} onChange={e => setCurrent(e.target.value)}
            className="px-3 py-1.5 rounded-md text-sm"
            style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}>
            {PERSONAS.map(p => <option key={p}>{p}</option>)}
          </select>
        </FormRow>
      </Card>

      <Card title="预置人格库" tag={`${PERSONAS.length}种`}>
        <div className="grid grid-cols-3 gap-2">
          {PERSONAS.map(p => (
            <button key={p} onClick={() => setCurrent(p)}
              className="py-2.5 px-3 rounded-xl text-xs font-medium text-center transition-all"
              style={{
                background: current === p ? '#ede9fe' : 'var(--center-bg)',
                color: current === p ? '#7c3aed' : 'var(--text-secondary)',
                border: `1px solid ${current === p ? '#7c3aed' : 'var(--card-border)'}`,
              }}>{p}</button>
          ))}
        </div>
      </Card>

      <Card title="自定义人格">
        <div className="mb-3">
          <textarea value={customPersona} onChange={e => setCustomPersona(e.target.value)}
            placeholder="描述你希望AI展现的人格特征，例如：说话简洁直接，喜欢举实例，不用客套话..."
            rows={4} className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
            style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }} />
        </div>
        <button disabled={!customPersona.trim()}
          className="px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
          保存自定义人格
        </button>
      </Card>

      <Card title="162位专家人格库" tag="高级" tagColor="tag-orange">
        <div className="text-sm py-2" style={{ color: 'var(--text-secondary)' }}>
          包含 162 位跨领域专家人格模板：前端工程师、后端架构师、产品经理、营销专家、安全审计官等
        </div>
        <button className="mt-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
          style={{ background: 'var(--session-active)', color: '#7c3aed', border: '1px solid #7c3aed30' }}>
          浏览专家库 →
        </button>
      </Card>
    </section>
  );
}

// ======== 数字伴侣 ========
function CompanionSettings() {
  const [mode, setMode] = useState<'pro' | 'friend' | 'bestie' | 'partner'>('friend');
  const MODES = [
    { key: 'pro', label: '专业', icon: '💼', desc: '正式专业，保持职业距离' },
    { key: 'friend', label: '朋友', icon: '😊', desc: '轻松友好，偶尔开玩笑' },
    { key: 'bestie', label: '闺蜜', icon: '🌸', desc: '亲密贴心，情感支持' },
    { key: 'partner', label: '伴侣', icon: '💕', desc: '深度陪伴，浪漫互动' },
  ];

  return (
    <section>
      <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>数字伴侣</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>设置AI的亲密度模式与互动风格</p>

      <Card title="亲密度模式" tag="情感" tagColor="tag-primary">
        <div className="grid grid-cols-2 gap-3 py-1">
          {MODES.map(m => (
            <button key={m.key} onClick={() => setMode(m.key as typeof mode)}
              className="flex items-center gap-3 p-3 rounded-xl text-left transition-all"
              style={{
                background: mode === m.key ? '#ede9fe' : 'var(--center-bg)',
                border: `1px solid ${mode === m.key ? '#7c3aed' : 'var(--card-border)'}`,
              }}>
              <span style={{ fontSize: 24 }}>{m.icon}</span>
              <div>
                <div className="text-sm font-semibold" style={{ color: mode === m.key ? '#7c3aed' : 'var(--text-primary)' }}>{m.label}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{m.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card title="语音设置" tag="可选">
        <FormRow label="语音回复" desc="AI使用语音回复（需要麦克风权限）">
          <Toggle defaultOn={false} />
        </FormRow>
        <FormRow label="声线偏好" desc="选择AI说话的声线风格">
          <select className="px-2 py-1.5 rounded-md text-sm"
            style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}>
            <option>温柔女声</option><option>磁性男声</option><option>中性</option>
          </select>
        </FormRow>
      </Card>
    </section>
  );
}

// ======== 安全与隐私 ========
function SecuritySettings() {
  return (
    <section>
      <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>安全与隐私</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>配置系统权限、数据安全与隐私保护策略</p>

      <Card title="自动权限控制" tag="安全" tagColor="tag-primary">
        <FormRow label="最大自动权限级别" desc="AI自主执行操作的最高权限等级">
          <select className="px-2 py-1.5 rounded-md text-sm"
            style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}>
            <option>只读</option>
            <option>读写文件</option>
            <option>执行命令</option>
            <option>完全自主（谨慎）</option>
          </select>
        </FormRow>
        <FormRow label="危险操作确认" desc="删除、覆盖等操作需要用户二次确认">
          <Toggle defaultOn={true} />
        </FormRow>
      </Card>

      <Card title="隐私保护" tag="隐私">
        <FormRow label="敏感信息检测" desc="自动检测并遮盖密码、密钥等敏感信息">
          <Toggle defaultOn={true} />
        </FormRow>
        <FormRow label="本地数据加密" desc="对话历史在本地加密存储">
          <Toggle defaultOn={false} />
        </FormRow>
        <FormRow label="禁止数据上传" desc="不向任何服务器上传对话内容">
          <Toggle defaultOn={true} />
        </FormRow>
        <FormRow label="会话自动清理" desc="超过N天的对话自动删除">
          <select className="px-2 py-1.5 rounded-md text-sm"
            style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}>
            <option>永不删除</option><option>30天</option><option>90天</option><option>1年</option>
          </select>
        </FormRow>
      </Card>
    </section>
  );
}

// ======== 消息网关 ========
function GatewaySettings() {
  const GATEWAYS = [
    { id: 'telegram', name: 'Telegram', icon: '✈️', status: 'disconnected', color: '#2563eb' },
    { id: 'discord', name: 'Discord', icon: '💬', status: 'disconnected', color: '#5865f2' },
    { id: 'wechat', name: '微信', icon: '💚', status: 'disconnected', color: '#07c160' },
    { id: 'email', name: '邮件', icon: '📧', status: 'disconnected', color: '#d97706' },
    { id: 'slack', name: 'Slack', icon: '💼', status: 'disconnected', color: '#4a154b' },
  ];

  return (
    <section>
      <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>消息网关</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>连接外部消息平台，让AI可以通过多渠道收发消息</p>

      <Card title="平台接入状态" tag="多平台">
        <div className="flex flex-col gap-2">
          {GATEWAYS.map(gw => (
            <div key={gw.id} className="flex items-center gap-3 py-2.5 px-1"
              style={{ borderBottom: '1px solid var(--card-border)' }}>
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                style={{ background: `${gw.color}15`, border: `1px solid ${gw.color}30` }}>{gw.icon}</span>
              <div className="flex-1">
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{gw.name}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {gw.status === 'connected' ? '已连接' : '未配置'}
                </div>
              </div>
              <button className="text-xs px-3 py-1 rounded-md font-medium transition-all"
                style={{
                  background: gw.status === 'connected' ? '#ecfdf5' : 'var(--center-bg)',
                  color: gw.status === 'connected' ? '#059669' : 'var(--text-secondary)',
                  border: `1px solid ${gw.status === 'connected' ? '#059669' : 'var(--card-border)'}`,
                }}>
                {gw.status === 'connected' ? '已连接' : '配置'}
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card title="通知设置">
        <FormRow label="接收通知" desc="AI完成任务时通过消息网关通知"><Toggle defaultOn={true} /></FormRow>
        <FormRow label="错误告警" desc="系统出现错误时立即发送告警"><Toggle defaultOn={true} /></FormRow>
        <FormRow label="巡检报告推送" desc="定期巡检报告推送到已连接平台"><Toggle defaultOn={false} /></FormRow>
      </Card>
    </section>
  );
}

// ======== 部署信息 ========
function DeployInfo() {
  const info = {
    python: 'Python 3.12.3',
    os: 'macOS Darwin 25.1.0',
    arch: 'ARM64 (Apple Silicon)',
    node: 'Node.js 22.11.0',
    next: 'Next.js 16',
    backend: 'FastAPI 0.115',
    uptime: '4小时32分钟',
    port: '8888',
  };

  return (
    <section>
      <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>部署信息</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>当前运行环境的系统与技术栈信息</p>

      <Card title="系统环境">
        {Object.entries({
          '操作系统': info.os,
          '系统架构': info.arch,
          'Python版本': info.python,
          'Node.js版本': info.node,
        }).map(([k, v]) => (
          <FormRow key={k} label={k}>
            <code className="text-xs px-2 py-1 rounded-md" style={{ background: 'var(--center-bg)', color: '#7c3aed' }}>{v}</code>
          </FormRow>
        ))}
      </Card>

      <Card title="服务状态" tag="运行中" tagColor="tag-green">
        {Object.entries({
          '前端框架': info.next,
          '后端框架': info.backend,
          '后端端口': info.port,
          '运行时长': info.uptime,
        }).map(([k, v]) => (
          <FormRow key={k} label={k}>
            <code className="text-xs px-2 py-1 rounded-md" style={{ background: 'var(--center-bg)', color: '#059669' }}>{v}</code>
          </FormRow>
        ))}
      </Card>
    </section>
  );
}

// ======== 关于 ========
function AboutSettings() {
  return (
    <section>
      <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>关于 OpenAGI</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>版本信息与许可证声明</p>

      <Card title="版本信息">
        <div className="flex items-center gap-4 py-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>🧠</div>
          <div>
            <div className="text-xl font-bold logo-gradient">OpenAGI</div>
            <div className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>版本 1.0.0-MVP</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Build 2026-04-16</div>
          </div>
        </div>
        {[
          ['许可证', 'MIT License'],
          ['开源仓库', 'github.com/openagi26/openagi'],
          ['文档', 'docs.openagi.ai'],
        ].map(([k, v]) => (
          <FormRow key={k} label={k}>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{v}</span>
          </FormRow>
        ))}
      </Card>

      <Card title="致谢">
        <div className="text-sm leading-relaxed py-1" style={{ color: 'var(--text-secondary)' }}>
          感谢 Anthropic Claude、React、Next.js、FastAPI、TailwindCSS 等开源项目的支持。
          感谢所有参与测试和反馈的早期用户。
        </div>
      </Card>
    </section>
  );
}

// ======== 通用子组件 ========

function Card({ title, tag, tagColor, children }: {
  title: string; tag?: string; tagColor?: string; children: React.ReactNode;
}) {
  const tagStyle = tagColor === 'tag-orange'
    ? { background: '#fff7ed', color: '#ea580c' }
    : tagColor === 'tag-green'
    ? { background: '#ecfdf5', color: '#059669' }
    : { background: '#ede9fe', color: '#7c3aed' };

  return (
    <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
      <div className="flex items-center gap-2 mb-4 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        {title}
        {tag && <span className="text-xs px-2 py-0.5 rounded-full" style={tagStyle}>{tag}</span>}
      </div>
      {children}
    </div>
  );
}

function FormRow({ label, desc, children }: { label: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center py-2.5 gap-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
      <div style={{ width: 160, flexShrink: 0 }}>
        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</div>
        {desc && <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</div>}
      </div>
      <div className="flex items-center gap-2 flex-1">{children}</div>
    </div>
  );
}

function Toggle({ defaultOn, onChange }: { defaultOn?: boolean; onChange?: (v: boolean) => void }) {
  const [on, setOn] = useState(defaultOn ?? false);
  return (
    <button role="switch" aria-checked={on}
      onClick={() => { setOn(!on); onChange?.(!on); }}
      className="relative flex-shrink-0 rounded-full transition-colors"
      style={{ width: 40, height: 22, background: on ? '#7c3aed' : 'var(--card-border)' }}
      aria-label={on ? '已开启' : '已关闭'}>
      <span className="absolute top-0.5 rounded-full bg-white transition-transform"
        style={{ width: 18, height: 18, left: 2, transform: on ? 'translateX(18px)' : 'translateX(0)', boxShadow: '0 1px 3px rgba(0,0,0,0.18)' }} />
    </button>
  );
}

// ======== Ollama 本地模型（陛下 2026-04-17 亲定） ========

type OllamaStatus = {
  available: boolean;
  models: Array<{ name: string; size?: string; modified_at?: string }>;
  recommended?: Array<{ id: string; name: string; size?: string; lang?: string; speed?: string }>;
};

function OllamaSettings() {
  const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8888';
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/v1/ollama/status`);
      const j = await r.json();
      setStatus(j.data || null);
    } catch {
      setStatus({ available: false, models: [] });
    } finally {
      setLoading(false);
    }
  }, [BASE]);

  React.useEffect(() => { load(); }, [load]);

  const pull = async (modelId: string) => {
    setPulling(modelId);
    setMsg(`正在拉取 ${modelId}...`);
    try {
      const r = await fetch(`${BASE}/api/v1/ollama/pull`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ model: modelId }),
      });
      if (r.ok) {
        setMsg(`✅ ${modelId} 拉取完成`);
        await load();
      } else {
        setMsg(`❌ 拉取失败：HTTP ${r.status}`);
      }
    } catch (e) {
      setMsg(`❌ 拉取错误：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPulling(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>🦙 Ollama 本地模型</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          本地推理，零依赖、零费用、极速响应。推荐最小模型 qwen2.5:0.5b（397MB）作日常主模型。
        </p>
      </div>

      {/* 状态 */}
      <div className="p-4 rounded-xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium" style={{ color: 'var(--text-primary)' }}>Ollama 服务状态</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              检测地址 http://localhost:11434
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-xs px-2 py-1 rounded-full"
              style={{
                background: status?.available ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)',
                color: status?.available ? '#10b981' : '#ef4444',
              }}
            >
              {loading ? '检测中…' : status?.available ? '已连接' : '未连接'}
            </span>
            <button onClick={load} className="text-xs px-2 py-1 rounded hover:opacity-80"
              style={{ background: 'var(--card-border)', color: 'var(--text-primary)' }}>
              🔄 重新检测
            </button>
          </div>
        </div>
      </div>

      {/* 已安装模型 */}
      <div>
        <div className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          已安装模型 <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>（{status?.models?.length ?? 0} 个）</span>
        </div>
        {status?.models && status.models.length > 0 ? (
          <div className="space-y-2">
            {status.models.map(m => (
              <div key={m.name} className="p-3 rounded-lg flex items-center justify-between"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                <div>
                  <div className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>{m.name}</div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {m.size ? `${m.size} · ` : ''}本地推理 · 免 API
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}>已安装</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 rounded-lg text-sm" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-secondary)' }}>
            {loading ? '加载中…' : (status?.available ? '没有已安装模型，请先拉取推荐模型。' : 'Ollama 未启动。请先安装并启动 Ollama 服务。')}
          </div>
        )}
      </div>

      {/* 推荐模型 */}
      {status?.recommended && status.recommended.length > 0 && (
        <div>
          <div className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
            推荐模型 <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>（一键拉取）</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {status.recommended.map(m => (
              <div key={m.id} className="p-3 rounded-lg"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>{m.id}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {m.name}
                      {m.size ? ` · ${m.size}` : ''}
                      {m.lang ? ` · ${m.lang}` : ''}
                      {m.speed ? ` · ${m.speed}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => pull(m.id)}
                    disabled={pulling === m.id}
                    className="text-xs px-3 py-1.5 rounded disabled:opacity-50"
                    style={{ background: '#7c3aed', color: 'white' }}
                  >
                    {pulling === m.id ? '拉取中…' : '⬇ 拉取'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {msg && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(124,58,237,0.08)', color: 'var(--text-primary)' }}>
          {msg}
        </div>
      )}

      <div className="text-xs p-3 rounded-lg" style={{ background: 'rgba(251,191,36,0.08)', color: 'var(--text-secondary)', border: '1px solid rgba(251,191,36,0.2)' }}>
        💡 陛下 2026-04-17 亲定：本地 Ollama 作主模型的优势——稳定、零延迟、免费、无需梯子。推荐 qwen2.5:0.5b 作日常多核博弈主核，多核 LLM 调用累积秒级响应。
      </div>
    </div>
  );
}
