/**
 * OpenAGI Governance Files Manager
 *
 * Manages the 5 core governance files (Section 6 of v6.0 Spec):
 *   1. EVIDENCE.jsonl  — Conclusions with H1-H4 evidence levels + blockchain hash
 *   2. VALUE.json      — PoO Priority Score history
 *   3. DEBT.md         — Strategic debt list + Federated Debt Clearing
 *   4. PROGRESS.md     — Rolling log + entropy-reduction GC
 *   5. PLAYBOOKS/      — Success experience library (auctionable)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { secureId } from '../utils/secure-id'

// ─── Evidence Levels ──────────────────────────────────────────────────────────

export enum EvidenceLevel {
  /** H1: Reproducible — machine-verified, reproducible evidence (highest) */
  H1 = 'H1',
  /** H2: Corroborated — multi-source corroborated evidence */
  H2 = 'H2',
  /** H3: Reviewed — single-source, expert-reviewed evidence */
  H3 = 'H3',
  /** H4: Hypothesis — unverified hypothesis (lowest) */
  H4 = 'H4',
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvidenceEntry {
  id: string
  timestamp: string
  source: 'AI-1' | 'AI-2' | 'AI-3'
  claim: string
  evidenceLevel: EvidenceLevel
  supportingData: string[]
  hash: string
  /** Only H3/H4 entries can be written to long-term state */
  persisted: boolean
}

export interface ValueEntry {
  id: string
  timestamp: string
  taskId: string
  taskDescription: string
  priorityScore: number
  components: {
    goalFit: number
    pooOutcome: number
    evidenceLevel: number
    cost: number
    debtImpact: number
  }
  outcome: 'executed' | 'discarded' | 'pending'
  newbReward: number
}

export interface DebtItem {
  id: string
  description: string
  createdAt: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  estimatedCost: number
  status: 'open' | 'in_progress' | 'resolved' | 'federated'
  resolvedAt?: string
  federatedBounty?: number
}

export interface PlaybookEntry {
  id: string
  title: string
  description: string
  createdAt: string
  author: string
  evidenceLevel: EvidenceLevel
  successRate: number
  usageCount: number
  tags: string[]
  content: string
  /** New.B price for auction */
  auctionPrice?: number
  /** PoO-tracked outcomes from buyers */
  buyerOutcomes: Array<{ buyerId: string; outcome: number; timestamp: string }>
}

// ─── Governance Manager ───────────────────────────────────────────────────────

export class GovernanceManager {
  private dataDir: string

  constructor(dataDir: string) {
    this.dataDir = join(dataDir, 'governance')
    this.ensureStructure()
  }

  private ensureStructure(): void {
    const dirs = [this.dataDir, join(this.dataDir, 'playbooks')]
    for (const dir of dirs) {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    }

    // Initialize files if they don't exist
    const evidencePath = join(this.dataDir, 'EVIDENCE.jsonl')
    if (!existsSync(evidencePath)) writeFileSync(evidencePath, '')

    const valuePath = join(this.dataDir, 'VALUE.json')
    if (!existsSync(valuePath)) writeFileSync(valuePath, JSON.stringify({ entries: [], summary: { totalTasks: 0, avgScore: 0, totalNewbEarned: 0 } }, null, 2))

    const debtPath = join(this.dataDir, 'DEBT.md')
    if (!existsSync(debtPath)) {
      writeFileSync(debtPath, [
        '# Strategic Debt Ledger',
        '',
        '> Auto-managed by OpenAGI Governance Engine',
        '> Federated Debt Clearing runs every 7 days',
        '',
        '## Open Debts',
        '',
        '_No debts recorded yet._',
        '',
        '## Resolved',
        '',
        '_None._',
        '',
      ].join('\n'))
    }

    const progressPath = join(this.dataDir, 'PROGRESS.md')
    if (!existsSync(progressPath)) {
      writeFileSync(progressPath, [
        '# Progress Log',
        '',
        '> Rolling log with entropy-reduction GC (auto-compresses entries older than 7 days)',
        '',
        `## ${new Date().toISOString().split('T')[0]}`,
        '',
        '- **Genesis**: Governance files initialized',
        '',
      ].join('\n'))
    }
  }

  // ─── EVIDENCE.jsonl ───────────────────────────────────────────────────────

  appendEvidence(entry: Omit<EvidenceEntry, 'id' | 'hash' | 'persisted'>): EvidenceEntry {
    const id = secureId('EV')
    const hash = createHash('sha256')
      .update(JSON.stringify({ ...entry, id }))
      .digest('hex')

    const persisted = entry.evidenceLevel === EvidenceLevel.H1 || entry.evidenceLevel === EvidenceLevel.H2
    const full: EvidenceEntry = { ...entry, id, hash, persisted }

    appendFileSync(join(this.dataDir, 'EVIDENCE.jsonl'), JSON.stringify(full) + '\n')
    return full
  }

  getEvidence(filter?: { level?: EvidenceLevel; source?: string; persistedOnly?: boolean }): EvidenceEntry[] {
    const content = readFileSync(join(this.dataDir, 'EVIDENCE.jsonl'), 'utf8').trim()
    if (!content) return []

    let entries: EvidenceEntry[] = content.split('\n').map((line) => JSON.parse(line))

    if (filter?.level) entries = entries.filter((e) => e.evidenceLevel === filter.level)
    if (filter?.source) entries = entries.filter((e) => e.source === filter.source)
    if (filter?.persistedOnly) entries = entries.filter((e) => e.persisted)

    return entries
  }

  // ─── VALUE.json ───────────────────────────────────────────────────────────

  recordValue(entry: Omit<ValueEntry, 'id'>): ValueEntry {
    const id = secureId('VAL')
    const full: ValueEntry = { ...entry, id }

    const data = this.getValueData()
    data.entries.push(full)
    data.summary.totalTasks = data.entries.length
    data.summary.avgScore = data.entries.reduce((sum, e) => sum + e.priorityScore, 0) / data.entries.length
    data.summary.totalNewbEarned = data.entries.reduce((sum, e) => sum + e.newbReward, 0)

    writeFileSync(join(this.dataDir, 'VALUE.json'), JSON.stringify(data, null, 2))
    return full
  }

  getValueData(): { entries: ValueEntry[]; summary: { totalTasks: number; avgScore: number; totalNewbEarned: number } } {
    return JSON.parse(readFileSync(join(this.dataDir, 'VALUE.json'), 'utf8'))
  }

  // ─── DEBT.md ──────────────────────────────────────────────────────────────

  addDebt(debt: Omit<DebtItem, 'id' | 'status'>): DebtItem {
    const id = secureId('DEBT')
    const full: DebtItem = { ...debt, id, status: 'open' }

    // Store in JSON sidecar for programmatic access
    const debtDataPath = join(this.dataDir, 'debt-data.json')
    const debts: DebtItem[] = existsSync(debtDataPath) ? JSON.parse(readFileSync(debtDataPath, 'utf8')) : []
    debts.push(full)
    writeFileSync(debtDataPath, JSON.stringify(debts, null, 2))

    // Also update the human-readable markdown
    this.regenerateDebtMd(debts)
    return full
  }

  resolveDebt(debtId: string): void {
    const debtDataPath = join(this.dataDir, 'debt-data.json')
    if (!existsSync(debtDataPath)) return

    const debts: DebtItem[] = JSON.parse(readFileSync(debtDataPath, 'utf8'))
    const debt = debts.find((d) => d.id === debtId)
    if (debt) {
      debt.status = 'resolved'
      debt.resolvedAt = new Date().toISOString()
      writeFileSync(debtDataPath, JSON.stringify(debts, null, 2))
      this.regenerateDebtMd(debts)
    }
  }

  getDebts(status?: DebtItem['status']): DebtItem[] {
    const debtDataPath = join(this.dataDir, 'debt-data.json')
    if (!existsSync(debtDataPath)) return []
    const debts: DebtItem[] = JSON.parse(readFileSync(debtDataPath, 'utf8'))
    return status ? debts.filter((d) => d.status === status) : debts
  }

  /**
   * Federated Debt Clearing — auto-generates cleanup tasks every 7 days
   */
  runFederatedClearing(): DebtItem[] {
    const openDebts = this.getDebts('open')
    const federatedDebts = openDebts.filter((d) => {
      const ageMs = Date.now() - new Date(d.createdAt).getTime()
      return ageMs > 7 * 24 * 60 * 60 * 1000 // Older than 7 days
    })

    for (const debt of federatedDebts) {
      debt.status = 'federated'
      debt.federatedBounty = Math.ceil(debt.estimatedCost * 1.5)
    }

    if (federatedDebts.length > 0) {
      const debtDataPath = join(this.dataDir, 'debt-data.json')
      const allDebts: DebtItem[] = JSON.parse(readFileSync(debtDataPath, 'utf8'))
      // Apply federation status to the persisted copy by matching IDs
      for (const fd of federatedDebts) {
        const target = allDebts.find((d) => d.id === fd.id)
        if (target) {
          target.status = 'federated'
          target.federatedBounty = fd.federatedBounty
        }
      }
      writeFileSync(debtDataPath, JSON.stringify(allDebts, null, 2))
      this.regenerateDebtMd(allDebts)
    }

    return federatedDebts
  }

  private regenerateDebtMd(debts: DebtItem[]): void {
    const open = debts.filter((d) => d.status === 'open' || d.status === 'in_progress' || d.status === 'federated')
    const resolved = debts.filter((d) => d.status === 'resolved')

    const lines = [
      '# Strategic Debt Ledger',
      '',
      '> Auto-managed by OpenAGI Governance Engine',
      '> Federated Debt Clearing runs every 7 days',
      '',
      '## Open Debts',
      '',
    ]

    if (open.length === 0) {
      lines.push('_No open debts._', '')
    } else {
      for (const d of open) {
        const tag = d.status === 'federated' ? ` [FEDERATED: ${d.federatedBounty} New.B bounty]` : ''
        lines.push(`- **${d.id}** [${d.severity}] ${d.description} (cost: ${d.estimatedCost} New.B)${tag}`)
      }
      lines.push('')
    }

    lines.push('## Resolved', '')
    if (resolved.length === 0) {
      lines.push('_None._', '')
    } else {
      for (const d of resolved) {
        lines.push(`- ~~${d.id}~~ ${d.description} — resolved ${d.resolvedAt}`)
      }
      lines.push('')
    }

    writeFileSync(join(this.dataDir, 'DEBT.md'), lines.join('\n'))
  }

  // ─── PROGRESS.md ──────────────────────────────────────────────────────────

  logProgress(message: string, category: string = 'system'): void {
    const timestamp = new Date().toISOString()
    const line = `- **[${category}]** ${timestamp}: ${message}\n`
    appendFileSync(join(this.dataDir, 'PROGRESS.md'), line)
  }

  /**
   * Entropy-reduction GC — compress entries older than 7 days into summaries
   */
  runEntropyGC(): void {
    const progressPath = join(this.dataDir, 'PROGRESS.md')
    const content = readFileSync(progressPath, 'utf8')
    const lines = content.split('\n')

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const headerLines: string[] = []
    const recentLines: string[] = []
    let oldCount = 0

    for (const line of lines) {
      // Detect timestamp in log entries
      const isoMatch = line.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)
      if (isoMatch) {
        const entryDate = new Date(isoMatch[0])
        if (entryDate < sevenDaysAgo) {
          oldCount++
          continue
        }
      }

      if (line.startsWith('#') || line.startsWith('>') || line.trim() === '') {
        headerLines.push(line)
      } else {
        recentLines.push(line)
      }
    }

    if (oldCount > 0) {
      const compressed = [
        ...headerLines,
        '',
        `> GC: Compressed ${oldCount} entries older than 7 days at ${new Date().toISOString()}`,
        '',
        ...recentLines,
        '',
      ]
      writeFileSync(progressPath, compressed.join('\n'))
    }
  }

  // ─── PLAYBOOKS/ ───────────────────────────────────────────────────────────

  savePlaybook(playbook: Omit<PlaybookEntry, 'id' | 'usageCount' | 'buyerOutcomes'>): PlaybookEntry {
    const id = secureId('PB')
    const full: PlaybookEntry = { ...playbook, id, usageCount: 0, buyerOutcomes: [] }

    const filePath = join(this.dataDir, 'playbooks', `${id}.json`)
    writeFileSync(filePath, JSON.stringify(full, null, 2))
    return full
  }

  getPlaybook(id: string): PlaybookEntry | null {
    const filePath = join(this.dataDir, 'playbooks', `${id}.json`)
    if (!existsSync(filePath)) return null
    return JSON.parse(readFileSync(filePath, 'utf8'))
  }

  listPlaybooks(): PlaybookEntry[] {
    const playbooksDir = join(this.dataDir, 'playbooks')
    if (!existsSync(playbooksDir)) return []

    return readdirSync(playbooksDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(join(playbooksDir, f), 'utf8')))
      .sort((a, b) => b.successRate - a.successRate)
  }

  recordPlaybookOutcome(playbookId: string, buyerId: string, outcome: number): void {
    const playbook = this.getPlaybook(playbookId)
    if (!playbook) return

    playbook.usageCount++
    playbook.buyerOutcomes.push({ buyerId, outcome, timestamp: new Date().toISOString() })

    // Recalculate success rate
    const successCount = playbook.buyerOutcomes.filter((o) => o.outcome >= 85).length
    playbook.successRate = playbook.buyerOutcomes.length > 0
      ? (successCount / playbook.buyerOutcomes.length) * 100
      : 0

    writeFileSync(join(this.dataDir, 'playbooks', `${playbookId}.json`), JSON.stringify(playbook, null, 2))
  }
}
