/**
 * Claude Code Engine 类型定义
 * 定义与 Claw Code Rust 引擎交互的数据结构
 */

/** 引擎状态 */
export type CodeEngineStatus = 'stopped' | 'starting' | 'ready' | 'busy' | 'error';

/** 会话信息 */
export interface CodeSession {
  sessionId: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  workingDirectory: string;
}

/** 工具调用请求 */
export interface ToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** 工具调用结果 */
export interface ToolResult {
  toolUseId: string;
  toolName: string;
  output: string;
  isError: boolean;
}

/** 助手事件（流式响应） */
export type AssistantEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_use'; tool: ToolUse }
  | { type: 'tool_result'; result: ToolResult }
  | { type: 'usage'; inputTokens: number; outputTokens: number }
  | { type: 'message_stop' }
  | { type: 'error'; message: string };

/** 发送消息请求 */
export interface SendMessageRequest {
  sessionId?: string;
  message: string;
  workingDirectory?: string;
  model?: string;
  tools?: string[];
}

/** 发送消息响应（非流式） */
export interface SendMessageResponse {
  sessionId: string;
  events: AssistantEvent[];
}

/** 引擎配置 */
export interface CodeEngineConfig {
  /** Rust 动态库路径（FFI 模式） */
  libraryPath?: string;
  /** CLI 二进制路径（子进程模式） */
  binaryPath?: string;
  /** 默认工作目录 */
  defaultWorkingDirectory?: string;
  /** 默认 AI 模型 */
  defaultModel?: string;
  /** API 密钥 */
  apiKey?: string;
  /** 是否启用 */
  enabled: boolean;
}

/** 14 个内置工具名称 */
export const BUILTIN_TOOLS = [
  'bash',
  'read_file',
  'write_file',
  'edit_file',
  'glob_search',
  'grep_search',
  'WebFetch',
  'WebSearch',
  'TodoWrite',
  'Skill',
  'Agent',
  'ToolSearch',
  'NotebookEdit',
  'Sleep',
] as const;

export type BuiltinToolName = typeof BUILTIN_TOOLS[number];
