/**
 * GoalManager + AutoRunner Tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { GoalManager } from '../../electron/trinity/goal-manager'

let dataDir: string

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'openagi-goal-test-'))
  mkdirSync(join(dataDir, 'trinity'), { recursive: true })
})

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true })
})

describe('GoalManager', () => {
  it('sets and retrieves a goal', () => {
    const mgr = new GoalManager(dataDir)
    const goal = mgr.setGoal({
      title: 'Find profitable GitHub bounties',
      description: 'Scan GitHub for bounties > $100 and complete them',
      priority: 'P0',
    })

    expect(goal.id).toMatch(/^GOAL-/)
    expect(goal.title).toBe('Find profitable GitHub bounties')
    expect(goal.status).toBe('active')
    expect(goal.priority).toBe('P0')

    expect(mgr.getCurrentGoal()).not.toBeNull()
    expect(mgr.getCurrentGoal()!.id).toBe(goal.id)
  })

  it('manages sub-goals', () => {
    const mgr = new GoalManager(dataDir)
    mgr.setGoal({ title: 'Test', description: 'Test', priority: 'P1' })

    const sg = mgr.addSubGoal('Scan for bounties')
    expect(sg).not.toBeNull()
    expect(sg!.status).toBe('pending')

    const sg2 = mgr.addSubGoal('Analyze profitability')
    expect(mgr.getCurrentGoal()!.subGoals).toHaveLength(2)

    // Complete all sub-goals should auto-complete goal
    mgr.completeSubGoal(sg!.id)
    mgr.completeSubGoal(sg2!.id)

    // Goal should now be completed and archived
    expect(mgr.getCurrentGoal()).toBeNull()
    expect(mgr.getGoalHistory()).toHaveLength(1)
    expect(mgr.getGoalHistory()[0].status).toBe('completed')
  })

  it('archives current goal when setting a new one', () => {
    const mgr = new GoalManager(dataDir)
    mgr.setGoal({ title: 'Goal 1', description: 'D1', priority: 'P1' })
    mgr.setGoal({ title: 'Goal 2', description: 'D2', priority: 'P0' })

    expect(mgr.getCurrentGoal()!.title).toBe('Goal 2')
    expect(mgr.getGoalHistory()).toHaveLength(1)
    expect(mgr.getGoalHistory()[0].title).toBe('Goal 1')
    expect(mgr.getGoalHistory()[0].status).toBe('paused')
  })

  it('abandons a goal', () => {
    const mgr = new GoalManager(dataDir)
    mgr.setGoal({ title: 'Doomed', description: 'Will fail', priority: 'P2' })
    mgr.abandonGoal()

    expect(mgr.getCurrentGoal()).toBeNull()
    expect(mgr.getGoalHistory()[0].status).toBe('abandoned')
  })

  it('initializes with default constraints', () => {
    const mgr = new GoalManager(dataDir)
    const constraints = mgr.getConstraints()

    expect(constraints.length).toBeGreaterThanOrEqual(7) // 7 defaults
    expect(constraints.some((c) => c.id === 'C-FINANCIAL-001')).toBe(true)
    expect(constraints.some((c) => c.id === 'C-SAFETY-001')).toBe(true)
  })

  it('checks hard constraints correctly', () => {
    const mgr = new GoalManager(dataDir)

    // Balance below minimum
    const check1 = mgr.checkConstraints({ type: 'transfer', balance: 5 })
    expect(check1.allowed).toBe(false)
    expect(check1.violations.some((v) => v.id === 'C-FINANCIAL-001')).toBe(true)

    // Spending over 30%
    const check2 = mgr.checkConstraints({ type: 'transfer', amount: 40, balance: 100 })
    expect(check2.allowed).toBe(false)
    expect(check2.violations.some((v) => v.id === 'C-FINANCIAL-002')).toBe(true)

    // Low confidence
    const check3 = mgr.checkConstraints({ type: 'cycle', confidence: 30 })
    expect(check3.allowed).toBe(false)

    // All good
    const check4 = mgr.checkConstraints({ type: 'cycle', balance: 100, confidence: 80, amount: 10 })
    expect(check4.allowed).toBe(true)
  })

  it('adds and removes custom constraints', () => {
    const mgr = new GoalManager(dataDir)
    const initial = mgr.getConstraints().length

    const c = mgr.addConstraint({
      category: 'ethical',
      rule: 'No spam',
      severity: 'hard',
      description: 'Do not send unsolicited messages',
    })

    expect(mgr.getConstraints()).toHaveLength(initial + 1)

    mgr.removeConstraint(c.id)
    expect(mgr.getConstraints()).toHaveLength(initial)
  })
})
