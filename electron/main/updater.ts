/**
 * Auto-Updater Module (Disabled for OpenAGI)
 * All update functions are no-ops. Auto-update will be re-enabled in a future version.
 */
import { app, BrowserWindow, ipcMain } from 'electron';

export interface UpdateStatus {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  info?: unknown;
  progress?: unknown;
  error?: string;
}

export class AppUpdater {
  getStatus(): UpdateStatus {
    return { status: 'idle' };
  }

  setMainWindow(_window: BrowserWindow): void {
    // No-op
  }

  async checkForUpdates(): Promise<null> {
    return null;
  }

  async downloadUpdate(): Promise<void> {
    // No-op
  }

  quitAndInstall(): void {
    // No-op
  }

  cancelAutoInstall(): void {
    // No-op
  }

  setChannel(_channel: string): void {
    // No-op
  }

  setAutoDownload(_enable: boolean): void {
    // No-op
  }

  getCurrentVersion(): string {
    return app.getVersion();
  }
}

/**
 * Register IPC handlers (all return idle/disabled status)
 */
export function registerUpdateHandlers(
  updater: AppUpdater,
  mainWindow: BrowserWindow
): void {
  updater.setMainWindow(mainWindow);

  ipcMain.handle('update:status', () => updater.getStatus());
  ipcMain.handle('update:version', () => updater.getCurrentVersion());
  ipcMain.handle('update:check', async () => ({ success: true, status: updater.getStatus() }));
  ipcMain.handle('update:download', async () => ({ success: false, error: 'Auto-update disabled' }));
  ipcMain.handle('update:install', () => ({ success: false, error: 'Auto-update disabled' }));
  ipcMain.handle('update:setChannel', () => ({ success: true }));
  ipcMain.handle('update:setAutoDownload', () => ({ success: true }));
  ipcMain.handle('update:cancelAutoInstall', () => ({ success: true }));
}

// Export singleton instance
export const appUpdater = new AppUpdater();
