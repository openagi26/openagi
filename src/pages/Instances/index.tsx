/**
 * 实例管理页面
 * 查看和管理 OpenAGI 运行中的服务实例
 */
import { useEffect, useState, useCallback } from 'react';
import { Server, RefreshCw, Power, Clock, Cpu, HardDrive, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { hostApiFetch } from '@/lib/host-api';
import { cn } from '@/lib/utils';

interface InstanceInfo {
  id: string;
  name: string;
  type: string;
  status: 'running' | 'stopped' | 'error';
  uptime?: number;
  pid?: number;
  port?: number;
  memoryMb?: number;
  cpuPercent?: number;
  startedAt?: string;
}

export function Instances() {
  const [instances, setInstances] = useState<InstanceInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInstances = useCallback(async () => {
    try {
      const res = await hostApiFetch<{ instances?: InstanceInfo[] }>('/api/gateway/instances').catch(() => ({}));
      setInstances((res as any)?.instances || [
        // 默认显示核心服务
        {
          id: 'gateway',
          name: 'OpenAGI 网关',
          type: 'gateway',
          status: 'running' as const,
          port: 18799,
          startedAt: new Date().toISOString(),
        },
        {
          id: 'code-engine',
          name: 'Claude Code 引擎',
          type: 'code-engine',
          status: 'running' as const,
        },
      ]);
    } catch {
      // 静默
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInstances();
    const timer = setInterval(fetchInstances, 10000);
    return () => clearInterval(timer);
  }, [fetchInstances]);

  const statusConfig = {
    running: { label: '运行中', color: 'bg-green-500/10 text-green-400 border-green-500/20', dot: 'bg-green-500' },
    stopped: { label: '已停止', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20', dot: 'bg-gray-500' },
    error: { label: '错误', color: 'bg-red-500/10 text-red-400 border-red-500/20', dot: 'bg-red-500' },
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif text-foreground font-normal tracking-tight" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
            实例管理
          </h1>
          <p className="text-foreground/50 mt-1">查看和管理运行中的服务实例</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setLoading(true); fetchInstances(); }}
          className="text-foreground/50"
        >
          <RefreshCw className={cn("w-4 h-4 mr-1.5", loading && "animate-spin")} />
          刷新
        </Button>
      </div>

      <div className="space-y-3">
        {instances.length > 0 ? (
          instances.map((inst) => {
            const cfg = statusConfig[inst.status];
            return (
              <div key={inst.id} className="glass-card-purple rounded-xl p-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                    <Server className="w-6 h-6 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{inst.name}</h3>
                      <Badge className={cn("text-xs", cfg.color)}>
                        <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5", cfg.dot)} />
                        {cfg.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-foreground/40">
                      {inst.port && (
                        <span className="flex items-center gap-1">
                          <Power className="w-3 h-3" /> 端口 {inst.port}
                        </span>
                      )}
                      {inst.pid && (
                        <span className="flex items-center gap-1">
                          <Cpu className="w-3 h-3" /> PID {inst.pid}
                        </span>
                      )}
                      {inst.memoryMb && (
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3" /> {inst.memoryMb} MB
                        </span>
                      )}
                      {inst.startedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {new Date(inst.startedAt).toLocaleString('zh-CN')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="glass-card-purple rounded-xl p-12 text-center">
            <AlertTriangle className="w-10 h-10 text-foreground/20 mx-auto mb-3" />
            <p className="text-foreground/40 text-lg">暂无运行中的实例</p>
          </div>
        )}
      </div>
    </div>
  );
}
