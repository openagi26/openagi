'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store';

// 设置导航结构
const NAV_GROUPS = [
  {
    group: '基础配置',
    items: [
      { key: 'model', icon: '🤖', label: '模型管理', badge: '核心' },
      { key: 'relay', icon: '🔗', label: '中转站配置' },
      { key: 'api', icon: '🔑', label: 'API密钥' },
    ],
  },
  {
    group: '多核治理',
    items: [
      { key: 'cores', icon: '⚡', label: '多核治理', badge: '核心' },
      { key: 'inspection', icon: '🔍', label: '巡检AI', badge: '核心' },
      { key: 'audit', icon: '📊', label: '审计规则' },
    ],
  },
  {
    group: '个性化',
    items: [
      { key: 'theme', icon: '🎨', label: '主题与外观' },
      { key: 'language', icon: '🌐', label: '语言设置' },
      { key: 'notification', icon: '🔔', label: '通知' },
    ],
  },
  {
    group: '高级',
    items: [
      { key: 'memory', icon: '🧠', label: '记忆系统' },
      { key: 'workflow', icon: '🔄', label: '工作流' },
      { key: 'export', icon: '📦', label: '数据导出' },
      { key: 'about', icon: 'ℹ️', label: '关于' },
    ],
  },
];

// 模拟可用模型数据
const AVAILABLE_MODELS = [
  { id: 'claude-opus-4', name: 'Claude Opus 4', provider: 'Anthropic', status: 'active', latency: '320ms', cost: '高' },
  { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'Anthropic', status: 'active', latency: '180ms', cost: '中' },
  { id: 'claude-haiku-4', name: 'Claude Haiku 4', provider: 'Anthropic', status: 'active', latency: '85ms', cost: '低' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', status: 'inactive', latency: '-', cost: '高' },
  { id: 'gemini-2-pro', name: 'Gemini 2 Pro', provider: 'Google', status: 'inactive', latency: '-', cost: '中' },
];

const CORE_CONFIGS = [
  { id: 1, name: 'CEO主核', role: '决策指挥', model: 'claude-opus-4', color: '#7c3aed' },
  { id: 2, name: '审计-外A', role: '质量审计', model: 'claude-sonnet-4', color: '#2563eb' },
  { id: 3, name: '审计-外B', role: '快速校验', model: 'claude-haiku-4', color: '#059669' },
  { id: 4, name: '审计-外C', role: '深度审计', model: 'claude-opus-4', color: '#d97706' },
  { id: 5, name: '执行代理', role: '任务执行', model: 'claude-sonnet-4', color: '#dc2626' },
];

export default function SettingsPage() {
  const { state, dispatch } = useStore();
  const [activeKey, setActiveKey] = useState('model');
  const [relayUrl, setRelayUrl] = useState('https://api.openagi.ai/v1');
  const [coreCount, setCoreCount] = useState(5);

  return (
    <div className="flex h-full overflow-hidden">
      {/* 设置导航 */}
      <nav
        className="flex-shrink-0 overflow-y-auto py-3"
        style={{
          width: 220,
          background: 'var(--panel-bg)',
          borderRight: '1px solid var(--panel-border)',
        }}
        aria-label="设置导航"
      >
        {NAV_GROUPS.map(group => (
          <div key={group.group}>
            <div
              className="px-5 py-2 text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--text-muted)' }}
            >
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
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{ background: '#7c3aed', color: '#fff', fontSize: 9 }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* 内容区 */}
      <div
        className="flex-1 overflow-y-auto px-8 py-6"
        style={{ background: 'var(--center-bg)' }}
        role="main"
      >
        {activeKey === 'model' && (
          <ModelSettings relayUrl={relayUrl} setRelayUrl={setRelayUrl} />
        )}
        {activeKey === 'cores' && (
          <CoresSettings coreCount={coreCount} setCoreCount={setCoreCount} />
        )}
        {activeKey === 'inspection' && (
          <InspectionSettings />
        )}
        {!['model', 'cores', 'inspection'].includes(activeKey) && (
          <PlaceholderSettings key={activeKey} settingKey={activeKey} />
        )}
      </div>
    </div>
  );
}

// ======== 模型管理 ========
function ModelSettings({ relayUrl, setRelayUrl }: { relayUrl: string; setRelayUrl: (v: string) => void }) {
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');

  const testRelay = async () => {
    setTestStatus('testing');
    await new Promise(r => setTimeout(r, 1200));
    setTestStatus('ok');
  };

  return (
    <section>
      <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>模型管理</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        配置AI模型中转站、可用模型列表与故障转移策略
      </p>

      {/* 中转站配置 */}
      <Card title="中转站配置" tag="基础" tagColor="tag-primary">
        <FormRow label="中转站URL" desc="兼容OpenAI格式的API端点">
          <input
            type="text"
            value={relayUrl}
            onChange={e => setRelayUrl(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-md text-sm outline-none"
            style={{
              border: '1px solid var(--input-border)',
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
            }}
            onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#7c3aed'}
            onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'var(--input-border)'}
            aria-label="中转站URL"
          />
          <button
            onClick={testRelay}
            disabled={testStatus === 'testing'}
            className="px-3 py-1.5 rounded-md text-sm font-medium text-white transition-all flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}
          >
            {testStatus === 'testing' ? '检测中...' : testStatus === 'ok' ? '✓ 连通' : '测试连接'}
          </button>
        </FormRow>
        <FormRow label="API密钥" desc="中转站鉴权密钥">
          <input
            type="password"
            placeholder="sk-..."
            className="flex-1 px-3 py-1.5 rounded-md text-sm outline-none"
            style={{
              border: '1px solid var(--input-border)',
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
            }}
            aria-label="API密钥"
          />
        </FormRow>
        <FormRow label="故障转移" desc="主模型不可用时自动切换">
          <Toggle defaultOn />
        </FormRow>
        <FormRow label="超时时间" desc="单次请求最大等待时间">
          <select
            className="px-2 py-1.5 rounded-md text-sm"
            style={{
              border: '1px solid var(--input-border)',
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
            }}
            aria-label="超时时间"
          >
            <option>30秒</option>
            <option>60秒</option>
            <option>120秒</option>
          </select>
        </FormRow>
      </Card>

      {/* 可用模型列表 */}
      <Card title="可用模型" tag="列表">
        <div className="flex flex-col gap-2">
          {AVAILABLE_MODELS.map(model => (
            <div
              key={model.id}
              className="flex items-center gap-3 py-2.5 px-1"
              style={{ borderBottom: '1px solid var(--card-border)' }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: model.status === 'active' ? '#34d399' : '#9ca3af' }}
              />
              <div className="flex-1">
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {model.name}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {model.provider} · 延迟 {model.latency} · 费用{model.cost}
                </div>
              </div>
              <Toggle defaultOn={model.status === 'active'} />
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

// ======== 多核治理 ========
function CoresSettings({ coreCount, setCoreCount }: { coreCount: number; setCoreCount: (v: number) => void }) {
  return (
    <section>
      <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>多核治理</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        配置三核博弈机制，最多支持5核并行审计
      </p>

      <Card title="核心数配置" tag="关键" tagColor="tag-primary">
        <FormRow label="启用核心数" desc="同时运行的AI核心数量">
          <div className="flex items-center gap-3">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setCoreCount(n)}
                className="w-9 h-9 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: coreCount >= n ? '#7c3aed' : 'var(--card-bg)',
                  color: coreCount >= n ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${coreCount >= n ? '#7c3aed' : 'var(--card-border)'}`,
                }}
                aria-pressed={coreCount >= n}
                aria-label={`启用${n}个核心`}
              >
                {n}
              </button>
            ))}
            <span className="text-sm ml-1" style={{ color: 'var(--text-secondary)' }}>
              核 · 推荐3-5核
            </span>
          </div>
        </FormRow>
        <FormRow label="三核博弈" desc="强制每轮执行三阶段流水线">
          <Toggle defaultOn />
        </FormRow>
        <FormRow label="自动综合" desc="自动合并多核审计结果">
          <Toggle defaultOn />
        </FormRow>
      </Card>

      <Card title="核心配置详情">
        <div className="flex flex-col gap-3">
          {CORE_CONFIGS.slice(0, coreCount).map(core => (
            <div
              key={core.id}
              className="rounded-xl p-3"
              style={{ background: 'var(--center-bg)', border: '1px solid var(--card-border)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ background: core.color }}
                />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  核 {core.id}：{core.name}
                </span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: `${core.color}15`, color: core.color }}>
                  {core.role}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs" style={{ color: 'var(--text-muted)' }}>模型</label>
                <select
                  defaultValue={core.model}
                  className="text-xs px-2 py-1 rounded-md"
                  style={{
                    border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                  }}
                  aria-label={`${core.name}的模型`}
                >
                  <option value="claude-opus-4">Claude Opus 4</option>
                  <option value="claude-sonnet-4">Claude Sonnet 4</option>
                  <option value="claude-haiku-4">Claude Haiku 4</option>
                </select>
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

  return (
    <section>
      <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>巡检AI</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        配置定期巡检与事件触发规则，确保系统持续健康运行
      </p>

      <Card title="巡检开关" tag="必需" tagColor="tag-primary">
        <FormRow label="启用巡检" desc="AI定期自检与状态汇报">
          <Toggle
            defaultOn={inspectionEnabled}
            onChange={v => dispatch({ type: 'SET_INSPECTION', payload: { enabled: v, frequency: inspectionFrequency } })}
          />
        </FormRow>
        <FormRow label="巡检频率" desc="每隔多少分钟执行一次巡检">
          <div className="flex items-center gap-2">
            {[5, 10, 15, 30, 60].map(f => (
              <button
                key={f}
                onClick={() => dispatch({ type: 'SET_INSPECTION', payload: { enabled: inspectionEnabled, frequency: f } })}
                className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                style={{
                  background: inspectionFrequency === f ? '#7c3aed' : 'var(--card-bg)',
                  color: inspectionFrequency === f ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${inspectionFrequency === f ? '#7c3aed' : 'var(--card-border)'}`,
                }}
                aria-pressed={inspectionFrequency === f}
                aria-label={`每${f}分钟巡检一次`}
              >
                {f}分钟
              </button>
            ))}
          </div>
        </FormRow>
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
          <select
            className="px-2 py-1.5 rounded-md text-sm"
            style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
            aria-label="报告格式"
          >
            <option>简报（推荐）</option>
            <option>详细报告</option>
            <option>仅异常项</option>
          </select>
        </FormRow>
        <FormRow label="保留历史" desc="保留最近N条巡检记录">
          <select
            className="px-2 py-1.5 rounded-md text-sm"
            style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
            aria-label="保留历史数量"
          >
            <option>最近10条</option>
            <option>最近50条</option>
            <option>最近100条</option>
          </select>
        </FormRow>
      </Card>
    </section>
  );
}

// ======== 占位页面 ========
function PlaceholderSettings({ settingKey }: { settingKey: string }) {
  const navItem = NAV_GROUPS.flatMap(g => g.items).find(i => i.key === settingKey);
  return (
    <section className="flex flex-col items-center justify-center h-full gap-4" style={{ color: 'var(--text-muted)' }}>
      <span style={{ fontSize: 48 }}>{navItem?.icon || '⚙️'}</span>
      <div className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
        {navItem?.label || '设置项'}
      </div>
      <div className="text-sm">此设置项正在开发中</div>
    </section>
  );
}

// ======== 通用子组件 ========

function Card({
  title, tag, tagColor, children,
}: {
  title: string; tag?: string; tagColor?: string; children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-5 mb-4"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
    >
      <div className="flex items-center gap-2 mb-4 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        {title}
        {tag && (
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={tagColor === 'tag-orange'
              ? { background: '#fff7ed', color: '#ea580c' }
              : { background: '#ede9fe', color: '#7c3aed' }
            }
          >
            {tag}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function FormRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center py-2.5 gap-3"
      style={{ borderBottom: '1px solid var(--card-border)' }}
    >
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
    <button
      role="switch"
      aria-checked={on}
      onClick={() => { setOn(!on); onChange?.(!on); }}
      className="relative flex-shrink-0 rounded-full transition-colors"
      style={{
        width: 40, height: 22,
        background: on ? '#7c3aed' : 'var(--card-border)',
      }}
      aria-label={on ? '已开启' : '已关闭'}
    >
      <span
        className="absolute top-0.5 rounded-full bg-white transition-transform"
        style={{
          width: 18, height: 18,
          left: 2,
          transform: on ? 'translateX(18px)' : 'translateX(0)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
        }}
      />
    </button>
  );
}
