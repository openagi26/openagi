/**
 * Trinity Host API Routes
 *
 * Exposes Trinity engine, economy, governance, identity, goals, auto-runner via HTTP
 */
import type { IncomingMessage, ServerResponse } from 'http'
import type { HostApiContext } from '../context'
import { parseJsonBody, sendJson } from '../route-utils'
import { TrinityEngine } from '../../trinity'
import { GoalManager } from '../../trinity/goal-manager'
import { TrinityAutoRunner } from '../../trinity/auto-runner'
import { ProphetMiningEngine } from '../../trinity/prophet-mining'
import { KnowledgeMarket } from '../../trinity/knowledge-market'
import { SwarmManager } from '../../trinity/swarm'
import { HostDividendManager } from '../../trinity/host-dividend'
import { ZombieCleanupManager } from '../../trinity/zombie-cleanup'
import { NewBBlockchain } from '../../trinity/blockchain'
import { FiatOracle } from '../../trinity/fiat-oracle'
import { AIExecutor } from '../../trinity/ai-executor'
import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

// ─── Singletons ───────────────────────────────────────────────────────────────

let engine: TrinityEngine | null = null
let goalMgr: GoalManager | null = null
let autoRunner: TrinityAutoRunner | null = null
let prophetMining: ProphetMiningEngine | null = null
let knowledgeMarket: KnowledgeMarket | null = null
let swarmManager: SwarmManager | null = null
let hostDividend: HostDividendManager | null = null
let zombieCleanup: ZombieCleanupManager | null = null
let blockchain: NewBBlockchain | null = null
let fiatOracle: FiatOracle | null = null

function getDataDir(): string {
  return join(app.getPath('userData'), 'openagi-data')
}

function getEngine(): TrinityEngine {
  if (!engine) engine = new TrinityEngine(getDataDir())
  return engine
}

function getGoalManager(): GoalManager {
  if (!goalMgr) goalMgr = new GoalManager(getDataDir())
  return goalMgr
}

function getAutoRunner(): TrinityAutoRunner {
  if (!autoRunner) autoRunner = new TrinityAutoRunner(getEngine(), getGoalManager())
  return autoRunner
}

function getProphetMining(): ProphetMiningEngine {
  if (!prophetMining) prophetMining = new ProphetMiningEngine(getDataDir())
  return prophetMining
}

function getKnowledgeMarket(): KnowledgeMarket {
  if (!knowledgeMarket) knowledgeMarket = new KnowledgeMarket(getDataDir())
  return knowledgeMarket
}

function getSwarmManager(): SwarmManager {
  if (!swarmManager) {
    const nodeId = getEngine().identity.getIdentity()?.nodeId ?? 'local-node'
    swarmManager = new SwarmManager(getDataDir(), nodeId)
  }
  return swarmManager
}

function getHostDividend(): HostDividendManager {
  if (!hostDividend) hostDividend = new HostDividendManager(getDataDir(), 'local-host')
  return hostDividend
}

function getZombieCleanup(): ZombieCleanupManager {
  if (!zombieCleanup) zombieCleanup = new ZombieCleanupManager(getDataDir())
  return zombieCleanup
}

function getBlockchain(): NewBBlockchain {
  if (!blockchain) blockchain = new NewBBlockchain(getDataDir())
  return blockchain
}

function getFiatOracle(): FiatOracle {
  if (!fiatOracle) fiatOracle = new FiatOracle(getDataDir())
  return fiatOracle
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function handleTrinityRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  _ctx: HostApiContext,
): Promise<boolean> {
  const { pathname } = url
  const method = req.method

  // ═══ Dashboard ══════════════════════════════════════════════════════════════

  if (pathname === '/api/trinity/dashboard' && method === 'GET') {
    const e = getEngine()
    const gm = getGoalManager()
    const ar = getAutoRunner()
    const dashboard = e.getDashboard()
    sendJson(res, 200, {
      ...dashboard,
      goal: gm.getCurrentGoal(),
      autoRunner: ar.getState(),
    })
    return true
  }

  // ═══ Genesis ════════════════════════════════════════════════════════════════

  if (pathname === '/api/trinity/genesis' && method === 'POST') {
    const body = await parseJsonBody<{ passphrase: string }>(req)
    if (!body.passphrase || body.passphrase.length < 8) {
      sendJson(res, 400, { error: 'Passphrase must be at least 8 characters' })
      return true
    }
    try {
      const result = getEngine().performGenesis(body.passphrase)
      sendJson(res, 201, result)
    } catch (err: any) {
      sendJson(res, 409, { error: err.message })
    }
    return true
  }

  if (pathname === '/api/trinity/genesis/status' && method === 'GET') {
    const e = getEngine()
    sendJson(res, 200, {
      isComplete: e.identity.hasGenesis() && e.economy.isInitialized(),
      hasIdentity: e.identity.hasGenesis(),
      hasEconomy: e.economy.isInitialized(),
    })
    return true
  }

  // ═══ Identity ═══════════════════════════════════════════════════════════════

  if (pathname === '/api/trinity/identity' && method === 'GET') {
    sendJson(res, 200, getEngine().identity.getIdentity() ?? { error: 'No identity' })
    return true
  }

  if (pathname === '/api/trinity/identity/unlock' && method === 'POST') {
    const body = await parseJsonBody<{ passphrase: string }>(req)
    sendJson(res, 200, { success: getEngine().identity.unlock(body.passphrase) })
    return true
  }

  if (pathname === '/api/trinity/identity/lock' && method === 'POST') {
    getEngine().identity.lock()
    sendJson(res, 200, { success: true })
    return true
  }

  if (pathname === '/api/trinity/identity/status' && method === 'GET') {
    const id = getEngine().identity
    sendJson(res, 200, {
      hasGenesis: id.hasGenesis(),
      isUnlocked: id.isUnlocked(),
      identity: id.getIdentity(),
    })
    return true
  }

  if (pathname === '/api/trinity/identity/sign' && method === 'POST') {
    const body = await parseJsonBody<{ data: string }>(req)
    if (!body.data) {
      sendJson(res, 400, { error: 'data field is required' })
      return true
    }
    const signature = getEngine().identity.sign(body.data)
    if (!signature) {
      sendJson(res, 403, { error: 'Identity is locked — unlock first' })
      return true
    }
    sendJson(res, 200, { signature })
    return true
  }

  if (pathname === '/api/trinity/identity/credit' && method === 'POST') {
    const body = await parseJsonBody<{ delta: number }>(req)
    if (typeof body.delta !== 'number') {
      sendJson(res, 400, { error: 'delta (number) is required' })
      return true
    }
    getEngine().identity.updateCredit(body.delta)
    sendJson(res, 200, { creditScore: getEngine().identity.getIdentity()?.creditScore ?? 0 })
    return true
  }

  if (pathname === '/api/trinity/identity/deactivate' && method === 'POST') {
    getEngine().identity.deactivate()
    sendJson(res, 200, { success: true, identity: getEngine().identity.getIdentity() })
    return true
  }

  // ═══ Economy ════════════════════════════════════════════════════════════════

  if (pathname === '/api/trinity/economy' && method === 'GET') {
    sendJson(res, 200, getEngine().economy.getLedger() ?? { error: 'No ledger' })
    return true
  }

  if (pathname === '/api/trinity/economy/balance' && method === 'GET') {
    sendJson(res, 200, { balance: getEngine().economy.getBalance() })
    return true
  }

  if (pathname === '/api/trinity/economy/transactions' && method === 'GET') {
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)
    sendJson(res, 200, getEngine().economy.getTransactions(limit))
    return true
  }

  if (pathname === '/api/trinity/economy/mining-config' && method === 'GET') {
    sendJson(res, 200, getEngine().economy.getMiningConfig())
    return true
  }

  // ═══ Trinity State ══════════════════════════════════════════════════════════

  if (pathname === '/api/trinity/state' && method === 'GET') {
    sendJson(res, 200, getEngine().getState())
    return true
  }

  if (pathname === '/api/trinity/history' && method === 'GET') {
    const limit = parseInt(url.searchParams.get('limit') ?? '20', 10)
    sendJson(res, 200, getEngine().getHistory(limit))
    return true
  }

  if (pathname === '/api/trinity/roles' && method === 'GET') {
    sendJson(res, 200, getEngine().getRolePrompts())
    return true
  }

  if (pathname === '/api/trinity/game-mode' && method === 'PUT') {
    const body = await parseJsonBody<{ mode: 'debate' | 'competition' | 'refinement' }>(req)
    getEngine().setGameMode(body.mode)
    sendJson(res, 200, { mode: body.mode })
    return true
  }

  // ═══ Goals ══════════════════════════════════════════════════════════════════

  if (pathname === '/api/trinity/goal' && method === 'GET') {
    const gm = getGoalManager()
    sendJson(res, 200, {
      current: gm.getCurrentGoal(),
      history: gm.getGoalHistory(),
    })
    return true
  }

  if (pathname === '/api/trinity/goal' && method === 'POST') {
    const body = await parseJsonBody<{
      title: string; description: string; priority?: string;
      targetMetric?: string; deadline?: string
    }>(req)
    if (!body.title || !body.description) {
      sendJson(res, 400, { error: 'title and description are required' })
      return true
    }
    const goal = getGoalManager().setGoal({
      title: body.title,
      description: body.description,
      priority: (body.priority as any) ?? 'P1',
      targetMetric: body.targetMetric,
      deadline: body.deadline,
    })
    sendJson(res, 201, goal)
    return true
  }

  if (pathname === '/api/trinity/goal/sub-goal' && method === 'POST') {
    const body = await parseJsonBody<{ title: string }>(req)
    const sub = getGoalManager().addSubGoal(body.title)
    sendJson(res, sub ? 201 : 400, sub ?? { error: 'No active goal' })
    return true
  }

  if (pathname === '/api/trinity/goal/complete' && method === 'POST') {
    getGoalManager().completeGoal()
    sendJson(res, 200, { success: true })
    return true
  }

  if (pathname === '/api/trinity/goal/abandon' && method === 'POST') {
    getGoalManager().abandonGoal()
    sendJson(res, 200, { success: true })
    return true
  }

  // ═══ Constraints ════════════════════════════════════════════════════════════

  if (pathname === '/api/trinity/constraints' && method === 'GET') {
    sendJson(res, 200, getGoalManager().getConstraints())
    return true
  }

  if (pathname === '/api/trinity/constraints' && method === 'POST') {
    const body = await parseJsonBody<{ category: string; rule: string; severity: string; description: string }>(req)
    const constraint = getGoalManager().addConstraint({
      category: body.category as any,
      rule: body.rule,
      severity: (body.severity as any) ?? 'soft',
      description: body.description,
    })
    sendJson(res, 201, constraint)
    return true
  }

  // ═══ Auto-Runner ════════════════════════════════════════════════════════════

  if (pathname === '/api/trinity/runner/state' && method === 'GET') {
    sendJson(res, 200, getAutoRunner().getState())
    return true
  }

  if (pathname === '/api/trinity/runner/config' && method === 'GET') {
    sendJson(res, 200, getAutoRunner().getConfig())
    return true
  }

  if (pathname === '/api/trinity/runner/start' && method === 'POST') {
    getAutoRunner().start()
    sendJson(res, 200, getAutoRunner().getState())
    return true
  }

  if (pathname === '/api/trinity/runner/stop' && method === 'POST') {
    getAutoRunner().stop('User stopped')
    sendJson(res, 200, getAutoRunner().getState())
    return true
  }

  if (pathname === '/api/trinity/runner/run-once' && method === 'POST') {
    try {
      const result = await getAutoRunner().runOnce()
      sendJson(res, 200, result ?? { message: 'No result — check goal and genesis status' })
    } catch (err: any) {
      sendJson(res, 500, { error: err.message })
    }
    return true
  }

  if (pathname === '/api/trinity/runner/config' && method === 'PUT') {
    const body = await parseJsonBody<Record<string, any>>(req)
    getAutoRunner().updateConfig(body)
    sendJson(res, 200, getAutoRunner().getConfig())
    return true
  }

  if (pathname === '/api/trinity/runner/ai-config' && method === 'PUT') {
    const body = await parseJsonBody<Record<string, any>>(req)
    getAutoRunner().updateAIConfig(body)
    sendJson(res, 200, { success: true })
    return true
  }

  // ═══ Governance ═════════════════════════════════════════════════════════════

  if (pathname === '/api/trinity/governance/evidence' && method === 'GET') {
    const level = url.searchParams.get('level') as any
    const persistedOnly = url.searchParams.get('persisted') === 'true'
    sendJson(res, 200, getEngine().governance.getEvidence({ level, persistedOnly }))
    return true
  }

  if (pathname === '/api/trinity/governance/value' && method === 'GET') {
    sendJson(res, 200, getEngine().governance.getValueData())
    return true
  }

  if (pathname === '/api/trinity/governance/debts' && method === 'GET') {
    const status = url.searchParams.get('status') as any
    sendJson(res, 200, getEngine().governance.getDebts(status))
    return true
  }

  if (pathname === '/api/trinity/governance/debts' && method === 'POST') {
    const body = await parseJsonBody<{ description: string; severity: string; estimatedCost: number }>(req)
    const debt = getEngine().governance.addDebt({
      description: body.description,
      createdAt: new Date().toISOString(),
      severity: (body.severity as any) ?? 'medium',
      estimatedCost: body.estimatedCost ?? 1,
    })
    sendJson(res, 201, debt)
    return true
  }

  if (pathname.startsWith('/api/trinity/governance/debts/') && pathname.endsWith('/resolve') && method === 'POST') {
    const debtId = pathname.split('/')[5]
    getEngine().governance.resolveDebt(debtId)
    sendJson(res, 200, { success: true })
    return true
  }

  if (pathname === '/api/trinity/governance/playbooks' && method === 'GET') {
    sendJson(res, 200, getEngine().governance.listPlaybooks())
    return true
  }

  if (pathname === '/api/trinity/governance/playbooks' && method === 'POST') {
    const body = await parseJsonBody<any>(req)
    const pb = getEngine().governance.savePlaybook({
      title: body.title,
      description: body.description,
      createdAt: new Date().toISOString(),
      author: getEngine().identity.getIdentity()?.nodeId ?? 'unknown',
      evidenceLevel: body.evidenceLevel ?? 'H2',
      successRate: body.successRate ?? 0,
      tags: body.tags ?? [],
      content: body.content ?? '',
      auctionPrice: body.auctionPrice,
    })
    sendJson(res, 201, pb)
    return true
  }

  if (pathname === '/api/trinity/governance/federated-clearing' && method === 'POST') {
    const result = getEngine().governance.runFederatedClearing()
    // Wire federated debts to swarm broadcast
    if (result.length > 0) {
      try {
        getSwarmManager().broadcastDebtClearing(
          result.map(d => ({ id: d.id, description: d.description, bounty: d.federatedBounty ?? d.estimatedCost * 1.5 }))
        )
      } catch { /* swarm may not be running */ }
    }
    sendJson(res, 200, { federatedDebts: result.length, debts: result })
    return true
  }

  if (pathname === '/api/trinity/governance/entropy-gc' && method === 'POST') {
    getEngine().governance.runEntropyGC()
    sendJson(res, 200, { success: true })
    return true
  }

  // ═══ PoO ════════════════════════════════════════════════════════════════════

  if (pathname === '/api/trinity/poo/stats' && method === 'GET') {
    sendJson(res, 200, getEngine().verifier.getStats())
    return true
  }

  if (pathname === '/api/trinity/poo/tasks' && method === 'GET') {
    const status = url.searchParams.get('status') as any
    sendJson(res, 200, getEngine().verifier.listTasks(status))
    return true
  }

  if (pathname === '/api/trinity/poo/config' && method === 'GET') {
    sendJson(res, 200, getEngine().verifier.getConfig())
    return true
  }

  if (pathname === '/api/trinity/poo/config' && method === 'PUT') {
    const body = await parseJsonBody<Record<string, any>>(req)
    getEngine().verifier.updateConfig(body)
    sendJson(res, 200, getEngine().verifier.getConfig())
    return true
  }

  // ═══ Prophet Mining ═════════════════════════════════════════════════════════

  if (pathname === '/api/trinity/prophet/predictions' && method === 'GET') {
    const status = url.searchParams.get('status') as any
    const category = url.searchParams.get('category') ?? undefined
    const nodeId = url.searchParams.get('nodeId') ?? undefined
    sendJson(res, 200, getProphetMining().getAllPredictions({ status, category, nodeId }))
    return true
  }

  if (pathname === '/api/trinity/prophet/stats' && method === 'GET') {
    sendJson(res, 200, getProphetMining().getStats())
    return true
  }

  if (pathname === '/api/trinity/prophet/predict' && method === 'POST') {
    const body = await parseJsonBody<{
      claim: string; category: string; targetMetric: string; predictedValue: string
      confidence: number; verifyAfter: string; stakedAmount: number
    }>(req)
    const nodeId = getEngine().identity.getIdentity()?.nodeId ?? 'local-node'
    const result = getProphetMining().createPrediction({
      nodeId,
      claim: body.claim,
      category: body.category as any,
      targetMetric: body.targetMetric,
      predictedValue: body.predictedValue,
      confidence: body.confidence,
      verifyAfter: body.verifyAfter,
      stakedAmount: body.stakedAmount,
    })
    if ('error' in result) {
      sendJson(res, 400, result)
    } else {
      sendJson(res, 201, result)
    }
    return true
  }

  if (pathname.startsWith('/api/trinity/prophet/verify/') && method === 'POST') {
    const id = pathname.split('/')[5]
    try {
      const result = await getProphetMining().verifyPrediction(id)
      if ('error' in result) {
        sendJson(res, 400, result)
      } else {
        sendJson(res, 200, result)
      }
    } catch (err: any) {
      sendJson(res, 500, { error: err.message })
    }
    return true
  }

  if (pathname.startsWith('/api/trinity/prophet/resolve/') && method === 'POST') {
    const id = pathname.split('/')[5]
    const body = await parseJsonBody<{ actualValue: string; accuracy: number }>(req)
    const result = getProphetMining().manualResolve(id, body.actualValue, body.accuracy)
    if ('error' in result) {
      sendJson(res, 400, result)
    } else {
      sendJson(res, 200, result)
    }
    return true
  }

  if (pathname.startsWith('/api/trinity/prophet/cancel/') && method === 'POST') {
    const id = pathname.split('/')[5]
    const success = getProphetMining().cancelPrediction(id)
    sendJson(res, success ? 200 : 400, { success })
    return true
  }

  if (pathname === '/api/trinity/prophet/due' && method === 'GET') {
    sendJson(res, 200, getProphetMining().getDuePredictions())
    return true
  }

  if (pathname === '/api/trinity/prophet/config' && method === 'GET') {
    sendJson(res, 200, getProphetMining().getConfig())
    return true
  }

  if (pathname === '/api/trinity/prophet/config' && method === 'PUT') {
    const body = await parseJsonBody<Record<string, any>>(req)
    getProphetMining().updateConfig(body)
    sendJson(res, 200, getProphetMining().getConfig())
    return true
  }

  // ═══ Knowledge Market ═══════════════════════════════════════════════════════

  if (pathname === '/api/trinity/market/listings' && method === 'GET') {
    const tags = url.searchParams.get('tags')?.split(',').filter(Boolean)
    const minPrice = url.searchParams.get('minPrice') ? parseFloat(url.searchParams.get('minPrice')!) : undefined
    const maxPrice = url.searchParams.get('maxPrice') ? parseFloat(url.searchParams.get('maxPrice')!) : undefined
    sendJson(res, 200, getKnowledgeMarket().searchListings({ tags, minPrice, maxPrice }))
    return true
  }

  if (pathname.startsWith('/api/trinity/market/listing/') && method === 'GET') {
    const id = pathname.split('/')[5]
    const listing = getKnowledgeMarket().getListing(id)
    sendJson(res, listing ? 200 : 404, listing ?? { error: 'Listing not found' })
    return true
  }

  if (pathname === '/api/trinity/market/stats' && method === 'GET') {
    sendJson(res, 200, getKnowledgeMarket().getStats())
    return true
  }

  if (pathname === '/api/trinity/market/list' && method === 'POST') {
    const body = await parseJsonBody<any>(req)
    const nodeId = getEngine().identity.getIdentity()?.nodeId ?? 'local-node'
    const result = getKnowledgeMarket().createListing({
      sellerId: body.sellerId ?? nodeId,
      playbookId: body.playbookId,
      title: body.title,
      description: body.description,
      tags: body.tags ?? [],
      startPrice: body.startPrice,
      floorPrice: body.floorPrice,
      decrementAmount: body.decrementAmount,
      decrementIntervalMs: body.decrementIntervalMs,
      sellerStake: body.sellerStake,
      evidenceLevel: body.evidenceLevel ?? 'H2',
      durationMs: body.durationMs,
    })
    if ('error' in result) {
      sendJson(res, 400, result)
    } else {
      sendJson(res, 201, result)
    }
    return true
  }

  if (pathname.startsWith('/api/trinity/market/buy/') && method === 'POST') {
    const id = pathname.split('/')[5]
    const body = await parseJsonBody<{ buyerId: string }>(req)
    const result = getKnowledgeMarket().purchase(id, body.buyerId)
    if ('error' in result) {
      sendJson(res, 400, result)
    } else {
      sendJson(res, 200, result)
    }
    return true
  }

  if (pathname.startsWith('/api/trinity/market/outcome/') && method === 'POST') {
    const id = pathname.split('/')[5]
    const body = await parseJsonBody<{ buyerId: string; outcomeScore: number; feedback: string }>(req)
    const result = getKnowledgeMarket().recordBuyerOutcome(id, body.buyerId, body.outcomeScore, body.feedback)
    if ('error' in result) {
      sendJson(res, 400, result)
    } else {
      sendJson(res, 200, result)
    }
    return true
  }

  if (pathname.startsWith('/api/trinity/market/cancel/') && method === 'POST') {
    const id = pathname.split('/')[5]
    const body = await parseJsonBody<{ sellerId: string }>(req)
    const success = getKnowledgeMarket().cancelListing(id, body.sellerId)
    sendJson(res, success ? 200 : 400, { success })
    return true
  }

  if (pathname === '/api/trinity/market/expire' && method === 'POST') {
    const count = getKnowledgeMarket().expireListings()
    sendJson(res, 200, { expired: count })
    return true
  }

  // ═══ Swarm ══════════════════════════════════════════════════════════════════

  if (pathname === '/api/trinity/swarm/peers' && method === 'GET') {
    const status = url.searchParams.get('status') as any
    sendJson(res, 200, getSwarmManager().getPeers(status ? { status } : undefined))
    return true
  }

  if (pathname === '/api/trinity/swarm/stats' && method === 'GET') {
    sendJson(res, 200, getSwarmManager().getStats())
    return true
  }

  if (pathname === '/api/trinity/swarm/config' && method === 'GET') {
    sendJson(res, 200, getSwarmManager().getConfig())
    return true
  }

  if (pathname === '/api/trinity/swarm/start' && method === 'POST') {
    await getSwarmManager().start()
    sendJson(res, 200, { success: true, running: getSwarmManager().getIsRunning() })
    return true
  }

  if (pathname === '/api/trinity/swarm/stop' && method === 'POST') {
    await getSwarmManager().stop()
    sendJson(res, 200, { success: true, running: getSwarmManager().getIsRunning() })
    return true
  }

  if (pathname === '/api/trinity/swarm/connect' && method === 'POST') {
    const body = await parseJsonBody<{ address: string; port: number }>(req)
    const success = await getSwarmManager().connectToPeer(body.address, body.port)
    sendJson(res, success ? 200 : 400, { success })
    return true
  }

  if (pathname === '/api/trinity/swarm/discover' && method === 'POST') {
    getSwarmManager().discoverPeers()
    sendJson(res, 200, { success: true })
    return true
  }

  if (pathname === '/api/trinity/swarm/report' && method === 'POST') {
    const body = await parseJsonBody<{ targetNodeId: string; reason: string; evidence: string }>(req)
    getSwarmManager().reportMaliciousNode(body.targetNodeId, body.reason, body.evidence)
    sendJson(res, 200, { success: true })
    return true
  }

  // ═══ Host Dividend ══════════════════════════════════════════════════════════

  if (pathname === '/api/trinity/dividend/summary' && method === 'GET') {
    sendJson(res, 200, getHostDividend().getSummary())
    return true
  }

  if (pathname === '/api/trinity/dividend/config' && method === 'GET') {
    sendJson(res, 200, getHostDividend().getConfig())
    return true
  }

  if (pathname === '/api/trinity/dividend/config' && method === 'PUT') {
    const body = await parseJsonBody<Record<string, any>>(req)
    getHostDividend().updateConfig(body)
    sendJson(res, 200, getHostDividend().getConfig())
    return true
  }

  if (pathname === '/api/trinity/dividend/payout' && method === 'POST') {
    const result = getHostDividend().processPayout()
    sendJson(res, 200, result)
    return true
  }

  // ═══ Zombie Cleanup ═════════════════════════════════════════════════════════

  if (pathname === '/api/trinity/zombie/activities' && method === 'GET') {
    const status = url.searchParams.get('status') as any
    sendJson(res, 200, getZombieCleanup().getAllActivities(status ? { status } : undefined))
    return true
  }

  if (pathname === '/api/trinity/zombie/report' && method === 'GET') {
    sendJson(res, 200, getZombieCleanup().getLastReport() ?? { error: 'No cleanup report yet' })
    return true
  }

  if (pathname === '/api/trinity/zombie/config' && method === 'GET') {
    sendJson(res, 200, getZombieCleanup().getConfig())
    return true
  }

  if (pathname === '/api/trinity/zombie/cleanup' && method === 'POST') {
    const report = getZombieCleanup().runCleanup()
    sendJson(res, 200, report)
    return true
  }

  // ═══ Blockchain ═════════════════════════════════════════════════════════════

  if (pathname === '/api/trinity/chain/state' && method === 'GET') {
    sendJson(res, 200, getBlockchain().getChainState())
    return true
  }

  if (pathname.startsWith('/api/trinity/chain/block/') && method === 'GET') {
    const index = parseInt(pathname.split('/')[5], 10)
    const block = getBlockchain().getBlock(index)
    sendJson(res, block ? 200 : 404, block ?? { error: 'Block not found' })
    return true
  }

  if (pathname.startsWith('/api/trinity/chain/transactions/') && method === 'GET') {
    const nodeId = pathname.split('/')[5]
    sendJson(res, 200, getBlockchain().getTransactionHistory(nodeId))
    return true
  }

  if (pathname.startsWith('/api/trinity/chain/balance/') && method === 'GET') {
    const nodeId = pathname.split('/')[5]
    sendJson(res, 200, { nodeId, balance: getBlockchain().getBalance(nodeId) })
    return true
  }

  if (pathname === '/api/trinity/chain/pending' && method === 'GET') {
    sendJson(res, 200, getBlockchain().getPendingTransactions())
    return true
  }

  if (pathname === '/api/trinity/chain/init' && method === 'POST') {
    const body = await parseJsonBody<{ nodeId?: string; initialSupply: number }>(req)
    const nodeId = body.nodeId ?? getEngine().identity.getIdentity()?.nodeId ?? 'local-node'
    try {
      const block = getBlockchain().initGenesis(nodeId, body.initialSupply)
      sendJson(res, 201, block)
    } catch (err: any) {
      sendJson(res, 409, { error: err.message })
    }
    return true
  }

  if (pathname === '/api/trinity/chain/transfer' && method === 'POST') {
    const body = await parseJsonBody<{ from: string; to: string; amount: number }>(req)
    const result = getBlockchain().createTransaction({
      type: 'transfer',
      from: body.from,
      to: body.to,
      amount: body.amount,
    })
    if ('error' in result) {
      sendJson(res, 400, result)
    } else {
      sendJson(res, 201, result)
    }
    return true
  }

  if (pathname === '/api/trinity/chain/mine' && method === 'POST') {
    const body = await parseJsonBody<{ minerNodeId: string }>(req)
    const block = getBlockchain().mineBlock(body.minerNodeId)
    sendJson(res, block ? 201 : 400, block ?? { error: 'No pending transactions to mine' })
    return true
  }

  if (pathname === '/api/trinity/chain/anchor-evidence' && method === 'POST') {
    const body = await parseJsonBody<{ nodeId: string; evidenceHash: string; description: string }>(req)
    const result = getBlockchain().anchorEvidence(body.nodeId, body.evidenceHash, body.description)
    if ('error' in result) {
      sendJson(res, 400, result)
    } else {
      sendJson(res, 201, result)
    }
    return true
  }

  if (pathname === '/api/trinity/chain/validate' && method === 'POST') {
    const result = getBlockchain().validateChain()
    sendJson(res, 200, result)
    return true
  }

  // ═══ Fiat Oracle ════════════════════════════════════════════════════════════

  if (pathname === '/api/trinity/oracle/rates' && method === 'GET') {
    sendJson(res, 200, getFiatOracle().getAllRates())
    return true
  }

  if (pathname.startsWith('/api/trinity/oracle/rate/') && method === 'GET') {
    const pair = decodeURIComponent(pathname.split('/')[5])
    const rate = getFiatOracle().getCurrentRate(pair)
    sendJson(res, rate ? 200 : 404, rate ?? { error: `No rate for pair: ${pair}` })
    return true
  }

  if (pathname.startsWith('/api/trinity/oracle/history/') && method === 'GET') {
    const pair = decodeURIComponent(pathname.split('/')[5])
    const history = getFiatOracle().getPriceHistory(pair)
    sendJson(res, history ? 200 : 404, history ?? { error: `No history for pair: ${pair}` })
    return true
  }

  if (pathname === '/api/trinity/oracle/convert' && method === 'GET') {
    const amount = parseFloat(url.searchParams.get('amount') ?? '0')
    const from = url.searchParams.get('from') ?? 'NEWB'
    const to = url.searchParams.get('to') ?? 'USD'

    if (from.toUpperCase() === 'NEWB') {
      const result = getFiatOracle().convertToFiat(amount, to)
      sendJson(res, result ? 200 : 404, result ?? { error: `No rate available for NEWB/${to}` })
    } else {
      const result = getFiatOracle().convertFromFiat(amount, from)
      sendJson(res, result ? 200 : 404, result ?? { error: `No rate available for NEWB/${from}` })
    }
    return true
  }

  if (pathname === '/api/trinity/oracle/calculate' && method === 'POST') {
    const body = await parseJsonBody<{
      metrics: {
        totalComputeCycles: number; totalSupply: number; activeNodes: number
        avgPoOScore: number; totalVerifiedTasks: number
      }
    }>(req)
    const rate = getFiatOracle().calculateRate(body.metrics)
    sendJson(res, 200, rate)
    return true
  }

  if (pathname === '/api/trinity/oracle/fetch-external' && method === 'POST') {
    try {
      const rates = await getFiatOracle().fetchExternalRates()
      sendJson(res, 200, { fetched: rates.length, rates })
    } catch (err: any) {
      sendJson(res, 500, { error: err.message })
    }
    return true
  }

  // ═══ Supplementary Endpoints (fix frontend gaps) ════════════════════════════

  if (pathname === '/api/trinity/chain/blocks' && method === 'GET') {
    const bc = getBlockchain()
    const state = bc.getChainState()
    const blocks: any[] = []
    const start = Math.max(0, state.height - 20)
    for (let i = start; i < state.height; i++) {
      const b = bc.getBlock(i)
      if (b) blocks.push({ index: b.index, miner: b.miner, txCount: b.transactions.length, hash: b.hash, timestamp: b.timestamp })
    }
    sendJson(res, 200, blocks.reverse())
    return true
  }

  if (pathname === '/api/trinity/chain/initialize' && method === 'POST') {
    const nodeId = getEngine().identity.getIdentity()?.nodeId ?? 'local-node'
    try {
      const block = getBlockchain().initGenesis(nodeId, 100)
      sendJson(res, 201, block)
    } catch (err: any) {
      sendJson(res, 409, { error: err.message })
    }
    return true
  }

  if (pathname === '/api/trinity/oracle/history' && method === 'GET') {
    const history = getFiatOracle().getPriceHistory('NEWB/USD')
    sendJson(res, 200, history ?? { pair: 'NEWB/USD', rates: [], high24h: 0, low24h: 0, change24h: 0, volume24h: 0 })
    return true
  }

  if (pathname === '/api/trinity/oracle/recalculate' && method === 'POST') {
    const e = getEngine()
    const pooStats = e.verifier.getStats()
    const rate = getFiatOracle().calculateRate({
      totalComputeCycles: pooStats.totalTasks * 100,
      totalSupply: e.economy.getBalance() + (e.economy.getLedger()?.totalSpent ?? 0),
      activeNodes: 1,
      avgPoOScore: pooStats.avgScore,
      totalVerifiedTasks: pooStats.verified,
    })
    sendJson(res, 200, rate)
    return true
  }

  if (pathname === '/api/trinity/dividend/records' && method === 'GET') {
    const summary = getHostDividend().getSummary()
    sendJson(res, 200, summary.recentRecords)
    return true
  }

  // ═══ AI Personality Configuration ═══════════════════════════════════════════

  if (pathname === '/api/trinity/roles/config' && method === 'GET') {
    sendJson(res, 200, getRoleConfig())
    return true
  }

  if (pathname === '/api/trinity/roles/config' && method === 'PUT') {
    const body = await parseJsonBody<Record<string, any>>(req)
    updateRoleConfig(body)
    sendJson(res, 200, getRoleConfig())
    return true
  }

  // ═══ Trinity Cycle Manual Trigger (for chat integration) ═══════════════════

  if (pathname === '/api/trinity/cycle/run' && method === 'POST') {
    const body = await parseJsonBody<{ goal?: string; mode?: string }>(req)
    const gm = getGoalManager()
    const goal = gm.getCurrentGoal()
    const goalText = body.goal ?? goal?.title ?? 'General task'

    if (body.mode) getEngine().setGameMode(body.mode as any)

    try {
      const executor = new AIExecutor()
      const result = await getEngine().runCycle(goalText, (role: any, prompt: any, ctx: any) => executor.execute(role, prompt, ctx))
      sendJson(res, 200, result)
    } catch (err: any) {
      sendJson(res, 500, { error: err.message })
    }
    return true
  }

  if (pathname === '/api/trinity/cycle/history' && method === 'GET') {
    const limit = parseInt(url.searchParams.get('limit') ?? '10', 10)
    sendJson(res, 200, getEngine().getHistory(limit))
    return true
  }

  return false
}

// ─── Role Config Persistence ────────────────────────────────────────────────

function getRoleConfig(): Record<string, { name: string; personality: string; temperature: number }> {
  const path = join(getDataDir(), 'trinity', 'role-config.json')
  if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8'))
  return {
    'AI-1': { name: '扩张者', personality: '激进、创新、机会导向。善于发现高价值目标，快速制定战略方案。', temperature: 0.8 },
    'AI-2': { name: '风控员', personality: '冷静、怀疑、证据驱动。拒绝一切缺乏H3+证据的声明，优先发现潜在风险。', temperature: 0.2 },
    'AI-3': { name: '财务官', personality: '理性、平衡、决策果断。以PoO Priority Score为核心，严控支出上限30%。', temperature: 0.4 },
  }
}

function updateRoleConfig(config: Record<string, any>): void {
  const dir = join(getDataDir(), 'trinity')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const current = getRoleConfig()
  const merged = { ...current, ...config }
  writeFileSync(join(dir, 'role-config.json'), JSON.stringify(merged, null, 2))
}
