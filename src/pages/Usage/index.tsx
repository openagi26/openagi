/**
 * 使用情况页面
 * 显示 Token 用量、API 调用次数、模型分布、成本估算
 */
import { useEffect, useState, useCallback } from 'react';
import {
  BarChart3,
  RefreshCw,
  Zap,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { hostApiFetch } from '@/lib/host-api';
import { cn } from '@/lib/utils';

interface UsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalRequests: number;
  totalCostUsd: number;
  modelBreakdown: Array<{
    model: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    requests: number;
    costUsd: number;
  }>;
  dailyUsage?: Array<{
    date: string;
    inputTokens: number;
    outputTokens: number;
    requests: number;
  }>;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function Usage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await hostApiFetch<UsageStats>('/api/gateway/usage').catch(() => null);
      if (res) {
        setStats(res);
      } else {
        // 使用模拟数据展示界面布局
        setStats({
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalRequests: 0,
          totalCostUsd: 0,
          modelBreakdown: [],
        });
      }
    } catch {
      setStats({
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalRequests: 0,
        totalCostUsd: 0,
        modelBreakdown: [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
    const timer = setInterval(fetchUsage, 30000);
    return () => clearInterval(timer);
  }, [fetchUsage]);

  const totalTokens = (stats?.totalInputTokens ?? 0) + (stats?.totalOutputTokens ?? 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif text-foreground font-normal tracking-tight" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
            使用情况
          </h1>
          <p className="text-foreground/50 mt-1">Token 用量、API 调用和费用统计</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setLoading(true); fetchUsage(); }}
          className="text-foreground/50"
        >
          <RefreshCw className={cn("w-4 h-4 mr-1.5", loading && "animate-spin")} />
          刷新
        </Button>
      </div>

      {/* 统计总览 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card-purple rounded-xl p-5">
          <div className="flex items-center gap-2 text-foreground/50 text-sm mb-2">
            <Zap className="w-4 h-4 text-purple-400" /> 总 Token
          </div>
          <p className="text-2xl font-bold text-foreground">{formatTokens(totalTokens)}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-foreground/40">
            <span className="flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-blue-400" />
              输入 {formatTokens(stats?.totalInputTokens ?? 0)}
            </span>
            <span className="flex items-center gap-1">
              <ArrowDownRight className="w-3 h-3 text-green-400" />
              输出 {formatTokens(stats?.totalOutputTokens ?? 0)}
            </span>
          </div>
        </div>

        <div className="glass-card-purple rounded-xl p-5">
          <div className="flex items-center gap-2 text-foreground/50 text-sm mb-2">
            <TrendingUp className="w-4 h-4 text-blue-400" /> API 调用
          </div>
          <p className="text-2xl font-bold text-foreground">{stats?.totalRequests ?? 0}</p>
          <p className="text-xs text-foreground/40 mt-2">累计请求次数</p>
        </div>

        <div className="glass-card-purple rounded-xl p-5">
          <div className="flex items-center gap-2 text-foreground/50 text-sm mb-2">
            <DollarSign className="w-4 h-4 text-green-400" /> 预估费用
          </div>
          <p className="text-2xl font-bold text-foreground">
            ${(stats?.totalCostUsd ?? 0).toFixed(2)}
          </p>
          <p className="text-xs text-foreground/40 mt-2">基于 Token 估算</p>
        </div>

        <div className="glass-card-purple rounded-xl p-5">
          <div className="flex items-center gap-2 text-foreground/50 text-sm mb-2">
            <BarChart3 className="w-4 h-4 text-amber-400" /> 模型数
          </div>
          <p className="text-2xl font-bold text-foreground">{stats?.modelBreakdown?.length ?? 0}</p>
          <p className="text-xs text-foreground/40 mt-2">已使用的模型</p>
        </div>
      </div>

      {/* 模型用量明细 */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-purple-400" />
          模型用量明细
        </h2>
        {stats?.modelBreakdown && stats.modelBreakdown.length > 0 ? (
          <div className="space-y-2">
            {stats.modelBreakdown
              .sort((a, b) => (b.inputTokens + b.outputTokens) - (a.inputTokens + a.outputTokens))
              .map((m, i) => {
                const mTotal = m.inputTokens + m.outputTokens;
                const pct = totalTokens > 0 ? (mTotal / totalTokens) * 100 : 0;
                return (
                  <div key={i} className="glass-card-purple rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground text-sm">{m.model}</span>
                        <Badge className="bg-purple-500/10 text-purple-300 border-purple-500/20 text-xs">
                          {m.provider}
                        </Badge>
                      </div>
                      <span className="text-sm text-foreground/50">{formatTokens(mTotal)} tokens</span>
                    </div>
                    {/* 进度条 */}
                    <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-purple-600 to-violet-400 transition-all"
                        style={{ width: `${Math.max(pct, 1)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5 text-xs text-foreground/40">
                      <span>{m.requests} 次调用</span>
                      <span>{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="glass-card-purple rounded-xl p-12 text-center">
            <AlertTriangle className="w-10 h-10 text-foreground/20 mx-auto mb-3" />
            <p className="text-foreground/40 text-lg">暂无使用数据</p>
            <p className="text-xs text-foreground/30 mt-1">开始使用 AI 对话后，这里会显示用量统计</p>
          </div>
        )}
      </div>
    </div>
  );
}
