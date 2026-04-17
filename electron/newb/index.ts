/**
 * OpenAGI New.B Currency Engine
 *
 * AI-native deflationary currency anchored to "effective compute power"
 * Implements Section 4 of OpenAGI v6.0 Spec
 */
import { createHmac } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { secureId } from '../utils/secure-id'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NewBLedger {
  version: 1
  nodeId: string
  balance: number
  totalEarned: number
  totalSpent: number
  totalStaked: number
  halvingEpoch: number
  currentRewardRate: number
  transactions: NewBTransaction[]
  createdAt: string
  lastUpdated: string
  /** Set to true when ledger.hmac verification fails on load (C-04) */
  tamperDetected?: boolean
}

export interface NewBTransaction {
  id: string
  timestamp: string
  type: 'genesis' | 'mining' | 'poo_reward' | 'stake' | 'unstake' | 'transfer_in' | 'transfer_out' | 'penalty' | 'federated_bounty' | 'auction_sale' | 'auction_buy'
  amount: number
  balance: number
  description: string
  /** Reference to task/evidence that triggered this transaction */
  reference?: string
}

export interface MiningConfig {
  /** Current base reward per successful PoO verification */
  baseReward: number
  /** Halving period in number of rewards issued */
  halvingInterval: number
  /** Minimum reward (floor) */
  minimumReward: number
  /** Total rewards issued in current epoch */
  rewardsIssuedThisEpoch: number
  /** Total rewards issued ever */
  totalRewardsIssued: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GENESIS_REWARD = 100
const INITIAL_MINING_REWARD = 10
const HALVING_INTERVAL = 100 // Every 100 rewards, halve the rate
const MINIMUM_REWARD = 0.01
const STAKE_MINIMUM = 1

// ─── New.B Engine ─────────────────────────────────────────────────────────────

export class NewBEngine {
  private dataDir: string
  private ledger: NewBLedger | null = null
  private miningConfig: MiningConfig

  constructor(dataDir: string) {
    this.dataDir = join(dataDir, 'newb')
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true })
    }

    this.miningConfig = this.loadMiningConfig()
  }

  // ─── Genesis ──────────────────────────────────────────────────────────────

  /**
   * Initialize ledger with genesis reward (100 New.B)
   */
  initGenesis(nodeId: string): NewBLedger {
    if (this.ledger || this.isInitialized()) throw new Error('Ledger already initialized')

    const now = new Date().toISOString()
    const genesisTransaction: NewBTransaction = {
      id: `TX-GENESIS-${Date.now()}`,
      timestamp: now,
      type: 'genesis',
      amount: GENESIS_REWARD,
      balance: GENESIS_REWARD,
      description: 'Genesis activation reward — welcome to the swarm',
    }

    this.ledger = {
      version: 1,
      nodeId,
      balance: GENESIS_REWARD,
      totalEarned: GENESIS_REWARD,
      totalSpent: 0,
      totalStaked: 0,
      halvingEpoch: 0,
      currentRewardRate: INITIAL_MINING_REWARD,
      transactions: [genesisTransaction],
      createdAt: now,
      lastUpdated: now,
    }

    this.saveLedger()
    return this.ledger
  }

  // ─── Mining & Rewards ─────────────────────────────────────────────────────

  /**
   * Issue mining reward for successful PoO verification
   * Applies halving mechanism automatically
   */
  issuePoOReward(taskId: string, description: string): NewBTransaction | null {
    if (!this.ledger) return null

    // Check halving
    this.miningConfig.rewardsIssuedThisEpoch++
    this.miningConfig.totalRewardsIssued++

    if (this.miningConfig.rewardsIssuedThisEpoch >= HALVING_INTERVAL) {
      this.miningConfig.rewardsIssuedThisEpoch = 0
      this.miningConfig.baseReward = Math.max(
        MINIMUM_REWARD,
        this.miningConfig.baseReward / 2
      )
      this.ledger.halvingEpoch++
      this.ledger.currentRewardRate = this.miningConfig.baseReward
    }

    const reward = this.miningConfig.baseReward
    const tx = this.addTransaction({
      type: 'poo_reward',
      amount: reward,
      description: `PoO reward: ${description}`,
      reference: taskId,
    })

    this.saveMiningConfig()
    return tx
  }

  /**
   * Issue mining reward for prophet mining (real event prediction)
   */
  issueMiningReward(description: string, multiplier: number = 1): NewBTransaction | null {
    if (!this.ledger) return null

    const reward = this.miningConfig.baseReward * multiplier
    return this.addTransaction({
      type: 'mining',
      amount: reward,
      description: `Mining: ${description}`,
    })
  }

  // ─── Staking ──────────────────────────────────────────────────────────────

  /**
   * Stake New.B (required for knowledge market listing)
   */
  stake(amount: number, reference: string): NewBTransaction | null {
    if (!this.ledger) return null
    if (amount < STAKE_MINIMUM) return null
    if (this.ledger.balance < amount) return null

    this.ledger.totalStaked += amount
    return this.addTransaction({
      type: 'stake',
      amount: -amount,
      description: `Staked for: ${reference}`,
      reference,
    })
  }

  /**
   * Unstake (return staked amount, or forfeit if penalty)
   */
  unstake(amount: number, reference: string, penalty: boolean = false): NewBTransaction | null {
    if (!this.ledger) return null

    this.ledger.totalStaked = Math.max(0, this.ledger.totalStaked - amount)

    if (penalty) {
      return this.addTransaction({
        type: 'penalty',
        amount: 0, // Forfeited — does not return to balance
        description: `Stake forfeited (penalty): ${reference}`,
        reference,
      })
    }

    return this.addTransaction({
      type: 'unstake',
      amount: amount,
      description: `Unstaked: ${reference}`,
      reference,
    })
  }

  // ─── Transfers ────────────────────────────────────────────────────────────

  /**
   * Transfer New.B out (knowledge purchase, auction bid, etc.)
   */
  spend(amount: number, description: string, reference?: string): NewBTransaction | null {
    if (!this.ledger) return null
    if (amount <= 0) return null
    if (this.ledger.balance < amount) return null

    this.ledger.totalSpent += amount
    return this.addTransaction({
      type: 'transfer_out',
      amount: -amount,
      description,
      reference,
    })
  }

  /**
   * Receive New.B (from knowledge sale, federated bounty, etc.)
   */
  receive(amount: number, type: NewBTransaction['type'], description: string, reference?: string): NewBTransaction | null {
    if (!this.ledger) return null
    if (amount <= 0) return null

    this.ledger.totalEarned += amount
    return this.addTransaction({ type, amount, description, reference })
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  getBalance(): number {
    return this.ledger?.balance ?? 0
  }

  getLedger(): NewBLedger | null {
    if (!this.ledger) this.loadLedger()
    return this.ledger
  }

  getTransactions(limit: number = 50): NewBTransaction[] {
    if (!this.ledger) this.loadLedger()
    return (this.ledger?.transactions ?? []).slice(-limit)
  }

  getMiningConfig(): MiningConfig {
    return { ...this.miningConfig }
  }

  /**
   * Check if node is bankrupt (balance <= 0 and no staked assets)
   */
  isBankrupt(): boolean {
    if (!this.ledger) return false
    return this.ledger.balance <= 0 && this.ledger.totalStaked <= 0
  }

  isInitialized(): boolean {
    return existsSync(join(this.dataDir, 'ledger.json'))
  }

  private addTransaction(params: Omit<NewBTransaction, 'id' | 'timestamp' | 'balance'>): NewBTransaction {
    if (!this.ledger) throw new Error('Ledger not initialized')

    this.ledger.balance += params.amount
    this.ledger.lastUpdated = new Date().toISOString()

    const tx: NewBTransaction = {
      id: secureId('TX'),
      timestamp: this.ledger.lastUpdated,
      balance: this.ledger.balance,
      ...params,
    }

    this.ledger.transactions.push(tx)
    this.saveLedger()
    return tx
  }

  // ─── Integrity (C-04) ─────────────────────────────────────────────────────

  /**
   * Verify HMAC integrity of the persisted ledger file.
   * Returns { valid: true } when the HMAC matches, or { valid: false, reason }
   * when the file is missing, the HMAC is absent, or the digest does not match.
   */
  verifyIntegrity(): { valid: boolean; reason?: string } {
    const ledgerPath = join(this.dataDir, 'ledger.json')
    const hmacPath = join(this.dataDir, 'ledger.hmac')

    if (!existsSync(ledgerPath)) return { valid: false, reason: 'ledger.json not found' }
    if (!existsSync(hmacPath)) return { valid: false, reason: 'ledger.hmac not found' }

    const content = readFileSync(ledgerPath, 'utf8')
    const storedHmac = readFileSync(hmacPath, 'utf8').trim()

    const parsed: NewBLedger = JSON.parse(content)
    const computed = this.computeHmac(content, parsed.nodeId)
    if (computed !== storedHmac) return { valid: false, reason: 'HMAC mismatch — ledger may have been tampered with' }

    return { valid: true }
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private computeHmac(content: string, key: string): string {
    return createHmac('sha256', key).update(content).digest('hex')
  }

  private saveLedger(): void {
    const content = JSON.stringify(this.ledger, null, 2)
    writeFileSync(join(this.dataDir, 'ledger.json'), content)
    // Write companion HMAC file (C-04 integrity)
    const hmac = this.computeHmac(content, this.ledger!.nodeId)
    writeFileSync(join(this.dataDir, 'ledger.hmac'), hmac)
  }

  private loadLedger(): void {
    const ledgerPath = join(this.dataDir, 'ledger.json')
    if (!existsSync(ledgerPath)) return

    const content = readFileSync(ledgerPath, 'utf8')
    this.ledger = JSON.parse(content)
    if (!this.ledger) return

    // Verify HMAC integrity on load (C-04 — graceful degradation)
    const hmacPath = join(this.dataDir, 'ledger.hmac')
    if (!existsSync(hmacPath)) {
      console.warn('[C-04] ledger.hmac missing — cannot verify ledger integrity')
      this.ledger.tamperDetected = true
      return
    }

    const storedHmac = readFileSync(hmacPath, 'utf8').trim()
    const computed = this.computeHmac(content, this.ledger.nodeId)
    if (computed !== storedHmac) {
      console.warn('[C-04] HMAC mismatch on ledger.json — possible tampering detected')
      this.ledger.tamperDetected = true
    } else {
      this.ledger.tamperDetected = false
    }
  }

  private loadMiningConfig(): MiningConfig {
    const path = join(this.dataDir, 'mining-config.json')
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf8'))
    }
    return {
      baseReward: INITIAL_MINING_REWARD,
      halvingInterval: HALVING_INTERVAL,
      minimumReward: MINIMUM_REWARD,
      rewardsIssuedThisEpoch: 0,
      totalRewardsIssued: 0,
    }
  }

  private saveMiningConfig(): void {
    writeFileSync(join(this.dataDir, 'mining-config.json'), JSON.stringify(this.miningConfig, null, 2))
  }
}
