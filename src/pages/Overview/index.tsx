/**
 * 概览仪表板页面
 * 显示系统总览：网关状态、活跃会话、渠道健康、使用统计
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  MessageSquare,
  Network,
  Bot,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useGatewayStore } from '@/stores/gateway';
import { useAgentsStore } from '@/stores/agents';
import { hostApiFetch } from '@/lib/host-api';
import { cn } from '@/lib/utils';

interface GatewaySnapshot {
  channels?: Array<{
    type: string;
    accountName?: string;
    healthy: boolean;
    lastSuccessAt?: string;
  }>;
  agents?: Array<{
    id: string;
    name: string;
    running: boolean;
  }>;
  sessions?: {
    active: number;
    total: number;
  };
  uptime?: number;
  version?: string;
}

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="glass-card-purple rounded-xl p-5 flex items-start gap-4">
      <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", color)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-foreground/50 font-medium">{label}</p>
        <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
        {sub && <p className="text-xs text-foreground/40 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export function Overview() {
  const gatewayStatus = useGatewayStore((s) => s.status);
  const agents = useAgentsStore((s) => s.agents);
  const [snapshot, setSnapshot] = useState<GatewaySnapshot>({});
  const [loading, setLoading] = useState(true);

  const fetchSnapshot = useCallback(async () => {
    try {
      // 获取频道状态
      const channelsRes = await hostApiFetch<{ channels?: GatewaySnapshot['channels'] }>('/api/gateway/channels').catch(() => ({}));
      // 获取会话统计
      const sessionsRes = await hostApiFetch<{ active?: number; total?: number }>('/api/gateway/sessions/stats').catch(() => ({}));

      setSnapshot({
        channels: (channelsRes as any)?.channels || [],
        sessions: {
          active: (sessionsRes as any)?.active || 0,
          total: (sessionsRes as any)?.total || 0,
        },
      });
    } catch {
      // 静默处理
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSnapshot();
    const timer = setInterval(fetchSnapshot, 15000);
    return () => clearInterval(timer);
  }, [fetchSnapshot]);

  const healthyChannels = snapshot.channels?.filter((c) => c.healthy).length ?? 0;
  const totalChannels = snapshot.channels?.length ?? 0;
  const runningAgents = agents?.filter((a: any) => a.running !== false).length ?? agents?.length ?? 0;



  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif text-foreground font-normal tracking-tight" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
            概览
          </h1>
          <p className="text-foreground/50 mt-1">系统运行状态一览</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setLoading(true); fetchSnapshot(); }}
          className="text-foreground/50 hover:text-foreground"
        >
          <RefreshCw className={cn("w-4 h-4 mr-1.5", loading && "animate-spin")} />
          刷新
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Activity className="w-5 h-5 text-green-400" />}
          label="网关状态"
          value={gatewayStatus.state === 'running' ? '运行中' : '已停止'}
          sub={`端口 ${gatewayStatus.port || 18799}`}
          color="bg-green-500/10"
        />
        <StatCard
          icon={<MessageSquare className="w-5 h-5 text-purple-400" />}
          label="活跃会话"
          value={snapshot.sessions?.active ?? 0}
          sub={`共 ${snapshot.sessions?.total ?? 0} 个会话`}
          color="bg-purple-500/10"
        />
        <StatCard
          icon={<Network className="w-5 h-5 text-blue-400" />}
          label="消息渠道"
          value={`${healthyChannels}/${totalChannels}`}
          sub={healthyChannels === totalChannels ? '全部正常' : `${totalChannels - healthyChannels} 个异常`}
          color="bg-blue-500/10"
        />
        <StatCard
          icon={<Bot className="w-5 h-5 text-amber-400" />}
          label="智能体"
          value={runningAgents}
          sub={`${agents?.length ?? 0} 个已配置`}
          color="bg-amber-500/10"
        />
      </div>

      {/* 渠道健康状态 */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
          <Network className="w-5 h-5 text-purple-400" />
          渠道健康状态
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {snapshot.channels && snapshot.channels.length > 0 ? (
            snapshot.channels.map((ch, i) => (
              <div key={i} className="glass-card-purple rounded-lg p-4 flex items-center gap-3">
                {ch.healthy ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {ch.type}{ch.accountName ? ` · ${ch.accountName}` : ''}
                  </p>
                  <p className="text-xs text-foreground/40">
                    {ch.healthy ? '正常运行' : '连接异常'}
                    {ch.lastSuccessAt && ` · 最后成功: ${new Date(ch.lastSuccessAt).toLocaleTimeString('zh-CN')}`}
                  </p>
                </div>
                <Badge className={cn(
                  "shrink-0 text-xs",
                  ch.healthy
                    ? "bg-green-500/10 text-green-400 border-green-500/20"
                    : "bg-red-500/10 text-red-400 border-red-500/20"
                )}>
                  {ch.healthy ? '健康' : '异常'}
                </Badge>
              </div>
            ))
          ) : (
            <div className="glass-card-purple rounded-lg p-8 col-span-full text-center">
              <AlertTriangle className="w-8 h-8 text-foreground/20 mx-auto mb-2" />
              <p className="text-foreground/40">暂无已配置的渠道</p>
              <p className="text-xs text-foreground/30 mt-1">前往「消息渠道」页面添加 WhatsApp、Telegram 等</p>
            </div>
          )}
        </div>
      </div>

      {/* 智能体状态 */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
          <Bot className="w-5 h-5 text-purple-400" />
          智能体状态
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {agents && agents.length > 0 ? (
            agents.map((agent: any) => (
              <div key={agent.id} className="glass-card-purple rounded-lg p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-purple-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{agent.name || agent.id}</p>
                  <p className="text-xs text-foreground/40">{agent.description || 'AI 智能体'}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="glass-card-purple rounded-lg p-8 col-span-full text-center">
              <Bot className="w-8 h-8 text-foreground/20 mx-auto mb-2" />
              <p className="text-foreground/40">暂无智能体</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
