'use client';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8888';

// ======== 占位数据（后端未启动时使用） ========

const FALLBACK_MODELS = [
  { id: 'claude-opus-4', name: 'Claude Opus 4', provider: 'Anthropic', available: true },
  { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'Anthropic', available: true },
  { id: 'claude-haiku-4', name: 'Claude Haiku 4', provider: 'Anthropic', available: true },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', available: false },
  { id: 'gemini-2-pro', name: 'Gemini 2 Pro', provider: 'Google', available: false },
];

const FALLBACK_STATUS = {
  version: 'v0.1.0-dev',
  uptime: 0,
  activeAgents: 0,
  totalRequests: 0,
  mood: { label: '就绪', emoji: '✅', level: 80 },
};

// ======== 通用请求封装 ========

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch {
    throw new Error(`API请求失败: ${path}`);
  }
}

// ======== API函数 ========

export async function fetchStatus() {
  try {
    return await request<typeof FALLBACK_STATUS>('/api/v1/heart/status');
  } catch {
    return FALLBACK_STATUS;
  }
}

export async function fetchModels() {
  try {
    return await request<typeof FALLBACK_MODELS>('/api/v1/models');
  } catch {
    return FALLBACK_MODELS;
  }
}

export async function fetchSessions() {
  try {
    const res = await request<{ success: boolean; data: { id: string; title: string; created_at: string; message_count: number; group?: string }[] }>('/api/v1/chat/sessions');
    return (res.data ?? []).map(s => ({
      id: s.id,
      title: s.title,
      timestamp: s.created_at ? new Date(s.created_at).getTime() : Date.now(),
      messageCount: s.message_count ?? 0,
      group: s.group,
    }));
  } catch {
    return [];
  }
}

export async function fetchHistory(sessionId: string) {
  try {
    const res = await request<{ success: boolean; data: { role: string; content: string }[] }>(`/api/v1/chat/history/${sessionId}`);
    return res.data ?? [];
  } catch {
    return [];
  }
}

export async function createSession(title?: string) {
  try {
    return await request<{ id: string; title: string }>('/api/v1/chat/send', {
      method: 'POST',
      body: JSON.stringify({ message: '', session_id: Date.now().toString(), title: title || '新对话' }),
    });
  } catch {
    return { id: Date.now().toString(), title: title || '新对话' };
  }
}

export async function sendMessage(sessionId: string, content: string, model: string) {
  try {
    const res = await request<{
      success: boolean;
      data: {
        reply: string;
        session_id: string;
        tokens: number;
        duration_ms: number;
        model: string;
        core_count: number;
        audit: string;
        heart_level: string;
      };
    }>('/api/v1/chat/send', {
      method: 'POST',
      body: JSON.stringify({ message: content, session_id: sessionId, model }),
    });
    return {
      id: Date.now().toString(),
      content: res.data.reply,
      model: res.data.model,
      tokens: res.data.tokens,
      audit: res.data.audit,
    };
  } catch {
    // Fallback: 模拟AI回复
    await new Promise(r => setTimeout(r, 800));
    return {
      id: Date.now().toString(),
      content: `[演示模式] 您说：「${content}」\n\n后端服务暂未连接（${BASE_URL}），当前显示占位回复。请启动后端服务后重试。`,
      model,
      tokens: undefined as number | undefined,
      audit: undefined as string | undefined,
    };
  }
}

export async function fetchSettings() {
  try {
    return await request<Record<string, unknown>>('/api/v1/settings/');
  } catch {
    return {};
  }
}

export async function saveSettings(settings: Record<string, unknown>) {
  try {
    return await request('/api/v1/settings/multicore', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  } catch {
    return { ok: true };
  }
}

// ======== WebSocket聊天客户端 ========

export class ChatWebSocket {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private onMessage: (chunk: string) => void;
  private onDone: () => void;
  private onError: (err: string) => void;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    sessionId: string,
    onMessage: (chunk: string) => void,
    onDone: () => void,
    onError: (err: string) => void,
  ) {
    this.sessionId = sessionId;
    this.onMessage = onMessage;
    this.onDone = onDone;
    this.onError = onError;
  }

  connect() {
    const wsUrl = BASE_URL.replace(/^http/, 'ws') + '/ws/chat';
    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'chunk') this.onMessage(data.content);
          else if (data.type === 'done') this.onDone();
          else if (data.type === 'error') this.onError(data.message);
        } catch {
          this.onMessage(e.data);
        }
      };
      this.ws.onerror = () => this.onError('WebSocket连接错误');
      this.ws.onclose = () => {
        // 自动重连
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      };
    } catch {
      this.onError('无法建立WebSocket连接');
    }
  }

  send(content: string, model: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ content, model }));
    }
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}
