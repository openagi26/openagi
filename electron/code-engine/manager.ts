/**
 * Claude Code Engine 管理器
 * 管理 Claw Code 引擎的生命周期（启动、停止、重启）
 * 支持两种模式：FFI（外部函数接口）和子进程
 */

import { EventEmitter } from 'events';
import { ChildProcess, spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import type {
  CodeEngineStatus,
  CodeEngineConfig,
  SendMessageRequest,
  AssistantEvent,
  CodeSession,
} from './types';
import { logger } from '../utils/logger';

export interface CodeEngineEvents {
  'status-changed': (status: CodeEngineStatus) => void;
  'event': (sessionId: string, event: AssistantEvent) => void;
  'error': (error: Error) => void;
}

export class CodeEngineManager extends EventEmitter {
  private status: CodeEngineStatus = 'stopped';
  private process: ChildProcess | null = null;
  private config: CodeEngineConfig;
  private sessions: Map<string, CodeSession> = new Map();
  private pendingCallbacks: Map<string, (data: unknown) => void> = new Map();
  private requestId = 0;

  constructor(config?: Partial<CodeEngineConfig>) {
    super();
    this.config = {
      enabled: true,
      defaultModel: 'claude-sonnet-4-6',
      ...config,
    };

    // 默认错误处理，防止未处理的 error 事件导致进程崩溃
    this.on('error', (error: Error) => {
      logger.error('[CodeEngine] Error:', error.message);
    });
  }

  /** 获取当前状态 */
  getStatus(): CodeEngineStatus {
    return this.status;
  }

  /** 获取配置 */
  getConfig(): CodeEngineConfig {
    return { ...this.config };
  }

  /** 更新配置 */
  updateConfig(config: Partial<CodeEngineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** 启动引擎 */
  async start(): Promise<void> {
    if (this.status === 'ready' || this.status === 'starting') {
      return;
    }

    if (!this.config.enabled) {
      logger.info('[CodeEngine] Engine is disabled, skipping start');
      return;
    }

    this.setStatus('starting');
    logger.info('[CodeEngine] Starting engine...');

    try {
      // 尝试 FFI 模式
      if (this.config.libraryPath && existsSync(this.config.libraryPath)) {
        await this.startFFI();
      }
      // 尝试子进程模式
      else if (this.config.binaryPath && existsSync(this.config.binaryPath)) {
        await this.startProcess();
      }
      // 尝试自动发现
      else {
        const discovered = this.discoverEngine();
        if (discovered) {
          await this.startProcess();
        } else {
          // 引擎不可用，设为就绪状态但功能受限
          logger.warn('[CodeEngine] No engine binary found. Code features will be limited.');
          this.setStatus('ready');
          return;
        }
      }

      this.setStatus('ready');
      logger.info('[CodeEngine] Engine started successfully');
    } catch (error) {
      this.setStatus('error');
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('error', err);
      logger.error('[CodeEngine] Failed to start:', err.message);
    }
  }

  /** 停止引擎 */
  async stop(): Promise<void> {
    if (this.status === 'stopped') return;

    logger.info('[CodeEngine] Stopping engine...');

    if (this.process) {
      this.process.kill('SIGTERM');
      // 等待进程退出，最多 5 秒
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        if (this.process) {
          this.process.once('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        } else {
          clearTimeout(timeout);
          resolve();
        }
      });
      this.process = null;
    }

    this.sessions.clear();
    this.pendingCallbacks.clear();
    this.setStatus('stopped');
    logger.info('[CodeEngine] Engine stopped');
  }

  /** 重启引擎 */
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  /** 发送消息（流式） */
  async sendMessage(
    request: SendMessageRequest,
    onEvent: (event: AssistantEvent) => void,
  ): Promise<string> {
    if (this.status !== 'ready') {
      throw new Error('Code engine is not ready');
    }

    const sessionId = request.sessionId || this.generateSessionId();
    this.setStatus('busy');

    try {
      if (this.process) {
        await this.sendViaProcess(sessionId, request, onEvent);
      } else {
        // 无引擎可用时，返回提示信息
        onEvent({
          type: 'text_delta',
          text: '⚠️ Claude Code 引擎尚未安装。请先编译 Rust 引擎或配置引擎路径。\n\n' +
            '可在设置 → 代码引擎中配置引擎路径。',
        });
        onEvent({ type: 'message_stop' });
      }
    } finally {
      this.setStatus('ready');
    }

    return sessionId;
  }

  /** 获取所有会话 */
  getSessions(): CodeSession[] {
    return Array.from(this.sessions.values());
  }

  /** 删除会话 */
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  // ===== 私有方法 =====

  private setStatus(status: CodeEngineStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.emit('status-changed', status);
    }
  }

  private generateSessionId(): string {
    return `ce-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /** 自动发现引擎二进制 */
  private discoverEngine(): boolean {
    const possiblePaths = [
      // 打包后的资源目录
      join(process.resourcesPath || '', 'bin', 'claw'),
      // 开发模式：从 claude 项目编译
      join(__dirname, '../../../claude/rust/target/release/claw'),
      join(__dirname, '../../../claude/rust/target/debug/claw'),
      // 系统 PATH 中的 claw
      '/usr/local/bin/claw',
    ];

    for (const p of possiblePaths) {
      if (existsSync(p)) {
        this.config.binaryPath = p;
        logger.info(`[CodeEngine] Discovered engine at: ${p}`);
        return true;
      }
    }

    return false;
  }

  /** FFI 模式启动（预留） */
  private async startFFI(): Promise<void> {
    logger.info('[CodeEngine] FFI mode - loading library:', this.config.libraryPath);
    // FFI 集成将在后续实现
    // 目前降级为子进程模式
    if (this.config.binaryPath && existsSync(this.config.binaryPath)) {
      await this.startProcess();
    }
  }

  /** 子进程模式启动 */
  private async startProcess(): Promise<void> {
    const binary = this.config.binaryPath!;
    logger.info('[CodeEngine] Starting process:', binary);

    const env = { ...process.env };
    if (this.config.apiKey) {
      env.ANTHROPIC_API_KEY = this.config.apiKey;
    }

    this.process = spawn(binary, ['--output-format', 'json'], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.config.defaultWorkingDirectory || process.cwd(),
    });

    this.process.on('exit', (code) => {
      logger.info(`[CodeEngine] Process exited with code ${code}`);
      this.process = null;
      if (this.status !== 'stopped') {
        this.setStatus('error');
      }
    });

    this.process.on('error', (error) => {
      logger.error('[CodeEngine] Process error:', error.message);
      this.emit('error', error);
    });

    // 读取 stdout（JSON 响应）
    if (this.process.stdout) {
      let buffer = '';
      this.process.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.trim()) {
            this.handleProcessOutput(line.trim());
          }
        }
      });
    }

    // 读取 stderr（日志）
    if (this.process.stderr) {
      this.process.stderr.on('data', (chunk: Buffer) => {
        logger.debug('[CodeEngine:stderr]', chunk.toString().trim());
      });
    }
  }

  /** 通过子进程发送消息 */
  private async sendViaProcess(
    sessionId: string,
    request: SendMessageRequest,
    onEvent: (event: AssistantEvent) => void,
  ): Promise<void> {
    if (!this.process?.stdin) {
      throw new Error('Engine process is not running');
    }

    const id = String(++this.requestId);

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCallbacks.delete(id);
        reject(new Error('Request timeout'));
      }, 300000); // 5 分钟超时

      this.pendingCallbacks.set(id, (data: unknown) => {
        clearTimeout(timeout);
        const event = data as AssistantEvent;
        onEvent(event);
        if (event.type === 'message_stop' || event.type === 'error') {
          this.pendingCallbacks.delete(id);
          resolve();
        }
      });

      const payload = JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: 'chat.send',
        params: {
          sessionId,
          message: request.message,
          model: request.model || this.config.defaultModel,
          workingDirectory: request.workingDirectory || this.config.defaultWorkingDirectory,
        },
      });

      this.process!.stdin!.write(payload + '\n');
    });
  }

  /** 处理子进程输出 */
  private handleProcessOutput(line: string): void {
    try {
      const data = JSON.parse(line);

      if (data.id && this.pendingCallbacks.has(data.id)) {
        const callback = this.pendingCallbacks.get(data.id)!;
        if (data.error) {
          callback({ type: 'error', message: data.error.message || String(data.error) });
        } else if (data.result) {
          callback(data.result);
        }
      }
    } catch {
      // 非 JSON 输出，忽略
      logger.debug('[CodeEngine] Non-JSON output:', line.slice(0, 200));
    }
  }
}
