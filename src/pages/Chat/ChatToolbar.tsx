/**
 * Chat Toolbar
 * Session selector, new session, refresh, and thinking toggle.
 * Rendered in the Header when on the Chat page.
 */
import { useMemo, useState, useRef, useEffect } from 'react';
import { RefreshCw, Brain, Bot, Shield, Users, Download, FileText, Braces } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { useChatStore } from '@/stores/chat';
import { useAgentsStore } from '@/stores/agents';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { RawMessage, ContentBlock } from '@/stores/chat/types';

/** Extract plain text from a message's content field */
function extractMessageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return (content as ContentBlock[])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('');
  }
  return '';
}

/** Format a Unix timestamp (ms or s) as HH:MM */
function formatTime(ts?: number): string {
  if (!ts) return '';
  // Gateway may return seconds; normalise to ms
  const ms = ts > 1e12 ? ts : ts * 1000;
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Build Markdown（标记语言）text from messages */
function buildMarkdown(messages: RawMessage[]): string {
  const now = new Date().toLocaleString();
  const lines: string[] = [
    '# OpenAGI 对话记录',
    `导出时间：${now}`,
    '',
    '## 对话内容',
    '',
  ];
  for (const msg of messages) {
    if (msg.role === 'system') continue;
    const time = formatTime(msg.timestamp);
    const text = extractMessageText(msg.content);
    if (!text.trim()) continue;
    const label =
      msg.role === 'user'
        ? `**用户**${time ? `（${time}）` : ''}`
        : `**AI助手**${time ? `（${time}）` : ''}`;
    lines.push(`${label}：`);
    lines.push(text.trim());
    lines.push('');
  }
  return lines.join('\n');
}

/** Trigger a browser（浏览器）download */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ChatToolbar() {
  const refresh = useChatStore((s) => s.refresh);
  const loading = useChatStore((s) => s.loading);
  const showThinking = useChatStore((s) => s.showThinking);
  const toggleThinking = useChatStore((s) => s.toggleThinking);
  const chatMode = useChatStore((s) => s.chatMode);
  const setChatMode = useChatStore((s) => s.setChatMode);
  const currentAgentId = useChatStore((s) => s.currentAgentId);
  const messages = useChatStore((s) => s.messages);
  const agents = useAgentsStore((s) => s.agents);
  const { t } = useTranslation('chat');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const currentAgentName = useMemo(
    () => (agents ?? []).find((agent) => agent.id === currentAgentId)?.name ?? currentAgentId,
    [agents, currentAgentId],
  );

  // Close export dropdown（下拉菜单）when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    }
    if (exportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportMenuOpen]);

  const timestamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  function handleExportMarkdown() {
    setExportMenuOpen(false);
    if (!messages.length) {
      toast.error(t('toolbar.noMessagesToExport'));
      return;
    }
    const md = buildMarkdown(messages);
    downloadFile(md, `openagi-chat-${timestamp()}.md`, 'text/markdown;charset=utf-8');
    toast.success(t('toolbar.exportSuccess'));
  }

  function handleExportJson() {
    setExportMenuOpen(false);
    if (!messages.length) {
      toast.error(t('toolbar.noMessagesToExport'));
      return;
    }
    const json = JSON.stringify(messages, null, 2);
    downloadFile(json, `openagi-chat-${timestamp()}.json`, 'application/json;charset=utf-8');
    toast.success(t('toolbar.exportSuccess'));
  }

  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-[12px] font-medium text-foreground/80 dark:border-white/10 dark:bg-white/5">
        <Bot className="h-3.5 w-3.5 text-primary" />
        <span>{t('toolbar.currentAgent', { agent: currentAgentName })}</span>
      </div>

      {/* Mode Toggle */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-8 w-8', chatMode === 'debate' && 'bg-primary/10 text-primary')}
              onClick={() => setChatMode('debate')}
            >
              <Shield className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('toolbar.debateMode')}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-8 w-8', chatMode === 'team' && 'bg-primary/10 text-primary')}
              onClick={() => setChatMode('team')}
            >
              <Users className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('toolbar.teamMode')}</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-4 mx-1" />
      </div>

      {/* Refresh */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => refresh()}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('toolbar.refresh')}</p>
        </TooltipContent>
      </Tooltip>

      {/* Thinking Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8',
              showThinking && 'bg-primary/10 text-primary',
            )}
            onClick={toggleThinking}
          >
            <Brain className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{showThinking ? t('toolbar.hideThinking') : t('toolbar.showThinking')}</p>
        </TooltipContent>
      </Tooltip>

      {/* Export Button with Dropdown（下拉菜单） */}
      <div className="relative" ref={exportMenuRef}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setExportMenuOpen((prev) => !prev)}
            >
              <Download className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('toolbar.export')}</p>
          </TooltipContent>
        </Tooltip>

        {exportMenuOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-md border border-black/10 bg-white shadow-md dark:border-white/10 dark:bg-zinc-900">
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/60 rounded-t-md"
              onClick={handleExportMarkdown}
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              {t('toolbar.exportMarkdown')}
            </button>
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/60 rounded-b-md"
              onClick={handleExportJson}
            >
              <Braces className="h-3.5 w-3.5 shrink-0" />
              {t('toolbar.exportJson')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
