/**
 * RunningAgentPlaceholder
 * 移植自 OpenTeams RunningAgentPlaceholder，适配 OpenAGI 架构。
 * 旋转光晕边框 + Agent 头像 + 运行时钟 + 可折叠思考内容 + 错误区 + 停止按钮。
 */
import { useState, useEffect } from 'react';
import { Sparkles, ChevronDown, ChevronRight, Square, AlertCircle, Wrench, Loader2, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { ToolStatus } from '@/stores/chat';

export interface RunningAgentPlaceholderProps {
  /** 当前 Agent 名称 */
  agentName: string;
  /** 开始时间（毫秒时间戳，Date.now() 格式） */
  startTime: number;
  /** 思考内容（来自 streamingMessage 的 thinkingContent） */
  thinkingContent?: string;
  /** 工具调用状态列表 */
  streamingTools?: ToolStatus[];
  /** 错误信息 */
  error?: string;
  /** 是否正在停止中 */
  isStopping?: boolean;
  /** 停止生成回调 */
  onStop: () => void;
}

export function RunningAgentPlaceholder({
  agentName,
  startTime,
  thinkingContent,
  streamingTools = [],
  error,
  isStopping = false,
  onStop,
}: RunningAgentPlaceholderProps) {
  const { t } = useTranslation('chat');
  const [elapsed, setElapsed] = useState(0);
  const [thinkingExpanded, setThinkingExpanded] = useState(true);

  // 每秒更新已用时
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const hasThinking = !!(thinkingContent && thinkingContent.trim().length > 0);
  const hasError = !!(error && error.trim().length > 0);
  const hasTools = streamingTools.length > 0;

  return (
    <div className="flex gap-3">
      {/* Agent 头像 */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-1 bg-black/5 dark:bg-white/5 text-foreground">
        <Sparkles className="h-4 w-4" />
      </div>

      {/* 主卡片容器 — 旋转光晕边框 */}
      <div className="relative w-full max-w-[680px] overflow-hidden rounded-2xl p-[1px]">
        {/* 旋转光晕层（conic-gradient，适配星空紫主题） */}
        <div
          className="absolute inset-[-50%] pointer-events-none"
          style={{
            background:
              'conic-gradient(from 0deg, transparent, rgba(168, 85, 247, 0.7), #8BBEFF, rgba(168, 85, 247, 0.7), transparent 30%)',
            animation: 'shimmer-rotate 4s linear infinite',
          }}
        />

        {/* 内容层 — 玻璃效果 */}
        <div className="relative rounded-2xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border border-white/20 dark:border-white/10 p-4 space-y-3">
          {/* 头部：Agent 名称 + 运行指示 + 停止按钮 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* 运行脉冲指示器 */}
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="text-sm font-medium text-foreground">{agentName}</span>
            </div>

            {/* 停止按钮 */}
            <button
              type="button"
              onClick={onStop}
              disabled={isStopping}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200',
                isStopping
                  ? 'cursor-not-allowed border-border/30 text-muted-foreground opacity-50'
                  : 'border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10 hover:border-destructive/50 active:scale-95',
              )}
            >
              <Square className="h-3 w-3 shrink-0" />
              {isStopping ? t('agent.stopping') : t('agent.stop')}
            </button>
          </div>

          {/* 运行时钟 */}
          <div className="text-sm text-muted-foreground">
            {t('agent.running', { seconds: elapsed })}
          </div>

          {/* 工具调用状态 */}
          {hasTools && (
            <div className="space-y-1">
              {streamingTools.map((tool) => {
                const isRunning = tool.status === 'running';
                const isError = tool.status === 'error';
                return (
                  <div
                    key={tool.toolCallId || tool.id || tool.name}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors',
                      isRunning && 'border-primary/30 bg-primary/5 text-foreground',
                      !isRunning && !isError && 'border-border/50 bg-muted/20 text-muted-foreground',
                      isError && 'border-destructive/30 bg-destructive/5 text-destructive',
                    )}
                  >
                    {isRunning && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />}
                    {!isRunning && !isError && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                    {isError && <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                    <Wrench className="h-3 w-3 shrink-0 opacity-60" />
                    <span className="font-mono text-[12px] font-medium">{tool.name}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* 思考内容区 */}
          {hasThinking && (
            <div className="rounded-lg border border-border/50 bg-black/[0.03] dark:bg-white/[0.03] p-3">
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <span>{t('agent.thinking')}</span>
                <button
                  type="button"
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                  onClick={() => setThinkingExpanded((prev) => !prev)}
                  aria-expanded={thinkingExpanded}
                >
                  <span className="text-[11px] normal-case">
                    {thinkingExpanded ? t('agent.collapse') : t('agent.expand')}
                  </span>
                  {thinkingExpanded ? (
                    <ChevronDown className="h-3 w-3 transition-transform" />
                  ) : (
                    <ChevronRight className="h-3 w-3 transition-transform" />
                  )}
                </button>
              </div>
              {thinkingExpanded && (
                <div className="rounded-[4px_8px_8px_4px] border-l-[3px] border-l-primary bg-white/50 dark:bg-black/20 px-3 py-2">
                  <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground font-mono">
                    {thinkingContent}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* 错误区 */}
          {hasError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive uppercase tracking-wide">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>Error</span>
              </div>
              <div className="rounded-[4px_8px_8px_4px] border-l-[3px] border-l-destructive/70 bg-white/50 dark:bg-black/20 px-3 py-2">
                <p className="text-xs text-destructive break-words">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
