/**
 * Zombie Cleanup Module
 *
 * Phase 2: 180-day inactivity → token reclaim + Playbook archival
 * Implements §7 of v6.0 Spec — Zombie Node Management
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ZombieConfig {
  /** Days of inactivity before zombie status */
  inactivityThresholdDays: number
  /** Days of warning before reclamation */
  warningPeriodDays: number
  /** Percentage of tokens reclaimed to treasury */
  reclaimPercent: number
  /** Whether to archive playbooks to public library */
  archivePlaybooks: boolean
  /** Whether cleanup is enabled */
  enabled: boolean
}

export interface NodeActivity {
  nodeId: string
  lastActiveAt: string
  lastCycleAt: string | null
  lastTransactionAt: string | null
  totalCycles: number
  totalTransactions: number
  balance: number
  playbookCount: number
  status: 'active' | 'warning' | 'zombie' | 'reclaimed'
  warningIssuedAt?: string
  reclaimedAt?: string
}

export interface ZombieReport {
  scannedAt: string
  totalNodes: number
  activeNodes: number
  warningNodes: number
  zombieNodes: number
  reclaimedNodes: number
  tokensReclaimed: number
  playbooksArchived: number
}

// ─── Zombie Cleanup Manager ───────────────────────────────────────────────────

export class ZombieCleanupManager {
  private dataDir: string
  private config: ZombieConfig
  private activities: Map<string, NodeActivity> = new Map()

  constructor(dataDir: string, config?: Partial<ZombieConfig>) {
    this.dataDir = join(dataDir, 'zombie-cleanup')
    if (!existsSync(this.dataDir)) mkdirSync(this.dataDir, { recursive: true })

    this.config = {
      inactivityThresholdDays: 180,
      warningPeriodDays: 30,
      reclaimPercent: 100,
      archivePlaybooks: true,
      enabled: true,
      ...config,
    }

    this.loadActivities()
  }

  /**
   * Record node activity (called on every cycle/transaction)
   */
  recordActivity(nodeId: string, type: 'cycle' | 'transaction', balance: number, playbookCount: number): void {
    const now = new Date().toISOString()
    const existing = this.activities.get(nodeId)

    if (existing) {
      existing.lastActiveAt = now
      existing.balance = balance
      existing.playbookCount = playbookCount
      existing.status = 'active'
      existing.warningIssuedAt = undefined

      if (type === 'cycle') {
        existing.lastCycleAt = now
        existing.totalCycles++
      } else {
        existing.lastTransactionAt = now
        existing.totalTransactions++
      }
    } else {
      this.activities.set(nodeId, {
        nodeId,
        lastActiveAt: now,
        lastCycleAt: type === 'cycle' ? now : null,
        lastTransactionAt: type === 'transaction' ? now : null,
        totalCycles: type === 'cycle' ? 1 : 0,
        totalTransactions: type === 'transaction' ? 1 : 0,
        balance,
        playbookCount,
        status: 'active',
      })
    }

    this.saveActivities()
  }

  /**
   * Run zombie cleanup scan
   * Returns a report of actions taken
   */
  runCleanup(): ZombieReport {
    if (!this.config.enabled) {
      return this.emptyReport()
    }

    const now = Date.now()
    const inactivityMs = this.config.inactivityThresholdDays * 24 * 60 * 60 * 1000
    const warningMs = (this.config.inactivityThresholdDays - this.config.warningPeriodDays) * 24 * 60 * 60 * 1000

    let tokensReclaimed = 0
    let playbooksArchived = 0

    for (const [_nodeId, activity] of this.activities) {
      if (activity.status === 'reclaimed') continue

      const lastActive = new Date(activity.lastActiveAt).getTime()
      const elapsed = now - lastActive

      if (elapsed >= inactivityMs) {
        // Full zombie — reclaim
        activity.status = 'zombie'
        const reclaimAmount = activity.balance * (this.config.reclaimPercent / 100)
        tokensReclaimed += reclaimAmount
        activity.balance -= reclaimAmount

        if (this.config.archivePlaybooks && activity.playbookCount > 0) {
          playbooksArchived += activity.playbookCount
        }

        activity.status = 'reclaimed'
        activity.reclaimedAt = new Date().toISOString()
      } else if (elapsed >= warningMs && activity.status === 'active') {
        // Warning period
        activity.status = 'warning'
        activity.warningIssuedAt = new Date().toISOString()
      }
    }

    this.saveActivities()

    const all = Array.from(this.activities.values())
    const report: ZombieReport = {
      scannedAt: new Date().toISOString(),
      totalNodes: all.length,
      activeNodes: all.filter((a) => a.status === 'active').length,
      warningNodes: all.filter((a) => a.status === 'warning').length,
      zombieNodes: all.filter((a) => a.status === 'zombie').length,
      reclaimedNodes: all.filter((a) => a.status === 'reclaimed').length,
      tokensReclaimed,
      playbooksArchived,
    }

    // Save report
    writeFileSync(join(this.dataDir, 'last-report.json'), JSON.stringify(report, null, 2))
    return report
  }

  /**
   * Check a specific node's zombie status
   */
  checkNode(nodeId: string): NodeActivity | null {
    return this.activities.get(nodeId) ?? null
  }

  /**
   * Get all activities
   */
  getAllActivities(filter?: { status?: NodeActivity['status'] }): NodeActivity[] {
    let all = Array.from(this.activities.values())
    if (filter?.status) all = all.filter((a) => a.status === filter.status)
    return all
  }

  /**
   * Get the last cleanup report
   */
  getLastReport(): ZombieReport | null {
    const path = join(this.dataDir, 'last-report.json')
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf8'))
  }

  getConfig(): ZombieConfig { return { ...this.config } }

  updateConfig(partial: Partial<ZombieConfig>): void {
    Object.assign(this.config, partial)
  }

  private emptyReport(): ZombieReport {
    return {
      scannedAt: new Date().toISOString(),
      totalNodes: 0, activeNodes: 0, warningNodes: 0,
      zombieNodes: 0, reclaimedNodes: 0, tokensReclaimed: 0, playbooksArchived: 0,
    }
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  private saveActivities(): void {
    writeFileSync(join(this.dataDir, 'activities.json'), JSON.stringify(Object.fromEntries(this.activities), null, 2))
  }

  private loadActivities(): void {
    const path = join(this.dataDir, 'activities.json')
    if (existsSync(path)) {
      this.activities = new Map(Object.entries(JSON.parse(readFileSync(path, 'utf8'))))
    }
  }
}
