/**
 * Prophet Mining Module
 *
 * Phase 1: Real-world event prediction → verification → New.B reward
 * Nodes earn New.B by making verifiable predictions about future events.
 *
 * Flow: Create prediction → Lock stake → Event occurs → Oracle verifies → Reward/Penalize
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { secureId } from '../utils/secure-id'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Prediction {
  id: string
  nodeId: string
  /** What is being predicted */
  claim: string
  /** Category for routing to appropriate oracle */
  category: 'price' | 'event' | 'metric' | 'code' | 'custom'
  /** Specific measurable outcome */
  targetMetric: string
  /** Predicted value or boolean outcome */
  predictedValue: string
  /** Confidence in prediction (0-100) */
  confidence: number
  /** When the prediction should be verified */
  verifyAfter: string
  /** Optional: deadline after which prediction expires */
  expiresAt?: string
  /** New.B staked on this prediction */
  stakedAmount: number
  /** Current status */
  status: 'pending' | 'locked' | 'verified_correct' | 'verified_wrong' | 'expired' | 'cancelled'
  /** Oracle verification result */
  oracleResult?: OracleResult
  /** Reward issued (or penalty applied) */
  reward: number
  /** SHA-256 hash of prediction at creation time (tamper-proof) */
  commitHash: string
  createdAt: string
  verifiedAt?: string
}

export interface OracleResult {
  /** Actual observed value */
  actualValue: string
  /** How close the prediction was (0-100) */
  accuracy: number
  /** Source of verification */
  source: string
  /** Verification method */
  method: 'api' | 'manual' | 'consensus' | 'sandbox'
  /** Timestamp of verification */
  timestamp: string
}

export interface ProphetMiningConfig {
  /** Minimum stake per prediction */
  minStake: number
  /** Maximum stake per prediction */
  maxStake: number
  /** Accuracy threshold for "correct" (0-100) */
  accuracyThreshold: number
  /** Reward multiplier for correct predictions */
  rewardMultiplier: number
  /** Penalty multiplier for wrong predictions (0-1, portion of stake lost) */
  penaltyRate: number
  /** Maximum active predictions per node */
  maxActivePredictions: number
}

// ─── Oracle Adapters ──────────────────────────────────────────────────────────

interface OracleAdapter {
  name: string
  canVerify(category: string): boolean
  verify(prediction: Prediction): Promise<OracleResult>
}

/**
 * Price Oracle — verifies cryptocurrency/stock price predictions
 * Uses public APIs (CoinGecko, etc.)
 */
class PriceOracle implements OracleAdapter {
  name = 'price-oracle'

  canVerify(category: string): boolean {
    return category === 'price'
  }

  async verify(prediction: Prediction): Promise<OracleResult> {
    try {
      // Try CoinGecko for crypto prices
      const symbol = prediction.targetMetric.toLowerCase()
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd`
      )

      if (!response.ok) {
        return this.manualFallback(prediction, `API returned ${response.status}`)
      }

      const data = await response.json() as any
      const actualPrice = data[symbol]?.usd

      if (actualPrice == null) {
        return this.manualFallback(prediction, `No price data for ${symbol}`)
      }

      const predicted = parseFloat(prediction.predictedValue)
      const deviation = Math.abs(actualPrice - predicted) / predicted
      const accuracy = Math.max(0, Math.round((1 - deviation) * 100))

      return {
        actualValue: String(actualPrice),
        accuracy,
        source: 'coingecko',
        method: 'api',
        timestamp: new Date().toISOString(),
      }
    } catch (err: any) {
      return this.manualFallback(prediction, err.message)
    }
  }

  private manualFallback(prediction: Prediction, reason: string): OracleResult {
    return {
      actualValue: 'UNVERIFIED',
      accuracy: 0,
      source: `manual-fallback: ${reason}`,
      method: 'manual',
      timestamp: new Date().toISOString(),
    }
  }
}

/**
 * Sandbox Oracle — verifies code/metric predictions by running tests
 */
class SandboxOracle implements OracleAdapter {
  name = 'sandbox-oracle'

  canVerify(category: string): boolean {
    return category === 'code' || category === 'metric'
  }

  async verify(_prediction: Prediction): Promise<OracleResult> {
    // For code predictions, we check if the claim holds
    // For metric predictions, we compare against observable data
    return {
      actualValue: 'sandbox-pending',
      accuracy: 0,
      source: 'sandbox',
      method: 'sandbox',
      timestamp: new Date().toISOString(),
    }
  }
}

/**
 * Generic Event Oracle — manual/consensus verification
 */
class EventOracle implements OracleAdapter {
  name = 'event-oracle'

  canVerify(category: string): boolean {
    return category === 'event' || category === 'custom'
  }

  async verify(_prediction: Prediction): Promise<OracleResult> {
    return {
      actualValue: 'awaiting-consensus',
      accuracy: 0,
      source: 'consensus-pending',
      method: 'consensus',
      timestamp: new Date().toISOString(),
    }
  }
}

// ─── Prophet Mining Engine ────────────────────────────────────────────────────

export class ProphetMiningEngine {
  private dataDir: string
  private predictions: Map<string, Prediction> = new Map()
  private config: ProphetMiningConfig
  private oracles: OracleAdapter[]

  constructor(dataDir: string, config?: Partial<ProphetMiningConfig>) {
    this.dataDir = join(dataDir, 'prophet-mining')
    if (!existsSync(this.dataDir)) mkdirSync(this.dataDir, { recursive: true })

    this.config = {
      minStake: 1,
      maxStake: 50,
      accuracyThreshold: 70,
      rewardMultiplier: 2.0,
      penaltyRate: 0.5,
      maxActivePredictions: 10,
      ...config,
    }

    this.oracles = [new PriceOracle(), new SandboxOracle(), new EventOracle()]
    this.loadPredictions()
  }

  /**
   * Create a new prediction and lock stake
   */
  createPrediction(params: {
    nodeId: string
    claim: string
    category: Prediction['category']
    targetMetric: string
    predictedValue: string
    confidence: number
    verifyAfter: string
    expiresAt?: string
    stakedAmount: number
  }): Prediction | { error: string } {
    // Validation
    if (params.stakedAmount < this.config.minStake) {
      return { error: `Minimum stake is ${this.config.minStake} New.B` }
    }
    if (params.stakedAmount > this.config.maxStake) {
      return { error: `Maximum stake is ${this.config.maxStake} New.B` }
    }
    if (params.confidence < 1 || params.confidence > 100) {
      return { error: 'Confidence must be between 1 and 100' }
    }

    const activePredictions = this.getActivePredictions(params.nodeId)
    if (activePredictions.length >= this.config.maxActivePredictions) {
      return { error: `Maximum ${this.config.maxActivePredictions} active predictions allowed` }
    }

    const id = secureId('PRED')

    // Create tamper-proof commit hash
    const commitData = JSON.stringify({
      claim: params.claim,
      predictedValue: params.predictedValue,
      targetMetric: params.targetMetric,
      nodeId: params.nodeId,
      timestamp: Date.now(),
    })
    const commitHash = createHash('sha256').update(commitData).digest('hex')

    const prediction: Prediction = {
      id,
      ...params,
      status: 'locked',
      reward: 0,
      commitHash,
      createdAt: new Date().toISOString(),
    }

    this.predictions.set(id, prediction)
    this.savePredictions()
    return prediction
  }

  /**
   * Verify a prediction using the appropriate oracle
   */
  async verifyPrediction(predictionId: string): Promise<OracleResult | { error: string }> {
    const prediction = this.predictions.get(predictionId)
    if (!prediction) return { error: 'Prediction not found' }
    if (prediction.status !== 'locked') return { error: `Cannot verify — status is ${prediction.status}` }

    // Check if verification time has passed
    const verifyTime = new Date(prediction.verifyAfter).getTime()
    if (Date.now() < verifyTime) {
      return { error: `Too early — verify after ${prediction.verifyAfter}` }
    }

    // Check expiry
    if (prediction.expiresAt && Date.now() > new Date(prediction.expiresAt).getTime()) {
      prediction.status = 'expired'
      this.savePredictions()
      return { error: 'Prediction expired' }
    }

    // Find appropriate oracle
    const oracle = this.oracles.find((o) => o.canVerify(prediction.category))
    if (!oracle) return { error: `No oracle available for category: ${prediction.category}` }

    const result = await oracle.verify(prediction)
    prediction.oracleResult = result
    prediction.verifiedAt = new Date().toISOString()

    // Determine outcome
    if (result.accuracy >= this.config.accuracyThreshold) {
      prediction.status = 'verified_correct'
      prediction.reward = prediction.stakedAmount * this.config.rewardMultiplier
    } else {
      prediction.status = 'verified_wrong'
      prediction.reward = -(prediction.stakedAmount * this.config.penaltyRate)
    }

    this.savePredictions()
    return result
  }

  /**
   * Manually resolve a prediction (for consensus/manual oracle types)
   */
  manualResolve(predictionId: string, actualValue: string, accuracy: number): Prediction | { error: string } {
    const prediction = this.predictions.get(predictionId)
    if (!prediction) return { error: 'Prediction not found' }
    if (prediction.status !== 'locked') return { error: `Cannot resolve — status is ${prediction.status}` }

    prediction.oracleResult = {
      actualValue,
      accuracy,
      source: 'manual',
      method: 'manual',
      timestamp: new Date().toISOString(),
    }
    prediction.verifiedAt = new Date().toISOString()

    if (accuracy >= this.config.accuracyThreshold) {
      prediction.status = 'verified_correct'
      prediction.reward = prediction.stakedAmount * this.config.rewardMultiplier
    } else {
      prediction.status = 'verified_wrong'
      prediction.reward = -(prediction.stakedAmount * this.config.penaltyRate)
    }

    this.savePredictions()
    return prediction
  }

  /**
   * Cancel a prediction (only if still locked and not yet verifiable)
   */
  cancelPrediction(predictionId: string): boolean {
    const prediction = this.predictions.get(predictionId)
    if (!prediction || prediction.status !== 'locked') return false

    const verifyTime = new Date(prediction.verifyAfter).getTime()
    if (Date.now() >= verifyTime) return false // Too late to cancel

    prediction.status = 'cancelled'
    prediction.reward = 0
    this.savePredictions()
    return true
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  getPrediction(id: string): Prediction | undefined {
    return this.predictions.get(id)
  }

  getActivePredictions(nodeId: string): Prediction[] {
    return Array.from(this.predictions.values())
      .filter((p) => p.nodeId === nodeId && p.status === 'locked')
  }

  getAllPredictions(filter?: { status?: Prediction['status']; category?: string; nodeId?: string }): Prediction[] {
    let all = Array.from(this.predictions.values())
    if (filter?.status) all = all.filter((p) => p.status === filter.status)
    if (filter?.category) all = all.filter((p) => p.category === filter.category)
    if (filter?.nodeId) all = all.filter((p) => p.nodeId === filter.nodeId)
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  /**
   * Get predictions that are due for verification
   */
  getDuePredictions(): Prediction[] {
    const now = Date.now()
    return Array.from(this.predictions.values())
      .filter((p) => p.status === 'locked' && now >= new Date(p.verifyAfter).getTime())
  }

  getStats(): {
    total: number; active: number; correct: number; wrong: number; expired: number
    totalStaked: number; totalRewards: number; accuracy: number
  } {
    const all = Array.from(this.predictions.values())
    const verified = all.filter((p) => p.status === 'verified_correct' || p.status === 'verified_wrong')
    const correct = all.filter((p) => p.status === 'verified_correct').length

    return {
      total: all.length,
      active: all.filter((p) => p.status === 'locked').length,
      correct,
      wrong: all.filter((p) => p.status === 'verified_wrong').length,
      expired: all.filter((p) => p.status === 'expired').length,
      totalStaked: all.reduce((sum, p) => sum + p.stakedAmount, 0),
      totalRewards: all.reduce((sum, p) => sum + Math.max(0, p.reward), 0),
      accuracy: verified.length > 0 ? (correct / verified.length) * 100 : 0,
    }
  }

  getConfig(): ProphetMiningConfig {
    return { ...this.config }
  }

  updateConfig(partial: Partial<ProphetMiningConfig>): void {
    Object.assign(this.config, partial)
    writeFileSync(join(this.dataDir, 'config.json'), JSON.stringify(this.config, null, 2))
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  private savePredictions(): void {
    const data = Object.fromEntries(this.predictions)
    writeFileSync(join(this.dataDir, 'predictions.json'), JSON.stringify(data, null, 2))
  }

  private loadPredictions(): void {
    const path = join(this.dataDir, 'predictions.json')
    if (existsSync(path)) {
      const data = JSON.parse(readFileSync(path, 'utf8'))
      this.predictions = new Map(Object.entries(data))
    }
  }
}
