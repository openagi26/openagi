'use client';

import React, { useState, useEffect, useCallback } from 'react';

const BASE_URL = 'http://localhost:8888';

interface MemoryLayerStats {
  count?: number;
  total?: number;
  size?: number;
  [key: string]: unknown;
}

interface MemoryStats {
  working: MemoryLayerStats;
  recent: MemoryLayerStats;
  archive: MemoryLayerStats;
  core_dna: MemoryLayerStats;
}

interface SearchResult {
  layer: string;
  content: string;
  score: number;
  tags?: string[];
}

interface DnaItem {
  id: string;
  content: string;
  category: string;
}

const LAYER_LABELS: Record<string, { label: string; badge: string; color: string; bg: string; border: string }> = {
  working: {
    label: 'L0 工作记忆',
    badge: '热',
    color: '#f87171',
    bg: 'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.25)',
  },
  recent: {
    label: 'L1 近期记忆',
    badge: '温',
    color: '#fb923c',
    bg: 'rgba(251,146,60,0.08)',
    border: 'rgba(251,146,60,0.25)',
  },
  archive: {
    label: 'L2 归档记忆',
    badge: '冷',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.08)',
    border: 'rgba(96,165,250,0.25)',
  },
  core_dna: {
    label: 'L3 核心DNA',
    badge: 'DNA',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.08)',
    border: 'rgba(167,139,250,0.35)',
  },
};

function getCount(layer: MemoryLayerStats): number {
  return (layer.count ?? layer.total ?? layer.size ?? 0) as number;
}

export default function MemoryPage() {
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const [dna, setDna] = useState<DnaItem[]>([]);
  const [dnaLoading, setDnaLoading] = useState(true);
  const [dnaError, setDnaError] = useState<string | null>(null);

  useEffect(() => {
    setStatsLoading(true);
    fetch(`${BASE_URL}/api/v1/memory/stats`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setStats(data.data);
        else setStatsError('获取统计失败');
      })
      .catch(() => setStatsError('后端连接失败'))
      .finally(() => setStatsLoading(false));

    setDnaLoading(true);
    fetch(`${BASE_URL}/api/v1/memory/dna`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setDna(data.data);
        else setDnaError('获取DNA失败');
      })
      .catch(() => setDnaError('后端连接失败'))
      .finally(() => setDnaLoading(false));
  }, []);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearched(false);
    try {
      const res = await fetch(
        `${BASE_URL}/api/v1/memory/search?query=${encodeURIComponent(query.trim())}&limit=10`
      );
      const data = await res.json();
      if (data.success) setSearchResults(data.data);
      else setSearchResults([]);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div
      className="flex-1 overflow-y-auto p-6"
      style={{ background: 'var(--center-bg)', color: 'var(--text-primary)' }}
    >
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#a78bfa' }}>
          🧠 记忆中枢
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          四层记忆架构 · 跨层检索 · 核心知识DNA
        </p>
      </div>

      {/* 四层统计卡片 */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-3 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
          记忆层统计
        </h2>
        {statsLoading ? (
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>加载中...</div>
        ) : statsError ? (
          <div className="text-sm" style={{ color: '#f87171' }}>{statsError}</div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {(Object.keys(LAYER_LABELS) as Array<keyof typeof LAYER_LABELS>).map(key => {
              const cfg = LAYER_LABELS[key];
              const layerData = stats[key as keyof MemoryStats];
              const count = layerData ? getCount(layerData) : 0;
              return (
                <div
                  key={key}
                  className="rounded-xl p-4 flex flex-col gap-2"
                  style={{
                    background: cfg.bg,
                    border: `1px solid ${cfg.border}`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium" style={{ color: cfg.color }}>
                      {cfg.label}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-bold"
                      style={{ background: cfg.border, color: cfg.color }}
                    >
                      {cfg.badge}
                    </span>
                  </div>
                  <div className="text-3xl font-bold" style={{ color: cfg.color }}>
                    {count}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    条目
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      {/* 记忆搜索 */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-3 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
          跨层检索
        </h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="输入查询词，按 Enter 或点击搜索..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 px-4 py-2 rounded-lg text-sm outline-none"
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              color: 'var(--text-primary)',
            }}
            aria-label="记忆搜索框"
          />
          <button
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: searching || !query.trim() ? 'rgba(124,58,237,0.3)' : '#7c3aed',
              color: '#fff',
              cursor: searching || !query.trim() ? 'not-allowed' : 'pointer',
              border: 'none',
            }}
          >
            {searching ? '搜索中...' : '搜索'}
          </button>
        </div>

        {searched && (
          <div className="space-y-2">
            {searchResults.length === 0 ? (
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>未找到相关记忆</div>
            ) : (
              searchResults.map((item, idx) => {
                const layerCfg = LAYER_LABELS[item.layer] ?? LAYER_LABELS.archive;
                return (
                  <div
                    key={idx}
                    className="rounded-lg p-3 flex flex-col gap-1"
                    style={{
                      background: 'var(--card-bg)',
                      border: `1px solid var(--card-border)`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: layerCfg.bg, color: layerCfg.color, border: `1px solid ${layerCfg.border}` }}
                      >
                        {layerCfg.label}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        评分: {typeof item.score === 'number' ? item.score.toFixed(3) : item.score}
                      </span>
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {item.tags.map((tag, ti) => (
                            <span
                              key={ti}
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(124,58,237,0.12)', color: '#a78bfa' }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      {item.content}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>

      {/* DNA核心知识 */}
      <section>
        <h2 className="text-sm font-semibold mb-3 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
          核心知识 DNA
        </h2>
        {dnaLoading ? (
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>加载中...</div>
        ) : dnaError ? (
          <div className="text-sm" style={{ color: '#f87171' }}>{dnaError}</div>
        ) : dna.length === 0 ? (
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>暂无核心知识</div>
        ) : (
          <div className="space-y-2">
            {dna.map(item => (
              <div
                key={item.id}
                className="rounded-lg p-3 flex flex-col gap-1"
                style={{
                  background: 'rgba(167,139,250,0.06)',
                  border: '1px solid rgba(167,139,250,0.2)',
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}
                  >
                    {item.category}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    #{item.id}
                  </span>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {item.content.slice(0, 100)}{item.content.length > 100 ? '...' : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
