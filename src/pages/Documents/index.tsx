/**
 * 文档管理页面
 * 管理 AI 知识库文档、SKILL 文件、Agent 文件
 */
import { useEffect, useState, useCallback } from 'react';
import {
  FileText,
  RefreshCw,
  Search,
  File,
  Code,
  BookOpen,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { hostApiFetch } from '@/lib/host-api';
import { cn } from '@/lib/utils';

interface DocumentInfo {
  name: string;
  path: string;
  type: 'skill' | 'agent' | 'config' | 'other';
  size: number;
  modifiedAt: string;
  agentId?: string;
  description?: string;
}

function formatSize(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

const typeConfig = {
  skill: { label: '技能文件', color: 'bg-purple-500/10 text-purple-300 border-purple-500/20', icon: Code },
  agent: { label: '智能体', color: 'bg-blue-500/10 text-blue-300 border-blue-500/20', icon: BookOpen },
  config: { label: '配置文件', color: 'bg-amber-500/10 text-amber-300 border-amber-500/20', icon: File },
  other: { label: '其他', color: 'bg-gray-500/10 text-gray-300 border-gray-500/20', icon: FileText },
};

export function Documents() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await hostApiFetch<{ documents?: DocumentInfo[] }>('/api/gateway/documents').catch(() => ({}));
      setDocuments((res as any)?.documents || []);
    } catch {
      // 静默
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const filtered = documents.filter((d) => {
    if (filter !== 'all' && d.type !== filter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return d.name.toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q);
  });

  const typeCounts = documents.reduce((acc, d) => {
    acc[d.type] = (acc[d.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif text-foreground font-normal tracking-tight" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
            文档
          </h1>
          <p className="text-foreground/50 mt-1">
            知识库文档与配置文件 · {documents.length} 个文件
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setLoading(true); fetchDocuments(); }}
          className="text-foreground/50"
        >
          <RefreshCw className={cn("w-4 h-4 mr-1.5", loading && "animate-spin")} />
          刷新
        </Button>
      </div>

      {/* 搜索和过滤 */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索文档名称或描述..."
            className="pl-9 bg-black/10 border-white/10"
          />
        </div>
        <div className="flex gap-1.5">
          {[
            { key: 'all', label: '全部' },
            { key: 'skill', label: '技能' },
            { key: 'agent', label: '智能体' },
            { key: 'config', label: '配置' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                filter === f.key
                  ? "bg-purple-600/20 text-purple-300 ring-1 ring-purple-500/30"
                  : "text-foreground/40 hover:text-foreground/60 hover:bg-white/5"
              )}
            >
              {f.label}
              {f.key !== 'all' && typeCounts[f.key] ? ` (${typeCounts[f.key]})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* 文档列表 */}
      <div className="space-y-2">
        {filtered.length > 0 ? (
          filtered.map((doc, i) => {
            const cfg = typeConfig[doc.type] || typeConfig.other;
            const Icon = cfg.icon;
            return (
              <div key={i} className="glass-card-purple rounded-lg p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{doc.name}</span>
                    <Badge className={cn("text-xs shrink-0", cfg.color)}>{cfg.label}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-foreground/40">
                    <span className="truncate">{doc.path}</span>
                    <span>{formatSize(doc.size)}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(doc.modifiedAt).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  {doc.description && (
                    <p className="text-xs text-foreground/30 mt-1 truncate">{doc.description}</p>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="glass-card-purple rounded-xl p-12 text-center">
            <AlertTriangle className="w-10 h-10 text-foreground/20 mx-auto mb-3" />
            <p className="text-foreground/40 text-lg">
              {search || filter !== 'all' ? '没有匹配的文档' : '暂无文档'}
            </p>
            <p className="text-xs text-foreground/30 mt-1">
              文档会在配置智能体和技能后自动出现
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
