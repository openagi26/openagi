/**
 * Claude Code Engine 状态管理
 * 管理代码引擎的连接状态和会话
 */

import { create } from 'zustand';

/** 引擎状态 */
type CodeEngineStatus = 'stopped' | 'starting' | 'ready' | 'busy' | 'error';

/** 工具调用信息 */
interface ToolUseInfo {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  isError?: boolean;
  isComplete?: boolean;
}

/** 代码消息 */
interface CodeMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolUses?: ToolUseInfo[];
  timestamp: number;
}

/** 代码会话 */
interface CodeSessionState {
  sessionId: string;
  messages: CodeMessage[];
  workingDirectory: string;
  model: string;
}

interface CodeEngineStore {
  // 状态
  status: CodeEngineStatus;
  currentSession: CodeSessionState | null;
  sessions: CodeSessionState[];
  streamingText: string;
  isStreaming: boolean;

  // 动作
  setStatus: (status: CodeEngineStatus) => void;
  startNewSession: (workingDirectory?: string, model?: string) => void;
  addUserMessage: (content: string) => void;
  appendStreamingText: (text: string) => void;
  finalizeAssistantMessage: () => void;
  addToolUse: (toolUse: ToolUseInfo) => void;
  updateToolResult: (toolUseId: string, output: string, isError: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  clearSession: () => void;
  switchSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
}

export const useCodeEngineStore = create<CodeEngineStore>((set, get) => ({
  // 初始状态
  status: 'stopped',
  currentSession: null,
  sessions: [],
  streamingText: '',
  isStreaming: false,

  setStatus: (status) => set({ status }),

  startNewSession: (workingDirectory, model) => {
    const sessionId = `ce-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const session: CodeSessionState = {
      sessionId,
      messages: [],
      workingDirectory: workingDirectory || '~',
      model: model || 'claude-sonnet-4-6',
    };
    set((state) => ({
      currentSession: session,
      sessions: [...state.sessions, session],
    }));
  },

  addUserMessage: (content) => {
    const message: CodeMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    set((state) => {
      if (!state.currentSession) return state;
      return {
        currentSession: {
          ...state.currentSession,
          messages: [...state.currentSession.messages, message],
        },
      };
    });
  },

  appendStreamingText: (text) => {
    set((state) => ({
      streamingText: state.streamingText + text,
    }));
  },

  finalizeAssistantMessage: () => {
    const { streamingText, currentSession } = get();
    if (!currentSession || !streamingText) return;

    const message: CodeMessage = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: streamingText,
      timestamp: Date.now(),
    };

    set((state) => ({
      streamingText: '',
      isStreaming: false,
      currentSession: state.currentSession
        ? {
            ...state.currentSession,
            messages: [...state.currentSession.messages, message],
          }
        : null,
    }));
  },

  addToolUse: (toolUse) => {
    set((state) => {
      if (!state.currentSession) return state;
      const lastMsg = state.currentSession.messages[state.currentSession.messages.length - 1];
      if (lastMsg?.role === 'assistant') {
        const updatedMsg = {
          ...lastMsg,
          toolUses: [...(lastMsg.toolUses || []), toolUse],
        };
        return {
          currentSession: {
            ...state.currentSession,
            messages: [
              ...state.currentSession.messages.slice(0, -1),
              updatedMsg,
            ],
          },
        };
      }
      return state;
    });
  },

  updateToolResult: (toolUseId, output, isError) => {
    set((state) => {
      if (!state.currentSession) return state;
      const messages = state.currentSession.messages.map((msg) => {
        if (msg.toolUses) {
          return {
            ...msg,
            toolUses: msg.toolUses.map((t) =>
              t.id === toolUseId ? { ...t, output, isError, isComplete: true } : t
            ),
          };
        }
        return msg;
      });
      return {
        currentSession: { ...state.currentSession, messages },
      };
    });
  },

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  clearSession: () => set({ currentSession: null, streamingText: '', isStreaming: false }),

  switchSession: (sessionId) => {
    const { sessions } = get();
    const session = sessions.find((s) => s.sessionId === sessionId);
    if (session) {
      set({ currentSession: session });
    }
  },

  deleteSession: (sessionId) => {
    set((state) => ({
      sessions: state.sessions.filter((s) => s.sessionId !== sessionId),
      currentSession:
        state.currentSession?.sessionId === sessionId ? null : state.currentSession,
    }));
  },
}));
