/**
 * Probe S4: Trinity Three-AI Collaboration Minimal Cycle
 * Tests AI-1(Propose) → AI-2(Audit) → AI-3(Decide) flow
 * Uses mock AI executor to simulate the full cycle
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync as _rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes, createHash, generateKeyPairSync, createCipheriv, scryptSync } from 'node:crypto'

const PROBE_DIR = join(tmpdir(), 'openagi-probe-s4')

const EvidenceLevel = { H1: 'H1', H2: 'H2', H3: 'H3', H4: 'H4' } as const

function secureId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString('hex')}`
}

class IdentityManager {
  private dataDir: string
  private identity: Record<string, unknown> | null = null

  constructor(dataDir: string) {
    this.dataDir = join(dataDir, 'identity')
    mkdirSync(this.dataDir, { recursive: true })
  }

  generateGenesis(passphrase: string) {
    if (this.hasGenesis()) throw new Error('Identity already exists')
    const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    })
    const pubKeyHash = createHash('sha256').update(publicKey).digest()
    const nodeId = 'NC-' + pubKeyHash.subarray(0, 20).toString('hex')

    const salt = randomBytes(32)
    const key = scryptSync(passphrase, salt, 32)
    const iv = randomBytes(16)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(privateKey, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()

    writeFileSync(join(this.dataDir, 'keystore.json'), JSON.stringify({
      version: 1, nodeId, publicKey,
      encryptedPrivateKey: Buffer.concat([encrypted, authTag]).toString('base64'),
      iv: iv.toString('hex'), salt: salt.toString('hex'),
      createdAt: new Date().toISOString(),
    }, null, 2))

    this.identity = {
      nodeId, publicKey, createdAt: new Date().toISOString(),
      genesisBlock: 0, creditScore: 100, isActive: true,
    }
    writeFileSync(join(this.dataDir, 'identity.json'), JSON.stringify(this.identity, null, 2))
    return this.identity
  }

  hasGenesis() { return existsSync(join(this.dataDir, 'keystore.json')) }
  getIdentity() {
    if (this.identity) return this.identity
    const p = join(this.dataDir, 'identity.json')
    if (!existsSync(p)) return null
    this.identity = JSON.parse(readFileSync(p, 'utf8'))
    return this.identity
  }
}

class GovernanceManager {
  private evidence: Record<string, unknown>[] = []
  private valueData: Record<string, unknown>[] = []
  private playbooks: Record<string, unknown>[] = []

  constructor(_dataDir: string) {
    mkdirSync(join(_dataDir, 'governance'), { recursive: true })
  }

  logProgress(_msg: string, _source: string) {}
  appendEvidence(entry: Record<string, unknown>) { this.evidence.push({ ...entry, id: secureId('EVI'), hash: createHash('sha256').update(JSON.stringify(entry)).digest('hex'), persisted: entry.evidenceLevel !== 'H1' }) }
  recordValue(entry: Record<string, unknown>) { this.valueData.push(entry) }
  getEvidence(_opts?: Record<string, unknown>) { return this.evidence }
  getDebts(_status?: string) { return [] }
  listPlaybooks() { return this.playbooks }
  getValueData() { return { summary: { avgScore: 0, totalTasks: 0, totalNewbEarned: 0 } } }
}

class NewBEngine {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ledger: any = null

  constructor(_dataDir: string) {}

  initGenesis(nodeId: string) {
    this.ledger = {
      version: 1 as const, nodeId, balance: 100, totalEarned: 100, totalSpent: 0,
      totalStaked: 0, halvingEpoch: 1, currentRewardRate: 10,
      transactions: [{ id: secureId('TX'), timestamp: new Date().toISOString(), type: 'genesis' as const, amount: 100, balance: 100, description: 'Genesis reward' }],
      createdAt: new Date().toISOString(), lastUpdated: new Date().toISOString(),
    }
    return this.ledger
  }

  getBalance() { return this.ledger?.balance ?? 0 }
  getLedger() { return this.ledger }
  isInitialized() { return this.ledger !== null }
  issuePoOReward(taskId: string, desc: string) {
    if (!this.ledger) return
    const reward = this.ledger.currentRewardRate
    this.ledger.balance += reward
    this.ledger.totalEarned += reward
    this.ledger.transactions.push({ id: secureId('TX'), timestamp: new Date().toISOString(), type: 'poo_reward' as const, amount: reward, balance: this.ledger.balance, description: desc, reference: taskId })
  }
}

 
class PoOVerifier {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private tasks: Map<string, any> = new Map()
  private config = { confidencePauseThreshold: 50 }

   
  submitTask(task: Record<string, unknown>) {
    const id = secureId('POO')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = { id, ...task, createdAt: new Date().toISOString(), status: 'pending' as const, newbReward: 0 } as any
    this.tasks.set(id, t)
    return t
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  calculateScore(id: string, components: any) {
    const t = this.tasks.get(id)
    if (!t) return
    const numerator = (components.goalFit * 0.35 + components.pooOutcome * 0.35 + components.evidenceLevel * 0.2)
    const denominator = Math.max(1, components.cost + components.debtImpact * 0.1)
    const score = Math.min(100, Math.max(0, (numerator / denominator) * 100))
    t.priorityScore = Math.round(score * 100) / 100
    t.scoreComponents = components
  }

  finalizeTask(id: string) {
    const t = this.tasks.get(id)
    if (!t) return { action: 'discard', reward: 0 }
    const score = t.priorityScore ?? 0
    if (score >= 85) {
      t.status = 'verified'
      t.newbReward = 10
      return { action: 'execute', reward: 10 }
    }
    t.status = 'discarded'
    return { action: 'discard', reward: 0 }
  }

  getStats() { return { total: this.tasks.size, verified: 0, discarded: 0 } }
  getConfig() { return this.config }
}

async function probeTrinityCycle() {
  console.log('=== S4: Trinity Three-AI Cycle Probe ===\n')

  if (existsSync(PROBE_DIR)) _rmSync(PROBE_DIR, { recursive: true, force: true })
  mkdirSync(PROBE_DIR, { recursive: true })

  const identity = new IdentityManager(PROBE_DIR)
  new GovernanceManager(PROBE_DIR)
  const economy = new NewBEngine(PROBE_DIR)

  console.log('[1] Running Genesis sequence...')
  const nodeIdentity = identity.generateGenesis('probe-test-passphrase')
  const ledger = economy.initGenesis(nodeIdentity.nodeId as string)
  console.log(`    Node ID: ${nodeIdentity.nodeId}`)
  console.log(`    Genesis balance: ${ledger.balance} New.B`)

  console.log('\n[2] AI-1 (Expander) proposing...')
  const proposal = {
    id: secureId('PROP'),
    round: 1,
    proposedBy: 'AI-1' as const,
    title: 'Test Opportunity: API Integration Optimization',
    description: 'Refactor API client to reduce latency by 40%',
    actionPlan: ['Profile current API calls', 'Implement connection pooling', 'Add response caching'],
    estimatedValue: 50,
    estimatedCost: 10,
    evidenceLevel: EvidenceLevel.H3,
    supportingData: ['benchmark_data: 120ms avg latency', 'cache_hit_rate_potential: 60%'],
    timestamp: new Date().toISOString(),
  }
  console.log(`    Proposal: "${proposal.title}"`)
  console.log(`    Value: ${proposal.estimatedValue} New.B, Cost: ${proposal.estimatedCost} New.B`)
  console.log(`    Evidence: ${proposal.evidenceLevel}`)

  console.log('\n[3] AI-2 (Risk Controller) auditing...')
  const audit = {
    id: secureId('AUDIT'),
    proposalId: proposal.id,
    auditor: 'AI-2' as const,
    riskLevel: 'low' as const,
    findings: [
      { category: 'security' as const, severity: 'info' as const, description: 'Cache invalidation strategy needed', recommendation: 'Add TTL-based cache expiry' },
    ],
    approved: true,
    confidence: 82,
    timestamp: new Date().toISOString(),
  }
  console.log(`    Risk Level: ${audit.riskLevel}`)
  console.log(`    Approved: ${audit.approved}`)
  console.log(`    Confidence: ${audit.confidence}%`)
  console.log(`    Findings: ${audit.findings.length}`)

  console.log('\n[4] AI-3 (CFO) deciding...')
  const scoreComponents = { goalFit: 90, pooOutcome: 85, evidenceLevel: 75, cost: 20, debtImpact: 10 }
  const numerator = (scoreComponents.goalFit * 0.35 + scoreComponents.pooOutcome * 0.35 + scoreComponents.evidenceLevel * 0.2)
  const denominator = Math.max(1, scoreComponents.cost + scoreComponents.debtImpact * 0.1)
  const priorityScore = Math.round(Math.min(100, Math.max(0, (numerator / denominator) * 100)))
  const decision = {
    id: secureId('DEC'),
    proposalId: proposal.id,
    auditId: audit.id,
    decidedBy: 'AI-3' as const,
    approved: priorityScore >= 85 && audit.approved,
    evidenceLevel: EvidenceLevel.H3,
    reasoning: `PriorityScore ${priorityScore} >= 85, audit approved. Proceed.`,
    scoreComponents,
    priorityScore,
    timestamp: new Date().toISOString(),
  }
  console.log(`    Priority Score: ${priorityScore}`)
  console.log(`    Decision: ${decision.approved ? 'APPROVED' : 'REJECTED'}`)
  console.log(`    Reasoning: ${decision.reasoning}`)

  console.log('\n[5] PoO verification...')
  const verifier = new PoOVerifier()
  const pooTask = verifier.submitTask({ title: proposal.title, description: proposal.description, proposedBy: proposal.proposedBy })
  verifier.calculateScore(pooTask.id, decision.scoreComponents)
  const finalization = verifier.finalizeTask(pooTask.id)
  console.log(`    Action: ${finalization.action}`)
  console.log(`    Reward: ${finalization.reward} New.B`)

  if (finalization.action === 'execute') {
    economy.issuePoOReward(pooTask.id, proposal.title)
  }

  console.log('\n[6] Final state verification...')
  console.log(`    Balance: ${economy.getBalance()} New.B`)
  console.log(`    Identity active: ${nodeIdentity.isActive}`)
  console.log(`    Credit score: ${nodeIdentity.creditScore}`)

  const cycleOk = decision.approved && finalization.action === 'execute' && economy.getBalance() > 100
  console.log(`\n=== S4 RESULT: ${cycleOk ? 'PASS' : 'FAIL'} ===`)
  console.log(`    Full cycle: AI-1 Propose → AI-2 Audit → AI-3 Decide → PoO Verify → Reward`)
  console.log(`    Score: ${priorityScore}, Action: ${finalization.action}, Balance: ${economy.getBalance()}`)

  try { _rmSync(PROBE_DIR, { recursive: true, force: true }) } catch { /* cleanup */ }
}

probeTrinityCycle().catch(err => {
  console.error('Probe S4 failed:', err)
  process.exit(1)
})
