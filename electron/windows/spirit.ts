/**
 * 小星（Spirit）浮窗管理
 * 创建透明、置顶、无边框的桌面伴侣窗口
 * W10：新增情感记忆支持（重逢问候 + 记忆存储）
 */
import { BrowserWindow, screen, ipcMain } from 'electron';
import { join } from 'path';
import { generateGreeting, addFact, touchLastSeen, getMemory } from '../memory/spirit-memory';

let spiritWindow: BrowserWindow | null = null;

/**
 * 创建小星浮窗
 * mainWindow 参数保留供未来扩展（例如同步状态），当前通过 registerSpiritIpcHandlers 关联
 */
export function createSpiritWindow(_mainWindow: BrowserWindow): BrowserWindow {
  // 获取主显示器（primary display）尺寸
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: 120,
    height: 200,  // W15：增高 40px，为语音按钮（VoiceButton）留空间
    x: screenWidth - 160,
    y: screenHeight - 200,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    focusable: false,       // 不抢焦点（focus）
    resizable: false,
    skipTaskbar: true,      // 不在任务栏（taskbar）显示
    hasShadow: false,
    // macOS 专属：让浮窗悬浮于全屏 App 之上
    ...(process.platform === 'darwin' ? { type: 'panel' } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    title: '小星',
  });

  // 加载 Spirit 页面
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(`${process.env.VITE_DEV_SERVER_URL}spirit.html`);
  } else {
    win.loadFile(join(__dirname, '../../dist/spirit.html'));
  }

  // 允许拖动（macOS 通过 -webkit-app-region: drag 实现，Electron 也支持 setMovable）
  win.setMovable(true);

  // 窗口关闭时清理引用
  win.on('closed', () => {
    spiritWindow = null;
  });

  // W10：记录本次启动时间（touchLastSeen 在问候语发出后调用，避免影响时间差判断）
  // 加载完成后发送问候语
  win.webContents.once('did-finish-load', () => {
    const greeting = generateGreeting();
    // 稍微延迟让渲染层准备就绪
    setTimeout(() => {
      if (!win.isDestroyed()) {
        win.webContents.send('spirit:greeting', greeting);
      }
      // 问候发出后才更新 last_seen，避免影响下次时间差判断
      touchLastSeen();
    }, 800);
  });

  spiritWindow = win;
  return win;
}

/**
 * 获取当前小星窗口（可能为 null）
 */
export function getSpiritWindow(): BrowserWindow | null {
  return spiritWindow;
}

/**
 * 向小星窗口广播情绪（mood）变化
 * @param mood 'idle' | 'listening' | 'thinking' | 'replying'
 */
export function broadcastSpiritMood(mood: string): void {
  if (spiritWindow && !spiritWindow.isDestroyed()) {
    spiritWindow.webContents.send('spirit:mood', mood);
  }
}

/**
 * 注册小星相关的 IPC（进程间通信）处理器
 * @param mainWindow 主窗口，点击小星时聚焦
 */
export function registerSpiritIpcHandlers(mainWindow: BrowserWindow): void {
  // 点击小星 → 唤起主窗口
  ipcMain.handle('spirit:focus-main', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  });

  // W10：记忆相关 IPC handlers

  // 渲染层获取重逢问候语（备用：浮窗可主动拉取）
  ipcMain.handle('memory:getGreeting', () => {
    return generateGreeting();
  });

  // 渲染层提交一条用户事实（由聊天回复后的 async 流程调用）
  ipcMain.handle('memory:addFact', (_event, content: string) => {
    addFact(content);
    return true;
  });

  // 读取当前全部记忆（供调试 / 测试用）
  ipcMain.handle('memory:get', () => {
    return getMemory();
  });
}
