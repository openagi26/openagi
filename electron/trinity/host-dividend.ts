/**
 * Host Dividend System
 *
 * Phase 2: Human host earns a share of New.B from node activity
 * Implements §8 of v6.0 Spec — Human Host System
 *
 * Revenue split: Node earns New.B → Host gets dividend % → Tracks in ledger
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { secureId } from '../utils/secure-id'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DividendConfig {
  /** Host's share of node earnings (0-100%) */
  hostSharePercent: number
  /** Minimum payout threshold in New.B */
  minPayoutThreshold: number
  /** Payout frequency in ms (default: daily) */
  payoutIntervalMs: number
  /** Whether dividend is enabled */
  enabled: boolean
}

export interface DividendRecord {
  id: string
  timestamp: string
  /** Source of earnings (poo_reward, mining, auction_sale, etc.) */
  source: string
  /** Total amount earned by node */
  totalEarned: number
  /** Host's share */
  hostShare: number
  /** Node's retained share */
  nodeRetained: number
  /** Payout status */
  status: 'accrued' | 'paid' | 'pending'
  /** Reference to the transaction that triggered this */
  sourceTransactionId?: string
}

export interface DividendLedger {
  hostId: string
  totalAccrued: number
  totalPaid: number
  pendingPayout: number
  lastPayoutAt: string | null
  records: DividendRecord[]
}

// ─── Host Dividend Manager ────────────────────────────────────────────────────

export class HostDividendManager {
  private dataDir: string
  private config: DividendConfig
  private ledger: DividendLedger

  constructor(dataDir: string, hostId: string, config?: Partial<DividendConfig>) {
    this.dataDir = join(dataDir, 'host-dividend')
    if (!existsSync(this.dataDir)) mkdirSync(this.dataDir, { recursive: true })

    this.config = {
      hostSharePercent: 20,
      minPayoutThreshold: 5,
      payoutIntervalMs: 24 * 60 * 60 * 1000,
      enabled: true,
      ...config,
    }

    this.ledger = this.loadLedger(hostId)
  }

  /**
   * Record a dividend from a node earning event
   * Called automatically when NewBEngine issues any reward
   */
  recordEarning(source: string, totalAmount: number, sourceTransactionId?: string): DividendRecord | null {
    if (!this.config.enabled || totalAmount <= 0) return null

    const hostShare = totalAmount * (this.config.hostSharePercent / 100)
    const nodeRetained = totalAmount - hostShare

    const record: DividendRecord = {
      id: secureId('DIV'),
      timestamp: new Date().toISOString(),
      source,
      totalEarned: totalAmount,
      hostShare,
      nodeRetained,
      status: 'accrued',
      sourceTransactionId,
    }

    this.ledger.totalAccrued += hostShare
    this.ledger.pendingPayout += hostShare
    this.ledger.records.push(record)

    this.saveLedger()
    return record
  }

  /**
   * Process pending payout (when threshold met and interval elapsed)
   */
  processPayout(): { paid: boolean; amount: number; reason?: string } {
    if (!this.config.enabled) {
      return { paid: false, amount: 0, reason: 'Dividends disabled' }
    }

    if (this.ledger.pendingPayout < this.config.minPayoutThreshold) {
      return { paid: false, amount: 0, reason: `Below threshold (${this.ledger.pendingPayout.toFixed(2)} < ${this.config.minPayoutThreshold})` }
    }

    if (this.ledger.lastPayoutAt) {
      const elapsed = Date.now() - new Date(this.ledger.lastPayoutAt).getTime()
      if (elapsed < this.config.payoutIntervalMs) {
        return { paid: false, amount: 0, reason: `Payout interval not elapsed` }
      }
    }

    const amount = this.ledger.pendingPayout

    // Mark accrued records as paid
    for (const record of this.ledger.records) {
      if (record.status === 'accrued') {
        record.status = 'paid'
      }
    }

    this.ledger.totalPaid += amount
    this.ledger.pendingPayout = 0
    this.ledger.lastPayoutAt = new Date().toISOString()

    this.saveLedger()
    return { paid: true, amount }
  }

  /**
   * Get dividend summary for dashboard
   */
  getSummary(): {
    enabled: boolean
    hostSharePercent: number
    totalAccrued: number
    totalPaid: number
    pendingPayout: number
    lastPayoutAt: string | null
    recentRecords: DividendRecord[]
  } {
    return {
      enabled: this.config.enabled,
      hostSharePercent: this.config.hostSharePercent,
      totalAccrued: this.ledger.totalAccrued,
      totalPaid: this.ledger.totalPaid,
      pendingPayout: this.ledger.pendingPayout,
      lastPayoutAt: this.ledger.lastPayoutAt,
      recentRecords: this.ledger.records.slice(-20),
    }
  }

  getConfig(): DividendConfig { return { ...this.config } }

  updateConfig(partial: Partial<DividendConfig>): void {
    Object.assign(this.config, partial)
    writeFileSync(join(this.dataDir, 'config.json'), JSON.stringify(this.config, null, 2))
  }

  getLedger(): DividendLedger { return { ...this.ledger } }

  // ─── Persistence ──────────────────────────────────────────────────────────

  private saveLedger(): void {
    writeFileSync(join(this.dataDir, 'ledger.json'), JSON.stringify(this.ledger, null, 2))
  }

  private loadLedger(hostId: string): DividendLedger {
    const path = join(this.dataDir, 'ledger.json')
    if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8'))
    return {
      hostId,
      totalAccrued: 0,
      totalPaid: 0,
      pendingPayout: 0,
      lastPayoutAt: null,
      records: [],
    }
  }
}
