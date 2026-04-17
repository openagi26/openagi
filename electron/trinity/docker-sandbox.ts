/**
 * Docker Sandbox for PoO Verification
 *
 * Phase 1: Process-isolation mode (default)
 * Docker container execution is available as an optional upgrade
 * when Docker is present on the host system.
 *
 * Execution priority: Docker (if available) → Process isolation (always available)
 */
import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { secureId } from '../utils/secure-id'

const execFileAsync = promisify(execFile)

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SandboxConfig {
  /** Docker image to use (Docker mode only) */
  image: string
  /** Maximum execution time in ms */
  timeoutMs: number
  /** Maximum memory in MB */
  memoryMb: number
  /** Maximum CPU shares (relative weight) */
  cpuShares: number
  /** Whether to enable network access */
  networkEnabled: boolean
  /** Working directory inside container */
  workDir: string
  /** Auto-remove container after execution */
  autoRemove: boolean
  /** Preferred execution method: 'auto' | 'docker' | 'process' */
  executionMode: 'auto' | 'docker' | 'process'
}

export interface SandboxExecution {
  id: string
  status: 'running' | 'success' | 'failed' | 'timeout' | 'error'
  stdout: string
  stderr: string
  exitCode: number | null
  durationMs: number
  resourceUsage: {
    memoryMb: number
    cpuMs: number
  }
  method: 'docker' | 'process'
}

// ─── Docker Sandbox ───────────────────────────────────────────────────────────

export class DockerSandbox {
  private config: SandboxConfig
  private dockerAvailable: boolean | null = null
  private dataDir: string

  constructor(dataDir: string, config?: Partial<SandboxConfig>) {
    this.dataDir = join(dataDir, 'sandbox')
    if (!existsSync(this.dataDir)) mkdirSync(this.dataDir, { recursive: true })

    this.config = {
      image: 'node:20-alpine',
      timeoutMs: 30000,
      memoryMb: 256,
      cpuShares: 512,
      networkEnabled: false,
      workDir: '/app',
      autoRemove: true,
      executionMode: 'auto',
      ...config,
    }
  }

  /**
   * Check if Docker is available on the host
   */
  async isDockerAvailable(): Promise<boolean> {
    if (this.dockerAvailable !== null) return this.dockerAvailable

    try {
      await execFileAsync('docker', ['version', '--format', '{{.Server.Version}}'], { timeout: 5000 })
      this.dockerAvailable = true
    } catch {
      this.dockerAvailable = false
    }

    return this.dockerAvailable
  }

  /**
   * Execute code in a sandboxed environment
   * Tries Docker first, falls back to process isolation
   */
  async execute(code: string, language: 'javascript' | 'python' | 'shell' = 'javascript'): Promise<SandboxExecution> {
    const id = secureId('SBX')

    if (this.config.executionMode === 'process') {
      return this.executeInProcess(id, code, language)
    }

    if (this.config.executionMode === 'docker') {
      if (await this.isDockerAvailable()) {
        return this.executeInDocker(id, code, language)
      }
      throw new Error('Docker execution mode requested but Docker is not available')
    }

    // 'auto': Docker if available, else process
    if (await this.isDockerAvailable()) {
      return this.executeInDocker(id, code, language)
    }

    return this.executeInProcess(id, code, language)
  }

  /**
   * Execute in Docker container with resource limits
   */
  private async executeInDocker(id: string, code: string, language: string): Promise<SandboxExecution> {
    const startTime = Date.now()
    const workDir = join(this.dataDir, id)
    mkdirSync(workDir, { recursive: true })

    // Write code to temp file
    const ext = language === 'python' ? 'py' : language === 'shell' ? 'sh' : 'js'
    const scriptFile = `script.${ext}`
    writeFileSync(join(workDir, scriptFile), code)

    // Build Docker command
    const cmd = this.buildDockerCommand(language, scriptFile)
    const args = [
      'run',
      ...(this.config.autoRemove ? ['--rm'] : []),
      '--name', id,
      `-m`, `${this.config.memoryMb}m`,
      `--cpu-shares`, String(this.config.cpuShares),
      ...(this.config.networkEnabled ? [] : ['--network', 'none']),
      '-v', `${workDir}:${this.config.workDir}:ro`,
      '-w', this.config.workDir,
      '--read-only',
      '--tmpfs', '/tmp:size=50m',
      this.config.image,
      ...cmd,
    ]

    try {
      const result = await this.runWithTimeout('docker', args, this.config.timeoutMs)
      const durationMs = Date.now() - startTime

      // Cleanup
      this.cleanupWorkDir(workDir)

      return {
        id,
        status: result.exitCode === 0 ? 'success' : 'failed',
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        durationMs,
        resourceUsage: { memoryMb: this.config.memoryMb, cpuMs: durationMs },
        method: 'docker',
      }
    } catch (err: any) {
      const durationMs = Date.now() - startTime
      this.cleanupWorkDir(workDir)

      // Kill container if still running
      try { await execFileAsync('docker', ['rm', '-f', id], { timeout: 5000 }) } catch { /* ignore */ }

      return {
        id,
        status: err.message.includes('timeout') ? 'timeout' : 'error',
        stdout: '',
        stderr: err.message,
        exitCode: null,
        durationMs,
        resourceUsage: { memoryMb: 0, cpuMs: durationMs },
        method: 'docker',
      }
    }
  }

  /**
   * Fallback: Execute in process isolation (no Docker)
   */
  private async executeInProcess(id: string, code: string, language: string): Promise<SandboxExecution> {
    const startTime = Date.now()

    const cmdMap: Record<string, { bin: string; args: string[] }> = {
      javascript: { bin: 'node', args: ['-e', code] },
      python: { bin: 'python3', args: ['-c', code] },
      shell: { bin: 'sh', args: ['-c', code] },
    }

    const { bin, args } = cmdMap[language] ?? cmdMap.javascript

    try {
      const result = await this.runWithTimeout(bin, args, this.config.timeoutMs)
      const durationMs = Date.now() - startTime

      return {
        id,
        status: result.exitCode === 0 ? 'success' : 'failed',
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        durationMs,
        resourceUsage: {
          memoryMb: process.memoryUsage().heapUsed / (1024 * 1024),
          cpuMs: durationMs,
        },
        method: 'process',
      }
    } catch (err: any) {
      return {
        id,
        status: err.message.includes('timeout') ? 'timeout' : 'error',
        stdout: '',
        stderr: err.message,
        exitCode: null,
        durationMs: Date.now() - startTime,
        resourceUsage: { memoryMb: 0, cpuMs: Date.now() - startTime },
        method: 'process',
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private buildDockerCommand(language: string, scriptFile: string): string[] {
    switch (language) {
      case 'python': return ['python3', `${this.config.workDir}/${scriptFile}`]
      case 'shell': return ['sh', `${this.config.workDir}/${scriptFile}`]
      default: return ['node', `${this.config.workDir}/${scriptFile}`]
    }
  }

  private runWithTimeout(
    bin: string,
    args: string[],
    timeoutMs: number,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      let stdout = ''
      let stderr = ''
      let killed = false

      const child: ChildProcess = spawn(bin, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: timeoutMs,
        env: { ...process.env, NODE_ENV: 'sandbox' },
      })

      child.stdout?.on('data', (d) => { stdout += d.toString().slice(0, 50000) })
      child.stderr?.on('data', (d) => { stderr += d.toString().slice(0, 50000) })

      const timer = setTimeout(() => {
        killed = true
        child.kill('SIGKILL')
        reject(new Error('Sandbox execution timeout'))
      }, timeoutMs + 1000)

      child.on('close', (code) => {
        clearTimeout(timer)
        if (!killed) {
          resolve({ stdout, stderr, exitCode: code ?? 1 })
        }
      })

      child.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
    })
  }

  private cleanupWorkDir(workDir: string): void {
    try { rmSync(workDir, { recursive: true, force: true }) } catch { /* ignore */ }
  }

  getConfig(): SandboxConfig { return { ...this.config } }

  updateConfig(partial: Partial<SandboxConfig>): void {
    Object.assign(this.config, partial)
    this.dockerAvailable = null // Re-check on next call
  }
}
