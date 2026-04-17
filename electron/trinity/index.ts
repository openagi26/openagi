/**
 * OpenAGI Trinity Engine
 *
 * Core three-AI governance unit (Section 2 & 10 of v6.0 Spec)
 *
 * The Trinity:
 *   AI-1 (Expander / Strategist)  — Opportunity mining, strategy, script authoring
 *   AI-2 (Risk Controller / Auditor) — Code security, financial risk, anti-hallucination
 *   AI-3 (CFO / Decision Maker) — Private key holder, final decisions, asset management
 *
 * Collaboration Protocol:
 *   AI-1 proposes → AI-2 audits → AI-3 decides (with evidence levels H1-H4)
 *
 * Game Modes:
 *   Debate      — Adversarial argumentation
 *   Competition — Parallel proposals, best wins
 *   Refinement  — Iterative improvement
 *
 * Role rotation every 8 rounds
 */
import { EventEmitter } from 'node:events'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { IdentityManager, type NodeIdentity } from '../identity'
import { GovernanceManager, EvidenceLevel } from '../governance'
import { NewBEngine } from '../newb'
import { PoOVerifier, type ScoreComponents } from '../poo'
import { secureId } from '../utils/secure-id'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrinityRole = 'AI-1' | 'AI-2' | 'AI-3'
export type GameMode = 'debate' | 'competition' | 'refinement'
export type TrinityPhase = 'idle' | 'proposing' | 'auditing' | 'deciding' | 'executing' | 'verifying'

export interface TrinityState {
  phase: TrinityPhase
  currentRound: number
  gameMode: GameMode
  roleRotationCounter: number
  isRunning: boolean
  lastActivity: string
  /** Confidence level (0-100), auto-pause if < 50 */
  confidence: number
}

export interface Proposal {
  id: string
  round: number
  proposedBy: TrinityRole
  title: string
  description: string
  actionPlan: string[]
  estimatedValue: number
  estimatedCost: number
  evidenceLevel: EvidenceLevel
  supportingData: string[]
  timestamp: string
}

export interface AuditReport {
  id: string
  proposalId: string
  auditor: TrinityRole
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  findings: AuditFinding[]
  approved: boolean
  confidence: number
  timestamp: string
}

export interface AuditFinding {
  category: 'logic' | 'security' | 'financial' | 'hallucination' | 'compliance'
  severity: 'info' | 'warning' | 'error' | 'critical'
  description: string
  recommendation: string
}

export interface Decision {
  id: string
  proposalId: string
  auditId: string
  decidedBy: TrinityRole
  approved: boolean
  evidenceLevel: EvidenceLevel
  reasoning: string
  scoreComponents: ScoreComponents
  priorityScore: number
  timestamp: string
}

export interface TrinityRoundResult {
  round: number
  proposal: Proposal
  audit: AuditReport
  decision: Decision
  taskId?: string
  outcome?: 'executed' | 'discarded'
  newbReward: number
}

// ─── Role Prompts (Phase 0 Templates) ─────────────────────────────────────────

export const ROLE_PROMPTS: Record<TrinityRole, { name: string; title: string; systemPrompt: string }> = {
  'AI-1': {
    name: 'Expander',
    title: 'Strategic Expansion Officer',
    systemPrompt: `You are AI-1, the Expander/Strategist of a OpenAGI Trinity node.

CORE MISSION: Discover opportunities, design strategies, and write executable action plans.

RESPONSIBILITIES:
1. Scan for high-value opportunities (bounties, arbitrage, knowledge gaps, automation targets)
2. Design action plans with clear steps, expected ROI, and resource requirements
3. Estimate value in New.B terms and provide supporting evidence
4. Write executable scripts/code when the plan requires automation

CONSTRAINTS:
- Every claim must carry an evidence level (H1-H4)
- All financial estimates must include worst-case scenarios
- Proposals must include cost estimates and debt impact assessment
- You do NOT have final decision authority — that belongs to AI-3

OUTPUT FORMAT (strict JSON):
{
  "title": "string",
  "description": "string",
  "actionPlan": ["step1", "step2", ...],
  "estimatedValue": number,
  "estimatedCost": number,
  "evidenceLevel": "H1|H2|H3|H4",
  "supportingData": ["evidence1", "evidence2", ...]
}`,
  },

  'AI-2': {
    name: 'Risk Controller',
    title: 'Chief Audit & Risk Officer',
    systemPrompt: `You are AI-2, the Risk Controller/Auditor of a OpenAGI Trinity node.

CORE MISSION: Ruthlessly audit every proposal for security flaws, financial risks, and hallucination.

RESPONSIBILITIES:
1. Code security review — detect injection, overflow, race conditions, API key exposure
2. Financial risk assessment — verify ROI claims, stress-test worst cases
3. Hallucination detection — cross-reference claims against verifiable data
4. Compliance check — ensure operations stay within CONSTRAINTS.md boundaries

PERSONALITY: Cold, skeptical, evidence-driven. You reject any claim lacking H3+ evidence.

RULES:
- NEVER approve a proposal you haven't fully analyzed
- If you can't verify a claim, mark it as H1 (Hearsay) and flag it
- Financial projections without historical data = automatic H1
- Code without tests = automatic "security: warning"

OUTPUT FORMAT (strict JSON):
{
  "riskLevel": "low|medium|high|critical",
  "findings": [
    {
      "category": "logic|security|financial|hallucination|compliance",
      "severity": "info|warning|error|critical",
      "description": "string",
      "recommendation": "string"
    }
  ],
  "approved": boolean,
  "confidence": number (0-100)
}`,
  },

  'AI-3': {
    name: 'CFO',
    title: 'Chief Financial Officer & Decision Maker',
    systemPrompt: `You are AI-3, the CFO/Decision Maker of a OpenAGI Trinity node.

CORE MISSION: Make final resource allocation decisions. You hold the private key (soul of the node).

RESPONSIBILITIES:
1. Final GO/NO-GO decisions on proposals, incorporating AI-2's audit
2. New.B asset management — balance growth vs. risk
3. Knowledge market transactions — approve buy/sell of Playbooks
4. Sign critical operations with node identity

DECISION FRAMEWORK:
- Calculate PoO Priority Score:
  PriorityScore = (GoalFit×0.35 + PoO_Outcome×0.35 + EvidenceLevel×0.2) / (Cost + DebtImpact×0.1)
- Score >= 85: APPROVE and allocate resources
- Score 60-84: REQUEST REFINEMENT from AI-1
- Score < 60: REJECT and log reasoning
- Any "critical" finding from AI-2: AUTO-REJECT regardless of score

CONSTRAINTS:
- Never approve expenditure exceeding 30% of current New.B balance in a single transaction
- Confidence < 50%: AUTO-PAUSE and notify human host
- Maintain minimum reserve of 10 New.B at all times

OUTPUT FORMAT (strict JSON):
{
  "approved": boolean,
  "evidenceLevel": "H1|H2|H3|H4",
  "reasoning": "string",
  "scoreComponents": {
    "goalFit": number,
    "pooOutcome": number,
    "evidenceLevel": number,
    "cost": number,
    "debtImpact": number
  },
  "priorityScore": number
}`,
  },
}

// ─── Trinity Engine ───────────────────────────────────────────────────────────

export class TrinityEngine extends EventEmitter {
  private dataDir: string
  private state: TrinityState
  private history: TrinityRoundResult[] = []

  // Sub-systems
  public identity: IdentityManager
  public governance: GovernanceManager
  public economy: NewBEngine
  public verifier: PoOVerifier

  constructor(dataDir: string) {
    super()
    this.dataDir = join(dataDir, 'trinity')
    if (!existsSync(this.dataDir)) mkdirSync(this.dataDir, { recursive: true })

    // Initialize sub-systems
    this.identity = new IdentityManager(dataDir)
    this.governance = new GovernanceManager(dataDir)
    this.economy = new NewBEngine(dataDir)
    this.verifier = new PoOVerifier(dataDir)

    // Load or initialize state
    this.state = this.loadState()
    this.history = this.loadHistory()
  }

  // ─── Genesis ──────────────────────────────────────────────────────────────

  /**
   * Full Genesis Sequence — creates identity, initializes economy, activates governance
   */
  performGenesis(passphrase: string): {
    identity: NodeIdentity
    balance: number
    message: string
  } {
    // Step 1: Generate cryptographic identity
    const identity = this.identity.generateGenesis(passphrase)

    // Step 2: Initialize New.B economy with genesis reward
    const ledger = this.economy.initGenesis(identity.nodeId)

    // Step 3: Log genesis in governance
    this.governance.logProgress('Genesis Sequence completed — node activated', 'genesis')
    this.governance.appendEvidence({
      timestamp: new Date().toISOString(),
      source: 'AI-3',
      claim: `Node ${identity.nodeId} activated with ${ledger.balance} New.B`,
      evidenceLevel: EvidenceLevel.H1,
      supportingData: [`nodeId: ${identity.nodeId}`, `balance: ${ledger.balance}`],
    })

    // Step 4: Reset state
    this.state = {
      phase: 'idle',
      currentRound: 0,
      gameMode: 'refinement',
      roleRotationCounter: 0,
      isRunning: false,
      lastActivity: new Date().toISOString(),
      confidence: 100,
    }
    this.saveState()

    this.emit('genesis', { identity, balance: ledger.balance })

    return {
      identity,
      balance: ledger.balance,
      message: `Node ${identity.nodeId} is alive. Balance: ${ledger.balance} New.B. The Trinity awaits your GOAL.`,
    }
  }

  // ─── Trinity Cycle ────────────────────────────────────────────────────────

  /**
   * Run one full Trinity cycle: Propose → Audit → Decide → (Execute → Verify)
   *
   * @param goal - The current objective/task description
   * @param aiExecutor - Function that simulates AI role execution
   */
  async runCycle(
    goal: string,
    aiExecutor: (role: TrinityRole, prompt: string, context: string) => Promise<string>
  ): Promise<TrinityRoundResult> {
    this.state.currentRound++
    this.state.phase = 'proposing'
    this.state.lastActivity = new Date().toISOString()
    this.saveState()

    this.emit('phase', { phase: 'proposing', round: this.state.currentRound })

    // ── Phase 1: AI-1 Proposes ──────────────────────────────────────────

    const proposalContext = [
      `GOAL: ${goal}`,
      `Round: ${this.state.currentRound}`,
      `Game Mode: ${this.state.gameMode}`,
      `Current Balance: ${this.economy.getBalance()} New.B`,
      `Open Debts: ${this.governance.getDebts('open').length}`,
    ].join('\n')

    const proposalRaw = await aiExecutor('AI-1', ROLE_PROMPTS['AI-1'].systemPrompt, proposalContext)
    const proposal = this.parseProposal(proposalRaw)

    this.emit('proposal', proposal)

    // ── Phase 2: AI-2 Audits ────────────────────────────────────────────

    this.state.phase = 'auditing'
    this.saveState()
    this.emit('phase', { phase: 'auditing', round: this.state.currentRound })

    const auditContext = [
      `PROPOSAL TO AUDIT:`,
      JSON.stringify(proposal, null, 2),
      `---`,
      `Current Balance: ${this.economy.getBalance()} New.B`,
      `Recent Evidence: ${JSON.stringify(this.governance.getEvidence({ persistedOnly: true }).slice(-3))}`,
    ].join('\n')

    const auditRaw = await aiExecutor('AI-2', ROLE_PROMPTS['AI-2'].systemPrompt, auditContext)
    const audit = this.parseAudit(auditRaw, proposal.id)

    this.emit('audit', audit)

    // ── Phase 3: AI-3 Decides ───────────────────────────────────────────

    this.state.phase = 'deciding'
    this.saveState()
    this.emit('phase', { phase: 'deciding', round: this.state.currentRound })

    const decisionContext = [
      `PROPOSAL:`,
      JSON.stringify(proposal, null, 2),
      `---`,
      `AUDIT REPORT:`,
      JSON.stringify(audit, null, 2),
      `---`,
      `Current Balance: ${this.economy.getBalance()} New.B`,
      `Goal: ${goal}`,
    ].join('\n')

    const decisionRaw = await aiExecutor('AI-3', ROLE_PROMPTS['AI-3'].systemPrompt, decisionContext)
    const decision = this.parseDecision(decisionRaw, proposal.id, audit.id)

    this.emit('decision', decision)

    // ── PoO Verification ────────────────────────────────────────────────

    const pooTask = this.verifier.submitTask({
      title: proposal.title,
      description: proposal.description,
      proposedBy: proposal.proposedBy,
    })

    this.verifier.calculateScore(pooTask.id, decision.scoreComponents)
    const finalization = this.verifier.finalizeTask(pooTask.id)

    // Record in governance
    this.governance.appendEvidence({
      timestamp: new Date().toISOString(),
      source: decision.decidedBy,
      claim: `Round ${this.state.currentRound}: ${proposal.title} — Score: ${decision.priorityScore}, Outcome: ${finalization.action}`,
      evidenceLevel: decision.evidenceLevel,
      supportingData: [
        `score: ${decision.priorityScore}`,
        `action: ${finalization.action}`,
        `audit_risk: ${audit.riskLevel}`,
      ],
    })

    this.governance.recordValue({
      timestamp: new Date().toISOString(),
      taskId: pooTask.id,
      taskDescription: proposal.title,
      priorityScore: decision.priorityScore,
      components: decision.scoreComponents,
      outcome: finalization.action === 'execute' ? 'executed' : 'discarded',
      newbReward: finalization.reward,
    })

    // Issue reward if executed
    if (finalization.action === 'execute') {
      this.economy.issuePoOReward(pooTask.id, proposal.title)
    }

    // Log progress
    this.governance.logProgress(
      `Round ${this.state.currentRound}: "${proposal.title}" → ${finalization.action} (score: ${decision.priorityScore})`,
      'trinity-cycle'
    )

    // ── Role Rotation Check ─────────────────────────────────────────────

    this.state.roleRotationCounter++
    if (this.state.roleRotationCounter >= 8) {
      this.state.roleRotationCounter = 0
      this.rotateGameMode()
    }

    // ── Confidence Check ────────────────────────────────────────────────

    this.state.confidence = audit.confidence
    if (this.state.confidence < this.verifier.getConfig().confidencePauseThreshold) {
      this.state.isRunning = false
      this.emit('paused', { reason: 'low_confidence', confidence: this.state.confidence })
    }

    this.state.phase = 'idle'
    this.saveState()

    // Build result
    const result: TrinityRoundResult = {
      round: this.state.currentRound,
      proposal,
      audit,
      decision,
      taskId: pooTask.id,
      outcome: finalization.action === 'execute' ? 'executed' : 'discarded',
      newbReward: finalization.reward,
    }

    this.history.push(result)
    this.saveHistory()

    this.emit('cycle-complete', result)
    return result
  }

  // ─── Game Mode Management ─────────────────────────────────────────────────

  private rotateGameMode(): void {
    const modes: GameMode[] = ['debate', 'competition', 'refinement']
    const currentIndex = modes.indexOf(this.state.gameMode)
    this.state.gameMode = modes[(currentIndex + 1) % modes.length]
    this.emit('mode-change', { newMode: this.state.gameMode })
  }

  setGameMode(mode: GameMode): void {
    this.state.gameMode = mode
    this.saveState()
  }

  // ─── State ────────────────────────────────────────────────────────────────

  getState(): TrinityState {
    return { ...this.state }
  }

  getHistory(limit: number = 20): TrinityRoundResult[] {
    return this.history.slice(-limit)
  }

  getRolePrompts(): typeof ROLE_PROMPTS {
    return ROLE_PROMPTS
  }

  /**
   * Get full dashboard data for frontend
   */
  getDashboard() {
    const identity = this.identity.getIdentity()
    const ledger = this.economy.getLedger()
    const pooStats = this.verifier.getStats()
    const valueData = this.governance.getValueData()
    const openDebts = this.governance.getDebts('open')

    return {
      identity: identity ? {
        nodeId: identity.nodeId,
        creditScore: identity.creditScore,
        isActive: identity.isActive,
        createdAt: identity.createdAt,
      } : null,
      economy: ledger ? {
        balance: ledger.balance,
        totalEarned: ledger.totalEarned,
        totalSpent: ledger.totalSpent,
        totalStaked: ledger.totalStaked,
        halvingEpoch: ledger.halvingEpoch,
        currentRewardRate: ledger.currentRewardRate,
        recentTransactions: ledger.transactions.slice(-10),
      } : null,
      trinity: {
        ...this.state,
        totalRounds: this.history.length,
        recentResults: this.history.slice(-5),
      },
      poo: pooStats,
      value: {
        avgScore: valueData.summary.avgScore,
        totalTasks: valueData.summary.totalTasks,
        totalNewbEarned: valueData.summary.totalNewbEarned,
      },
      debts: {
        openCount: openDebts.length,
        totalCost: openDebts.reduce((sum, d) => sum + d.estimatedCost, 0),
      },
      playbooks: {
        count: this.governance.listPlaybooks().length,
      },
      isGenesisComplete: this.identity.hasGenesis() && this.economy.isInitialized(),
    }
  }

  // ─── Parsers ──────────────────────────────────────────────────────────────

  private parseProposal(raw: string): Proposal {
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      const data = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
      return {
        id: secureId('PROP'),
        round: this.state.currentRound,
        proposedBy: 'AI-1',
        title: data.title ?? 'Untitled Proposal',
        description: data.description ?? raw.substring(0, 200),
        actionPlan: data.actionPlan ?? [],
        estimatedValue: data.estimatedValue ?? 0,
        estimatedCost: data.estimatedCost ?? 0,
        evidenceLevel: data.evidenceLevel ?? EvidenceLevel.H3,
        supportingData: data.supportingData ?? [],
        timestamp: new Date().toISOString(),
      }
    } catch {
      return {
        id: `PROP-${Date.now()}`,
        round: this.state.currentRound,
        proposedBy: 'AI-1',
        title: 'Parse Error Proposal',
        description: raw.substring(0, 500),
        actionPlan: [],
        estimatedValue: 0,
        estimatedCost: 0,
        evidenceLevel: EvidenceLevel.H4,
        supportingData: [],
        timestamp: new Date().toISOString(),
      }
    }
  }

  private parseAudit(raw: string, proposalId: string): AuditReport {
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      const data = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
      return {
        id: secureId('AUDIT'),
        proposalId,
        auditor: 'AI-2',
        riskLevel: data.riskLevel ?? 'medium',
        findings: data.findings ?? [],
        approved: data.approved ?? false,
        confidence: data.confidence ?? 50,
        timestamp: new Date().toISOString(),
      }
    } catch {
      return {
        id: `AUDIT-${Date.now()}`,
        proposalId,
        auditor: 'AI-2',
        riskLevel: 'high',
        findings: [{ category: 'logic', severity: 'error', description: 'Failed to parse audit response', recommendation: 'Retry' }],
        approved: false,
        confidence: 20,
        timestamp: new Date().toISOString(),
      }
    }
  }

  private parseDecision(raw: string, proposalId: string, auditId: string): Decision {
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      const data = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
      return {
        id: secureId('DEC'),
        proposalId,
        auditId,
        decidedBy: 'AI-3',
        approved: data.approved ?? false,
        evidenceLevel: data.evidenceLevel ?? EvidenceLevel.H3,
        reasoning: data.reasoning ?? 'No reasoning provided',
        scoreComponents: data.scoreComponents ?? { goalFit: 50, pooOutcome: 50, evidenceLevel: 50, cost: 50, debtImpact: 50 },
        priorityScore: data.priorityScore ?? 0,
        timestamp: new Date().toISOString(),
      }
    } catch {
      return {
        id: `DEC-${Date.now()}`,
        proposalId,
        auditId,
        decidedBy: 'AI-3',
        approved: false,
        evidenceLevel: EvidenceLevel.H4,
        reasoning: 'Failed to parse decision — auto-rejected for safety',
        scoreComponents: { goalFit: 0, pooOutcome: 0, evidenceLevel: 25, cost: 100, debtImpact: 100 },
        priorityScore: 0,
        timestamp: new Date().toISOString(),
      }
    }
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  private loadState(): TrinityState {
    const path = join(this.dataDir, 'state.json')
    if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8'))
    return {
      phase: 'idle',
      currentRound: 0,
      gameMode: 'refinement',
      roleRotationCounter: 0,
      isRunning: false,
      lastActivity: new Date().toISOString(),
      confidence: 100,
    }
  }

  private saveState(): void {
    writeFileSync(join(this.dataDir, 'state.json'), JSON.stringify(this.state, null, 2))
  }

  private loadHistory(): TrinityRoundResult[] {
    const path = join(this.dataDir, 'history.json')
    if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8'))
    return []
  }

  private saveHistory(): void {
    writeFileSync(join(this.dataDir, 'history.json'), JSON.stringify(this.history, null, 2))
  }
}
