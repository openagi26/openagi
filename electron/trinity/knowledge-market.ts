/**
 * Knowledge Market — Dutch Auction System
 *
 * Phase 1: Single-node knowledge trading with PoO buyer outcome tracking
 *
 * Dutch Auction: Price starts high, decreases over time until a buyer accepts.
 * Seller stakes New.B → Buyer purchases → PoO tracks buyer outcome → Credit adjustment.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { secureId } from '../utils/secure-id'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuctionListing {
  id: string
  sellerId: string
  /** Reference to a Playbook or knowledge artifact */
  playbookId?: string
  title: string
  description: string
  tags: string[]
  /** Starting (highest) price in New.B */
  startPrice: number
  /** Minimum (floor) price */
  floorPrice: number
  /** Price decrease per interval */
  decrementAmount: number
  /** Interval for price decrease in ms */
  decrementIntervalMs: number
  /** Current computed price */
  currentPrice: number
  /** New.B staked by seller (forfeited if fraud) */
  sellerStake: number
  /** Evidence level of the knowledge */
  evidenceLevel: 'H1' | 'H2' | 'H3' | 'H4'
  /** PoO success rate from previous buyers */
  historicalSuccessRate: number
  status: 'active' | 'sold' | 'expired' | 'cancelled' | 'disputed'
  createdAt: string
  expiresAt: string
  /** Buyer info (filled on purchase) */
  buyerId?: string
  purchasePrice?: number
  purchasedAt?: string
  /** PoO outcomes from buyers */
  buyerOutcomes: BuyerOutcome[]
}

export interface BuyerOutcome {
  buyerId: string
  outcomeScore: number
  feedback: string
  timestamp: string
  verified: boolean
}

export interface MarketStats {
  totalListings: number
  activeListings: number
  totalSales: number
  totalVolume: number
  avgSuccessRate: number
  topTags: Array<{ tag: string; count: number }>
}

export interface MarketConfig {
  /** Default auction duration in ms (24 hours) */
  defaultDurationMs: number
  /** Minimum seller stake as % of start price */
  minStakePercent: number
  /** Dispute window after purchase in ms */
  disputeWindowMs: number
  /** Minimum evidence level for listing */
  minEvidenceLevel: 'H1' | 'H2' | 'H3' | 'H4'
  /** Maximum active listings per seller */
  maxActiveListings: number
}

// ─── Knowledge Market Engine ──────────────────────────────────────────────────

export class KnowledgeMarket {
  private dataDir: string
  private listings: Map<string, AuctionListing> = new Map()
  private config: MarketConfig

  constructor(dataDir: string, config?: Partial<MarketConfig>) {
    this.dataDir = join(dataDir, 'knowledge-market')
    if (!existsSync(this.dataDir)) mkdirSync(this.dataDir, { recursive: true })

    this.config = {
      defaultDurationMs: 24 * 60 * 60 * 1000,
      minStakePercent: 20,
      disputeWindowMs: 7 * 24 * 60 * 60 * 1000,
      minEvidenceLevel: 'H2',
      maxActiveListings: 20,
      ...config,
    }

    this.loadListings()
  }

  /**
   * Create a Dutch auction listing
   */
  createListing(params: {
    sellerId: string
    playbookId?: string
    title: string
    description: string
    tags: string[]
    startPrice: number
    floorPrice: number
    decrementAmount?: number
    decrementIntervalMs?: number
    sellerStake: number
    evidenceLevel: AuctionListing['evidenceLevel']
    durationMs?: number
  }): AuctionListing | { error: string } {
    // Validation
    if (params.startPrice <= 0) return { error: 'Start price must be positive' }
    if (params.floorPrice < 0) return { error: 'Floor price cannot be negative' }
    if (params.floorPrice >= params.startPrice) return { error: 'Floor price must be less than start price' }

    const minStake = params.startPrice * (this.config.minStakePercent / 100)
    if (params.sellerStake < minStake) {
      return { error: `Minimum stake is ${minStake.toFixed(2)} New.B (${this.config.minStakePercent}% of start price)` }
    }

    const evidenceLevels = ['H4', 'H3', 'H2', 'H1']
    if (evidenceLevels.indexOf(params.evidenceLevel) < evidenceLevels.indexOf(this.config.minEvidenceLevel)) {
      return { error: `Minimum evidence level for listing is ${this.config.minEvidenceLevel}` }
    }

    const activeCount = this.getActiveListings(params.sellerId).length
    if (activeCount >= this.config.maxActiveListings) {
      return { error: `Maximum ${this.config.maxActiveListings} active listings allowed` }
    }

    const durationMs = params.durationMs ?? this.config.defaultDurationMs
    const id = secureId('AUC')

    const listing: AuctionListing = {
      id,
      sellerId: params.sellerId,
      playbookId: params.playbookId,
      title: params.title,
      description: params.description,
      tags: params.tags,
      startPrice: params.startPrice,
      floorPrice: params.floorPrice,
      decrementAmount: params.decrementAmount ?? ((params.startPrice - params.floorPrice) / 24),
      decrementIntervalMs: params.decrementIntervalMs ?? (durationMs / 24),
      currentPrice: params.startPrice,
      sellerStake: params.sellerStake,
      evidenceLevel: params.evidenceLevel,
      historicalSuccessRate: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + durationMs).toISOString(),
      buyerOutcomes: [],
    }

    this.listings.set(id, listing)
    this.saveListings()
    return listing
  }

  /**
   * Get current Dutch auction price (decreases over time)
   */
  getCurrentPrice(listingId: string): number | null {
    const listing = this.listings.get(listingId)
    if (!listing || listing.status !== 'active') return null

    const elapsed = Date.now() - new Date(listing.createdAt).getTime()
    const intervals = Math.floor(elapsed / listing.decrementIntervalMs)
    const price = Math.max(listing.floorPrice, listing.startPrice - (intervals * listing.decrementAmount))

    listing.currentPrice = price
    return price
  }

  /**
   * Purchase a listing at current price
   */
  purchase(listingId: string, buyerId: string): AuctionListing | { error: string } {
    const listing = this.listings.get(listingId)
    if (!listing) return { error: 'Listing not found' }
    if (listing.status !== 'active') return { error: `Cannot purchase — status is ${listing.status}` }
    if (listing.sellerId === buyerId) return { error: 'Cannot buy your own listing' }

    // Check expiry
    if (Date.now() > new Date(listing.expiresAt).getTime()) {
      listing.status = 'expired'
      this.saveListings()
      return { error: 'Listing has expired' }
    }

    const currentPrice = this.getCurrentPrice(listingId)!
    listing.status = 'sold'
    listing.buyerId = buyerId
    listing.purchasePrice = currentPrice
    listing.purchasedAt = new Date().toISOString()

    this.saveListings()
    return listing
  }

  /**
   * Record buyer's PoO outcome after using the knowledge
   */
  recordBuyerOutcome(listingId: string, buyerId: string, outcomeScore: number, feedback: string): BuyerOutcome | { error: string } {
    const listing = this.listings.get(listingId)
    if (!listing) return { error: 'Listing not found' }
    if (listing.status !== 'sold') return { error: 'Listing is not sold' }
    if (listing.buyerId !== buyerId) return { error: 'Only the buyer can record outcome' }

    const outcome: BuyerOutcome = {
      buyerId,
      outcomeScore: Math.max(0, Math.min(100, outcomeScore)),
      feedback,
      timestamp: new Date().toISOString(),
      verified: false,
    }

    listing.buyerOutcomes.push(outcome)

    // Recalculate success rate
    const allOutcomes = listing.buyerOutcomes
    const successCount = allOutcomes.filter((o) => o.outcomeScore >= 85).length
    listing.historicalSuccessRate = (successCount / allOutcomes.length) * 100

    this.saveListings()
    return outcome
  }

  /**
   * File a dispute (buyer claims fraud)
   */
  fileDispute(listingId: string, buyerId: string): boolean {
    const listing = this.listings.get(listingId)
    if (!listing || listing.status !== 'sold' || listing.buyerId !== buyerId) return false

    const disputeDeadline = new Date(listing.purchasedAt!).getTime() + this.config.disputeWindowMs
    if (Date.now() > disputeDeadline) return false

    listing.status = 'disputed'
    this.saveListings()
    return true
  }

  /**
   * Cancel a listing (seller only, before any purchase)
   */
  cancelListing(listingId: string, sellerId: string): boolean {
    const listing = this.listings.get(listingId)
    if (!listing || listing.status !== 'active' || listing.sellerId !== sellerId) return false

    listing.status = 'cancelled'
    this.saveListings()
    return true
  }

  /**
   * Expire old listings
   */
  expireListings(): number {
    let count = 0
    const now = Date.now()
    for (const listing of this.listings.values()) {
      if (listing.status === 'active' && now > new Date(listing.expiresAt).getTime()) {
        listing.status = 'expired'
        count++
      }
    }
    if (count > 0) this.saveListings()
    return count
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  getListing(id: string): AuctionListing | undefined {
    const listing = this.listings.get(id)
    if (listing && listing.status === 'active') {
      this.getCurrentPrice(id) // Update price
    }
    return listing
  }

  getActiveListings(sellerId?: string): AuctionListing[] {
    let active = Array.from(this.listings.values()).filter((l) => l.status === 'active')
    if (sellerId) active = active.filter((l) => l.sellerId === sellerId)

    // Update prices
    for (const listing of active) {
      this.getCurrentPrice(listing.id)
    }

    return active.sort((a, b) => b.currentPrice - a.currentPrice)
  }

  searchListings(query: { tags?: string[]; minPrice?: number; maxPrice?: number; evidenceLevel?: string }): AuctionListing[] {
    let results = this.getActiveListings()

    if (query.tags?.length) {
      results = results.filter((l) => l.tags.some((t) => query.tags!.includes(t)))
    }
    if (query.minPrice != null) {
      results = results.filter((l) => l.currentPrice >= query.minPrice!)
    }
    if (query.maxPrice != null) {
      results = results.filter((l) => l.currentPrice <= query.maxPrice!)
    }
    if (query.evidenceLevel) {
      const levels = ['H4', 'H3', 'H2', 'H1']
      const minIdx = levels.indexOf(query.evidenceLevel)
      results = results.filter((l) => levels.indexOf(l.evidenceLevel) >= minIdx)
    }

    return results
  }

  getStats(): MarketStats {
    const all = Array.from(this.listings.values())
    const sold = all.filter((l) => l.status === 'sold')

    // Count tags
    const tagCounts = new Map<string, number>()
    for (const l of all) {
      for (const t of l.tags) {
        tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
      }
    }

    return {
      totalListings: all.length,
      activeListings: all.filter((l) => l.status === 'active').length,
      totalSales: sold.length,
      totalVolume: sold.reduce((sum, l) => sum + (l.purchasePrice ?? 0), 0),
      avgSuccessRate: sold.length > 0
        ? sold.reduce((sum, l) => sum + l.historicalSuccessRate, 0) / sold.length
        : 0,
      topTags: Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count })),
    }
  }

  getConfig(): MarketConfig { return { ...this.config } }

  updateConfig(partial: Partial<MarketConfig>): void {
    Object.assign(this.config, partial)
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  private saveListings(): void {
    writeFileSync(join(this.dataDir, 'listings.json'), JSON.stringify(Object.fromEntries(this.listings), null, 2))
  }

  private loadListings(): void {
    const path = join(this.dataDir, 'listings.json')
    if (existsSync(path)) {
      this.predictions = new Map(Object.entries(JSON.parse(readFileSync(path, 'utf8'))))
    }
  }

  // Fix: use correct property name
  private set predictions(v: Map<string, any>) { this.listings = v }
  private get predictions(): Map<string, any> { return this.listings }
}
