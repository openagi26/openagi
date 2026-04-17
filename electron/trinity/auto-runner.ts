/**
 * Trinity Auto-Runner
 *
 * Autonomous cycle execution engine — the "heartbeat" of the Trinity node
 * Runs Trinity cycles on an interval, respecting constraints and confidence
 */
import { EventEmitter } from 'node:events'
import { logger } from '../utils/logger'
import type { TrinityEngine, TrinityRoundResult } from './index'
import { AIExecutor, type AIExecutorConfig } from './ai-executor'
import type { GoalManager } from './goal-manager'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AutoRunnerConfig {
  /** Interval between cycles in milliseconds (default: 5 minutes) */
  intervalMs: number
  /** Maximum consecutive failures before auto-pause */
  maxConsecutiveFailures: number
  /** Whether to run automatically on start */
  autoStart: boolean
  /** AI executor configuration */
  aiConfig: Partial<AIExecutorConfig>
  /** Graceful degradation budget modes */
  budgetMode: 'full' | 'conservative' | 'survival'
}

export interface AutoRunnerState {
  isRunning: boolean
  cyclesCompleted: number
  consecutiveFailures: number
  lastCycleAt: string | null
  lastError: string | null
  budgetMode: string
  pauseReason: string | null
}

// ─── Auto Runner ──────────────────────────────────────────────────────────────

export class TrinityAutoRunner extends EventEmitter {
  private engine: TrinityEngine
  private goalManager: GoalManager
  private executor: AIExecutor
  private config: AutoRunnerConfig
  private state: AutoRunnerState
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(
    engine: TrinityEngine,
    goalManager: GoalManager,
    config?: Partial<AutoRunnerConfig>,
  ) {
    super()
    this.engine = engine
    this.goalManager = goalManager

    this.config = {
      intervalMs: 5 * 60 * 1000, // 5 minutes
      maxConsecutiveFailures: 3,
      autoStart: false,
      aiConfig: {},
      budgetMode: 'full',
      ...config,
    }

    this.executor = new AIExecutor(this.config.aiConfig)

    this.state = {
      isRunning: false,
      cyclesCompleted: 0,
      consecutiveFailures: 0,
      lastCycleAt: null,
      lastError: null,
      budgetMode: this.config.budgetMode,
      pauseReason: null,
    }
  }

  // ─── Control ──────────────────────────────────────────────────────────────

  start(): void {
    if (this.state.isRunning) return

    // Pre-flight checks
    const goal = this.goalManager.getCurrentGoal()
    if (!goal) {
      this.state.pauseReason = 'No active goal — set a GOAL to start the Trinity'
      this.emit('paused', { reason: this.state.pauseReason })
      return
    }

    if (!this.engine.identity.hasGenesis()) {
      this.state.pauseReason = 'Genesis not complete — run genesis first'
      this.emit('paused', { reason: this.state.pauseReason })
      return
    }

    this.state.isRunning = true
    this.state.pauseReason = null
    this.state.consecutiveFailures = 0

    logger.info('[AutoRunner] Starting Trinity auto-runner')
    this.emit('started')

    // Run first cycle immediately
    this.executeCycle()

    // Schedule recurring cycles
    this.timer = setInterval(() => this.executeCycle(), this.config.intervalMs)
  }

  stop(reason: string = 'Manual stop'): void {
    if (!this.state.isRunning) return

    this.state.isRunning = false
    this.state.pauseReason = reason

    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

    logger.info(`[AutoRunner] Stopped: ${reason}`)
    this.emit('stopped', { reason })
  }

  /**
   * Execute one Trinity cycle manually (regardless of running state)
   */
  async runOnce(): Promise<TrinityRoundResult | null> {
    if (!this.engine.identity.hasGenesis()) {
      this.emit('error', { message: 'Cannot run cycle: genesis not completed' })
      return null
    }
    return this.executeCycle()
  }

  // ─── Cycle Execution ──────────────────────────────────────────────────────

  private async executeCycle(): Promise<TrinityRoundResult | null> {
    const goal = this.goalManager.getCurrentGoal()
    if (!goal) {
      this.stop('No active goal')
      return null
    }

    // Check budget mode constraints
    if (this.config.budgetMode === 'survival' && this.engine.economy.getBalance() < 10) {
      this.stop('Survival mode: balance below minimum reserve')
      return null
    }

    // Check constraint violations
    const constraintCheck = this.goalManager.checkConstraints({
      type: 'cycle',
      balance: this.engine.economy.getBalance(),
      confidence: this.engine.getState().confidence,
    })

    if (!constraintCheck.allowed) {
      const violationStr = constraintCheck.violations.map((v) => v.id).join(', ')
      this.stop(`Constraint violation: ${violationStr}`)
      return null
    }

    // Build goal context
    const goalContext = this.buildGoalContext(goal)

    try {
      this.emit('cycle-start', { round: this.engine.getState().currentRound + 1 })

      const result = await this.engine.runCycle(
        goalContext,
        (role, prompt, context) => this.executor.execute(role, prompt, context),
      )

      this.state.cyclesCompleted++
      this.state.consecutiveFailures = 0
      this.state.lastCycleAt = new Date().toISOString()
      this.state.lastError = null

      this.emit('cycle-complete', result)

      // Check if goal is complete
      if (goal.status === 'completed') {
        this.stop('Goal completed')
      }

      // Graceful degradation check
      this.checkBudgetDegradation()

      return result
    } catch (err: any) {
      this.state.consecutiveFailures++
      this.state.lastError = err.message

      logger.error(`[AutoRunner] Cycle failed (${this.state.consecutiveFailures}/${this.config.maxConsecutiveFailures}): ${err.message}`)
      this.emit('cycle-error', { error: err.message, failures: this.state.consecutiveFailures })

      // Auto-pause on too many consecutive failures
      if (this.state.consecutiveFailures >= this.config.maxConsecutiveFailures) {
        this.stop(`Too many consecutive failures (${this.state.consecutiveFailures})`)
      }

      return null
    }
  }

  // ─── Budget Degradation ───────────────────────────────────────────────────

  private checkBudgetDegradation(): void {
    const balance = this.engine.economy.getBalance()

    if (balance < 10) {
      this.config.budgetMode = 'survival'
      this.state.budgetMode = 'survival'
      this.emit('budget-mode', { mode: 'survival' })
    } else if (balance < 30) {
      this.config.budgetMode = 'conservative'
      this.state.budgetMode = 'conservative'
      this.emit('budget-mode', { mode: 'conservative' })
    } else {
      this.config.budgetMode = 'full'
      this.state.budgetMode = 'full'
    }
  }

  // ─── Context Building ─────────────────────────────────────────────────────

  private buildGoalContext(goal: any): string {
    const constraints = this.goalManager.getConstraints()
    const balance = this.engine.economy.getBalance()
    const state = this.engine.getState()
    const debts = this.engine.governance.getDebts('open')

    const parts = [
      `# Current Goal`,
      `**${goal.title}** [${goal.priority}]`,
      goal.description,
    ]

    if (goal.subGoals?.length > 0) {
      parts.push('', '## Sub-Goals:')
      for (const sg of goal.subGoals) {
        parts.push(`- [${sg.status === 'done' ? 'x' : ' '}] ${sg.title}`)
      }
    }

    parts.push(
      '',
      '## Node Status:',
      `- Balance: ${balance} New.B`,
      `- Budget Mode: ${this.state.budgetMode}`,
      `- Confidence: ${state.confidence}%`,
      `- Open Debts: ${debts.length}`,
      `- Round: ${state.currentRound}`,
    )

    if (goal.targetMetric) parts.push(`- Target Metric: ${goal.targetMetric}`)
    if (goal.deadline) parts.push(`- Deadline: ${goal.deadline}`)

    parts.push(
      '',
      '## Active Constraints:',
      ...constraints.filter((c) => c.severity === 'hard').map((c) => `- [${c.id}] ${c.rule}`),
    )

    return parts.join('\n')
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  getState(): AutoRunnerState {
    return { ...this.state }
  }

  getConfig(): AutoRunnerConfig {
    return { ...this.config }
  }

  updateConfig(partial: Partial<AutoRunnerConfig>): void {
    const wasRunning = this.state.isRunning
    if (wasRunning) this.stop('Config update')

    Object.assign(this.config, partial)
    if (partial.aiConfig) {
      this.executor.updateConfig(partial.aiConfig)
    }

    if (wasRunning) this.start()
  }

  updateAIConfig(config: Partial<AIExecutorConfig>): void {
    this.executor.updateConfig(config)
  }
}
