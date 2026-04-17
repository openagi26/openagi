/**
 * Trinity Engine Integration Tests
 *
 * Tests the full lifecycle:
 *   Genesis → Identity → Economy → PoO → Trinity Cycle
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { TrinityEngine } from '../../electron/trinity'
import { IdentityManager } from '../../electron/identity'
import { GovernanceManager, EvidenceLevel } from '../../electron/governance'
import { NewBEngine } from '../../electron/newb'
import { PoOVerifier } from '../../electron/poo'

// ─── Setup ────────────────────────────────────────────────────────────────────

let dataDir: string

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'openagi-test-'))
})

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true })
})

// ─── Identity Module ──────────────────────────────────────────────────────────

describe('IdentityManager', () => {
  it('generates genesis identity with valid node ID', () => {
    const mgr = new IdentityManager(dataDir)
    const identity = mgr.generateGenesis('test-passphrase-123')

    expect(identity.nodeId).toMatch(/^NC-[a-f0-9]{40}$/)
    expect(identity.creditScore).toBe(100)
    expect(identity.isActive).toBe(true)
    expect(identity.publicKey).toContain('BEGIN PUBLIC KEY')
    expect(mgr.hasGenesis()).toBe(true)
  })

  it('unlocks and locks private key correctly', () => {
    const mgr = new IdentityManager(dataDir)
    mgr.generateGenesis('my-secure-pass')

    expect(mgr.isUnlocked()).toBe(false)
    expect(mgr.unlock('wrong-pass')).toBe(false)
    expect(mgr.unlock('my-secure-pass')).toBe(true)
    expect(mgr.isUnlocked()).toBe(true)

    mgr.lock()
    expect(mgr.isUnlocked()).toBe(false)
  })

  it('signs data when unlocked', () => {
    const mgr = new IdentityManager(dataDir)
    mgr.generateGenesis('sign-test-pass')
    mgr.unlock('sign-test-pass')

    const signature = mgr.sign('hello world')
    expect(signature).toBeTruthy()
    expect(typeof signature).toBe('string')
    expect(signature!.length).toBeGreaterThan(0)
  })

  it('updates credit score', () => {
    const mgr = new IdentityManager(dataDir)
    mgr.generateGenesis('credit-test')

    mgr.updateCredit(50)
    expect(mgr.getIdentity()!.creditScore).toBe(150)

    mgr.updateCredit(-200)
    expect(mgr.getIdentity()!.creditScore).toBe(0) // Floor at 0
  })

  it('deactivates node (digital death)', () => {
    const mgr = new IdentityManager(dataDir)
    mgr.generateGenesis('death-test')
    mgr.deactivate()

    const identity = mgr.getIdentity()!
    expect(identity.isActive).toBe(false)
    expect(identity.creditScore).toBe(0)
  })
})

// ─── Governance Files ─────────────────────────────────────────────────────────

describe('GovernanceManager', () => {
  it('initializes 5 core governance files', () => {
    const gov = new GovernanceManager(dataDir)
    const evidence = gov.getEvidence()
    expect(evidence).toEqual([])

    const valueData = gov.getValueData()
    expect(valueData.entries).toEqual([])
    expect(valueData.summary.totalTasks).toBe(0)

    const debts = gov.getDebts()
    expect(debts).toEqual([])

    const playbooks = gov.listPlaybooks()
    expect(playbooks).toEqual([])
  })

  it('appends evidence with correct levels and hashing', () => {
    const gov = new GovernanceManager(dataDir)

    const ev = gov.appendEvidence({
      timestamp: new Date().toISOString(),
      source: 'AI-1',
      claim: 'Found profitable bounty on GitHub',
      evidenceLevel: EvidenceLevel.H3,
      supportingData: ['https://github.com/example/bounty'],
    })

    expect(ev.id).toMatch(/^EV-/)
    expect(ev.hash).toHaveLength(64) // SHA-256 hex
    expect(ev.persisted).toBe(false) // H3 → not persisted (middle grade)

    // H1 should be persisted (highest grade)
    const ev2 = gov.appendEvidence({
      timestamp: new Date().toISOString(),
      source: 'AI-2',
      claim: 'Machine-verified evidence',
      evidenceLevel: EvidenceLevel.H1,
      supportingData: [],
    })
    expect(ev2.persisted).toBe(true)
  })

  it('manages debt lifecycle including federated clearing', () => {
    const gov = new GovernanceManager(dataDir)

    const debt = gov.addDebt({
      description: 'Missing error handling in payment module',
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days ago
      severity: 'high',
      estimatedCost: 5,
    })

    expect(debt.status).toBe('open')
    expect(gov.getDebts('open')).toHaveLength(1)

    // Run federated clearing (should promote 8-day-old debt)
    const federated = gov.runFederatedClearing()
    expect(federated).toHaveLength(1)
    expect(federated[0].status).toBe('federated')
    expect(federated[0].federatedBounty).toBe(8) // 5 * 1.5 = 7.5, ceil = 8
  })

  it('saves and retrieves playbooks', () => {
    const gov = new GovernanceManager(dataDir)

    const pb = gov.savePlaybook({
      title: 'GitHub Bounty Hunter',
      description: 'Strategy for finding and completing GitHub bounties',
      createdAt: new Date().toISOString(),
      author: 'NC-test-node',
      evidenceLevel: EvidenceLevel.H3,
      successRate: 85,
      tags: ['github', 'bounty', 'automation'],
      content: '# Steps\n1. Scan repositories...',
    })

    expect(pb.id).toMatch(/^PB-/)
    expect(pb.usageCount).toBe(0)

    const retrieved = gov.getPlaybook(pb.id)
    expect(retrieved!.title).toBe('GitHub Bounty Hunter')

    const list = gov.listPlaybooks()
    expect(list).toHaveLength(1)
  })
})

// ─── New.B Economy ────────────────────────────────────────────────────────────

describe('NewBEngine', () => {
  it('initializes with genesis reward of 100 New.B', () => {
    const engine = new NewBEngine(dataDir)
    const ledger = engine.initGenesis('NC-test-node')

    expect(ledger.balance).toBe(100)
    expect(ledger.totalEarned).toBe(100)
    expect(ledger.transactions).toHaveLength(1)
    expect(ledger.transactions[0].type).toBe('genesis')
  })

  it('issues PoO rewards with halving', () => {
    const engine = new NewBEngine(dataDir)
    engine.initGenesis('NC-test-node')

    const reward = engine.issuePoOReward('task-1', 'Completed bounty')
    expect(reward!.amount).toBe(10) // Initial reward rate
    expect(engine.getBalance()).toBe(110) // 100 + 10
  })

  it('handles staking and unstaking', () => {
    const engine = new NewBEngine(dataDir)
    engine.initGenesis('NC-test-node')

    const stakeTx = engine.stake(20, 'playbook-listing')
    expect(stakeTx!.amount).toBe(-20)
    expect(engine.getBalance()).toBe(80) // 100 - 20

    const unstakeTx = engine.unstake(20, 'playbook-listing')
    expect(unstakeTx!.amount).toBe(20)
    expect(engine.getBalance()).toBe(100) // Back to 100
  })

  it('prevents overspending', () => {
    const engine = new NewBEngine(dataDir)
    engine.initGenesis('NC-test-node')

    const tx = engine.spend(200, 'Too expensive')
    expect(tx).toBeNull() // Insufficient balance
    expect(engine.getBalance()).toBe(100) // Unchanged
  })

  it('detects bankruptcy', () => {
    const engine = new NewBEngine(dataDir)
    engine.initGenesis('NC-test-node')

    engine.spend(100, 'All in')
    expect(engine.isBankrupt()).toBe(true)
  })
})

// ─── PoO Verifier ─────────────────────────────────────────────────────────────

describe('PoOVerifier', () => {
  it('calculates Priority Score correctly', () => {
    const verifier = new PoOVerifier(dataDir)
    const task = verifier.submitTask({
      title: 'Test Task',
      description: 'Testing PoO scoring',
      proposedBy: 'AI-1',
    })

    // High-quality task: goalFit=90, outcome=90, evidence=75, cost=10, debt=5
    const score = verifier.calculateScore(task.id, {
      goalFit: 90,
      pooOutcome: 90,
      evidenceLevel: 75,
      cost: 10,
      debtImpact: 5,
    })

    // Numerator: 90*0.35 + 90*0.35 + 75*0.2 = 31.5+31.5+15 = 78
    // Denominator: max(1, 10 + 5*0.1) = max(1, 10.5) = 10.5
    // Score: (78/10.5)*100 = 742... capped at 100
    expect(score).toBe(100) // Capped at 100
  })

  it('finalizes tasks above threshold as executed', () => {
    const verifier = new PoOVerifier(dataDir)
    const task = verifier.submitTask({
      title: 'Good Task',
      description: 'Should be executed',
      proposedBy: 'AI-1',
    })

    verifier.calculateScore(task.id, {
      goalFit: 90, pooOutcome: 90, evidenceLevel: 75, cost: 10, debtImpact: 5,
    })

    const result = verifier.finalizeTask(task.id)
    expect(result.action).toBe('execute')
    expect(result.reward).toBe(10)
  })

  it('discards tasks below threshold', () => {
    const verifier = new PoOVerifier(dataDir)
    const task = verifier.submitTask({
      title: 'Bad Task',
      description: 'Should be discarded',
      proposedBy: 'AI-1',
    })

    verifier.calculateScore(task.id, {
      goalFit: 10, pooOutcome: 10, evidenceLevel: 25, cost: 90, debtImpact: 90,
    })

    const result = verifier.finalizeTask(task.id)
    expect(result.action).toBe('discard')
    expect(result.reward).toBe(0)
  })

  it('runs sandbox verification', async () => {
    const verifier = new PoOVerifier(dataDir)
    const task = verifier.submitTask({
      title: 'Sandbox Test',
      description: 'Test sandbox execution',
      proposedBy: 'AI-1',
    })

    const result = await verifier.verifySandbox(task.id, async () => ({
      success: true,
      output: 'Task completed successfully',
      outcomeScore: 95,
    }))

    expect(result.success).toBe(true)
    expect(result.outcomeScore).toBe(95)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
    expect(verifier.getTask(task.id)!.evidenceHash).toBeTruthy()
  })

  it('produces statistics', () => {
    const verifier = new PoOVerifier(dataDir)

    verifier.submitTask({ title: 'T1', description: 'D1', proposedBy: 'AI-1' })
    verifier.submitTask({ title: 'T2', description: 'D2', proposedBy: 'AI-2' })

    const stats = verifier.getStats()
    expect(stats.totalTasks).toBe(2)
  })
})

// ─── Trinity Engine (Full Cycle) ──────────────────────────────────────────────

describe('TrinityEngine', () => {
  it('completes full genesis sequence', () => {
    const engine = new TrinityEngine(dataDir)
    const result = engine.performGenesis('genesis-test-pass')

    expect(result.identity.nodeId).toMatch(/^NC-/)
    expect(result.balance).toBe(100)
    expect(result.message).toContain('is alive')

    const dashboard = engine.getDashboard()
    expect(dashboard.isGenesisComplete).toBe(true)
    expect(dashboard.identity).not.toBeNull()
    expect(dashboard.economy).not.toBeNull()
    expect(dashboard.economy!.balance).toBe(100)
  })

  it('runs a complete Trinity cycle with mock AI executor', async () => {
    const engine = new TrinityEngine(dataDir)
    engine.performGenesis('cycle-test-pass')

    // Mock AI executor returns structured JSON for each role
    const mockExecutor = async (role: string, _prompt: string, _context: string) => {
      if (role === 'AI-1') {
        return JSON.stringify({
          title: 'GitHub Bounty: Fix login bug',
          description: 'Found a $500 bounty for fixing authentication bypass',
          actionPlan: ['Analyze codebase', 'Write fix', 'Submit PR'],
          estimatedValue: 50,
          estimatedCost: 5,
          evidenceLevel: 'H3',
          supportingData: ['https://github.com/example/issue/123'],
        })
      }
      if (role === 'AI-2') {
        return JSON.stringify({
          riskLevel: 'low',
          findings: [
            { category: 'security', severity: 'info', description: 'Code looks safe', recommendation: 'Proceed' },
          ],
          approved: true,
          confidence: 85,
        })
      }
      // AI-3
      return JSON.stringify({
        approved: true,
        evidenceLevel: 'H3',
        reasoning: 'Low risk, high reward, proceed with bounty',
        scoreComponents: {
          goalFit: 90,
          pooOutcome: 85,
          evidenceLevel: 75,
          cost: 10,
          debtImpact: 5,
        },
        priorityScore: 92,
      })
    }

    const result = await engine.runCycle('Find and complete profitable GitHub bounties', mockExecutor)

    expect(result.round).toBe(1)
    expect(result.proposal.title).toBe('GitHub Bounty: Fix login bug')
    expect(result.audit.approved).toBe(true)
    expect(result.audit.confidence).toBe(85)
    expect(result.decision.approved).toBe(true)
    expect(result.decision.priorityScore).toBe(92)
    expect(result.outcome).toBe('executed')
    expect(result.newbReward).toBeGreaterThan(0)

    // Check economy was updated
    expect(engine.economy.getBalance()).toBeGreaterThan(100) // Genesis + reward

    // Check governance logged the cycle
    const evidence = engine.governance.getEvidence()
    expect(evidence.length).toBeGreaterThan(1) // Genesis + cycle evidence

    const valueData = engine.governance.getValueData()
    expect(valueData.entries).toHaveLength(1)
    expect(valueData.entries[0].outcome).toBe('executed')

    // Check state
    const state = engine.getState()
    expect(state.currentRound).toBe(1)
    expect(state.phase).toBe('idle')
    expect(state.confidence).toBe(85)
  })

  it('returns full dashboard data', () => {
    const engine = new TrinityEngine(dataDir)
    engine.performGenesis('dashboard-test')

    const dashboard = engine.getDashboard()
    expect(dashboard.isGenesisComplete).toBe(true)
    expect(dashboard.identity!.nodeId).toMatch(/^NC-/)
    expect(dashboard.economy!.balance).toBe(100)
    expect(dashboard.trinity.phase).toBe('idle')
    expect(dashboard.poo.totalTasks).toBe(0)
    expect(dashboard.debts.openCount).toBe(0)
    expect(dashboard.playbooks.count).toBe(0)
  })
})
