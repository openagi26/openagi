/**
 * Governance Browser Page
 * Browse Evidence, Debts, Playbooks, PoO tasks
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FileSearch,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { hostApiFetch } from '@/lib/host-api'
import { cn } from '@/lib/utils'

type Tab = 'evidence' | 'debts' | 'playbooks' | 'poo'

export default function GovernancePage() {
  const { t } = useTranslation('trinity')
  const [tab, setTab] = useState<Tab>('evidence')
  const [evidence, setEvidence] = useState<any[]>([])
  const [debts, setDebts] = useState<any[]>([])
  const [playbooks, setPlaybooks] = useState<any[]>([])
  const [pooTasks, setPooTasks] = useState<any[]>([])
  const [pooStats, setPooStats] = useState<any>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmClearing, setConfirmClearing] = useState(false)

  useEffect(() => {
    loadData()
  }, [tab])

  async function loadData() {
    try {
      if (tab === 'evidence') {
        setEvidence(await hostApiFetch('/api/trinity/governance/evidence'))
      } else if (tab === 'debts') {
        setDebts(await hostApiFetch('/api/trinity/governance/debts'))
      } else if (tab === 'playbooks') {
        setPlaybooks(await hostApiFetch('/api/trinity/governance/playbooks'))
      } else if (tab === 'poo') {
        setPooTasks(await hostApiFetch('/api/trinity/poo/tasks'))
        setPooStats(await hostApiFetch('/api/trinity/poo/stats'))
      }
    } catch (err) {
      console.error('loadData failed:', err)
      toast.error(t('common.error') + ': ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  async function runClearing() {
    setActionLoading('runClearing')
    try {
      await hostApiFetch('/api/trinity/governance/federated-clearing', { method: 'POST' })
      toast.success(t('toast.clearingComplete'))
      loadData()
    } catch (err) {
      console.error('runClearing failed:', err)
      toast.error(t('common.error') + ': ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setActionLoading(null)
      setConfirmClearing(false)
    }
  }

  async function resolveDebt(debtId: string) {
    setActionLoading(`resolveDebt-${debtId}`)
    try {
      await hostApiFetch(`/api/trinity/governance/debts/${debtId}/resolve`, { method: 'POST' })
      toast.success(t('toast.debtResolved'))
      loadData()
    } catch (err) {
      console.error('resolveDebt failed:', err)
      toast.error(t('common.error') + ': ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setActionLoading(null)
    }
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'evidence', label: t('governance.evidence'), icon: <FileSearch className="w-4 h-4" /> },
    { key: 'debts', label: t('governance.debts'), icon: <AlertTriangle className="w-4 h-4" /> },
    { key: 'playbooks', label: t('governance.playbooks'), icon: <BookOpen className="w-4 h-4" /> },
    { key: 'poo', label: t('governance.pooTasks'), icon: <Shield className="w-4 h-4" /> },
  ]

  const levelColors: Record<string, string> = {
    H1: 'bg-red-500/20 text-red-400',
    H2: 'bg-yellow-500/20 text-yellow-400',
    H3: 'bg-blue-500/20 text-blue-400',
    H4: 'bg-green-500/20 text-green-400',
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <h1 className="text-2xl font-bold text-foreground">{t('governance.title')}</h1>

      {/* Tab bar */}
      <div className="flex gap-1 bg-background/30 rounded-lg p-1">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              tab === tb.key ? 'bg-purple-500/20 text-purple-300' : 'text-foreground/50 hover:text-foreground/80'
            )}
          >
            {tb.icon} {tb.label}
          </button>
        ))}
      </div>

      {/* Evidence Tab */}
      {tab === 'evidence' && (
        <div className="space-y-2">
          {evidence.length === 0 ? (
            <p className="text-foreground/40 text-center py-8">{t('governance.noEvidence')}</p>
          ) : (
            evidence.slice().reverse().map((ev: any) => (
              <div key={ev.id} className="glass-card-purple rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={cn('text-xs', levelColors[ev.evidenceLevel] ?? '')}>
                      {ev.evidenceLevel}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{ev.source}</Badge>
                    {ev.persisted && <Badge className="text-xs bg-green-500/20 text-green-400">{t('governance.persisted')}</Badge>}
                  </div>
                  <span className="text-xs text-foreground/40">{new Date(ev.timestamp).toLocaleString()}</span>
                </div>
                <p className="text-sm text-foreground/80">{ev.claim}</p>
                <p className="text-xs text-foreground/30 mt-1 font-mono truncate">{t('governance.hashLabel')} {ev.hash}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Debts Tab */}
      {tab === 'debts' && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmClearing(true)}
              disabled={actionLoading === 'runClearing'}
            >
              {t('governance.runClearing')}
            </Button>
          </div>
          {debts.length === 0 ? (
            <p className="text-foreground/40 text-center py-8">{t('governance.noDebts')}</p>
          ) : (
            debts.map((d: any) => (
              <div key={d.id} className="glass-card-purple rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={d.severity === 'critical' ? 'destructive' : 'outline'} className="text-xs">
                      {d.severity}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{d.status}</Badge>
                    {d.federatedBounty && (
                      <Badge className="text-xs bg-purple-500/20 text-purple-400">
                        {t('governance.bounty', { amount: d.federatedBounty })}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-foreground/80">{d.description}</p>
                  <p className="text-xs text-foreground/40">{t('governance.cost', { amount: d.estimatedCost })}</p>
                </div>
                {d.status === 'open' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => resolveDebt(d.id)}
                    disabled={actionLoading === `resolveDebt-${d.id}`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Playbooks Tab */}
      {tab === 'playbooks' && (
        <div className="space-y-2">
          {playbooks.length === 0 ? (
            <p className="text-foreground/40 text-center py-8">{t('governance.noPlaybooks')}</p>
          ) : (
            playbooks.map((pb: any) => (
              <div key={pb.id} className="glass-card-purple rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-foreground">{pb.title}</h3>
                  <div className="flex items-center gap-2">
                    <Badge className={cn('text-xs', levelColors[pb.evidenceLevel] ?? '')}>
                      {pb.evidenceLevel}
                    </Badge>
                    <span className="text-xs text-foreground/50">
                      {t('governance.successRate', { rate: pb.successRate.toFixed(0), count: pb.usageCount })}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-foreground/60">{pb.description}</p>
                <div className="flex gap-1 mt-2">
                  {pb.tags?.map((tag: string) => (
                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* PoO Tasks Tab */}
      {tab === 'poo' && (
        <div className="space-y-3">
          {pooStats && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: t('governance.statsTotal'), value: pooStats.totalTasks, color: 'text-foreground' },
                { label: t('governance.statsVerified'), value: pooStats.verified, color: 'text-green-400' },
                { label: t('governance.statsFailed'), value: pooStats.failed, color: 'text-red-400' },
                { label: t('governance.statsDiscarded'), value: pooStats.discarded, color: 'text-yellow-400' },
                { label: t('governance.statsAvgScore'), value: pooStats.avgScore?.toFixed(1) ?? '0', color: 'text-purple-400' },
              ].map((s) => (
                <div key={s.label} className="glass-card-purple rounded-lg p-3 text-center">
                  <p className="text-xs text-foreground/50">{s.label}</p>
                  <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {pooTasks.length === 0 ? (
            <p className="text-foreground/40 text-center py-8">{t('governance.noPoOTasks')}</p>
          ) : (
            pooTasks.slice().reverse().map((taskItem: any) => (
              <div key={taskItem.id} className="glass-card-purple rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-medium text-foreground">{taskItem.title}</h3>
                  <div className="flex items-center gap-2">
                    {taskItem.status === 'verified' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                    {taskItem.status === 'failed' && <XCircle className="w-4 h-4 text-red-400" />}
                    {taskItem.status === 'pending' && <Clock className="w-4 h-4 text-yellow-400" />}
                    <Badge variant="outline" className="text-xs">{taskItem.status}</Badge>
                    {taskItem.priorityScore != null && (
                      <Badge className={cn('text-xs',
                        taskItem.priorityScore >= 85 ? 'bg-green-500/20 text-green-400' :
                        taskItem.priorityScore >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      )}>
                        {t('governance.score', { score: taskItem.priorityScore })}
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-xs text-foreground/50">{taskItem.description}</p>
                {taskItem.newbReward > 0 && (
                  <p className="text-xs text-green-400 mt-1">{t('governance.reward', { amount: taskItem.newbReward })}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmClearing}
        title={t('toast.confirmClearingTitle')}
        message={t('toast.confirmClearingMessage')}
        confirmLabel={t('governance.runClearing')}
        cancelLabel={t('common.cancel')}
        onConfirm={runClearing}
        onCancel={() => setConfirmClearing(false)}
      />
    </div>
  )
}
