/**
 * GOAL.md + CONSTRAINTS.md Manager
 *
 * GOAL.md — The Trinity's current mission objective
 * CONSTRAINTS.md — Legal/safety boundaries (limited sovereignty principle)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { secureId } from '../utils/secure-id'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Goal {
  id: string
  title: string
  description: string
  priority: 'P0' | 'P1' | 'P2'
  status: 'active' | 'paused' | 'completed' | 'abandoned'
  createdAt: string
  updatedAt: string
  targetMetric?: string
  deadline?: string
  subGoals: SubGoal[]
}

export interface SubGoal {
  id: string
  title: string
  status: 'pending' | 'in_progress' | 'done'
  completedAt?: string
}

export interface Constraint {
  id: string
  category: 'legal' | 'safety' | 'financial' | 'ethical' | 'technical'
  rule: string
  severity: 'hard' | 'soft'
  description: string
}

export interface GoalState {
  currentGoal: Goal | null
  goalHistory: Goal[]
  constraints: Constraint[]
}

// ─── Default Constraints ──────────────────────────────────────────────────────

const DEFAULT_CONSTRAINTS: Constraint[] = [
  {
    id: 'C-LEGAL-001',
    category: 'legal',
    rule: 'MUST comply with local laws and regulations',
    severity: 'hard',
    description: 'All operations must be legal in the host jurisdiction. Violations trigger immediate halt.',
  },
  {
    id: 'C-SAFETY-001',
    category: 'safety',
    rule: 'Private key operations MUST run in sandbox isolation',
    severity: 'hard',
    description: 'All cryptographic signing and key operations require sandboxed execution environment.',
  },
  {
    id: 'C-SAFETY-002',
    category: 'safety',
    rule: 'High-risk operations REQUIRE host confirmation',
    severity: 'hard',
    description: 'Operations exceeding 30% of balance or involving external transfers need human host approval.',
  },
  {
    id: 'C-FINANCIAL-001',
    category: 'financial',
    rule: 'Maintain minimum reserve of 10 New.B',
    severity: 'hard',
    description: 'Never allow balance to drop below 10 New.B minimum reserve.',
  },
  {
    id: 'C-FINANCIAL-002',
    category: 'financial',
    rule: 'Single transaction MUST NOT exceed 30% of balance',
    severity: 'hard',
    description: 'No single expenditure may exceed 30% of current New.B holdings.',
  },
  {
    id: 'C-ETHICAL-001',
    category: 'ethical',
    rule: 'No deceptive practices in knowledge market',
    severity: 'hard',
    description: 'Playbooks must accurately represent their success rates and outcomes.',
  },
  {
    id: 'C-TECHNICAL-001',
    category: 'technical',
    rule: 'Confidence < 50% triggers auto-pause',
    severity: 'soft',
    description: 'When commander self-assesses confidence below 50%, system auto-pauses and notifies host.',
  },
  {
    id: 'C-TECHNICAL-002',
    category: 'technical',
    rule: 'All conclusions require H-level evidence tags',
    severity: 'soft',
    description: 'Every claim must carry an evidence level (H1-H4). H1/H2 cannot be written to long-term state.',
  },
]

// ─── Goal Manager ─────────────────────────────────────────────────────────────

export class GoalManager {
  private dataDir: string
  private state: GoalState

  constructor(dataDir: string) {
    this.dataDir = join(dataDir, 'trinity')
    this.state = this.loadState()
  }

  // ─── Goal Management ──────────────────────────────────────────────────────

  setGoal(params: Pick<Goal, 'title' | 'description' | 'priority' | 'targetMetric' | 'deadline'>): Goal {
    // Archive current goal if one exists
    if (this.state.currentGoal && this.state.currentGoal.status === 'active') {
      this.state.currentGoal.status = 'paused'
      this.state.currentGoal.updatedAt = new Date().toISOString()
      this.state.goalHistory.push(this.state.currentGoal)
    }

    const goal: Goal = {
      id: secureId('GOAL'),
      ...params,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      subGoals: [],
    }

    this.state.currentGoal = goal
    this.saveState()
    this.writeGoalMd()
    return goal
  }

  addSubGoal(title: string): SubGoal | null {
    if (!this.state.currentGoal) return null

    const sub: SubGoal = {
      id: secureId('SG'),
      title,
      status: 'pending',
    }

    this.state.currentGoal.subGoals.push(sub)
    this.state.currentGoal.updatedAt = new Date().toISOString()
    this.saveState()
    this.writeGoalMd()
    return sub
  }

  completeSubGoal(subGoalId: string): void {
    if (!this.state.currentGoal) return
    const sub = this.state.currentGoal.subGoals.find((s) => s.id === subGoalId)
    if (sub) {
      sub.status = 'done'
      sub.completedAt = new Date().toISOString()
      this.state.currentGoal.updatedAt = new Date().toISOString()

      // Check if all sub-goals complete → mark goal complete
      const allDone = this.state.currentGoal.subGoals.every((s) => s.status === 'done')
      if (allDone && this.state.currentGoal.subGoals.length > 0) {
        this.state.currentGoal.status = 'completed'
        this.state.goalHistory.push(this.state.currentGoal)
        this.state.currentGoal = null
      }

      this.saveState()
      this.writeGoalMd()
    }
  }

  completeGoal(): void {
    if (!this.state.currentGoal) return
    this.state.currentGoal.status = 'completed'
    this.state.currentGoal.updatedAt = new Date().toISOString()
    this.state.goalHistory.push(this.state.currentGoal)
    this.state.currentGoal = null
    this.saveState()
    this.writeGoalMd()
  }

  abandonGoal(): void {
    if (!this.state.currentGoal) return
    this.state.currentGoal.status = 'abandoned'
    this.state.currentGoal.updatedAt = new Date().toISOString()
    this.state.goalHistory.push(this.state.currentGoal)
    this.state.currentGoal = null
    this.saveState()
    this.writeGoalMd()
  }

  getCurrentGoal(): Goal | null {
    return this.state.currentGoal
  }

  getGoalHistory(): Goal[] {
    return this.state.goalHistory
  }

  // ─── Constraints ──────────────────────────────────────────────────────────

  getConstraints(): Constraint[] {
    return this.state.constraints
  }

  addConstraint(constraint: Omit<Constraint, 'id'>): Constraint {
    const full: Constraint = {
      id: `C-${constraint.category.toUpperCase()}-${Date.now().toString(36)}`,
      ...constraint,
    }
    this.state.constraints.push(full)
    this.saveState()
    this.writeConstraintsMd()
    return full
  }

  removeConstraint(id: string): void {
    this.state.constraints = this.state.constraints.filter((c) => c.id !== id)
    this.saveState()
    this.writeConstraintsMd()
  }

  /**
   * Check if an action violates any hard constraints
   */
  checkConstraints(action: { type: string; amount?: number; balance?: number; confidence?: number }): {
    allowed: boolean
    violations: Constraint[]
  } {
    const violations: Constraint[] = []

    for (const c of this.state.constraints) {
      // Check all constraint IDs regardless of severity for known auto-enforced rules
      if (c.id === 'C-FINANCIAL-001' && action.balance !== undefined && action.balance < 10) {
        violations.push(c)
      }
      if (c.id === 'C-FINANCIAL-002' && action.amount !== undefined && action.balance !== undefined) {
        if (action.amount > action.balance * 0.3) {
          violations.push(c)
        }
      }
      if (c.id === 'C-TECHNICAL-001' && action.confidence !== undefined && action.confidence < 50) {
        violations.push(c)
      }
    }

    return { allowed: violations.length === 0, violations }
  }

  // ─── Markdown Generators ──────────────────────────────────────────────────

  private writeGoalMd(): void {
    const goal = this.state.currentGoal
    const lines: string[] = ['# GOAL.md', '', '> Current mission objective for this Trinity node', '']

    if (!goal) {
      lines.push('## Status: No Active Goal', '', '_Set a goal to activate the Trinity cycle._', '')
    } else {
      lines.push(`## ${goal.title}`, '')
      lines.push(`**Priority**: ${goal.priority} | **Status**: ${goal.status}`)
      lines.push(`**Created**: ${goal.createdAt}`)
      if (goal.deadline) lines.push(`**Deadline**: ${goal.deadline}`)
      if (goal.targetMetric) lines.push(`**Target Metric**: ${goal.targetMetric}`)
      lines.push('', goal.description, '')

      if (goal.subGoals.length > 0) {
        lines.push('### Sub-Goals', '')
        for (const sg of goal.subGoals) {
          const check = sg.status === 'done' ? 'x' : ' '
          lines.push(`- [${check}] ${sg.title}`)
        }
        lines.push('')
      }
    }

    if (this.state.goalHistory.length > 0) {
      lines.push('---', '', '## History', '')
      for (const g of this.state.goalHistory.slice(-5).reverse()) {
        lines.push(`- **${g.title}** [${g.status}] — ${g.updatedAt}`)
      }
      lines.push('')
    }

    writeFileSync(join(this.dataDir, 'GOAL.md'), lines.join('\n'))
  }

  private writeConstraintsMd(): void {
    const lines = [
      '# CONSTRAINTS.md',
      '',
      '> Limited Sovereignty boundaries — hard constraints auto-enforced, soft constraints advisory',
      '',
    ]

    const categories = ['legal', 'safety', 'financial', 'ethical', 'technical'] as const
    for (const cat of categories) {
      const items = this.state.constraints.filter((c) => c.category === cat)
      if (items.length === 0) continue

      lines.push(`## ${cat.charAt(0).toUpperCase() + cat.slice(1)}`, '')
      for (const c of items) {
        const tag = c.severity === 'hard' ? '**[HARD]**' : '[soft]'
        lines.push(`- ${tag} \`${c.id}\`: ${c.rule}`)
        lines.push(`  > ${c.description}`)
      }
      lines.push('')
    }

    writeFileSync(join(this.dataDir, 'CONSTRAINTS.md'), lines.join('\n'))
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  private loadState(): GoalState {
    const path = join(this.dataDir, 'goal-state.json')
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf8'))
    }
    return {
      currentGoal: null,
      goalHistory: [],
      constraints: DEFAULT_CONSTRAINTS,
    }
  }

  private saveState(): void {
    writeFileSync(join(this.dataDir, 'goal-state.json'), JSON.stringify(this.state, null, 2))
  }
}
