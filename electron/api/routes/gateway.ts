import type { IncomingMessage, ServerResponse } from 'http';
import { PORTS } from '../../utils/config';
import { buildOpenClawControlUiUrl } from '../../utils/openclaw-control-ui';
import { getSetting } from '../../utils/store';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson } from '../route-utils';

export async function handleGatewayRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: HostApiContext,
): Promise<boolean> {
  if (url.pathname === '/api/app/gateway-info' && req.method === 'GET') {
    const status = ctx.gatewayManager.getStatus();
    const token = await getSetting('gatewayToken');
    const port = status.port || PORTS.OPENCLAW_GATEWAY;
    sendJson(res, 200, {
      wsUrl: `ws://127.0.0.1:${port}/ws`,
      token,
      port,
    });
    return true;
  }

  if (url.pathname === '/api/gateway/status' && req.method === 'GET') {
    sendJson(res, 200, ctx.gatewayManager.getStatus());
    return true;
  }

  if (url.pathname === '/api/gateway/health' && req.method === 'GET') {
    const health = await ctx.gatewayManager.checkHealth();
    sendJson(res, 200, health);
    return true;
  }

  if (url.pathname === '/api/gateway/start' && req.method === 'POST') {
    try {
      await ctx.gatewayManager.start();
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/gateway/stop' && req.method === 'POST') {
    try {
      await ctx.gatewayManager.stop();
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/gateway/restart' && req.method === 'POST') {
    try {
      await ctx.gatewayManager.restart();
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/gateway/control-ui' && req.method === 'GET') {
    try {
      const status = ctx.gatewayManager.getStatus();
      const token = await getSetting('gatewayToken');
      const port = status.port || PORTS.OPENCLAW_GATEWAY;
      const urlValue = buildOpenClawControlUiUrl(port, token);
      sendJson(res, 200, { success: true, url: urlValue, token, port });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/chat/send-with-media' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{
        sessionKey: string;
        message: string;
        deliver?: boolean;
        idempotencyKey: string;
        media?: Array<{ filePath: string; mimeType: string; fileName: string }>;
      }>(req);
      const VISION_MIME_TYPES = new Set([
        'image/png', 'image/jpeg', 'image/bmp', 'image/webp',
      ]);
      const imageAttachments: Array<{ content: string; mimeType: string; fileName: string }> = [];
      const fileReferences: string[] = [];
      if (body.media && body.media.length > 0) {
        const fsP = await import('node:fs/promises');
        for (const m of body.media) {
          fileReferences.push(`[media attached: ${m.filePath} (${m.mimeType}) | ${m.filePath}]`);
          if (VISION_MIME_TYPES.has(m.mimeType)) {
            const fileBuffer = await fsP.readFile(m.filePath);
            imageAttachments.push({
              content: fileBuffer.toString('base64'),
              mimeType: m.mimeType,
              fileName: m.fileName,
            });
          }
        }
      }

      const message = fileReferences.length > 0
        ? [body.message, ...fileReferences].filter(Boolean).join('\n')
        : body.message;
      const rpcParams: Record<string, unknown> = {
        sessionKey: body.sessionKey,
        message,
        deliver: body.deliver ?? false,
        idempotencyKey: body.idempotencyKey,
      };
      if (imageAttachments.length > 0) {
        rpcParams.attachments = imageAttachments;
      }
      const result = await ctx.gatewayManager.rpc('chat.send', rpcParams, 120000);
      sendJson(res, 200, { success: true, result });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  // ─── 新增：概览/实例/会话/使用情况/文档 的 Gateway RPC 代理 ───

  if (url.pathname === '/api/gateway/channels' && req.method === 'GET') {
    try {
      const channels = await ctx.gatewayManager.rpc<unknown[]>('channels.list', {}, 10000).catch(() => []);
      sendJson(res, 200, { channels });
    } catch {
      sendJson(res, 200, { channels: [] });
    }
    return true;
  }

  if (url.pathname === '/api/gateway/sessions' && req.method === 'GET') {
    try {
      const sessions = await ctx.gatewayManager.rpc<unknown[]>('sessions.list', {}, 10000).catch(() => []);
      sendJson(res, 200, { sessions });
    } catch {
      sendJson(res, 200, { sessions: [] });
    }
    return true;
  }

  if (url.pathname === '/api/gateway/sessions/stats' && req.method === 'GET') {
    try {
      const stats = await ctx.gatewayManager.rpc<unknown>('sessions.stats', {}, 10000).catch(() => ({ active: 0, total: 0 }));
      sendJson(res, 200, stats);
    } catch {
      sendJson(res, 200, { active: 0, total: 0 });
    }
    return true;
  }

  if (url.pathname.startsWith('/api/gateway/sessions/') && url.pathname.endsWith('/kill') && req.method === 'POST') {
    try {
      const sessionKey = decodeURIComponent(url.pathname.replace('/api/gateway/sessions/', '').replace('/kill', ''));
      await ctx.gatewayManager.rpc('sessions.kill', { sessionKey }, 15000);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/gateway/instances' && req.method === 'GET') {
    try {
      const status = ctx.gatewayManager.getStatus();
      const instances = [
        {
          id: 'gateway',
          name: 'OpenAGI 网关',
          type: 'gateway',
          status: status.state === 'running' ? 'running' : status.state === 'error' ? 'error' : 'stopped',
          port: status.port || 18799,
          pid: status.pid,
          startedAt: status.startedAt,
        },
      ];
      // 尝试获取 Code Engine 状态
      try {
        const codeStatus = await ctx.gatewayManager.rpc<{ status?: string }>('code-engine.status', {}, 5000);
        instances.push({
          id: 'code-engine',
          name: 'Claude Code 引擎',
          type: 'code-engine',
          status: codeStatus?.status === 'ready' ? 'running' : 'stopped',
          port: 0,
          pid: undefined as any,
          startedAt: undefined as any,
        });
      } catch {
        instances.push({
          id: 'code-engine',
          name: 'Claude Code 引擎',
          type: 'code-engine',
          status: 'stopped',
          port: 0,
          pid: undefined as any,
          startedAt: undefined as any,
        });
      }
      sendJson(res, 200, { instances });
    } catch {
      sendJson(res, 200, { instances: [] });
    }
    return true;
  }

  if (url.pathname === '/api/gateway/usage' && req.method === 'GET') {
    try {
      const usage = await ctx.gatewayManager.rpc<unknown>('usage.stats', {}, 10000).catch(() => null);
      if (usage) {
        sendJson(res, 200, usage);
      } else {
        sendJson(res, 200, {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalRequests: 0,
          totalCostUsd: 0,
          modelBreakdown: [],
        });
      }
    } catch {
      sendJson(res, 200, {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalRequests: 0,
        totalCostUsd: 0,
        modelBreakdown: [],
      });
    }
    return true;
  }

  if (url.pathname === '/api/gateway/documents' && req.method === 'GET') {
    try {
      const documents = await ctx.gatewayManager.rpc<unknown[]>('documents.list', {}, 10000).catch(() => []);
      sendJson(res, 200, { documents });
    } catch {
      sendJson(res, 200, { documents: [] });
    }
    return true;
  }

  return false;
}
