/**
 * Code Engine IPC 处理器
 * 注册所有与 Claude Code Engine 相关的 IPC 通道
 */

import { ipcMain, BrowserWindow } from 'electron';
import { CodeEngineManager } from './manager';
import type { SendMessageRequest, AssistantEvent } from './types';
import { routeMessage } from '../intent-router/router';
import { logger } from '../utils/logger';

let codeEngineManager: CodeEngineManager | null = null;

/**
 * 获取或创建 Code Engine 管理器实例
 */
export function getCodeEngineManager(): CodeEngineManager {
  if (!codeEngineManager) {
    codeEngineManager = new CodeEngineManager();
  }
  return codeEngineManager;
}

/**
 * 注册 Code Engine 相关的 IPC 处理器
 */
export function registerCodeEngineIpcHandlers(mainWindow: BrowserWindow): void {
  const manager = getCodeEngineManager();

  // 状态变更时通知渲染进程
  manager.on('status-changed', (status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('code-engine:status-changed', status);
    }
  });

  // 获取引擎状态
  ipcMain.handle('code-engine:status', () => {
    return manager.getStatus();
  });

  // 启动引擎
  ipcMain.handle('code-engine:start', async () => {
    try {
      await manager.start();
      return { success: true, status: manager.getStatus() };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // 停止引擎
  ipcMain.handle('code-engine:stop', async () => {
    try {
      await manager.stop();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // 重启引擎
  ipcMain.handle('code-engine:restart', async () => {
    try {
      await manager.restart();
      return { success: true, status: manager.getStatus() };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // 发送消息（流式）
  ipcMain.handle('code-engine:send', async (_event, request: SendMessageRequest) => {
    try {
      const events: AssistantEvent[] = [];
      const sessionId = await manager.sendMessage(request, (evt) => {
        events.push(evt);
        // 实时推送事件到渲染进程
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('code-engine:event', {
            sessionId: request.sessionId,
            event: evt,
          });
        }
      });
      return { success: true, sessionId, events };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // 获取会话列表
  ipcMain.handle('code-engine:sessions', () => {
    return manager.getSessions();
  });

  // 删除会话
  ipcMain.handle('code-engine:delete-session', (_event, sessionId: string) => {
    return manager.deleteSession(sessionId);
  });

  // 获取引擎配置
  ipcMain.handle('code-engine:config', () => {
    return manager.getConfig();
  });

  // 更新引擎配置
  ipcMain.handle('code-engine:update-config', (_event, config: Record<string, unknown>) => {
    manager.updateConfig(config);
    return { success: true };
  });

  // 意图路由（判断消息应该走哪个引擎）
  ipcMain.handle('intent-router:route', (_event, message: string) => {
    return routeMessage(message);
  });

  logger.info('[CodeEngine] IPC handlers registered');
}

/**
 * 初始化 Code Engine（在主进程启动时调用）
 */
export async function initCodeEngine(): Promise<void> {
  const manager = getCodeEngineManager();
  try {
    await manager.start();
    logger.info('[CodeEngine] Initialized successfully, status:', manager.getStatus());
  } catch (error) {
    logger.warn('[CodeEngine] Init failed (non-fatal):', error);
    // 非致命错误，引擎不可用时功能降级
  }
}

/**
 * 关闭 Code Engine（在应用退出时调用）
 */
export async function shutdownCodeEngine(): Promise<void> {
  if (codeEngineManager) {
    await codeEngineManager.stop();
    codeEngineManager = null;
  }
}
