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

async function request<T>(path: string, options?: RequestInit, timeoutMs = 60000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...options,
    });
    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch { /* ignore */ }
      throw new Error(`HTTP_${res.status}:${body}`);
    }
    return res.json();
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('TIMEOUT');
    }
    throw err;
  } finally {
    clearTimeout(timer);
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

export async function sendMessage(sessionId: string, content: string, model: string, coreCount: number = 1) {
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
      body: JSON.stringify({ message: content, session_id: sessionId, model, core_count: coreCount }),
    }, 90000 + (coreCount - 1) * 60000); // 1核90秒，每多1核+60秒（2核150秒，5核330秒）
    return {
      id: Date.now().toString(),
      content: res.data.reply,
      model: res.data.model,
      tokens: res.data.tokens,
      audit: res.data.audit,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    let errorContent: string;

    if (msg === 'TIMEOUT') {
      errorContent = `[请求超时] LLM推理超时（多核模式需更长时间），请稍后重试。`;
    } else if (msg.includes('Failed to fetch') || msg.includes('ECONNREFUSED') || msg.includes('NetworkError')) {
      errorContent = `[后端不可达] 无法连接到后端服务（${BASE_URL}）。请确认后端已启动：make dev`;
    } else if (msg.startsWith('HTTP_')) {
      const [code, ...rest] = msg.slice(5).split(':');
      errorContent = `[LLM调用失败] 后端返回错误 HTTP ${code}。${rest.join(':') ? `详情：${rest.join(':')}` : '请检查后端日志。'}`;
    } else {
      errorContent = `[请求失败] ${msg}`;
    }

    return {
      id: Date.now().toString(),
      content: errorContent,
      model,
      tokens: undefined as number | undefined,
      audit: undefined as string | undefined,
    };
  }
}

export async function fetchSettings() {
  try {
    const res = await request<{ success: boolean; data: Record<string, unknown> }>('/api/v1/settings/');
    return res.data ?? {};
  } catch {
    return {};
  }
}

export async function saveSettings(settings: Record<string, unknown>) {
  try {
    return await request('/api/v1/settings/', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  } catch {
    return { ok: true };
  }
}

// ======== 流式聊天（SSE via fetch+ReadableStream） ========

/**
 * 流式发送消息，逐字回调。
 *
 * @param sessionId   会话 ID
 * @param content     用户消息内容
 * @param model       模型 ID（传给后端做选择参考）
 * @param coreCount   核心数
 * @param persona     人格 key（如 'xiaoxing'）
 * @param onDelta     每收到一段文字时调用
 * @param onDone      流结束时调用（含 total_tokens / model / duration_ms）
 * @param onError     出错时调用
 */
export async function sendMessageStream(
  sessionId: string,
  content: string,
  model: string,
  coreCount: number = 1,
  persona: string = 'xiaoxing',
  onDelta: (delta: string) => void,
  onDone: (meta: { total_tokens?: number; model?: string; duration_ms?: number }) => void,
  onError: (err: string) => void,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000); // 2分钟总超时

  try {
    const res = await fetch(`${BASE_URL}/api/v1/chat/send/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: content,
        session_id: sessionId,
        model,
        core_count: coreCount,
        persona,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch { /* ignore */ }
      onError(`HTTP_${res.status}: ${body}`);
      return;
    }

    if (!res.body) {
      onError('浏览器不支持 ReadableStream');
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE 每条消息以 \n\n 结束
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? ''; // 最后可能是不完整的块，留到下次

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;

        try {
          const data = JSON.parse(jsonStr);
          if (data.error) {
            onError(data.error);
            return;
          } else if (data.done) {
            onDone({
              total_tokens: data.total_tokens,
              model: data.model,
              duration_ms: data.duration_ms,
            });
            return;
          } else if (typeof data.delta === 'string') {
            onDelta(data.delta);
          }
        } catch {
          // 忽略解析错误，继续读下一块
        }
      }
    }

    // 如果流正常关闭但没收到 done 事件，也触发 onDone
    onDone({});
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      onError('流式请求超时（> 120 秒）');
    } else {
      onError(err instanceof Error ? err.message : String(err));
    }
  } finally {
    clearTimeout(timer);
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
