/**
 * OpenAGI Proof of Outcome (PoO) Verifier
 *
 * Result-oriented verification system replacing subjective evaluation
 * Implements Section 5 of OpenAGI v6.0 Spec
 *
 * PoO-Driven Priority Score Formula:
 *   PriorityScore = (GoalFit×0.35 + PoO_Outcome×0.35 + EvidenceLevel×0.2) / (Cost + DebtImpact×0.1)
 *   Score >= 85 → Execute and reward New.B
 *   Score <  85 → Discard + stake deduction
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { secureId } from '../utils/secure-id'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PoOTask {
  id: string
  title: string
  description: string
  proposedBy: 'AI-1' | 'AI-2' | 'AI-3'
  createdAt: string
  status: 'pending' | 'running' | 'verified' | 'failed' | 'discarded'
  /** Sandbox execution result */
  sandboxResult?: SandboxResult
  /** Computed priority score */
  priorityScore?: number
  scoreComponents?: ScoreComponents
  /** New.B reward issued (0 if failed) */
  newbReward: number
  /** Evidence hash for blockchain anchoring */
  evidenceHash?: string
}

export interface ScoreComponents {
  goalFit: number        // 0-100: How well does this align with current GOAL?
  pooOutcome: number     // 0-100: Actual measured outcome from sandbox
  evidenceLevel: number  // 0-100: H1=100, H2=75, H3=50, H4=25
  cost: number           // 0-100: Resource cost (lower is better, inverted in formula)
  debtImpact: number     // 0-100: How much technical debt does this create?
}

export interface SandboxResult {
  /** Did the task execute successfully? */
  success: boolean
  /** Execution output */
  output: string
  /** Error message if failed */
  error?: string
  /** Execution duration in ms */
  durationMs: number
  /** Resource usage metrics */
  metrics: {
    cpuMs: number
    memoryMb: number
    networkBytes: number
  }
  /** Outcome measurement (0-100) */
  outcomeScore: number
  /** Timestamp of verification */
  verifiedAt: string
}

export interface PoOConfig {
  /** Minimum priority score to execute (default: 85) */
  executionThreshold: number
  /** Maximum sandbox execution time in ms */
  sandboxTimeoutMs: number
  /** Auto-discard tasks below this score */
  discardThreshold: number
  /** Confidence below which commander pauses (Section 9) */
  confidencePauseThreshold: number
}

// ─── PoO Verifier ─────────────────────────────────────────────────────────────

export class PoOVerifier {
  private dataDir: string
  private config: PoOConfig
  private tasks: Map<string, PoOTask> = new Map()

  constructor(dataDir: string, config?: Partial<PoOConfig>) {
    this.dataDir = join(dataDir, 'poo')
    if (!existsSync(this.dataDir)) mkdirSync(this.dataDir, { recursive: true })

    this.config = {
      executionThreshold: 85,
      sandboxTimeoutMs: 30000,
      discardThreshold: 40,
      confidencePauseThreshold: 50,
      ...config,
    }

    this.loadTasks()
  }

  // ─── Task Lifecycle ───────────────────────────────────────────────────────

  /**
   * Submit a new task for PoO verification
   */
  submitTask(params: Pick<PoOTask, 'title' | 'description' | 'proposedBy'>): PoOTask {
    const id = secureId('POO')
    const task: PoOTask = {
      id,
      ...params,
      createdAt: new Date().toISOString(),
      status: 'pending',
      newbReward: 0,
    }

    this.tasks.set(id, task)
    this.saveTasks()
    return task
  }

  /**
   * Calculate Priority Score for a task
   * PriorityScore = (GoalFit×0.35 + PoO_Outcome×0.35 + EvidenceLevel×0.2) / (Cost + DebtImpact×0.1)
   */
  calculateScore(taskId: string, components: ScoreComponents): number {
    const task = this.tasks.get(taskId)
    if (!task) throw new Error(`Task ${taskId} not found`)

    const numerator =
      (components.goalFit * 0.35) +
      (components.pooOutcome * 0.35) +
      (components.evidenceLevel * 0.2)

    // Cost and DebtImpact are inverted (higher = worse)
    // Normalize denominator to avoid division by zero
    const denominator = Math.max(1, (components.cost + components.debtImpact * 0.1))

    // Scale to 0-100 range
    const score = Math.min(100, Math.max(0, (numerator / denominator) * 100))

    task.priorityScore = Math.round(score * 100) / 100
    task.scoreComponents = components
    this.saveTasks()

    return task.priorityScore
  }

  /**
   * Run sandbox verification (process-isolated execution)
   * In Phase 0: uses child_process isolation instead of Docker
   */
  async verifySandbox(taskId: string, executionFn: () => Promise<{ success: boolean; output: string; outcomeScore: number }>): Promise<SandboxResult> {
    const task = this.tasks.get(taskId)
    if (!task) throw new Error(`Task ${taskId} not found`)

    task.status = 'running'
    this.saveTasks()

    const startTime = Date.now()

    try {
      // Execute with timeout
      const result = await Promise.race([
        executionFn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Sandbox timeout')), this.config.sandboxTimeoutMs)
        ),
      ])

      const durationMs = Date.now() - startTime
      const sandboxResult: SandboxResult = {
        success: result.success,
        output: result.output,
        durationMs,
        metrics: {
          cpuMs: durationMs, // Approximate
          memoryMb: process.memoryUsage().heapUsed / 1024 / 1024,
          networkBytes: 0,
        },
        outcomeScore: result.outcomeScore,
        verifiedAt: new Date().toISOString(),
      }

      task.sandboxResult = sandboxResult
      task.status = result.success ? 'verified' : 'failed'

      // Generate evidence hash
      task.evidenceHash = createHash('sha256')
        .update(JSON.stringify({ taskId, sandboxResult }))
        .digest('hex')

      this.saveTasks()
      return sandboxResult
    } catch (err: any) {
      const durationMs = Date.now() - startTime
      const sandboxResult: SandboxResult = {
        success: false,
        output: '',
        error: err.message,
        durationMs,
        metrics: { cpuMs: durationMs, memoryMb: 0, networkBytes: 0 },
        outcomeScore: 0,
        verifiedAt: new Date().toISOString(),
      }

      task.sandboxResult = sandboxResult
      task.status = 'failed'
      this.saveTasks()
      return sandboxResult
    }
  }

  /**
   * Final decision: execute & reward, or discard & penalize
   */
  finalizeTask(taskId: string): { action: 'execute' | 'discard'; score: number; reward: number } {
    const task = this.tasks.get(taskId)
    if (!task) throw new Error(`Task ${taskId} not found`)

    const score = task.priorityScore ?? 0

    if (score >= this.config.executionThreshold) {
      // Execute and reward
      const baseReward = 10 // Will be adjusted by NewBEngine halving
      task.newbReward = baseReward
      task.status = 'verified'
      this.saveTasks()
      return { action: 'execute', score, reward: baseReward }
    } else {
      // Discard
      task.status = 'discarded'
      task.newbReward = 0
      this.saveTasks()
      return { action: 'discard', score, reward: 0 }
    }
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  getTask(taskId: string): PoOTask | undefined {
    return this.tasks.get(taskId)
  }

  listTasks(status?: PoOTask['status']): PoOTask[] {
    const all = Array.from(this.tasks.values())
    return status ? all.filter((t) => t.status === status) : all
  }

  getConfig(): PoOConfig {
    return { ...this.config }
  }

  updateConfig(partial: Partial<PoOConfig>): void {
    Object.assign(this.config, partial)
    writeFileSync(join(this.dataDir, 'config.json'), JSON.stringify(this.config, null, 2))
  }

  /**
   * Get PoO statistics
   */
  getStats(): {
    totalTasks: number
    verified: number
    failed: number
    discarded: number
    avgScore: number
    totalRewards: number
  } {
    const tasks = Array.from(this.tasks.values())
    const scores = tasks.filter((t) => t.priorityScore != null).map((t) => t.priorityScore!)
    return {
      totalTasks: tasks.length,
      verified: tasks.filter((t) => t.status === 'verified').length,
      failed: tasks.filter((t) => t.status === 'failed').length,
      discarded: tasks.filter((t) => t.status === 'discarded').length,
      avgScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      totalRewards: tasks.reduce((sum, t) => sum + t.newbReward, 0),
    }
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  private saveTasks(): void {
    const data = Object.fromEntries(this.tasks)
    writeFileSync(join(this.dataDir, 'tasks.json'), JSON.stringify(data, null, 2))
  }

  private loadTasks(): void {
    const path = join(this.dataDir, 'tasks.json')
    if (existsSync(path)) {
      const data = JSON.parse(readFileSync(path, 'utf8'))
      this.tasks = new Map(Object.entries(data))
    }
  }
}
