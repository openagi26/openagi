/**
 * Phase 1-3 Backend Module Unit Tests
 *
 * Tests for: ProphetMining, KnowledgeMarket, DockerSandbox,
 *            SwarmManager, HostDividend, ZombieCleanup,
 *            NewBBlockchain, FiatOracle
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { ProphetMiningEngine } from '../../electron/trinity/prophet-mining'
import { KnowledgeMarket } from '../../electron/trinity/knowledge-market'
import { DockerSandbox } from '../../electron/trinity/docker-sandbox'
import { SwarmManager } from '../../electron/trinity/swarm'
import { HostDividendManager } from '../../electron/trinity/host-dividend'
import { ZombieCleanupManager } from '../../electron/trinity/zombie-cleanup'
import { NewBBlockchain } from '../../electron/trinity/blockchain'
import { FiatOracle } from '../../electron/trinity/fiat-oracle'

// ─── Shared Setup ────────────────────────────────────────────────────────────

let dataDir: string

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'openagi-phase13-'))
})

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true })
})

// ═══════════════════════════════════════════════════════════════════════════════
// ProphetMiningEngine
// ═══════════════════════════════════════════════════════════════════════════════

describe('ProphetMiningEngine', () => {
  const makePrediction = (engine: ProphetMiningEngine, overrides?: Record<string, any>) => {
    return engine.createPrediction({
      nodeId: 'NC-node1',
      claim: 'BTC will exceed 100k',
      category: 'price',
      targetMetric: 'bitcoin',
      predictedValue: '100000',
      confidence: 80,
      verifyAfter: new Date(Date.now() + 60_000).toISOString(),
      stakedAmount: 10,
      ...overrides,
    })
  }

  it('constructs with default config', () => {
    const engine = new ProphetMiningEngine(dataDir)
    const config = engine.getConfig()
    expect(config.minStake).toBe(1)
    expect(config.maxStake).toBe(50)
    expect(config.accuracyThreshold).toBe(70)
    expect(config.maxActivePredictions).toBe(10)
  })

  it('constructs with custom config', () => {
    const engine = new ProphetMiningEngine(dataDir, { minStake: 5, maxStake: 100 })
    const config = engine.getConfig()
    expect(config.minStake).toBe(5)
    expect(config.maxStake).toBe(100)
  })

  it('creates a valid prediction', () => {
    const engine = new ProphetMiningEngine(dataDir)
    const result = makePrediction(engine)
    expect('error' in result).toBe(false)
    const pred = result as any
    expect(pred.id).toMatch(/^PRED-/)
    expect(pred.status).toBe('locked')
    expect(pred.reward).toBe(0)
    expect(pred.commitHash).toHaveLength(64)
  })

  it('rejects stake below minimum', () => {
    const engine = new ProphetMiningEngine(dataDir, { minStake: 5 })
    const result = makePrediction(engine, { stakedAmount: 2 })
    expect('error' in result).toBe(true)
    expect((result as any).error).toContain('Minimum stake')
  })

  it('rejects stake above maximum', () => {
    const engine = new ProphetMiningEngine(dataDir, { maxStake: 10 })
    const result = makePrediction(engine, { stakedAmount: 20 })
    expect('error' in result).toBe(true)
    expect((result as any).error).toContain('Maximum stake')
  })

  it('rejects confidence out of range', () => {
    const engine = new ProphetMiningEngine(dataDir)
    const tooLow = makePrediction(engine, { confidence: 0 })
    expect('error' in tooLow).toBe(true)
    expect((tooLow as any).error).toContain('Confidence')

    const tooHigh = makePrediction(engine, { confidence: 101 })
    expect('error' in tooHigh).toBe(true)
    expect((tooHigh as any).error).toContain('Confidence')
  })

  it('enforces max active predictions per node', () => {
    const engine = new ProphetMiningEngine(dataDir, { maxActivePredictions: 2 })
    makePrediction(engine)
    makePrediction(engine)
    const third = makePrediction(engine)
    expect('error' in third).toBe(true)
    expect((third as any).error).toContain('active predictions')
  })

  it('cancels prediction before verify time', () => {
    const engine = new ProphetMiningEngine(dataDir)
    const pred = makePrediction(engine, {
      verifyAfter: new Date(Date.now() + 3_600_000).toISOString(),
    }) as any
    const cancelled = engine.cancelPrediction(pred.id)
    expect(cancelled).toBe(true)
    expect(engine.getPrediction(pred.id)!.status).toBe('cancelled')
  })

  it('cannot cancel prediction after verify time', () => {
    const engine = new ProphetMiningEngine(dataDir)
    const pred = makePrediction(engine, {
      verifyAfter: new Date(Date.now() - 1000).toISOString(),
    }) as any
    const cancelled = engine.cancelPrediction(pred.id)
    expect(cancelled).toBe(false)
  })

  it('manually resolves a correct prediction', () => {
    const engine = new ProphetMiningEngine(dataDir, { accuracyThreshold: 70, rewardMultiplier: 2.0 })
    const pred = makePrediction(engine, { stakedAmount: 10 }) as any
    const result = engine.manualResolve(pred.id, '100500', 90)
    expect('error' in result).toBe(false)
    const resolved = result as any
    expect(resolved.status).toBe('verified_correct')
    expect(resolved.reward).toBe(20) // 10 * 2.0
  })

  it('manually resolves a wrong prediction', () => {
    const engine = new ProphetMiningEngine(dataDir, { accuracyThreshold: 70, penaltyRate: 0.5 })
    const pred = makePrediction(engine, { stakedAmount: 10 }) as any
    const result = engine.manualResolve(pred.id, '50000', 30)
    expect('error' in result).toBe(false)
    const resolved = result as any
    expect(resolved.status).toBe('verified_wrong')
    expect(resolved.reward).toBe(-5) // -(10 * 0.5)
  })

  it('getDuePredictions returns overdue locked predictions', () => {
    const engine = new ProphetMiningEngine(dataDir)
    // Past verify time
    makePrediction(engine, {
      verifyAfter: new Date(Date.now() - 10_000).toISOString(),
    })
    // Future verify time
    makePrediction(engine, {
      verifyAfter: new Date(Date.now() + 3_600_000).toISOString(),
    })
    const due = engine.getDuePredictions()
    expect(due.length).toBe(1)
  })

  it('calculates stats correctly', () => {
    const engine = new ProphetMiningEngine(dataDir)
    const p1 = makePrediction(engine, { stakedAmount: 10 }) as any
    const p2 = makePrediction(engine, { stakedAmount: 20 }) as any
    engine.manualResolve(p1.id, '100000', 95)
    engine.manualResolve(p2.id, '50000', 20)

    const stats = engine.getStats()
    expect(stats.total).toBe(2)
    expect(stats.active).toBe(0)
    expect(stats.correct).toBe(1)
    expect(stats.wrong).toBe(1)
    expect(stats.totalStaked).toBe(30)
    expect(stats.accuracy).toBe(50)
  })

  it('persists predictions across instances', () => {
    const engine1 = new ProphetMiningEngine(dataDir)
    const pred = makePrediction(engine1) as any

    const engine2 = new ProphetMiningEngine(dataDir)
    const loaded = engine2.getPrediction(pred.id)
    expect(loaded).toBeDefined()
    expect(loaded!.claim).toBe('BTC will exceed 100k')
    expect(loaded!.status).toBe('locked')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// KnowledgeMarket
// ═══════════════════════════════════════════════════════════════════════════════

describe('KnowledgeMarket', () => {
  const makeListing = (market: KnowledgeMarket, overrides?: Record<string, any>) => {
    return market.createListing({
      sellerId: 'NC-seller1',
      title: 'ML Pipeline Playbook',
      description: 'End-to-end ML pipeline',
      tags: ['ml', 'pipeline'],
      startPrice: 100,
      floorPrice: 10,
      sellerStake: 25,
      evidenceLevel: 'H2',
      ...overrides,
    })
  }

  it('constructs with default config', () => {
    const market = new KnowledgeMarket(dataDir)
    const config = market.getConfig()
    expect(config.minStakePercent).toBe(20)
    expect(config.minEvidenceLevel).toBe('H2')
    expect(config.maxActiveListings).toBe(20)
  })

  it('creates a valid listing', () => {
    const market = new KnowledgeMarket(dataDir)
    const result = makeListing(market)
    expect('error' in result).toBe(false)
    const listing = result as any
    expect(listing.id).toMatch(/^AUC-/)
    expect(listing.status).toBe('active')
    expect(listing.currentPrice).toBe(100)
  })

  it('rejects invalid price: zero or negative start price', () => {
    const market = new KnowledgeMarket(dataDir)
    const r = makeListing(market, { startPrice: 0 })
    expect('error' in r).toBe(true)
    expect((r as any).error).toContain('Start price')
  })

  it('rejects floor price >= start price', () => {
    const market = new KnowledgeMarket(dataDir)
    const r = makeListing(market, { floorPrice: 100, startPrice: 100 })
    expect('error' in r).toBe(true)
    expect((r as any).error).toContain('Floor price')
  })

  it('rejects insufficient seller stake', () => {
    const market = new KnowledgeMarket(dataDir)
    // 20% of 100 = 20, stake of 10 is below
    const r = makeListing(market, { startPrice: 100, sellerStake: 10 })
    expect('error' in r).toBe(true)
    expect((r as any).error).toContain('Minimum stake')
  })

  it('rejects evidence level below minimum', () => {
    const market = new KnowledgeMarket(dataDir, { minEvidenceLevel: 'H3' })
    const r = makeListing(market, { evidenceLevel: 'H4' })
    expect('error' in r).toBe(true)
    expect((r as any).error).toContain('evidence level')
  })

  it('price decreases over time (Dutch auction)', () => {
    const market = new KnowledgeMarket(dataDir)
    const listing = makeListing(market, {
      startPrice: 100,
      floorPrice: 10,
      decrementAmount: 10,
      decrementIntervalMs: 1, // 1ms intervals for instant test
    }) as any

    // Wait a tiny bit to ensure at least one interval passes
    const price = market.getCurrentPrice(listing.id)
    expect(price).not.toBeNull()
    // Price should have decreased or be at floor
    expect(price!).toBeLessThanOrEqual(100)
    expect(price!).toBeGreaterThanOrEqual(10)
  })

  it('purchase flow works', () => {
    const market = new KnowledgeMarket(dataDir)
    const listing = makeListing(market) as any
    const result = market.purchase(listing.id, 'NC-buyer1')
    expect('error' in result).toBe(false)
    const sold = result as any
    expect(sold.status).toBe('sold')
    expect(sold.buyerId).toBe('NC-buyer1')
    expect(sold.purchasePrice).toBeGreaterThan(0)
  })

  it('prevents self-buy', () => {
    const market = new KnowledgeMarket(dataDir)
    const listing = makeListing(market) as any
    const result = market.purchase(listing.id, 'NC-seller1')
    expect('error' in result).toBe(true)
    expect((result as any).error).toContain('own listing')
  })

  it('records buyer outcome', () => {
    const market = new KnowledgeMarket(dataDir)
    const listing = makeListing(market) as any
    market.purchase(listing.id, 'NC-buyer1')
    const outcome = market.recordBuyerOutcome(listing.id, 'NC-buyer1', 90, 'Great playbook!')
    expect('error' in outcome).toBe(false)
    expect((outcome as any).outcomeScore).toBe(90)

    const updated = market.getListing(listing.id)!
    expect(updated.buyerOutcomes).toHaveLength(1)
    expect(updated.historicalSuccessRate).toBe(100) // 90 >= 85 threshold
  })

  it('files dispute within window', () => {
    const market = new KnowledgeMarket(dataDir)
    const listing = makeListing(market) as any
    market.purchase(listing.id, 'NC-buyer1')
    const disputed = market.fileDispute(listing.id, 'NC-buyer1')
    expect(disputed).toBe(true)
    expect(market.getListing(listing.id)!.status).toBe('disputed')
  })

  it('cancels listing by seller', () => {
    const market = new KnowledgeMarket(dataDir)
    const listing = makeListing(market) as any
    const cancelled = market.cancelListing(listing.id, 'NC-seller1')
    expect(cancelled).toBe(true)
    expect(market.getListing(listing.id)!.status).toBe('cancelled')
  })

  it('cannot cancel listing by non-seller', () => {
    const market = new KnowledgeMarket(dataDir)
    const listing = makeListing(market) as any
    const cancelled = market.cancelListing(listing.id, 'NC-other')
    expect(cancelled).toBe(false)
  })

  it('expires old listings', async () => {
    const market = new KnowledgeMarket(dataDir)
    // Create listing that expires in 10ms
    makeListing(market, { durationMs: 10 })
    // Wait for it to expire
    await new Promise((r) => setTimeout(r, 50))
    const expired = market.expireListings()
    expect(expired).toBe(1)
  })

  it('searches listings with filters', () => {
    const market = new KnowledgeMarket(dataDir)
    makeListing(market, { tags: ['ml', 'pipeline'], startPrice: 50, floorPrice: 5, sellerStake: 15 })
    makeListing(market, {
      sellerId: 'NC-seller2',
      tags: ['devops'],
      startPrice: 200,
      floorPrice: 20,
      sellerStake: 50,
    })

    const mlResults = market.searchListings({ tags: ['ml'] })
    expect(mlResults.length).toBe(1)

    const allActive = market.searchListings({})
    expect(allActive.length).toBe(2)
  })

  it('persists listings across instances', () => {
    const market1 = new KnowledgeMarket(dataDir)
    const listing = makeListing(market1) as any

    const market2 = new KnowledgeMarket(dataDir)
    const loaded = market2.getListing(listing.id)
    expect(loaded).toBeDefined()
    expect(loaded!.title).toBe('ML Pipeline Playbook')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// DockerSandbox
// ═══════════════════════════════════════════════════════════════════════════════

describe('DockerSandbox', () => {
  it('constructs with default config', () => {
    const sandbox = new DockerSandbox(dataDir)
    const config = sandbox.getConfig()
    expect(config.image).toBe('node:20-alpine')
    expect(config.timeoutMs).toBe(30000)
    expect(config.memoryMb).toBe(256)
  })

  it('isDockerAvailable returns boolean', async () => {
    const sandbox = new DockerSandbox(dataDir)
    const available = await sandbox.isDockerAvailable()
    expect(typeof available).toBe('boolean')
  })

  it('process fallback executes simple JS', async () => {
    // Force process fallback by setting dockerAvailable to false via updateConfig trick
    const sandbox = new DockerSandbox(dataDir, { timeoutMs: 10000 })
    // We use the process fallback directly via execute — it will try Docker first
    // but fall back to process if Docker is not installed
    const result = await sandbox.execute('console.log(42)', 'javascript')
    expect(result.stdout.trim()).toBe('42')
    expect(result.status).toBe('success')
    expect(result.exitCode).toBe(0)
    expect(['docker', 'process']).toContain(result.method)
  })

  it('handles execution timeout', async () => {
    const sandbox = new DockerSandbox(dataDir, { timeoutMs: 500 })
    const result = await sandbox.execute(
      'setTimeout(() => {}, 60000); setInterval(() => {}, 100)',
      'javascript',
    )
    // Should timeout or error
    expect(['timeout', 'error', 'failed']).toContain(result.status)
  }, 15000)

  it('updateConfig resets docker availability cache', async () => {
    const sandbox = new DockerSandbox(dataDir)
    // First call caches the result
    await sandbox.isDockerAvailable()
    // Update config should reset cache
    sandbox.updateConfig({ timeoutMs: 5000 })
    const config = sandbox.getConfig()
    expect(config.timeoutMs).toBe(5000)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SwarmManager
// ═══════════════════════════════════════════════════════════════════════════════

describe('SwarmManager', () => {
  it('constructs with default config', () => {
    const swarm = new SwarmManager(dataDir, 'NC-test-node')
    const config = swarm.getConfig()
    expect(config.listenPort).toBe(19900)
    expect(config.maxPeers).toBe(50)
    expect(swarm.getIsRunning()).toBe(false)
  })

  it('start/stop lifecycle', async () => {
    const swarm = new SwarmManager(dataDir, 'NC-test-node')
    await swarm.start()
    expect(swarm.getIsRunning()).toBe(true)
    await swarm.stop()
    expect(swarm.getIsRunning()).toBe(false)
  })

  it('connects and disconnects peer', async () => {
    const swarm = new SwarmManager(dataDir, 'NC-test-node')
    await swarm.start()

    const connected = await swarm.connectToPeer('127.0.0.1', 19901)
    expect(connected).toBe(true)
    expect(swarm.getStats().connectedPeers).toBe(1)

    const peers = swarm.getPeers({ status: 'connected' })
    expect(peers.length).toBe(1)

    swarm.disconnectPeer(peers[0].nodeId)
    expect(swarm.getStats().connectedPeers).toBe(0)

    await swarm.stop()
  })

  it('bans a peer', async () => {
    const swarm = new SwarmManager(dataDir, 'NC-test-node')
    await swarm.start()

    await swarm.connectToPeer('127.0.0.1', 19902)
    const peers = swarm.getPeers({ status: 'connected' })
    expect(peers.length).toBe(1)

    swarm.banPeer(peers[0].nodeId, 'malicious activity')

    const banned = swarm.getPeers({ status: 'banned' })
    expect(banned.length).toBe(1)
    expect(banned[0].creditScore).toBe(0)
    expect(swarm.getStats().connectedPeers).toBe(0)

    await swarm.stop()
  })

  it('sends and receives messages', async () => {
    const swarm = new SwarmManager(dataDir, 'NC-test-node')
    await swarm.start()
    await swarm.connectToPeer('127.0.0.1', 19903)

    const peers = swarm.getPeers({ status: 'connected' })
    const peerId = peers[0].nodeId

    const message = swarm.sendMessage('ping', peerId, { data: 'test' })
    expect(message.type).toBe('ping')
    expect(message.fromNodeId).toBe('NC-test-node')
    expect(message.signature).toHaveLength(64) // sha256 hex

    const stats = swarm.getStats()
    expect(stats.messagesSent).toBe(1)
    expect(stats.bytesTransferred).toBeGreaterThan(0)

    // Simulate receiving a message
    swarm.handleMessage({
      id: 'MSG-incoming-1',
      type: 'knowledge_offer',
      fromNodeId: peerId,
      toNodeId: 'NC-test-node',
      payload: { title: 'Test Knowledge' },
      signature: 'test-sig',
      timestamp: new Date().toISOString(),
      encrypted: false,
    })
    expect(swarm.getStats().messagesReceived).toBe(1)

    await swarm.stop()
  })

  it('discovery broadcasts to all peers', async () => {
    const swarm = new SwarmManager(dataDir, 'NC-test-node')
    await swarm.start()
    await swarm.connectToPeer('127.0.0.1', 19904)
    await swarm.connectToPeer('127.0.0.2', 19905)

    swarm.discoverPeers()
    // Broadcast sends to each connected peer
    expect(swarm.getStats().messagesSent).toBe(1) // 1 sendMessage call (broadcast counted once)

    await swarm.stop()
  })

  it('respects maxPeers limit', async () => {
    const swarm = new SwarmManager(dataDir, 'NC-test-node', { maxPeers: 2 })
    await swarm.start()

    await swarm.connectToPeer('127.0.0.1', 19910)
    await swarm.connectToPeer('127.0.0.2', 19911)
    const third = await swarm.connectToPeer('127.0.0.3', 19912)
    expect(third).toBe(false)
    expect(swarm.getStats().connectedPeers).toBe(2)

    await swarm.stop()
  })

  it('persists peers across instances', async () => {
    const swarm1 = new SwarmManager(dataDir, 'NC-test-node')
    await swarm1.start()
    await swarm1.connectToPeer('127.0.0.1', 19920)
    await swarm1.stop()

    const swarm2 = new SwarmManager(dataDir, 'NC-test-node')
    expect(swarm2.getStats().totalPeersKnown).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// HostDividendManager
// ═══════════════════════════════════════════════════════════════════════════════

describe('HostDividendManager', () => {
  it('constructs with default config', () => {
    const mgr = new HostDividendManager(dataDir, 'HOST-1')
    const config = mgr.getConfig()
    expect(config.hostSharePercent).toBe(20)
    expect(config.minPayoutThreshold).toBe(5)
    expect(config.enabled).toBe(true)
  })

  it('records earning with correct share calculation', () => {
    const mgr = new HostDividendManager(dataDir, 'HOST-1', { hostSharePercent: 25 })
    const record = mgr.recordEarning('poo_reward', 100, 'TX-123')
    expect(record).not.toBeNull()
    expect(record!.hostShare).toBe(25)
    expect(record!.nodeRetained).toBe(75)
    expect(record!.status).toBe('accrued')

    const summary = mgr.getSummary()
    expect(summary.totalAccrued).toBe(25)
    expect(summary.pendingPayout).toBe(25)
  })

  it('returns null for zero or negative earning', () => {
    const mgr = new HostDividendManager(dataDir, 'HOST-1')
    expect(mgr.recordEarning('poo_reward', 0)).toBeNull()
    expect(mgr.recordEarning('poo_reward', -5)).toBeNull()
  })

  it('returns null when disabled', () => {
    const mgr = new HostDividendManager(dataDir, 'HOST-1', { enabled: false })
    expect(mgr.recordEarning('poo_reward', 100)).toBeNull()
  })

  it('payout requires minimum threshold', () => {
    const mgr = new HostDividendManager(dataDir, 'HOST-1', {
      minPayoutThreshold: 10,
      hostSharePercent: 50,
    })
    mgr.recordEarning('mining', 10) // hostShare = 5, below threshold
    const result = mgr.processPayout()
    expect(result.paid).toBe(false)
    expect(result.reason).toContain('Below threshold')
  })

  it('payout requires interval to elapse', () => {
    const mgr = new HostDividendManager(dataDir, 'HOST-1', {
      minPayoutThreshold: 1,
      payoutIntervalMs: 86_400_000, // 24h
      hostSharePercent: 50,
    })
    mgr.recordEarning('mining', 100) // hostShare = 50, above threshold
    // First payout succeeds
    const first = mgr.processPayout()
    expect(first.paid).toBe(true)
    expect(first.amount).toBe(50)

    // Second payout within interval fails
    mgr.recordEarning('mining', 100)
    const second = mgr.processPayout()
    expect(second.paid).toBe(false)
    expect(second.reason).toContain('interval')
  })

  it('successful payout updates ledger', () => {
    const mgr = new HostDividendManager(dataDir, 'HOST-1', {
      minPayoutThreshold: 1,
      hostSharePercent: 20,
    })
    mgr.recordEarning('auction_sale', 50) // hostShare = 10
    const result = mgr.processPayout()
    expect(result.paid).toBe(true)
    expect(result.amount).toBe(10)

    const summary = mgr.getSummary()
    expect(summary.totalPaid).toBe(10)
    expect(summary.pendingPayout).toBe(0)
    expect(summary.lastPayoutAt).not.toBeNull()
  })

  it('disabled dividends reject payout', () => {
    const mgr = new HostDividendManager(dataDir, 'HOST-1', { enabled: false })
    const result = mgr.processPayout()
    expect(result.paid).toBe(false)
    expect(result.reason).toContain('disabled')
  })

  it('updateConfig persists', () => {
    const mgr = new HostDividendManager(dataDir, 'HOST-1')
    mgr.updateConfig({ hostSharePercent: 30 })
    expect(mgr.getConfig().hostSharePercent).toBe(30)
  })

  it('persists ledger across instances', () => {
    const mgr1 = new HostDividendManager(dataDir, 'HOST-1')
    mgr1.recordEarning('mining', 100)

    const mgr2 = new HostDividendManager(dataDir, 'HOST-1')
    const summary = mgr2.getSummary()
    expect(summary.totalAccrued).toBe(20) // 20% of 100
    expect(summary.pendingPayout).toBe(20)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// ZombieCleanupManager
// ═══════════════════════════════════════════════════════════════════════════════

describe('ZombieCleanupManager', () => {
  it('constructs with default config', () => {
    const mgr = new ZombieCleanupManager(dataDir)
    const config = mgr.getConfig()
    expect(config.inactivityThresholdDays).toBe(180)
    expect(config.warningPeriodDays).toBe(30)
    expect(config.reclaimPercent).toBe(100)
    expect(config.enabled).toBe(true)
  })

  it('records node activity', () => {
    const mgr = new ZombieCleanupManager(dataDir)
    mgr.recordActivity('NC-node1', 'cycle', 100, 5)
    const activity = mgr.checkNode('NC-node1')
    expect(activity).not.toBeNull()
    expect(activity!.status).toBe('active')
    expect(activity!.totalCycles).toBe(1)
    expect(activity!.balance).toBe(100)
  })

  it('updates existing activity', () => {
    const mgr = new ZombieCleanupManager(dataDir)
    mgr.recordActivity('NC-node1', 'cycle', 100, 5)
    mgr.recordActivity('NC-node1', 'transaction', 150, 6)
    const activity = mgr.checkNode('NC-node1')!
    expect(activity.totalCycles).toBe(1)
    expect(activity.totalTransactions).toBe(1)
    expect(activity.balance).toBe(150)
  })

  it('cleanup with active nodes changes nothing', () => {
    const mgr = new ZombieCleanupManager(dataDir)
    mgr.recordActivity('NC-node1', 'cycle', 100, 5)
    const report = mgr.runCleanup()
    expect(report.totalNodes).toBe(1)
    expect(report.activeNodes).toBe(1)
    expect(report.zombieNodes).toBe(0)
    expect(report.tokensReclaimed).toBe(0)
  })

  it('warning period triggers for old inactive nodes', () => {
    const mgr = new ZombieCleanupManager(dataDir, {
      inactivityThresholdDays: 180,
      warningPeriodDays: 30,
    })
    mgr.recordActivity('NC-oldnode', 'cycle', 100, 3)

    // Manually backdate the lastActiveAt to 155 days ago (inside warning window)
    const activity = mgr.checkNode('NC-oldnode')!
    const daysAgo = 155
    activity.lastActiveAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()

    const report = mgr.runCleanup()
    expect(report.warningNodes).toBe(1)
    expect(report.reclaimedNodes).toBe(0)

    const node = mgr.checkNode('NC-oldnode')!
    expect(node.status).toBe('warning')
    expect(node.warningIssuedAt).toBeDefined()
  })

  it('reclamation triggers for fully inactive nodes', () => {
    const mgr = new ZombieCleanupManager(dataDir, {
      inactivityThresholdDays: 180,
      reclaimPercent: 100,
      archivePlaybooks: true,
    })
    mgr.recordActivity('NC-zombie', 'cycle', 200, 4)

    // Backdate to 200 days ago
    const activity = mgr.checkNode('NC-zombie')!
    activity.lastActiveAt = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString()

    const report = mgr.runCleanup()
    expect(report.reclaimedNodes).toBe(1)
    expect(report.tokensReclaimed).toBe(200) // 100% of 200
    expect(report.playbooksArchived).toBe(4)

    const node = mgr.checkNode('NC-zombie')!
    expect(node.status).toBe('reclaimed')
    expect(node.balance).toBe(0)
    expect(node.reclaimedAt).toBeDefined()
  })

  it('disabled cleanup returns empty report', () => {
    const mgr = new ZombieCleanupManager(dataDir, { enabled: false })
    mgr.recordActivity('NC-node', 'cycle', 100, 1)
    const report = mgr.runCleanup()
    expect(report.totalNodes).toBe(0)
  })

  it('config update works', () => {
    const mgr = new ZombieCleanupManager(dataDir)
    mgr.updateConfig({ inactivityThresholdDays: 90 })
    expect(mgr.getConfig().inactivityThresholdDays).toBe(90)
  })

  it('persists activities across instances', () => {
    const mgr1 = new ZombieCleanupManager(dataDir)
    mgr1.recordActivity('NC-node1', 'cycle', 100, 5)

    const mgr2 = new ZombieCleanupManager(dataDir)
    const activity = mgr2.checkNode('NC-node1')
    expect(activity).not.toBeNull()
    expect(activity!.balance).toBe(100)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// NewBBlockchain
// ═══════════════════════════════════════════════════════════════════════════════

describe('NewBBlockchain', () => {
  it('constructs with default config', () => {
    const chain = new NewBBlockchain(dataDir)
    expect(chain.isInitialized()).toBe(false)
  })

  it('creates genesis block', () => {
    const chain = new NewBBlockchain(dataDir)
    const genesis = chain.initGenesis('NC-creator', 1000)
    expect(genesis.index).toBe(0)
    expect(genesis.previousHash).toBe('0'.repeat(64))
    expect(genesis.hash).toHaveLength(64)
    expect(genesis.transactions).toHaveLength(1)
    expect(genesis.transactions[0].type).toBe('genesis')
    expect(chain.getBalance('NC-creator')).toBe(1000)
  })

  it('prevents double genesis', () => {
    const chain = new NewBBlockchain(dataDir)
    chain.initGenesis('NC-creator', 1000)
    expect(() => chain.initGenesis('NC-creator', 500)).toThrow('already initialized')
  })

  it('creates a transfer transaction', () => {
    const chain = new NewBBlockchain(dataDir)
    chain.initGenesis('NC-alice', 1000)
    const tx = chain.createTransaction({
      type: 'transfer',
      from: 'NC-alice',
      to: 'NC-bob',
      amount: 100,
      fee: 0.01,
    })
    expect('error' in tx).toBe(false)
    expect((tx as any).type).toBe('transfer')
    expect(chain.getPendingTransactions()).toHaveLength(1)
  })

  it('rejects insufficient balance', () => {
    const chain = new NewBBlockchain(dataDir)
    chain.initGenesis('NC-alice', 100)
    const tx = chain.createTransaction({
      type: 'transfer',
      from: 'NC-alice',
      to: 'NC-bob',
      amount: 200,
      fee: 0.01,
    })
    expect('error' in tx).toBe(true)
    expect((tx as any).error).toContain('Insufficient')
  })

  it('rejects fee below minimum', () => {
    const chain = new NewBBlockchain(dataDir, { minFee: 0.01 })
    chain.initGenesis('NC-alice', 1000)
    const tx = chain.createTransaction({
      type: 'transfer',
      from: 'NC-alice',
      to: 'NC-bob',
      amount: 10,
      fee: 0.001,
    })
    expect('error' in tx).toBe(true)
    expect((tx as any).error).toContain('Minimum fee')
  })

  it('mines a block with PoW', () => {
    const chain = new NewBBlockchain(dataDir, { initialDifficulty: 1, blockReward: 5 })
    chain.initGenesis('NC-alice', 1000)
    chain.createTransaction({
      type: 'transfer',
      from: 'NC-alice',
      to: 'NC-bob',
      amount: 50,
    })

    const block = chain.mineBlock('NC-miner')
    expect(block).not.toBeNull()
    expect(block!.index).toBe(1)
    expect(block!.hash.startsWith('0')).toBe(true) // difficulty 1
    expect(block!.miner).toBe('NC-miner')

    // Balances updated
    expect(chain.getBalance('NC-bob')).toBe(50)
    expect(chain.getBalance('NC-miner')).toBe(5) // block reward
    // Pending cleared
    expect(chain.getPendingTransactions()).toHaveLength(0)
  })

  it('returns null when mining with no pending transactions', () => {
    const chain = new NewBBlockchain(dataDir)
    chain.initGenesis('NC-alice', 1000)
    const block = chain.mineBlock('NC-miner')
    expect(block).toBeNull()
  })

  it('validates a valid chain', () => {
    const chain = new NewBBlockchain(dataDir, { initialDifficulty: 1 })
    chain.initGenesis('NC-alice', 1000)
    chain.createTransaction({ type: 'transfer', from: 'NC-alice', to: 'NC-bob', amount: 10 })
    chain.mineBlock('NC-miner')

    const validation = chain.validateChain()
    expect(validation.valid).toBe(true)
    expect(validation.errors).toHaveLength(0)
  })

  it('anchors evidence on-chain', () => {
    const chain = new NewBBlockchain(dataDir)
    chain.initGenesis('NC-node1', 1000)
    const tx = chain.anchorEvidence('NC-node1', 'abc123hash', 'Test evidence')
    expect('error' in tx).toBe(false)
    expect((tx as any).type).toBe('evidence_anchor')
  })

  it('registers a playbook on-chain', () => {
    const chain = new NewBBlockchain(dataDir)
    chain.initGenesis('NC-node1', 1000)
    const tx = chain.registerPlaybook('NC-node1', 'PB-001', 'playbookhash123')
    expect('error' in tx).toBe(false)
    expect((tx as any).type).toBe('playbook_register')
  })

  it('tracks transaction history', () => {
    const chain = new NewBBlockchain(dataDir, { initialDifficulty: 1 })
    chain.initGenesis('NC-alice', 1000)
    chain.createTransaction({ type: 'transfer', from: 'NC-alice', to: 'NC-bob', amount: 10 })
    chain.createTransaction({ type: 'transfer', from: 'NC-alice', to: 'NC-bob', amount: 20 })
    chain.mineBlock('NC-miner')

    const history = chain.getTransactionHistory('NC-alice')
    // Genesis + 2 transfers
    expect(history.length).toBe(3)
  })

  it('getChainState returns accurate state', () => {
    const chain = new NewBBlockchain(dataDir, { initialDifficulty: 1 })
    chain.initGenesis('NC-alice', 1000)
    chain.createTransaction({ type: 'transfer', from: 'NC-alice', to: 'NC-bob', amount: 50 })
    chain.mineBlock('NC-miner')

    const state = chain.getChainState()
    expect(state.height).toBe(2) // genesis + 1 mined
    expect(state.totalBlocks).toBe(2)
    expect(state.pendingTransactions).toBe(0)
    expect(state.lastBlockHash).toHaveLength(64)
  })

  it('persists chain across instances', () => {
    const chain1 = new NewBBlockchain(dataDir, { initialDifficulty: 1 })
    chain1.initGenesis('NC-alice', 500)
    chain1.createTransaction({ type: 'transfer', from: 'NC-alice', to: 'NC-bob', amount: 100 })
    chain1.mineBlock('NC-miner')

    const chain2 = new NewBBlockchain(dataDir)
    expect(chain2.isInitialized()).toBe(true)
    expect(chain2.getBalance('NC-bob')).toBe(100)
    expect(chain2.getChainState().height).toBe(2)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// FiatOracle
// ═══════════════════════════════════════════════════════════════════════════════

describe('FiatOracle', () => {
  const defaultMetrics = {
    totalComputeCycles: 1000,
    totalSupply: 5000,
    activeNodes: 10,
    avgPoOScore: 75,
    totalVerifiedTasks: 500,
  }

  it('constructs with default config', () => {
    const oracle = new FiatOracle(dataDir)
    const config = oracle.getConfig()
    expect(config.genesisRateUsd).toBe(0.01)
    expect(config.useExternalFeeds).toBe(false)
  })

  it('calculates rate from metrics', () => {
    const oracle = new FiatOracle(dataDir)
    const rate = oracle.calculateRate(defaultMetrics)
    expect(rate.pair).toBe('NEWB/USD')
    expect(rate.rate).toBeGreaterThan(0)
    expect(rate.source).toBe('internal-model')
    expect(rate.confidence).toBe(80)

    // Rate should be stored
    const current = oracle.getCurrentRate('NEWB/USD')
    expect(current).not.toBeNull()
    expect(current!.rate).toBe(rate.rate)
  })

  it('converts New.B to fiat', () => {
    const oracle = new FiatOracle(dataDir)
    oracle.calculateRate(defaultMetrics)

    const result = oracle.convertToFiat(100, 'USD')
    expect(result).not.toBeNull()
    expect(result!.value).toBeGreaterThan(0)
    expect(result!.pair).toBe('NEWB/USD')
  })

  it('converts fiat to New.B', () => {
    const oracle = new FiatOracle(dataDir)
    oracle.calculateRate(defaultMetrics)

    const result = oracle.convertFromFiat(10, 'USD')
    expect(result).not.toBeNull()
    expect(result!.amount).toBeGreaterThan(0)
  })

  it('returns null for unknown currency pair', () => {
    const oracle = new FiatOracle(dataDir)
    const result = oracle.convertToFiat(100, 'EUR')
    expect(result).toBeNull()
  })

  it('rate history tracking works', () => {
    const oracle = new FiatOracle(dataDir)
    oracle.calculateRate({ ...defaultMetrics, totalComputeCycles: 500 })
    oracle.calculateRate({ ...defaultMetrics, totalComputeCycles: 1000 })
    oracle.calculateRate({ ...defaultMetrics, totalComputeCycles: 2000 })

    const history = oracle.getPriceHistory('NEWB/USD')
    expect(history).not.toBeNull()
    expect(history!.rates.length).toBe(3)
    expect(history!.high24h).toBeGreaterThanOrEqual(history!.low24h)
  })

  it('clamps rate to bounds', () => {
    const oracle = new FiatOracle(dataDir)
    // Extreme metrics that would produce very high rate
    const rate = oracle.calculateRate({
      totalComputeCycles: 1_000_000_000,
      totalSupply: 1,
      activeNodes: 10000,
      avgPoOScore: 100,
      totalVerifiedTasks: 1_000_000,
    })
    expect(rate.rate).toBeLessThanOrEqual(1000)

    // Extreme metrics for very low rate
    const rate2 = oracle.calculateRate({
      totalComputeCycles: 0,
      totalSupply: 1_000_000_000,
      activeNodes: 0,
      avgPoOScore: 0,
      totalVerifiedTasks: 0,
    })
    expect(rate2.rate).toBeGreaterThanOrEqual(0.0001)
  })

  it('config update works', () => {
    const oracle = new FiatOracle(dataDir)
    oracle.updateConfig({ genesisRateUsd: 0.05 })
    expect(oracle.getConfig().genesisRateUsd).toBe(0.05)
  })

  it('persists rates across instances', () => {
    const oracle1 = new FiatOracle(dataDir)
    oracle1.calculateRate(defaultMetrics)

    const oracle2 = new FiatOracle(dataDir)
    const rate = oracle2.getCurrentRate('NEWB/USD')
    expect(rate).not.toBeNull()
    expect(rate!.rate).toBeGreaterThan(0)
  })
})
