/**
 * 小星（Spirit）浮窗管理
 * 创建透明、置顶、无边框的桌面伴侣窗口
 * W10：新增情感记忆支持（重逢问候 + 记忆存储）
 */
import { BrowserWindow, screen, ipcMain } from 'electron';
import { join } from 'path';
import { generateGreeting, addFact, touchLastSeen, getMemory, loadMemory, saveMemory } from '../memory/spirit-memory';
import { getMood, setMood, getLastPositiveMoodEvent } from '../memory/emotion';

let spiritWindow: BrowserWindow | null = null;

/**
 * 创建小星浮窗
 * mainWindow 参数保留供未来扩展（例如同步状态），当前通过 registerSpiritIpcHandlers 关联
 */
export function createSpiritWindow(_mainWindow: BrowserWindow): BrowserWindow {
  // 检查是否应该隐藏
  const mem = loadMemory() as any;
  if (mem.hide_permanent) return null as any;
  if (mem.hide_until && new Date(mem.hide_until) > new Date()) return null as any;

  // W21：媒体权限（摄像头/麦克风）handler 已在主进程 app.whenReady() 最开始注册
  // 此处无需重复设置，避免覆盖导致竞态（race condition）

  // 获取主显示器（primary display）尺寸
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  // 恢复上次位置，并做越界检测
  const savedPos = mem.window_position;
  let x = screenWidth - 160;
  let y = screenHeight - 200;
  if (
    savedPos &&
    typeof savedPos.x === 'number' &&
    typeof savedPos.y === 'number' &&
    savedPos.x >= 0 && savedPos.x + 120 <= screenWidth &&
    savedPos.y >= 0 && savedPos.y + 200 <= screenHeight
  ) {
    x = savedPos.x;
    y = savedPos.y;
  }

  const win = new BrowserWindow({
    width: 120,
    height: 230,  // MVP：增高至 230px，为语音按钮 + 点击聊天预留空间
    x,
    y,
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

  // 监听窗口移动，防抖500ms后写入位置记忆
  let saveTimer: NodeJS.Timeout | null = null;
  win.on('move', () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const [wx, wy] = win.getPosition();
      const currentMem = loadMemory() as any;
      currentMem.window_position = { x: wx, y: wy };
      saveMemory(currentMem);
    }, 500);
  });

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
  // W21：摄像头访问 — 临时将 Spirit 窗口设为可聚焦（focusable），解决 Chromium 130+ 中
  // focusable:false 的窗口调用 getUserMedia 会因无有效用户激活（user activation）而被拒绝
  ipcMain.handle('spirit:set-focusable', (_event, focusable: boolean) => {
    if (spiritWindow && !spiritWindow.isDestroyed()) {
      spiritWindow.setFocusable(focusable);
      if (focusable) {
        spiritWindow.focus();
      }
    }
  });

  // 点击小星 → 唤起主窗口并导航到聊天页面
  ipcMain.handle('spirit:focus-main', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
    // 导航到聊天首页（前端监听 navigate:to 事件）
    mainWindow.webContents.send('navigate:to', '/');
  });

  // 小星模式切换（companion 伴侣模式 / assistant 助手模式）
  ipcMain.handle('spirit:set-mode', (_event, mode: string) => {
    // 向主窗口广播模式变更（供未来扩展）
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('spirit:mode-changed', mode);
  });

  // 隐藏小星
  ipcMain.handle('spirit:hide', (_event, type: 'session' | 'day' | 'permanent') => {
    if (spiritWindow && !spiritWindow.isDestroyed()) {
      spiritWindow.hide();
    }
    if (type === 'day') {
      const mem = loadMemory();
      (mem as any).hide_until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      saveMemory(mem);
    } else if (type === 'permanent') {
      const mem = loadMemory();
      (mem as any).hide_permanent = true;
      saveMemory(mem);
    }
  });

  // 恢复显示小星（Settings 页恢复开关用）
  ipcMain.handle('spirit:show', () => {
    const mem = loadMemory();
    (mem as any).hide_permanent = false;
    delete (mem as any).hide_until;
    saveMemory(mem);
    if (spiritWindow && !spiritWindow.isDestroyed()) {
      spiritWindow.show();
    }
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

  // 渲染层获取当前情绪状态
  ipcMain.handle('spirit:mood-get', () => {
    try {
      return getMood();
    } catch {
      return null;
    }
  });

  // 渲染层设置情绪（被夸时调用）
  ipcMain.handle('spirit:mood-set', (_event, mood: string, reason: string) => {
    try {
      setMood(mood as any, reason);
      return true;
    } catch {
      return false;
    }
  });

  // 渲染层获取最近一次 happy 情绪事件（用于启动时情绪传染记忆气泡）
  ipcMain.handle('spirit:last-positive-mood-event', () => {
    try {
      return getLastPositiveMoodEvent();
    } catch {
      return null;
    }
  });

  // MVP：聊天框开关 → 动态调整 Spirit 窗口大小
  let preChatPos: { x: number; y: number } | null = null;
  ipcMain.handle('spirit:chat-toggle', (_event, open: boolean) => {
    if (!spiritWindow || spiritWindow.isDestroyed()) return;
    if (open) {
      const [wx, wy] = spiritWindow.getPosition();
      preChatPos = { x: wx, y: wy };
      const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
      const newW = 300;
      const newH = 480;
      // 优先向左/上扩展，防止超出屏幕边界
      const newX = Math.max(0, Math.min(wx - (newW - 120), sw - newW));
      const newY = Math.max(0, Math.min(wy - (newH - 230), sh - newH));
      spiritWindow.setSize(newW, newH);
      spiritWindow.setPosition(newX, newY);
      spiritWindow.setFocusable(true);
      spiritWindow.focus();
    } else {
      spiritWindow.setSize(120, 230);
      if (preChatPos) {
        spiritWindow.setPosition(preChatPos.x, preChatPos.y);
        preChatPos = null;
      }
      spiritWindow.setFocusable(false);
    }
  });
}
