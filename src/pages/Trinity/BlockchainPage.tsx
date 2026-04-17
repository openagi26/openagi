/**
 * Blockchain + Economy Advanced Page
 * Chain state, Oracle pricing, and Dividend management
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Link2,
  Activity,
  DollarSign,
  ArrowUpDown,
  RefreshCw,
  Play,
  Coins,
  TrendingUp,
  TrendingDown,
  Settings2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { hostApiFetch } from '@/lib/host-api'
import { cn } from '@/lib/utils'

type Tab = 'chain' | 'oracle' | 'dividend'

interface ChainState {
  height: number
  difficulty: number
  totalSupply: number
  pendingTxs: number
  initialized: boolean
}

interface Block {
  index: number
  miner: string
  txCount: number
  hash: string
  timestamp: string
}

interface OracleRates {
  newbToUsd: number
  usdToNewb: number
  lastUpdated: string
}

interface PriceHistory {
  high24h: number
  low24h: number
  change24h: number
  changePercent: number
}

interface DividendSummary {
  totalAccrued: number
  totalPaid: number
  pending: number
}

interface DividendConfig {
  sharePercent: number
  minThreshold: number
}

interface DividendRecord {
  id: string
  amount: number
  recipient: string
  paidAt: string
  status: string
}

export default function BlockchainPage() {
  const { t } = useTranslation('trinity')
  const [tab, setTab] = useState<Tab>('chain')

  // Chain state
  const [chainState, setChainState] = useState<ChainState | null>(null)
  const [blocks, setBlocks] = useState<Block[]>([])

  // Oracle state
  const [rates, setRates] = useState<OracleRates | null>(null)
  const [priceHistory, setPriceHistory] = useState<PriceHistory | null>(null)
  const [convertAmount, setConvertAmount] = useState('')
  const [convertDirection, setConvertDirection] = useState<'toUsd' | 'toNewb'>('toUsd')
  const [convertResult, setConvertResult] = useState<number | null>(null)

  // Dividend state
  const [dividendSummary, setDividendSummary] = useState<DividendSummary | null>(null)
  const [dividendConfig, setDividendConfig] = useState<DividendConfig>({ sharePercent: 10, minThreshold: 100 })
  const [dividendRecords, setDividendRecords] = useState<DividendRecord[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmPayout, setConfirmPayout] = useState(false)

  useEffect(() => {
    loadData()
  }, [tab])

  async function loadData() {
    try {
      if (tab === 'chain') {
        setChainState(await hostApiFetch('/api/trinity/chain/state'))
        setBlocks(await hostApiFetch('/api/trinity/chain/blocks'))
      } else if (tab === 'oracle') {
        setRates(await hostApiFetch('/api/trinity/oracle/rates'))
        setPriceHistory(await hostApiFetch('/api/trinity/oracle/history'))
      } else if (tab === 'dividend') {
        setDividendSummary(await hostApiFetch('/api/trinity/dividend/summary'))
        const cfg = await hostApiFetch('/api/trinity/dividend/config')
        if (cfg) setDividendConfig(cfg as DividendConfig)
        setDividendRecords(await hostApiFetch('/api/trinity/dividend/records'))
      }
    } catch (err) {
      console.error('loadData failed:', err)
      toast.error(t('common.error') + ': ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  async function initializeChain() {
    setActionLoading('initializeChain')
    try {
      await hostApiFetch('/api/trinity/chain/initialize', { method: 'POST' })
      toast.success(t('toast.chainInitialized'))
      loadData()
    } catch (err) {
      console.error('initializeChain failed:', err)
      toast.error(t('common.error') + ': ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setActionLoading(null)
    }
  }

  async function recalculateOracle() {
    setActionLoading('recalculateOracle')
    try {
      await hostApiFetch('/api/trinity/oracle/recalculate', { method: 'POST' })
      toast.success(t('toast.oracleRecalculated'))
      loadData()
    } catch (err) {
      console.error('recalculateOracle failed:', err)
      toast.error(t('common.error') + ': ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setActionLoading(null)
    }
  }

  function convertCurrency() {
    if (!convertAmount || !rates) return
    const amount = Number(convertAmount)
    if (convertDirection === 'toUsd') {
      setConvertResult(amount * rates.newbToUsd)
    } else {
      setConvertResult(amount * rates.usdToNewb)
    }
  }

  async function saveDividendConfig() {
    const clamped = {
      sharePercent: Math.min(100, Math.max(0, dividendConfig.sharePercent)),
      minThreshold: Math.max(0, dividendConfig.minThreshold),
    }
    setDividendConfig(clamped)
    setActionLoading('saveDividendConfig')
    try {
      await hostApiFetch('/api/trinity/dividend/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clamped),
      })
      toast.success(t('toast.dividendConfigSaved'))
      loadData()
    } catch (err) {
      console.error('saveDividendConfig failed:', err)
      toast.error(t('common.error') + ': ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setActionLoading(null)
    }
  }

  async function processPayout() {
    setActionLoading('processPayout')
    try {
      await hostApiFetch('/api/trinity/dividend/payout', { method: 'POST' })
      toast.success(t('toast.payoutProcessed'))
      loadData()
    } catch (err) {
      console.error('processPayout failed:', err)
      toast.error(t('common.error') + ': ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setActionLoading(null)
      setConfirmPayout(false)
    }
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'chain', label: t('blockchain.tab.chain'), icon: <Link2 className="w-4 h-4" /> },
    { key: 'oracle', label: t('blockchain.tab.oracle'), icon: <DollarSign className="w-4 h-4" /> },
    { key: 'dividend', label: t('blockchain.tab.dividend'), icon: <Coins className="w-4 h-4" /> },
  ]

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <h1 className="text-2xl font-bold text-foreground">{t('blockchain.title')}</h1>

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

      {/* Chain Tab */}
      {tab === 'chain' && (
        <div className="space-y-3">
          {chainState && !chainState.initialized && (
            <div className="glass-card-purple rounded-xl p-8 text-center">
              <Link2 className="w-12 h-12 text-foreground/20 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-foreground/60">{t('blockchain.notInitialized')}</h2>
              <p className="text-sm text-foreground/40 mb-4">{t('blockchain.notInitializedHint')}</p>
              <Button onClick={initializeChain} disabled={actionLoading === 'initializeChain'} className="bg-purple-600 hover:bg-purple-700 text-white">
                <Play className="w-4 h-4 mr-1" /> {t('blockchain.initialize')}
              </Button>
            </div>
          )}

          {chainState && chainState.initialized && (
            <>
              {/* Chain stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: t('blockchain.stats.blockHeight'), value: chainState.height, color: 'text-foreground' },
                  { label: t('blockchain.stats.difficulty'), value: chainState.difficulty, color: 'text-blue-400' },
                  { label: t('blockchain.stats.totalSupply'), value: `${chainState.totalSupply} NB`, color: 'text-green-400' },
                  { label: t('blockchain.stats.pendingTx'), value: chainState.pendingTxs, color: 'text-yellow-400' },
                ].map((s) => (
                  <div key={s.label} className="glass-card-purple rounded-lg p-3 text-center">
                    <p className="text-xs text-foreground/50">{s.label}</p>
                    <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Latest blocks */}
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3">{t('blockchain.latestBlocks')}</h2>
                {blocks.length === 0 ? (
                  <p className="text-foreground/40 text-center py-8">{t('blockchain.noBlocks')}</p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-2 px-4 py-2 text-xs text-foreground/40 font-medium">
                      <span>{t('blockchain.column.block')}</span>
                      <span>{t('blockchain.column.miner')}</span>
                      <span>{t('blockchain.column.txCount')}</span>
                      <span>{t('blockchain.column.hash')}</span>
                    </div>
                    {blocks.slice().reverse().slice(0, 20).map((b) => (
                      <div key={b.index} className="glass-card-purple rounded-lg p-4 grid grid-cols-4 gap-2 items-center">
                        <span className="text-sm font-bold text-foreground">#{b.index}</span>
                        <span className="text-sm text-foreground/60 truncate" title={b.miner}>{b.miner}</span>
                        <div className="flex items-center gap-1">
                          <Activity className="w-3 h-3 text-foreground/40" />
                          <span className="text-sm text-foreground/70">{t('blockchain.txCountLabel', { count: b.txCount })}</span>
                        </div>
                        <span className="text-xs font-mono text-foreground/40 truncate" title={b.hash}>
                          {b.hash?.slice(0, 16)}...
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Oracle Tab */}
      {tab === 'oracle' && (
        <div className="space-y-3">
          {/* Current rates */}
          {rates && (
            <div className="glass-card-purple rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">{t('blockchain.oracle.title')}</h3>
                <Button size="sm" variant="outline" onClick={recalculateOracle} disabled={actionLoading === 'recalculateOracle'}>
                  <RefreshCw className="w-4 h-4 mr-1" /> {t('blockchain.oracle.recalculate')}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card-purple rounded-lg p-4 text-center">
                  <p className="text-xs text-foreground/50 mb-1">{t('blockchain.oracle.oneNewB')}</p>
                  <p className="text-2xl font-bold text-green-400">${rates.newbToUsd.toFixed(6)}</p>
                </div>
                <div className="glass-card-purple rounded-lg p-4 text-center">
                  <p className="text-xs text-foreground/50 mb-1">{t('blockchain.oracle.oneUSD')}</p>
                  <p className="text-2xl font-bold text-blue-400">{rates.usdToNewb.toFixed(2)} NB</p>
                </div>
              </div>
              <p className="text-xs text-foreground/30 mt-3 text-right">
                {t('blockchain.oracle.lastUpdated')} {new Date(rates.lastUpdated).toLocaleString()}
              </p>
            </div>
          )}

          {/* 24h Price History */}
          {priceHistory && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: t('blockchain.oracle.high24h'), value: `$${priceHistory.high24h.toFixed(6)}`, color: 'text-green-400', icon: <TrendingUp className="w-4 h-4" /> },
                { label: t('blockchain.oracle.low24h'), value: `$${priceHistory.low24h.toFixed(6)}`, color: 'text-red-400', icon: <TrendingDown className="w-4 h-4" /> },
                { label: t('blockchain.oracle.change24h'), value: `$${priceHistory.change24h.toFixed(6)}`, color: priceHistory.change24h >= 0 ? 'text-green-400' : 'text-red-400' },
                { label: t('blockchain.oracle.percent24h'), value: `${priceHistory.changePercent >= 0 ? '+' : ''}${priceHistory.changePercent.toFixed(2)}%`, color: priceHistory.changePercent >= 0 ? 'text-green-400' : 'text-red-400' },
              ].map((s) => (
                <div key={s.label} className="glass-card-purple rounded-lg p-3 text-center">
                  <p className="text-xs text-foreground/50">{s.label}</p>
                  <p className={cn('text-lg font-bold', s.color)}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Converter */}
          <div className="glass-card-purple rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">{t('blockchain.converter.title')}</h3>
            <div className="flex gap-2 items-center">
              <input
                type="number" placeholder={t('blockchain.converter.amount')}
                value={convertAmount}
                onChange={(e) => { setConvertAmount(e.target.value); setConvertResult(null) }}
                className="flex-1 px-3 py-2 rounded-md bg-background/50 border border-border text-foreground text-sm placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
              />
              <button
                onClick={() => { setConvertDirection(convertDirection === 'toUsd' ? 'toNewb' : 'toUsd'); setConvertResult(null) }}
                className="px-3 py-2 rounded-md bg-background/50 border border-border text-foreground/60 hover:text-foreground transition-colors"
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>
              <span className="text-sm text-foreground/50 w-20 text-center">
                {convertDirection === 'toUsd' ? t('blockchain.converter.nbToUsd') : t('blockchain.converter.usdToNb')}
              </span>
              <Button size="sm" variant="outline" onClick={convertCurrency} disabled={!convertAmount}>
                {t('blockchain.converter.convert')}
              </Button>
            </div>
            {convertResult !== null && (
              <p className="text-lg font-bold text-purple-400 mt-3 text-center">
                = {convertDirection === 'toUsd' ? `$${convertResult.toFixed(6)}` : `${convertResult.toFixed(2)} New.B`}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Dividend Tab */}
      {tab === 'dividend' && (
        <div className="space-y-3">
          {/* Dividend summary */}
          {dividendSummary && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: t('blockchain.dividend.totalAccrued'), value: `${dividendSummary.totalAccrued} NB`, color: 'text-foreground' },
                { label: t('blockchain.dividend.totalPaid'), value: `${dividendSummary.totalPaid} NB`, color: 'text-green-400' },
                { label: t('blockchain.dividend.pending'), value: `${dividendSummary.pending} NB`, color: 'text-yellow-400' },
              ].map((s) => (
                <div key={s.label} className="glass-card-purple rounded-lg p-3 text-center">
                  <p className="text-xs text-foreground/50">{s.label}</p>
                  <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Config editor */}
          <div className="glass-card-purple rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Settings2 className="w-4 h-4" /> {t('blockchain.dividend.config')}
              </h3>
              <Button size="sm" variant="outline" onClick={saveDividendConfig} disabled={actionLoading === 'saveDividendConfig'}>
                {t('blockchain.dividend.saveConfig')}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-foreground/50 mb-1 block">{t('blockchain.dividend.sharePercent')}</label>
                <input
                  type="number" min={0} max={100}
                  value={dividendConfig.sharePercent}
                  onChange={(e) => setDividendConfig({ ...dividendConfig, sharePercent: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-md bg-background/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-xs text-foreground/50 mb-1 block">{t('blockchain.dividend.minThreshold')}</label>
                <input
                  type="number" min={0}
                  value={dividendConfig.minThreshold}
                  onChange={(e) => setDividendConfig({ ...dividendConfig, minThreshold: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-md bg-background/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Process payout button */}
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => setConfirmPayout(true)}
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={!dividendSummary || dividendSummary.pending <= 0 || actionLoading === 'processPayout'}
            >
              <Coins className="w-4 h-4 mr-1" /> {t('blockchain.dividend.processPayout')}
            </Button>
          </div>

          {/* Dividend records */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">{t('blockchain.dividend.recentRecords')}</h2>
            {dividendRecords.length === 0 ? (
              <p className="text-foreground/40 text-center py-8">{t('blockchain.dividend.noRecords')}</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2 px-4 py-2 text-xs text-foreground/40 font-medium">
                  <span>{t('blockchain.dividend.column.amount')}</span>
                  <span>{t('blockchain.dividend.column.recipient')}</span>
                  <span>{t('blockchain.dividend.column.date')}</span>
                  <span>{t('blockchain.dividend.column.status')}</span>
                </div>
                {dividendRecords.slice().reverse().map((r) => (
                  <div key={r.id} className="glass-card-purple rounded-lg p-4 grid grid-cols-4 gap-2 items-center">
                    <span className="text-sm font-bold text-green-400">{r.amount} NB</span>
                    <span className="text-sm text-foreground/60 truncate" title={r.recipient}>{r.recipient}</span>
                    <span className="text-xs text-foreground/40">{new Date(r.paidAt).toLocaleString()}</span>
                    <Badge className={cn('text-xs w-fit',
                      r.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                      r.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    )}>
                      {r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmPayout}
        title={t('toast.confirmPayoutTitle')}
        message={t('toast.confirmPayoutMessage')}
        confirmLabel={t('blockchain.dividend.processPayout')}
        cancelLabel={t('common.cancel')}
        onConfirm={processPayout}
        onCancel={() => setConfirmPayout(false)}
      />
    </div>
  )
}
