/**
 * Goal Management Page
 * Set, manage, and track Trinity mission objectives
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Target,
  Plus,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  History,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { hostApiFetch } from '@/lib/host-api'
import { cn } from '@/lib/utils'

interface Goal {
  id: string; title: string; description: string; priority: string
  status: string; createdAt: string; updatedAt: string
  targetMetric?: string; deadline?: string
  subGoals: { id: string; title: string; status: string; completedAt?: string }[]
}

interface RunnerState {
  isRunning: boolean; cyclesCompleted: number; consecutiveFailures: number
  lastCycleAt: string | null; lastError: string | null
  budgetMode: string; pauseReason: string | null
}

export default function GoalPage() {
  const { t } = useTranslation('trinity')
  const [currentGoal, setCurrentGoal] = useState<Goal | null>(null)
  const [goalHistory, setGoalHistory] = useState<Goal[]>([])
  const [runnerState, setRunnerState] = useState<RunnerState | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', priority: 'P1', targetMetric: '', deadline: '' })
  const [subGoalTitle, setSubGoalTitle] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmAbandon, setConfirmAbandon] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    try {
      const goalData: any = await hostApiFetch('/api/trinity/goal')
      setCurrentGoal(goalData.current)
      setGoalHistory(goalData.history ?? [])
      setRunnerState(await hostApiFetch('/api/trinity/runner/state'))
    } catch (err) {
      console.error('loadAll failed:', err)
      toast.error(t('common.error') + ': ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  async function createGoal() {
    if (!form.title || !form.description) return
    setActionLoading('createGoal')
    try {
      await hostApiFetch('/api/trinity/goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      toast.success(t('toast.goalCreated'))
      setShowForm(false)
      setForm({ title: '', description: '', priority: 'P1', targetMetric: '', deadline: '' })
      loadAll()
    } catch (err) {
      console.error('createGoal failed:', err)
      toast.error(t('common.error') + ': ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setActionLoading(null)
    }
  }

  async function addSubGoal() {
    if (!subGoalTitle) return
    setActionLoading('addSubGoal')
    try {
      await hostApiFetch('/api/trinity/goal/sub-goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: subGoalTitle }),
      })
      toast.success(t('toast.subGoalAdded'))
      setSubGoalTitle('')
      loadAll()
    } catch (err) {
      console.error('addSubGoal failed:', err)
      toast.error(t('common.error') + ': ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setActionLoading(null)
    }
  }

  async function toggleRunner() {
    setActionLoading('toggleRunner')
    try {
      if (runnerState?.isRunning) {
        await hostApiFetch('/api/trinity/runner/stop', { method: 'POST' })
        toast.success(t('toast.runnerStopped'))
      } else {
        await hostApiFetch('/api/trinity/runner/start', { method: 'POST' })
        toast.success(t('toast.runnerStarted'))
      }
      loadAll()
    } catch (err) {
      console.error('toggleRunner failed:', err)
      toast.error(t('common.error') + ': ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setActionLoading(null)
    }
  }

  async function runOnce() {
    setActionLoading('runOnce')
    try {
      await hostApiFetch('/api/trinity/runner/run-once', { method: 'POST' })
      toast.success(t('toast.runOnceComplete'))
      loadAll()
    } catch (err) {
      console.error('runOnce failed:', err)
      toast.error(t('common.error') + ': ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setActionLoading(null)
    }
  }

  async function completeGoal() {
    setActionLoading('completeGoal')
    try {
      await hostApiFetch('/api/trinity/goal/complete', { method: 'POST' })
      toast.success(t('toast.goalCompleted'))
      loadAll()
    } catch (err) {
      console.error('completeGoal failed:', err)
      toast.error(t('common.error') + ': ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setActionLoading(null)
    }
  }

  async function abandonGoal() {
    setActionLoading('abandonGoal')
    try {
      await hostApiFetch('/api/trinity/goal/abandon', { method: 'POST' })
      toast.success(t('toast.goalAbandoned'))
      loadAll()
    } catch (err) {
      console.error('abandonGoal failed:', err)
      toast.error(t('common.error') + ': ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setActionLoading(null)
      setConfirmAbandon(false)
    }
  }

  const priorityColors: Record<string, string> = {
    P0: 'bg-red-500/20 text-red-400',
    P1: 'bg-yellow-500/20 text-yellow-400',
    P2: 'bg-blue-500/20 text-blue-400',
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('goal.missionControl')}</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={runOnce} disabled={!currentGoal || actionLoading === 'runOnce'}>
            <Play className="w-4 h-4 mr-1" /> {t('goal.runOnce')}
          </Button>
          <Button
            size="sm"
            onClick={toggleRunner}
            disabled={!currentGoal || actionLoading === 'toggleRunner'}
            className={cn(
              runnerState?.isRunning
                ? 'bg-red-500/80 hover:bg-red-600 text-white'
                : 'bg-green-500/80 hover:bg-green-600 text-white'
            )}
          >
            {runnerState?.isRunning ? <><Pause className="w-4 h-4 mr-1" /> {t('goal.stopAuto')}</> : <><Play className="w-4 h-4 mr-1" /> {t('goal.startAuto')}</>}
          </Button>
        </div>
      </div>

      {/* Runner Status */}
      {runnerState && (
        <div className="glass-card-purple rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('w-3 h-3 rounded-full', runnerState.isRunning ? 'bg-green-400 animate-pulse' : 'bg-foreground/20')} />
              <span className="text-sm font-medium text-foreground">
                {runnerState.isRunning ? t('runner.autoRunning') : t('runner.stopped')}
              </span>
              <Badge variant="outline" className="text-xs">{t('goal.budgetMode', { mode: runnerState.budgetMode })}</Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-foreground/50">
              <span>{t('runner.cycles')}: {runnerState.cyclesCompleted}</span>
              {runnerState.lastCycleAt && <span>{t('runner.lastCycle')}: {new Date(runnerState.lastCycleAt).toLocaleTimeString()}</span>}
              {runnerState.consecutiveFailures > 0 && (
                <span className="text-red-400">{t('runner.failures')}: {runnerState.consecutiveFailures}</span>
              )}
            </div>
          </div>
          {runnerState.pauseReason && (
            <p className="text-xs text-yellow-400 mt-2">{runnerState.pauseReason}</p>
          )}
          {runnerState.lastError && (
            <p className="text-xs text-red-400 mt-1">{t('goal.error')}: {runnerState.lastError}</p>
          )}
        </div>
      )}

      {/* Current Goal */}
      {currentGoal ? (
        <div className="glass-card-purple rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-bold text-foreground">{currentGoal.title}</h2>
                <Badge className={cn('text-xs', priorityColors[currentGoal.priority] ?? '')}>{currentGoal.priority}</Badge>
              </div>
              <p className="text-sm text-foreground/70">{currentGoal.description}</p>
              {currentGoal.targetMetric && <p className="text-xs text-foreground/50 mt-1">{t('goal.targetMetric')}: {currentGoal.targetMetric}</p>}
              {currentGoal.deadline && <p className="text-xs text-foreground/50">{t('goal.deadline')}: {currentGoal.deadline}</p>}
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={completeGoal} disabled={actionLoading === 'completeGoal'}>
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmAbandon(true)} disabled={actionLoading === 'abandonGoal'}>
                <XCircle className="w-4 h-4 text-red-400" />
              </Button>
            </div>
          </div>

          {/* Sub-Goals */}
          <div>
            <h3 className="text-sm font-semibold text-foreground/70 mb-2">{t('goal.subGoals')}</h3>
            {currentGoal.subGoals.map((sg) => (
              <div key={sg.id} className="flex items-center gap-2 py-1">
                <div className={cn('w-4 h-4 rounded border flex items-center justify-center',
                  sg.status === 'done' ? 'bg-green-500/20 border-green-500' : 'border-foreground/20'
                )}>
                  {sg.status === 'done' && <CheckCircle2 className="w-3 h-3 text-green-400" />}
                </div>
                <span className={cn('text-sm', sg.status === 'done' ? 'text-foreground/40 line-through' : 'text-foreground/80')}>
                  {sg.title}
                </span>
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                placeholder={t('goal.addSubGoal')}
                value={subGoalTitle}
                onChange={(e) => setSubGoalTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSubGoal()}
                className="flex-1 px-3 py-1.5 text-sm rounded-md bg-background/50 border border-border text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
              />
              <Button size="sm" variant="outline" onClick={addSubGoal} disabled={!subGoalTitle || actionLoading === 'addSubGoal'}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card-purple rounded-xl p-8 text-center">
          <Target className="w-12 h-12 text-foreground/20 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-foreground/60">{t('goal.noGoal')}</h2>
          <p className="text-sm text-foreground/40 mb-4">{t('goal.noGoalHint')}</p>
          <Button onClick={() => setShowForm(true)} className="bg-purple-600 hover:bg-purple-700 text-white">
            <Plus className="w-4 h-4 mr-1" /> {t('goal.setGoal')}
          </Button>
        </div>
      )}

      {/* New Goal Form */}
      {showForm && (
        <div className="glass-card-purple rounded-xl p-5 space-y-3">
          <h3 className="text-lg font-semibold text-foreground">{t('goal.newMission')}</h3>
          <input
            type="text" placeholder={t('goal.goalTitle')}
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 rounded-md bg-background/50 border border-border text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
          />
          <textarea
            placeholder={t('goal.description')}
            value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 rounded-md bg-background/50 border border-border text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 resize-none"
          />
          <div className="grid grid-cols-3 gap-3">
            <select
              value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="px-3 py-2 rounded-md bg-background/50 border border-border text-foreground text-sm"
            >
              <option value="P0">{t('goal.priority_p0')}</option>
              <option value="P1">{t('goal.priority_p1')}</option>
              <option value="P2">{t('goal.priority_p2')}</option>
            </select>
            <input
              type="text" placeholder={t('goal.targetMetricOptional')}
              value={form.targetMetric} onChange={(e) => setForm({ ...form, targetMetric: e.target.value })}
              className="px-3 py-2 rounded-md bg-background/50 border border-border text-foreground text-sm placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
            />
            <input
              type="date"
              value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              className="px-3 py-2 rounded-md bg-background/50 border border-border text-foreground text-sm"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>{t('goal.cancel')}</Button>
            <Button size="sm" onClick={createGoal} disabled={!form.title || !form.description || actionLoading === 'createGoal'}
              className="bg-purple-600 hover:bg-purple-700 text-white">
              {t('goal.activate')}
            </Button>
          </div>
        </div>
      )}

      {/* Goal History */}
      {goalHistory.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <History className="w-5 h-5" /> {t('goal.history')}
          </h2>
          <div className="space-y-2">
            {goalHistory.slice().reverse().map((g) => (
              <div key={g.id} className="glass-card-purple rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground/70">{g.title}</p>
                  <p className="text-xs text-foreground/40">{g.updatedAt}</p>
                </div>
                <Badge className={cn('text-xs',
                  g.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                  g.status === 'abandoned' ? 'bg-red-500/20 text-red-400' :
                  'bg-yellow-500/20 text-yellow-400'
                )}>
                  {g.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmAbandon}
        title={t('toast.confirmAbandonTitle')}
        message={t('toast.confirmAbandonMessage')}
        confirmLabel={t('toast.goalAbandoned')}
        cancelLabel={t('common.cancel')}
        variant="destructive"
        onConfirm={abandonGoal}
        onCancel={() => setConfirmAbandon(false)}
      />
    </div>
  )
}
