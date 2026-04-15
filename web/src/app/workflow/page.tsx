'use client';

import React, { useState } from 'react';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8888';

interface TrinityResult {
  proposal?: string;
  audit?: string;
  decision?: string;
}

export default function WorkflowPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrinityResult | null>(null);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/trinity/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), model: 'glm-5.1' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '运行失败');
      setResult(data.data || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-6" style={{ background: 'var(--center-bg)' }}>
      {/* 标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          ⚡ Trinity工作流
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          三核决策引擎：提案 → 审计 → 决策
        </p>
      </div>

      {/* 输入区 */}
      <div
        className="rounded-2xl p-5 mb-6"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
      >
        <div className="mb-4">
          <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>
            任务标题 *
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="输入任务标题..."
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
        <div className="mb-4">
          <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>
            任务描述
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="详细描述任务内容（可选）..."
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!title.trim() || loading}
          className="px-6 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}
        >
          {loading ? '运行中...' : '⚡ 运行Trinity'}
        </button>
      </div>

      {/* 加载动画 */}
      {loading && (
        <div className="flex flex-col gap-3 mb-6">
          {['🧠 AI-1 生成提案...', '🔍 AI-2 审计中...', '👑 AI-3 决策中...'].map((step, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 rounded-xl animate-pulse"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
            >
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{step}</span>
            </div>
          ))}
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div
          className="px-4 py-3 rounded-xl mb-6 text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}
        >
          错误：{error}
        </div>
      )}

      {/* 三阶段结果 */}
      {result && (
        <div className="flex flex-col gap-4">
          {[
            { key: 'proposal', label: '提案', icon: '🧠', agent: 'AI-1', color: '#7c3aed' },
            { key: 'audit',    label: '审计', icon: '🔍', agent: 'AI-2', color: '#2563eb' },
            { key: 'decision', label: '决策', icon: '👑', agent: 'AI-3', color: '#059669' },
          ].map(({ key, label, icon, agent, color }) => {
            const content = result[key as keyof TrinityResult];
            return (
              <div
                key={key}
                className="rounded-2xl p-5"
                style={{ background: 'var(--card-bg)', border: `1px solid var(--card-border)` }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ fontSize: 18 }}>{icon}</span>
                  <span className="text-sm font-semibold" style={{ color }}>
                    {agent} — {label}
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                  {content || <span style={{ color: 'var(--text-muted)' }}>（无内容）</span>}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
