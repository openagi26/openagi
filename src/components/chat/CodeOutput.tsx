/**
 * 代码输出渲染组件
 * 在聊天界面中渲染 Claude Code Engine 的工具调用结果
 */

import React from 'react';

interface ToolUseInfo {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  isError?: boolean;
  isComplete?: boolean;
}

interface CodeOutputProps {
  toolUses: ToolUseInfo[];
}

/** 工具名称的中文映射 */
const TOOL_NAMES_ZH: Record<string, string> = {
  bash: '终端命令',
  read_file: '读取文件',
  write_file: '创建文件',
  edit_file: '编辑文件',
  glob_search: '搜索文件',
  grep_search: '搜索内容',
  WebFetch: '获取网页',
  WebSearch: '网页搜索',
  TodoWrite: '任务管理',
  Skill: '加载技能',
  Agent: '子智能体',
  ToolSearch: '工具发现',
  NotebookEdit: '编辑笔记本',
  Sleep: '等待',
};

/** 获取工具图标 */
function getToolIcon(name: string): string {
  const icons: Record<string, string> = {
    bash: '💻',
    read_file: '📖',
    write_file: '📝',
    edit_file: '✏️',
    glob_search: '🔍',
    grep_search: '🔎',
    WebFetch: '🌐',
    WebSearch: '🔍',
    TodoWrite: '📋',
    Skill: '🧩',
    Agent: '🤖',
    ToolSearch: '🔧',
    NotebookEdit: '📓',
    Sleep: '⏳',
  };
  return icons[name] || '🔧';
}

/** 单个工具调用渲染 */
function ToolUseBlock({ tool }: { tool: ToolUseInfo }) {
  const [expanded, setExpanded] = React.useState(false);
  const zhName = TOOL_NAMES_ZH[tool.name] || tool.name;
  const icon = getToolIcon(tool.name);
  const statusColor = tool.isError
    ? 'text-red-400'
    : tool.isComplete
    ? 'text-green-400'
    : 'text-yellow-400';
  const statusText = tool.isError
    ? '失败'
    : tool.isComplete
    ? '完成'
    : '执行中...';

  return (
    <div className="my-2 rounded-lg border border-zinc-700 bg-zinc-800/50 overflow-hidden">
      {/* 标题栏 */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-zinc-700/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span>{icon}</span>
        <span className="font-medium text-sm text-zinc-200">
          {zhName}
        </span>
        <span className={`text-xs ${statusColor}`}>
          {statusText}
        </span>
        <span className="ml-auto text-xs text-zinc-500">
          {expanded ? '收起 ▲' : '展开 ▼'}
        </span>
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div className="border-t border-zinc-700">
          {/* 输入参数 */}
          <div className="px-3 py-2 bg-zinc-900/50">
            <div className="text-xs text-zinc-500 mb-1">输入参数</div>
            <pre className="text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap break-all">
              {formatInput(tool.name, tool.input)}
            </pre>
          </div>

          {/* 输出结果 */}
          {tool.output && (
            <div className="px-3 py-2 border-t border-zinc-700">
              <div className="text-xs text-zinc-500 mb-1">
                {tool.isError ? '错误信息' : '执行结果'}
              </div>
              <pre
                className={`text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-64 overflow-y-auto ${
                  tool.isError ? 'text-red-300' : 'text-green-300'
                }`}
              >
                {tool.output.length > 2000
                  ? tool.output.slice(0, 2000) + '\n... (内容过长，已截断)'
                  : tool.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 格式化工具输入 */
function formatInput(toolName: string, input: Record<string, unknown>): string {
  if (toolName === 'bash' && typeof input.command === 'string') {
    return `$ ${input.command}`;
  }
  if ((toolName === 'read_file' || toolName === 'write_file') && typeof input.file_path === 'string') {
    return input.file_path;
  }
  if (toolName === 'edit_file' && typeof input.file_path === 'string') {
    return `${input.file_path}\n旧内容 → 新内容`;
  }
  if (toolName === 'glob_search' && typeof input.pattern === 'string') {
    return `模式: ${input.pattern}`;
  }
  if (toolName === 'grep_search' && typeof input.pattern === 'string') {
    return `搜索: ${input.pattern}`;
  }
  return JSON.stringify(input, null, 2);
}

/** 代码输出主组件 */
export function CodeOutput({ toolUses }: CodeOutputProps) {
  if (!toolUses || toolUses.length === 0) return null;

  return (
    <div className="space-y-1">
      {toolUses.map((tool) => (
        <ToolUseBlock key={tool.id} tool={tool} />
      ))}
    </div>
  );
}

export default CodeOutput;
