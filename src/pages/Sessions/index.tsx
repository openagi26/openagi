/**
 * 会话管理页面
 * 查看所有活跃和历史会话，支持终止会话
 */
import { useEffect, useState, useCallback } from 'react';
import {
  MessageSquare,
  RefreshCw,
  XCircle,
  Clock,
  Bot,
  User,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { hostApiFetch } from '@/lib/host-api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SessionInfo {
  key: string;
  agentId: string;
  agentName?: string;
  channelType?: string;
  status: 'active' | 'idle' | 'completed';
  messageCount: number;
  startedAt: string;
  lastActivityAt?: string;
  displayName?: string;
}

export function Sessions() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [killTarget, setKillTarget] = useState<SessionInfo | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await hostApiFetch<{ sessions?: SessionInfo[] }>('/api/gateway/sessions').catch(() => ({}));
      const list = (res as any)?.sessions;
      setSessions(Array.isArray(list) ? list : []);
    } catch {
      // 静默
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    const timer = setInterval(fetchSessions, 8000);
    return () => clearInterval(timer);
  }, [fetchSessions]);

  const handleKill = async () => {
    if (!killTarget) return;
    try {
      await hostApiFetch(`/api/gateway/sessions/${encodeURIComponent(killTarget.key)}/kill`, {
        method: 'POST',
      });
      toast.success(`会话 ${killTarget.displayName || killTarget.key} 已终止`);
      fetchSessions();
    } catch (error) {
      toast.error(`终止失败: ${String(error)}`);
    } finally {
      setKillTarget(null);
    }
  };

  const filtered = sessions.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.key.toLowerCase().includes(q) ||
      (s.agentName || '').toLowerCase().includes(q) ||
      (s.channelType || '').toLowerCase().includes(q) ||
      (s.displayName || '').toLowerCase().includes(q)
    );
  });

  const statusConfig = {
    active: { label: '活跃', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
    idle: { label: '空闲', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
    completed: { label: '已完成', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif text-foreground font-normal tracking-tight" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
            会话管理
          </h1>
          <p className="text-foreground/50 mt-1">
            查看和管理所有会话 · {sessions.length} 个会话
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setLoading(true); fetchSessions(); }}
          className="text-foreground/50"
        >
          <RefreshCw className={cn("w-4 h-4 mr-1.5", loading && "animate-spin")} />
          刷新
        </Button>
      </div>

      {/* 搜索框 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索会话（智能体名、渠道类型、会话 ID...）"
          className="pl-9 bg-black/10 border-white/10"
        />
      </div>

      {/* 会话列表 */}
      <div className="space-y-2">
        {filtered.length > 0 ? (
          filtered.map((s) => {
            const cfg = statusConfig[s.status] || statusConfig.idle;
            return (
              <div key={s.key} className="glass-card-purple rounded-lg p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {s.displayName || s.key}
                    </span>
                    <Badge className={cn("text-xs shrink-0", cfg.color)}>
                      {cfg.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-foreground/40">
                    <span className="flex items-center gap-1">
                      <Bot className="w-3 h-3" /> {s.agentName || s.agentId}
                    </span>
                    {s.channelType && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> {s.channelType}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> {s.messageCount} 条消息
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {s.lastActivityAt ? new Date(s.lastActivityAt).toLocaleString('zh-CN') : '未知'}
                    </span>
                  </div>
                </div>
                {s.status === 'active' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setKillTarget(s)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    终止
                  </Button>
                )}
              </div>
            );
          })
        ) : (
          <div className="glass-card-purple rounded-xl p-12 text-center">
            <AlertTriangle className="w-10 h-10 text-foreground/20 mx-auto mb-3" />
            <p className="text-foreground/40 text-lg">
              {search ? '没有匹配的会话' : '暂无会话记录'}
            </p>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!killTarget}
        title="终止会话"
        message={`确定要终止会话「${killTarget?.displayName || killTarget?.key}」吗？这将立即中断正在进行的对话。`}
        confirmLabel="终止"
        cancelLabel="取消"
        variant="destructive"
        onConfirm={handleKill}
        onCancel={() => setKillTarget(null)}
      />
    </div>
  );
}
