/**
 * Sidebar Component
 * Navigation sidebar with menu items.
 * No longer fixed - sits inside the flex layout below the title bar.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Network,
  Bot,
  Puzzle,
  Clock,
  Settings as SettingsIcon,
  PanelLeftClose,
  PanelLeft,
  Plus,
  Trash2,
  Cpu,
  LayoutDashboard,
  Server,
  MessageSquare,
  BarChart3,
  FileText,
  Shield,
  Target,
  BookOpen,
  Settings2,
  ShoppingBag,
  Globe,
  Link2,
  Search,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settings';
import { useChatStore } from '@/stores/chat';
import { useGatewayStore } from '@/stores/gateway';
import { useAgentsStore } from '@/stores/agents';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useTranslation } from 'react-i18next';
import logoSvg from '@/assets/logo.png';

type SessionBucketKey =
  | 'today'
  | 'yesterday'
  | 'withinWeek'
  | 'withinTwoWeeks'
  | 'withinMonth'
  | 'older';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  collapsed?: boolean;
  onClick?: () => void;
  testId?: string;
}

function NavItem({ to, icon, label, badge, collapsed, onClick, testId }: NavItemProps) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      data-testid={testId}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] font-medium transition-colors',
          'hover:bg-purple-500/10 dark:hover:bg-purple-400/10 text-foreground/80',
          isActive
            ? 'bg-purple-500/15 dark:bg-purple-400/15 text-foreground'
            : '',
          collapsed && 'justify-center px-0'
        )
      }
    >
      {({ isActive }) => (
        <>
          <div className={cn("flex shrink-0 items-center justify-center", isActive ? "text-foreground" : "text-muted-foreground")}>
            {icon}
          </div>
          {!collapsed && (
            <>
              <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{label}</span>
              {badge && (
                <Badge variant="secondary" className="ml-auto shrink-0">
                  {badge}
                </Badge>
              )}
            </>
          )}
        </>
      )}
    </NavLink>
  );
}

function getSessionBucket(activityMs: number, nowMs: number): SessionBucketKey {
  if (!activityMs || activityMs <= 0) return 'older';

  const now = new Date(nowMs);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

  if (activityMs >= startOfToday) return 'today';
  if (activityMs >= startOfYesterday) return 'yesterday';

  const daysAgo = (startOfToday - activityMs) / (24 * 60 * 60 * 1000);
  if (daysAgo <= 7) return 'withinWeek';
  if (daysAgo <= 14) return 'withinTwoWeeks';
  if (daysAgo <= 30) return 'withinMonth';
  return 'older';
}

const INITIAL_NOW_MS = Date.now();

function getAgentIdFromSessionKey(sessionKey: string): string {
  if (!sessionKey.startsWith('agent:')) return 'main';
  const [, agentId] = sessionKey.split(':');
  return agentId || 'main';
}

export function Sidebar() {
  const sidebarCollapsed = useSettingsStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useSettingsStore((state) => state.setSidebarCollapsed);

  const sessions = useChatStore((s) => s.sessions);
  const currentSessionKey = useChatStore((s) => s.currentSessionKey);
  const sessionLabels = useChatStore((s) => s.sessionLabels);
  const sessionLastActivity = useChatStore((s) => s.sessionLastActivity);
  const switchSession = useChatStore((s) => s.switchSession);
  const newSession = useChatStore((s) => s.newSession);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const loadSessions = useChatStore((s) => s.loadSessions);
  const loadHistory = useChatStore((s) => s.loadHistory);
  const renameSession = useChatStore((s) => s.renameSession);

  const gatewayStatus = useGatewayStore((s) => s.status);
  const isGatewayRunning = gatewayStatus.state === 'running';

  useEffect(() => {
    if (!isGatewayRunning) return;
    let cancelled = false;
    const hasExistingMessages = useChatStore.getState().messages.length > 0;
    (async () => {
      await loadSessions();
      if (cancelled) return;
      await loadHistory(hasExistingMessages);
    })();
    return () => {
      cancelled = true;
    };
  }, [isGatewayRunning, loadHistory, loadSessions]);
  const agents = useAgentsStore((s) => s.agents);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);

  const navigate = useNavigate();
  const isOnChat = useLocation().pathname === '/';

  const getSessionLabel = (key: string, displayName?: string, label?: string) =>
    sessionLabels[key] ?? label ?? displayName ?? key;

  const { t } = useTranslation(['common', 'chat']);
  const [sessionToDelete, setSessionToDelete] = useState<{ key: string; label: string } | null>(null);
  const [nowMs, setNowMs] = useState(INITIAL_NOW_MS);
  const [sessionSearch, setSessionSearch] = useState('');
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const historyListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  const agentNameById = useMemo(
    () => Object.fromEntries((agents ?? []).map((agent) => [agent.id, agent.name])),
    [agents],
  );
  const filteredSessions = useMemo(
    () =>
      sessionSearch
        ? sessions.filter((s) =>
            getSessionLabel(s.key, s.displayName, s.label).toLowerCase().includes(sessionSearch.toLowerCase())
          )
        : sessions,
    [sessions, sessionSearch, sessionLabels],
  );

  const sessionBuckets: Array<{ key: SessionBucketKey; label: string; sessions: typeof sessions }> = [
    { key: 'today', label: t('chat:historyBuckets.today'), sessions: [] },
    { key: 'yesterday', label: t('chat:historyBuckets.yesterday'), sessions: [] },
    { key: 'withinWeek', label: t('chat:historyBuckets.withinWeek'), sessions: [] },
    { key: 'withinTwoWeeks', label: t('chat:historyBuckets.withinTwoWeeks'), sessions: [] },
    { key: 'withinMonth', label: t('chat:historyBuckets.withinMonth'), sessions: [] },
    { key: 'older', label: t('chat:historyBuckets.older'), sessions: [] },
  ];
  const sessionBucketMap = Object.fromEntries(sessionBuckets.map((bucket) => [bucket.key, bucket])) as Record<
    SessionBucketKey,
    (typeof sessionBuckets)[number]
  >;

  for (const session of [...filteredSessions].sort((a, b) =>
    (sessionLastActivity[b.key] ?? 0) - (sessionLastActivity[a.key] ?? 0)
  )) {
    const bucketKey = getSessionBucket(sessionLastActivity[session.key] ?? 0, nowMs);
    sessionBucketMap[bucketKey].sessions.push(session);
  }

  const navItems = [
    { to: '/overview', icon: <LayoutDashboard className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.overview'), testId: 'sidebar-nav-overview' },
    { to: '/models', icon: <Cpu className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.models'), testId: 'sidebar-nav-models' },
    { to: '/agents', icon: <Bot className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.agents'), testId: 'sidebar-nav-agents' },
    { to: '/channels', icon: <Network className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.channels'), testId: 'sidebar-nav-channels' },
    { to: '/skills', icon: <Puzzle className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.skills'), testId: 'sidebar-nav-skills' },
    { to: '/cron', icon: <Clock className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.cronTasks'), testId: 'sidebar-nav-cron' },
    { to: '/trinity', icon: <Shield className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.trinity'), testId: 'sidebar-nav-trinity' },
    { to: '/trinity/goals', icon: <Target className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.goals'), testId: 'sidebar-nav-goals' },
    { to: '/trinity/governance', icon: <BookOpen className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.governance'), testId: 'sidebar-nav-governance' },
    { to: '/trinity/settings', icon: <Settings2 className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.trinitySettings'), testId: 'sidebar-nav-trinity-settings' },
    { to: '/trinity/market', icon: <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.market'), testId: 'sidebar-nav-market' },
    { to: '/trinity/swarm', icon: <Globe className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.swarm'), testId: 'sidebar-nav-swarm' },
    { to: '/trinity/blockchain', icon: <Link2 className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.blockchain'), testId: 'sidebar-nav-blockchain' },
  ];

  const opsItems = [
    { to: '/instances', icon: <Server className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.instances'), testId: 'sidebar-nav-instances' },
    { to: '/sessions', icon: <MessageSquare className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.sessions'), testId: 'sidebar-nav-sessions' },
    { to: '/usage', icon: <BarChart3 className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.usage'), testId: 'sidebar-nav-usage' },
    { to: '/documents', icon: <FileText className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.documents'), testId: 'sidebar-nav-documents' },
  ];

  return (
    <aside
      data-testid="sidebar"
      className={cn(
        'flex shrink-0 flex-col glass-sidebar transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Top Header Toggle */}
      <div className={cn("flex items-center p-2 h-12", sidebarCollapsed ? "justify-center" : "justify-between")}>
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2 px-2 overflow-hidden">
            <img src={logoSvg} alt="OpenAGI" className="h-5 w-auto shrink-0" />
            <span className="text-sm font-semibold truncate whitespace-nowrap neon-text">
              OpenAGI
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          {sidebarCollapsed ? (
            <PanelLeft className="h-[18px] w-[18px]" />
          ) : (
            <PanelLeftClose className="h-[18px] w-[18px]" />
          )}
        </Button>
      </div>

      {/* Navigation — max half the sidebar height, scrollable */}
      <nav className="flex flex-col px-2 gap-0.5 overflow-y-auto" style={{ maxHeight: '45%' }}>
        <button
          data-testid="sidebar-new-chat"
          onClick={() => {
            const { messages } = useChatStore.getState();
            if (messages.length > 0) newSession();
            navigate('/');
          }}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] font-medium transition-colors mb-2',
            'bg-gradient-to-r from-purple-600/20 to-violet-500/15 dark:from-purple-500/25 dark:to-violet-400/15 shadow-none border border-purple-500/20 text-foreground hover:from-purple-600/30 hover:to-violet-500/25',
            sidebarCollapsed && 'justify-center px-0',
          )}
        >
          <div className="flex shrink-0 items-center justify-center text-foreground/80">
            <Plus className="h-[18px] w-[18px]" strokeWidth={2} />
          </div>
          {!sidebarCollapsed && <span className="flex-1 text-left overflow-hidden text-ellipsis whitespace-nowrap">{t('sidebar.newChat')}</span>}
        </button>

        {navItems.map((item) => (
          <NavItem
            key={item.to}
            {...item}
            collapsed={sidebarCollapsed}
          />
        ))}

        {/* 运维分组 */}
        {!sidebarCollapsed && (
          <div className="mt-3 mb-1 px-2.5 text-[11px] font-medium text-muted-foreground/40 tracking-wider uppercase">
            {t('sidebar.ops')}
          </div>
        )}
        {sidebarCollapsed && <div className="my-2 mx-3 border-t border-white/5" />}

        {opsItems.map((item) => (
          <NavItem
            key={item.to}
            {...item}
            collapsed={sidebarCollapsed}
          />
        ))}
      </nav>

      {/* 聊天历史列表 — 始终显示（展开模式），支持上下滑动按钮 */}
      {!sidebarCollapsed && (
        <div className="flex flex-col flex-1 min-h-0 mt-3 border-t border-white/5">
          {/* 标题行 + 上下滑动按钮 */}
          <div className="flex items-center justify-between px-2.5 py-1.5 shrink-0">
            <span className="text-[11px] font-medium text-muted-foreground/50 tracking-wider uppercase">
              {t('sidebar.chatHistory', '聊天历史')}
            </span>
            <div className="flex gap-0.5">
              <button
                aria-label="向上滚动"
                onClick={() => historyListRef.current?.scrollBy({ top: -200, behavior: 'smooth' })}
                className="flex items-center justify-center h-5 w-5 rounded text-muted-foreground/40 hover:text-foreground/60 hover:bg-white/5 transition-colors"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                aria-label="向下滚动"
                onClick={() => historyListRef.current?.scrollBy({ top: 200, behavior: 'smooth' })}
                className="flex items-center justify-center h-5 w-5 rounded text-muted-foreground/40 hover:text-foreground/60 hover:bg-white/5 transition-colors"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* 搜索框 */}
          <div className="relative px-2 mb-1.5 shrink-0">
            <Search className="absolute left-4.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <input
              type="text"
              value={sessionSearch}
              onChange={(e) => setSessionSearch(e.target.value)}
              placeholder={t('chat:sidebar.searchPlaceholder', '搜索会话...')}
              className="w-full rounded-md bg-black/5 dark:bg-white/5 pl-8 pr-3 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-purple-500/30"
            />
          </div>

          {/* 会话列表（可滚动区域，ref 绑定供滑动按钮控制） */}
          <div
            ref={historyListRef}
            className="flex-1 overflow-y-auto overflow-x-hidden px-2 space-y-0.5 pb-2"
          >
            {sessions.length === 0 ? (
              <div className="px-2.5 py-6 text-center text-[12px] text-muted-foreground/40 leading-relaxed">
                暂无会话，发第一条消息开始聊吧～
              </div>
            ) : (
              sessionBuckets.map((bucket) => (
                bucket.sessions.length > 0 ? (
                  <div key={bucket.key} className="pt-2">
                    <div className="px-2.5 pb-1 text-[11px] font-medium text-muted-foreground/60 tracking-tight">
                      {bucket.label}
                    </div>
                    {bucket.sessions.map((s) => {
                      const agentId = getAgentIdFromSessionKey(s.key);
                      const agentName = agentNameById[agentId] || agentId;
                      return (
                        <div key={s.key} className="group relative flex items-center">
                          <button
                            onClick={() => { switchSession(s.key); navigate('/'); }}
                            className={cn(
                              'w-full text-left rounded-lg px-2.5 py-1.5 text-[13px] transition-colors pr-7',
                              'hover:bg-purple-500/8 dark:hover:bg-purple-400/8',
                              isOnChat && currentSessionKey === s.key
                                ? 'bg-purple-500/12 dark:bg-purple-400/12 text-foreground font-medium'
                                : 'text-foreground/75',
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="shrink-0 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-400/15 dark:text-purple-300">
                                {agentName}
                              </span>
                              {renamingKey === s.key ? (
                                <input
                                  autoFocus
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onBlur={() => { renameSession(s.key, renameValue); setRenamingKey(null); }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') { renameSession(s.key, renameValue); setRenamingKey(null); }
                                    if (e.key === 'Escape') setRenamingKey(null);
                                  }}
                                  className="flex-1 min-w-0 bg-transparent outline-none border-b border-purple-500/50 text-[13px]"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <span
                                  className="truncate"
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    setRenamingKey(s.key);
                                    setRenameValue(getSessionLabel(s.key, s.displayName, s.label));
                                  }}
                                >
                                  {getSessionLabel(s.key, s.displayName, s.label)}
                                </span>
                              )}
                            </div>
                          </button>
                          <button
                            aria-label="Delete session"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSessionToDelete({
                                key: s.key,
                                label: getSessionLabel(s.key, s.displayName, s.label),
                              });
                            }}
                            className={cn(
                              'absolute right-1 flex items-center justify-center rounded p-0.5 transition-opacity',
                              'opacity-0 group-hover:opacity-100',
                              'text-muted-foreground hover:text-destructive hover:bg-destructive/10',
                            )}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null
              ))
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-2 mt-auto">
        <NavLink
            to="/settings"
            data-testid="sidebar-nav-settings"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] font-medium transition-colors',
                'hover:bg-purple-500/10 dark:hover:bg-purple-400/10 text-foreground/80',
                isActive && 'bg-purple-500/15 dark:bg-purple-400/15 text-foreground',
                sidebarCollapsed ? 'justify-center px-0' : ''
              )
            }
          >
          {({ isActive }) => (
            <>
              <div className={cn("flex shrink-0 items-center justify-center", isActive ? "text-foreground" : "text-muted-foreground")}>
                <SettingsIcon className="h-[18px] w-[18px]" strokeWidth={2} />
              </div>
              {!sidebarCollapsed && <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{t('sidebar.settings')}</span>}
            </>
          )}
        </NavLink>

        {/* OpenClaw 外部链接已移除 — 所有功能已内置 */}
      </div>

      <ConfirmDialog
        open={!!sessionToDelete}
        title={t('common:actions.confirm')}
        message={t('common:sidebar.deleteSessionConfirm', { label: sessionToDelete?.label })}
        confirmLabel={t('common:actions.delete')}
        cancelLabel={t('common:actions.cancel')}
        variant="destructive"
        onConfirm={async () => {
          if (!sessionToDelete) return;
          await deleteSession(sessionToDelete.key);
          if (currentSessionKey === sessionToDelete.key) navigate('/');
          setSessionToDelete(null);
        }}
        onCancel={() => setSessionToDelete(null)}
      />
    </aside>
  );
}
