/**
 * Trinity 控制台页面
 * 显示节点身份、三体状态、PoO统计、治理概览
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Shield,
  Coins,
  Activity,
  Zap,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  FileText,
  Swords,
  Eye,
  Landmark,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTrinityStore } from '@/stores/trinity'
import { cn } from '@/lib/utils'

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  color: string
}) {
  return (
    <div className="glass-card-purple rounded-xl p-5 flex items-start gap-4">
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', color)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-foreground/50 font-medium">{label}</p>
        <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
        {sub && <p className="text-xs text-foreground/40 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Role Card ────────────────────────────────────────────────────────────────

function RoleCard({ role, title, name, icon, color }: {
  role: string
  title: string
  name: string
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className="glass-card-purple rounded-xl p-4 flex items-center gap-3">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', color)}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-foreground">{role}: {name}</p>
        <p className="text-xs text-foreground/50">{title}</p>
      </div>
    </div>
  )
}

// ─── Genesis Screen ───────────────────────────────────────────────────────────

function GenesisScreen({ onGenesis, t }: { onGenesis: (passphrase: string) => void; t: (key: string) => string }) {
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const { isLoading } = useTrinityStore()

  const isValid = passphrase.length >= 8 && passphrase === confirm

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
        <Zap className="w-10 h-10 text-white" />
      </div>
      <h1 className="text-3xl font-bold text-foreground">{t('genesis.title')}</h1>
      <p className="text-foreground/60 text-center max-w-md">
        {t('genesis.description')}
      </p>

      <div className="w-full max-w-sm space-y-3">
        <input
          type="password"
          placeholder={t('genesis.passphrasePlaceholder')}
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          className="w-full px-4 py-3 rounded-lg bg-background/50 border border-border text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <input
          type="password"
          placeholder={t('genesis.confirmPlaceholder')}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full px-4 py-3 rounded-lg bg-background/50 border border-border text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <Button
          onClick={() => onGenesis(passphrase)}
          disabled={!isValid || isLoading}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3"
        >
          {isLoading ? t('genesis.activating') : t('genesis.activate')}
        </Button>
      </div>

      <p className="text-xs text-foreground/30 max-w-sm text-center">
        {t('genesis.warning')}
      </p>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function TrinityPage() {
  const { t } = useTranslation('trinity')
  const { dashboard, genesisStatus, isLoading, fetchDashboard, checkGenesis, performGenesis } = useTrinityStore()

  useEffect(() => {
    checkGenesis()
    fetchDashboard()
  }, [checkGenesis, fetchDashboard])

  // If genesis not complete, show genesis screen
  if (genesisStatus && !genesisStatus.isComplete) {
    return (
      <div className="p-6">
        <GenesisScreen
          t={t}
          onGenesis={async (passphrase) => {
            const result = await performGenesis(passphrase)
            if (result.success) {
              await checkGenesis()
              await fetchDashboard()
            }
          }}
        />
      </div>
    )
  }

  if (!dashboard) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[40vh]">
        <p className="text-foreground/50">{isLoading ? t('dashboard.loading') : t('dashboard.noData')}</p>
      </div>
    )
  }

  const { identity, economy, trinity, poo, value, debts, playbooks } = dashboard

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          {identity && (
            <p className="text-sm text-foreground/50 font-mono mt-1">
              {t('dashboard.nodeLabel')} {identity.nodeId.substring(0, 24)}...
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={trinity.phase === 'idle' ? 'secondary' : 'default'}>
            {trinity.phase.toUpperCase()}
          </Badge>
          <Badge variant="outline">
            {t('dashboard.round', { round: trinity.currentRound })}
          </Badge>
          <Badge className={cn(
            'text-xs',
            trinity.gameMode === 'debate' ? 'bg-red-500/20 text-red-400' :
            trinity.gameMode === 'competition' ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-green-500/20 text-green-400'
          )}>
            {trinity.gameMode}
          </Badge>
          <Button size="sm" variant="ghost" onClick={fetchDashboard}>
            <Activity className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── Top Stats ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Coins className="w-5 h-5 text-yellow-300" />}
          label={t('economy.balance')}
          value={economy?.balance.toFixed(2) ?? '0'}
          sub={t('dashboard.epochInfo', { epoch: economy?.halvingEpoch ?? 0, reward: economy?.currentRewardRate ?? 0 })}
          color="bg-yellow-500/20"
        />
        <StatCard
          icon={<Shield className="w-5 h-5 text-blue-300" />}
          label={t('stats.creditScore')}
          value={identity?.creditScore ?? 0}
          sub={identity?.isActive ? t('dashboard.active') : t('dashboard.inactive')}
          color="bg-blue-500/20"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5 text-green-300" />}
          label={t('stats.pooVerified')}
          value={poo.verified}
          sub={t('dashboard.pooFailed', { failed: poo.failed, discarded: poo.discarded })}
          color="bg-green-500/20"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-purple-300" />}
          label={t('stats.avgScore')}
          value={value.avgScore.toFixed(1)}
          sub={t('dashboard.taskStats', { totalTasks: value.totalTasks, earned: value.totalNewbEarned.toFixed(1) })}
          color="bg-purple-500/20"
        />
      </div>

      {/* ── Trinity Roles ──────────────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">{t('roles.title')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <RoleCard
            role="AI-1"
            name={t('roles.ai1.name')}
            title={t('roles.ai1.title')}
            icon={<Swords className="w-5 h-5 text-red-300" />}
            color="bg-red-500/20"
          />
          <RoleCard
            role="AI-2"
            name={t('roles.ai2.name')}
            title={t('roles.ai2.title')}
            icon={<Eye className="w-5 h-5 text-cyan-300" />}
            color="bg-cyan-500/20"
          />
          <RoleCard
            role="AI-3"
            name={t('roles.ai3.name')}
            title={t('roles.ai3.title')}
            icon={<Landmark className="w-5 h-5 text-amber-300" />}
            color="bg-amber-500/20"
          />
        </div>
      </div>

      {/* ── Economy Summary ────────────────────────────────────────────── */}
      {economy && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">{t('economy.title')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass-card-purple rounded-lg p-3">
              <p className="text-xs text-foreground/50">{t('economy.totalEarned')}</p>
              <p className="text-lg font-bold text-green-400">{economy.totalEarned.toFixed(2)}</p>
            </div>
            <div className="glass-card-purple rounded-lg p-3">
              <p className="text-xs text-foreground/50">{t('economy.totalSpent')}</p>
              <p className="text-lg font-bold text-red-400">{economy.totalSpent.toFixed(2)}</p>
            </div>
            <div className="glass-card-purple rounded-lg p-3">
              <p className="text-xs text-foreground/50">{t('economy.staked')}</p>
              <p className="text-lg font-bold text-blue-400">{economy.totalStaked.toFixed(2)}</p>
            </div>
            <div className="glass-card-purple rounded-lg p-3">
              <p className="text-xs text-foreground/50">{t('economy.openDebts')}</p>
              <p className="text-lg font-bold text-orange-400">{debts.openCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Recent Transactions ────────────────────────────────────────── */}
      {economy && economy.recentTransactions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">{t('economy.transactions')}</h2>
          <div className="glass-card-purple rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left p-3 text-foreground/50 font-medium">{t('dashboard.column.time')}</th>
                  <th className="text-left p-3 text-foreground/50 font-medium">{t('dashboard.column.type')}</th>
                  <th className="text-right p-3 text-foreground/50 font-medium">{t('dashboard.column.amount')}</th>
                  <th className="text-right p-3 text-foreground/50 font-medium">{t('dashboard.column.balance')}</th>
                </tr>
              </thead>
              <tbody>
                {economy.recentTransactions.slice().reverse().map((tx) => (
                  <tr key={tx.id} className="border-b border-border/10">
                    <td className="p-3 text-foreground/60 text-xs font-mono">
                      {new Date(tx.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs">
                        {tx.type.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className={cn(
                      'p-3 text-right font-mono font-bold',
                      tx.amount >= 0 ? 'text-green-400' : 'text-red-400'
                    )}>
                      {tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-mono text-foreground/60">
                      {tx.balance.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Confidence & Health ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass-card-purple rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground/70 mb-2">{t('stats.confidence')}</h3>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 bg-background/50 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  trinity.confidence >= 80 ? 'bg-green-500' :
                  trinity.confidence >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                )}
                style={{ width: `${trinity.confidence}%` }}
              />
            </div>
            <span className="text-sm font-bold text-foreground">{trinity.confidence}%</span>
          </div>
          {trinity.confidence < 50 && (
            <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {t('dashboard.autoPause')}
            </p>
          )}
        </div>

        <div className="glass-card-purple rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground/70 mb-2">{t('governance.playbooks')}</h3>
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-foreground/30" />
            <div>
              <p className="text-2xl font-bold text-foreground">{playbooks.count}</p>
              <p className="text-xs text-foreground/50">{t('dashboard.storedPlaybooks')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
