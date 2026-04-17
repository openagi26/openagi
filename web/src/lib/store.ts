'use client';

import React, { createContext, useContext, useReducer, useCallback } from 'react';

// ======== 类型定义 ========

export type Theme = 'light' | 'dark' | 'custom';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  agentName?: string;
  agentColor?: string;
  timestamp: number;
  thinking?: boolean;
  tokens?: number;
  audit?: string;
}

export interface Session {
  id: string;
  title: string;
  lastMessage?: string;
  timestamp: number;
  messageCount: number;
  group?: string;
}

export interface CoreStatus {
  id: number;
  name: string;
  model: string;
  role: string;
  status: 'idle' | 'thinking' | 'done' | 'error';
  score?: number;
  color: string;
}

export interface HeartMood {
  label: string;
  emoji: string;
  color: string;
  level: number; // 0-100
}

export interface AppState {
  // 主题
  theme: Theme;
  customBgUrl: string;

  // 布局
  leftSidebarOpen: boolean;
  rightPanelOpen: boolean;
  fullscreen: boolean;

  // 聊天
  sessions: Session[];
  activeSessionId: string | null;
  messages: Message[];
  isAIThinking: boolean;
  thinkingSeconds: number;

  // 多核状态
  coreCount: number;
  cores: CoreStatus[];

  // 心绪状态
  heartMood: HeartMood;

  // 模型
  currentModel: string;

  // 设置（简化）
  inspectionEnabled: boolean;
  inspectionFrequency: number;
}

// ======== 初始状态 ========

const INITIAL_CORES: CoreStatus[] = [
  { id: 1, name: 'CEO主核', model: 'claude-opus-4', role: '决策与协调', status: 'idle', color: '#7c3aed' },
  { id: 2, name: '审计-外A', model: 'claude-sonnet-4', role: '质量审计', status: 'idle', color: '#2563eb' },
  { id: 3, name: '审计-外B', model: 'claude-haiku-4', role: '快速校验', status: 'idle', color: '#059669' },
  { id: 4, name: '审计-外C', model: 'claude-opus-4', role: '深度审计', status: 'idle', color: '#d97706' },
  { id: 5, name: '执行代理', model: 'claude-sonnet-4', role: '任务执行', status: 'idle', color: '#dc2626' },
];

const INITIAL_SESSIONS: Session[] = [];

const INITIAL_STATE: AppState = {
  theme: 'light',
  customBgUrl: '',
  leftSidebarOpen: true,
  rightPanelOpen: true,
  fullscreen: false,
  sessions: INITIAL_SESSIONS,
  activeSessionId: null,
  messages: [],
  isAIThinking: false,
  thinkingSeconds: 0,
  coreCount: 5,
  cores: INITIAL_CORES,
  heartMood: { label: '专注', emoji: '🎯', color: '#7c3aed', level: 78 },
  currentModel: 'claude-opus-4',
  inspectionEnabled: true,
  inspectionFrequency: 10,
};

// ======== Actions ========

type Action =
  | { type: 'SET_THEME'; payload: Theme }
  | { type: 'SET_CUSTOM_BG'; payload: string }
  | { type: 'TOGGLE_LEFT_SIDEBAR' }
  | { type: 'TOGGLE_RIGHT_PANEL' }
  | { type: 'TOGGLE_FULLSCREEN' }
  | { type: 'SET_ACTIVE_SESSION'; payload: string }
  | { type: 'NEW_SESSION' }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'REPLACE_MESSAGE'; payload: { id: string; message: Message } }
  | { type: 'REMOVE_MESSAGE'; payload: string }
  | { type: 'SET_AI_THINKING'; payload: boolean }
  | { type: 'SET_THINKING_SECONDS'; payload: number }
  | { type: 'SET_CORE_COUNT'; payload: number }
  | { type: 'UPDATE_CORE'; payload: { id: number; status: CoreStatus['status']; score?: number } }
  | { type: 'SET_HEART_MOOD'; payload: HeartMood }
  | { type: 'SET_MODEL'; payload: string }
  | { type: 'SET_INSPECTION'; payload: { enabled: boolean; frequency: number } }
  | { type: 'SET_SESSIONS'; payload: Session[] }
  | { type: 'SET_MESSAGES'; payload: Message[] };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'SET_CUSTOM_BG':
      return { ...state, customBgUrl: action.payload, theme: 'custom' };
    case 'TOGGLE_LEFT_SIDEBAR':
      return { ...state, leftSidebarOpen: !state.leftSidebarOpen };
    case 'TOGGLE_RIGHT_PANEL':
      return { ...state, rightPanelOpen: !state.rightPanelOpen };
    case 'TOGGLE_FULLSCREEN':
      return { ...state, fullscreen: !state.fullscreen };
    case 'SET_ACTIVE_SESSION':
      return { ...state, activeSessionId: action.payload, messages: [] };
    case 'NEW_SESSION': {
      const newSession: Session = {
        id: Date.now().toString(),
        title: '新对话',
        lastMessage: '',
        timestamp: Date.now(),
        messageCount: 0,
        group: '今天',
      };
      return { ...state, sessions: [newSession, ...state.sessions], activeSessionId: newSession.id, messages: [] };
    }
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'REPLACE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(m => m.id === action.payload.id ? action.payload.message : m),
      };
    case 'REMOVE_MESSAGE':
      return { ...state, messages: state.messages.filter(m => m.id !== action.payload) };
    case 'SET_AI_THINKING':
      return { ...state, isAIThinking: action.payload, thinkingSeconds: action.payload ? 0 : state.thinkingSeconds };
    case 'SET_THINKING_SECONDS':
      return { ...state, thinkingSeconds: action.payload };
    case 'SET_CORE_COUNT':
      return { ...state, coreCount: Math.max(1, Math.min(5, action.payload)) };
    case 'UPDATE_CORE':
      return {
        ...state,
        cores: state.cores.map(c =>
          c.id === action.payload.id
            ? { ...c, status: action.payload.status, score: action.payload.score ?? c.score }
            : c
        ),
      };
    case 'SET_HEART_MOOD':
      return { ...state, heartMood: action.payload };
    case 'SET_MODEL':
      return { ...state, currentModel: action.payload };
    case 'SET_INSPECTION':
      return { ...state, inspectionEnabled: action.payload.enabled, inspectionFrequency: action.payload.frequency };
    case 'SET_SESSIONS':
      return { ...state, sessions: action.payload };
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    default:
      return state;
  }
}

// ======== Context ========

interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  // 🔴 2026-04-17 修复：启动时从后端拉取 settings + 主模型，同步到 store
  // 否则前端一直显示 claude-opus-4 但实际调用 ollama/gemma3:1b
  React.useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8888';
    fetch(`${base}/api/v1/settings/`)
      .then(r => r.json())
      .then(j => {
        const cc = j?.data?.multicore?.core_count;
        if (typeof cc === 'number') dispatch({ type: 'SET_CORE_COUNT', payload: cc });
      })
      .catch(() => {});
    fetch(`${base}/api/v1/models`)
      .then(r => r.json())
      .then(j => {
        const primary = (j?.data || []).find((m: { role?: string }) => m?.role === 'primary');
        if (primary?.id) dispatch({ type: 'SET_MODEL', payload: primary.id });
      })
      .catch(() => {});
  }, []);

  return React.createElement(StoreContext.Provider, { value: { state, dispatch } }, children);
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

// ======== 便捷hooks ========

export function useTheme() {
  const { state, dispatch } = useStore();
  const setTheme = useCallback((t: Theme) => dispatch({ type: 'SET_THEME', payload: t }), [dispatch]);
  const setCustomBg = useCallback((url: string) => dispatch({ type: 'SET_CUSTOM_BG', payload: url }), [dispatch]);
  return { theme: state.theme, customBgUrl: state.customBgUrl, setTheme, setCustomBg };
}

export function useChat() {
  const { state, dispatch } = useStore();
  const addMessage = useCallback((msg: Message) => dispatch({ type: 'ADD_MESSAGE', payload: msg }), [dispatch]);
  const setThinking = useCallback((v: boolean) => dispatch({ type: 'SET_AI_THINKING', payload: v }), [dispatch]);
  return { messages: state.messages, isAIThinking: state.isAIThinking, thinkingSeconds: state.thinkingSeconds, addMessage, setThinking };
}
