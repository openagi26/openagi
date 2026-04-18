/**
 * Preload Script
 * Exposes safe APIs to the renderer process via contextBridge
 */
import { contextBridge, ipcRenderer } from 'electron';

/**
 * IPC renderer methods exposed to the renderer process
 */
const electronAPI = {
  /**
   * IPC invoke (request-response pattern)
   */
  ipcRenderer: {
    invoke: (channel: string, ...args: unknown[]) => {
      const validChannels = [
        // Gateway
        'gateway:status',
        'gateway:isConnected',
        'gateway:start',
        'gateway:stop',
        'gateway:restart',
        'gateway:rpc',
        'gateway:httpProxy',
        'hostapi:fetch',
        'hostapi:token',
        'gateway:health',
        'gateway:getControlUiUrl',
        // OpenClaw
        'openclaw:status',
        'openclaw:isReady',
        // Shell
        'shell:openExternal',
        'shell:showItemInFolder',
        'shell:openPath',
        // Dialog
        'dialog:open',
        'dialog:save',
        'dialog:message',
        // App
        'app:version',
        'app:name',
        'app:getPath',
        'app:platform',
        'app:quit',
        'app:relaunch',
        'app:request',
        // Window controls
        'window:minimize',
        'window:maximize',
        'window:close',
        'window:isMaximized',
        // Settings
        'settings:get',
        'settings:set',
        'settings:setMany',
        'settings:getAll',
        'settings:reset',
        'usage:recentTokenHistory',
        // Update
        'update:status',
        'update:version',
        'update:check',
        'update:download',
        'update:install',
        'update:setChannel',
        'update:setAutoDownload',
        'update:cancelAutoInstall',
        // Env
        'env:getConfig',
        'env:setApiKey',
        'env:deleteApiKey',
        // Provider
        'provider:list',
        'provider:get',
        'provider:save',
        'provider:delete',
        'provider:setApiKey',
        'provider:updateWithKey',
        'provider:deleteApiKey',
        'provider:hasApiKey',
        'provider:getApiKey',
        'provider:setDefault',
        'provider:getDefault',
        'provider:validateKey',
        'provider:requestOAuth',
        'provider:cancelOAuth',
        // Cron
        'cron:list',
        'cron:create',
        'cron:update',
        'cron:delete',
        'cron:toggle',
        'cron:trigger',
        // Channel Config
        'channel:saveConfig',
        'channel:getConfig',
        'channel:getFormValues',
        'channel:deleteConfig',
        'channel:listConfigured',
        'channel:setEnabled',
        'channel:validate',
        'channel:validate',
        'channel:validateCredentials',
        // WhatsApp
        'channel:requestWhatsAppQr',
        'channel:cancelWhatsAppQr',
        // ClawHub
        'clawhub:search',
        'clawhub:install',
        'clawhub:uninstall',
        'clawhub:list',
        'clawhub:openSkillReadme',
        // UV
        'uv:check',
        'uv:install-all',
        // Skill config (direct file access)
        'skill:updateConfig',
        'skill:getConfig',
        'skill:getAllConfigs',
        // Logs
        'log:getRecent',
        'log:readFile',
        'log:getFilePath',
        'log:getDir',
        'log:listFiles',
        // File staging & media
        'file:stage',
        'file:stageBuffer',
        'media:getThumbnails',
        'media:saveImage',
        // Chat send with media (reads staged files in main process)
        'chat:sendWithMedia',
        // Session management
        'session:delete',
        // OpenClaw extras
        'openclaw:getDir',
        'openclaw:getConfigDir',
        'openclaw:getSkillsDir',
        'openclaw:getCliCommand',
        // 小星（Spirit）唤起主窗口
        'spirit:focus-main',
        // 小星（Spirit）W10 记忆系统
        'memory:getGreeting',
        'memory:addFact',
        'memory:get',
        // 小星（Spirit）W15 语音聊天
        'spirit:voice-input',
        // 小星（Spirit）W15 语音转文字（audio）：传入录音 base64 → 返回识别文字
        'spirit:voice-transcribe',
        // 小星（Spirit）W15/W21 临时控制窗口焦点（录音/摄像头前调用）
        'spirit:set-focusable',
        // 小星（Spirit）W16 视频拍照
        'spirit:photo-input',
        // 小星（Spirit）MVP 文字聊天
        'spirit:chat-toggle',
        'spirit:chat-input',
        'spirit:mood-set',
        // 小星（Spirit）情绪状态读取（Spirit.tsx useEffect 调用）
        'spirit:mood-get',
        'spirit:last-positive-mood-event',
        // 小星（Spirit）隐藏控制
        'spirit:hide',
        // 小星（Spirit）模式切换
        'spirit:set-mode',
      ];

      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }

      throw new Error(`Invalid IPC channel: ${channel}`);
    },

    /**
     * Listen for events from main process
     */
    on: (channel: string, callback: (...args: unknown[]) => void) => {
      const validChannels = [
        'gateway:status-changed',
        'gateway:message',
        'gateway:notification',
        'gateway:channel-status',
        'gateway:chat-message',
        'channel:whatsapp-qr',
        'channel:whatsapp-success',
        'channel:whatsapp-error',
        'channel:wechat-qr',
        'channel:wechat-success',
        'channel:wechat-error',
        'gateway:exit',
        'gateway:error',
        'navigate',
        'update:status-changed',
        'update:checking',
        'update:available',
        'update:not-available',
        'update:progress',
        'update:downloaded',
        'update:error',
        'update:auto-install-countdown',
        'cron:updated',
        'oauth:code',
        'oauth:success',
        'oauth:error',
        'openagi:cli-installed',
        // 小星（Spirit）状态变化
        'spirit:mood',
        // 小星（Spirit）W10 重逢问候
        'spirit:greeting',
        // 小星（Spirit）W15 语音回复推送
        'spirit:voice-reply',
        'spirit:speak',
        // 小星（Spirit）W16 视频回复推送
        'spirit:photo-reply',
        // 小星（Spirit）MVP 新增事件
        'spirit:fatigue',
        'spirit:chat-reply',
      ];

      if (validChannels.includes(channel)) {
        // Wrap the callback to strip the event
        const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => {
          callback(...args);
        };
        ipcRenderer.on(channel, subscription);

        // Return unsubscribe function
        return () => {
          ipcRenderer.removeListener(channel, subscription);
        };
      }

      throw new Error(`Invalid IPC channel: ${channel}`);
    },

    /**
     * Listen for a single event from main process
     */
    once: (channel: string, callback: (...args: unknown[]) => void) => {
      const validChannels = [
        'gateway:status-changed',
        'gateway:message',
        'gateway:notification',
        'gateway:channel-status',
        'gateway:chat-message',
        'channel:whatsapp-qr',
        'channel:whatsapp-success',
        'channel:whatsapp-error',
        'channel:wechat-qr',
        'channel:wechat-success',
        'channel:wechat-error',
        'gateway:exit',
        'gateway:error',
        'navigate',
        'update:status-changed',
        'update:checking',
        'update:available',
        'update:not-available',
        'update:progress',
        'update:downloaded',
        'update:error',
        'update:auto-install-countdown',
        'oauth:code',
        'oauth:success',
        'oauth:error',
      ];

      if (validChannels.includes(channel)) {
        ipcRenderer.once(channel, (_event, ...args) => callback(...args));
        return;
      }

      throw new Error(`Invalid IPC channel: ${channel}`);
    },

    /**
     * Remove all listeners for a channel
     */
    off: (channel: string, callback?: (...args: unknown[]) => void) => {
      if (callback) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ipcRenderer.removeListener(channel, callback as any);
      } else {
        ipcRenderer.removeAllListeners(channel);
      }
    },
  },

  /**
   * Open external URL in default browser
   */
  openExternal: (url: string) => {
    return ipcRenderer.invoke('shell:openExternal', url);
  },

  /**
   * Get current platform
   */
  platform: process.platform,

  /**
   * Check if running in development
   */
  isDev: process.env.NODE_ENV === 'development' || !!process.env.VITE_DEV_SERVER_URL,
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electron', electronAPI);

// Type declarations for the renderer process
export type ElectronAPI = typeof electronAPI;
