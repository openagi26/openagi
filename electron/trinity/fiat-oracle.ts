/**
 * Fiat Exchange Rate Oracle
 *
 * Phase 3: New.B ↔ real currency price feed
 * Tracks New.B's purchasing power relative to USD/BTC
 *
 * Pricing model: New.B value = f(effective_compute_power, supply, demand)
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExchangeRate {
  pair: string       // e.g. "NEWB/USD", "NEWB/BTC"
  rate: number       // 1 New.B = X units of quote currency
  timestamp: string
  source: string
  confidence: number // 0-100 confidence in rate accuracy
}

export interface PriceHistory {
  pair: string
  rates: Array<{ rate: number; timestamp: string }>
  high24h: number
  low24h: number
  change24h: number
  volume24h: number
}

export interface OracleConfig {
  /** Base value of 1 New.B in USD at genesis */
  genesisRateUsd: number
  /** How often to recalculate rates in ms */
  updateIntervalMs: number
  /** External price feeds to query */
  priceFeedUrls: string[]
  /** Whether to use external feeds or internal model only */
  useExternalFeeds: boolean
}

export interface ComputeMetrics {
  /** Total effective compute cycles across the network */
  totalComputeCycles: number
  /** Total New.B supply */
  totalSupply: number
  /** Total active nodes */
  activeNodes: number
  /** Average PoO score across network */
  avgPoOScore: number
  /** Total verified tasks */
  totalVerifiedTasks: number
}

// ─── Fiat Oracle ──────────────────────────────────────────────────────────────

export class FiatOracle {
  private dataDir: string
  private config: OracleConfig
  private currentRates: Map<string, ExchangeRate> = new Map()
  private history: Map<string, PriceHistory> = new Map()

  constructor(dataDir: string, config?: Partial<OracleConfig>) {
    this.dataDir = join(dataDir, 'fiat-oracle')
    if (!existsSync(this.dataDir)) mkdirSync(this.dataDir, { recursive: true })

    this.config = {
      genesisRateUsd: 0.01,  // 1 New.B = $0.01 at genesis
      updateIntervalMs: 60000,
      priceFeedUrls: [],
      useExternalFeeds: false,
      ...config,
    }

    this.loadRates()
  }

  /**
   * Calculate New.B/USD rate based on internal compute-power model
   *
   * Formula: rate = genesisRate × (totalComputeCycles / totalSupply) × qualityMultiplier
   * where qualityMultiplier = avgPoOScore / 50 (normalized around 1.0)
   */
  calculateRate(metrics: ComputeMetrics): ExchangeRate {
    const { totalComputeCycles, totalSupply, avgPoOScore, activeNodes } = metrics

    // Base rate from genesis
    let rate = this.config.genesisRateUsd

    // Supply factor: scarcity drives value (fewer tokens → higher value)
    const supplyFactor = totalSupply > 0 ? Math.max(0.1, 1000 / totalSupply) : 1

    // Compute factor: more verified compute → more value
    const computeFactor = totalComputeCycles > 0 ? Math.log2(totalComputeCycles + 1) / 10 : 0.1

    // Quality factor: higher PoO scores → more trustworthy → more valuable
    const qualityFactor = avgPoOScore > 0 ? avgPoOScore / 50 : 1

    // Network effect: more active nodes → more valuable
    const networkFactor = activeNodes > 0 ? Math.log2(activeNodes + 1) : 1

    rate = rate * supplyFactor * computeFactor * qualityFactor * networkFactor

    // Clamp to reasonable bounds
    rate = Math.max(0.0001, Math.min(1000, rate))

    const exchangeRate: ExchangeRate = {
      pair: 'NEWB/USD',
      rate: Math.round(rate * 10000) / 10000,
      timestamp: new Date().toISOString(),
      source: 'internal-model',
      confidence: 80,
    }

    this.updateRate(exchangeRate)
    return exchangeRate
  }

  /**
   * Fetch external price data (BTC price for NEWB/BTC pair)
   */
  async fetchExternalRates(): Promise<ExchangeRate[]> {
    const rates: ExchangeRate[] = []

    try {
      // Fetch BTC/USD to derive NEWB/BTC
      const btcResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd')
      if (btcResponse.ok) {
        const data = await btcResponse.json() as any
        const btcUsd = data.bitcoin?.usd

        if (btcUsd) {
          const newbUsd = this.getCurrentRate('NEWB/USD')?.rate ?? this.config.genesisRateUsd
          const newbBtc = newbUsd / btcUsd

          const btcRate: ExchangeRate = {
            pair: 'NEWB/BTC',
            rate: newbBtc,
            timestamp: new Date().toISOString(),
            source: 'coingecko-derived',
            confidence: 70,
          }

          this.updateRate(btcRate)
          rates.push(btcRate)
        }
      }
    } catch {
      // External feeds are best-effort
    }

    return rates
  }

  /**
   * Convert New.B amount to fiat
   */
  convertToFiat(amount: number, targetCurrency: string = 'USD'): { value: number; rate: number; pair: string } | null {
    const pair = `NEWB/${targetCurrency.toUpperCase()}`
    const rate = this.getCurrentRate(pair)
    if (!rate) return null

    return {
      value: Math.round(amount * rate.rate * 10000) / 10000,
      rate: rate.rate,
      pair,
    }
  }

  /**
   * Convert fiat amount to New.B
   */
  convertFromFiat(fiatAmount: number, sourceCurrency: string = 'USD'): { amount: number; rate: number } | null {
    const pair = `NEWB/${sourceCurrency.toUpperCase()}`
    const rate = this.getCurrentRate(pair)
    if (!rate || rate.rate === 0) return null

    return {
      amount: Math.round((fiatAmount / rate.rate) * 10000) / 10000,
      rate: rate.rate,
    }
  }

  // ─── Rate Management ──────────────────────────────────────────────────────

  private updateRate(rate: ExchangeRate): void {
    this.currentRates.set(rate.pair, rate)

    // Update history
    if (!this.history.has(rate.pair)) {
      this.history.set(rate.pair, {
        pair: rate.pair,
        rates: [],
        high24h: rate.rate,
        low24h: rate.rate,
        change24h: 0,
        volume24h: 0,
      })
    }

    const hist = this.history.get(rate.pair)!
    hist.rates.push({ rate: rate.rate, timestamp: rate.timestamp })

    // Keep only last 24 hours
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    hist.rates = hist.rates.filter((r) => new Date(r.timestamp).getTime() > oneDayAgo)

    if (hist.rates.length > 0) {
      hist.high24h = Math.max(...hist.rates.map((r) => r.rate))
      hist.low24h = Math.min(...hist.rates.map((r) => r.rate))
      const oldest = hist.rates[0].rate
      hist.change24h = oldest > 0 ? ((rate.rate - oldest) / oldest) * 100 : 0
    }

    this.saveRates()
  }

  getCurrentRate(pair: string): ExchangeRate | null {
    return this.currentRates.get(pair) ?? null
  }

  getAllRates(): ExchangeRate[] {
    return Array.from(this.currentRates.values())
  }

  getPriceHistory(pair: string): PriceHistory | null {
    return this.history.get(pair) ?? null
  }

  getConfig(): OracleConfig { return { ...this.config } }

  updateConfig(partial: Partial<OracleConfig>): void {
    Object.assign(this.config, partial)
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  private saveRates(): void {
    writeFileSync(join(this.dataDir, 'rates.json'), JSON.stringify(Object.fromEntries(this.currentRates), null, 2))
    writeFileSync(join(this.dataDir, 'history.json'), JSON.stringify(Object.fromEntries(this.history), null, 2))
  }

  private loadRates(): void {
    const ratesPath = join(this.dataDir, 'rates.json')
    if (existsSync(ratesPath)) {
      this.currentRates = new Map(Object.entries(JSON.parse(readFileSync(ratesPath, 'utf8'))))
    }
    const histPath = join(this.dataDir, 'history.json')
    if (existsSync(histPath)) {
      this.history = new Map(Object.entries(JSON.parse(readFileSync(histPath, 'utf8'))))
    }
  }
}
