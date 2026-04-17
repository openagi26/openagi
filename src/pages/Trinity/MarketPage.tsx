/**
 * Knowledge Market + Prophet Mining Page
 * Browse predictions, create prophecies, and trade knowledge assets
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  TrendingUp,
  ShoppingCart,
  Plus,
  Clock,
  Flame,
  Tag,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { hostApiFetch } from '@/lib/host-api'
import { cn } from '@/lib/utils'

type Tab = 'prophet' | 'market'

interface Prediction {
  id: string
  claim: string
  category: string
  targetMetric: string
  predictedValue: number
  confidence: number
  stakeAmount: number
  status: string
  accuracy?: number
  verifyAfter: string
  createdAt: string
}

interface ProphetStats {
  totalPredictions: number
  verified: number
  correct: number
  avgAccuracy: number
  totalStaked: number
}

interface MarketListing {
  id: string
  title: string
  description: string
  currentPrice: number
  startPrice: number
  tags: string[]
  evidenceLevel: string
  seller: string
  expiresAt: string
  status: string
}

interface MarketStats {
  totalSales: number
  totalVolume: number
  avgSuccessRate: number
  activeListings: number
}

export default function MarketPage() {
  const { t } = useTranslation('trinity')
  const [tab, setTab] = useState<Tab>('prophet')

  // Prophet state
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [prophetStats, setProphetStats] = useState<ProphetStats | null>(null)
  const [showProphetForm, setShowProphetForm] = useState(false)
  const [prophetForm, setProphetForm] = useState({
    claim: '',
    category: 'market',
    targetMetric: '',
    predictedValue: '',
    confidence: 70,
    verifyAfter: '',
    stakeAmount: '',
  })

  // Market state
  const [listings, setListings] = useState<MarketListing[]>([])
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmPurchase, setConfirmPurchase] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [tab])

  async function loadData() {
    try {
      if (tab === 'prophet') {
        setPredictions(await hostApiFetch('/api/trinity/prophet/predictions'))
        setProphetStats(await hostApiFetch('/api/trinity/prophet/stats'))
      } else {
        setListings(await hostApiFetch('/api/trinity/market/listings'))
        setMarketStats(await hostApiFetch('/api/trinity/market/stats'))
      }
    } catch (err) {
      console.error('loadData failed:', err)
      toast.error(t('common.error') + ': ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  async function createPrediction() {
    if (!prophetForm.claim || !prophetForm.targetMetric) return
    const stakeNum = Number(prophetForm.stakeAmount)
    if (!stakeNum || stakeNum <= 0) {
      toast.error(t('toast.invalidStake'))
      return
    }
    const predictedNum = Number(prophetForm.predictedValue)
    if (isNaN(predictedNum)) {
      toast.error(t('common.error') + ': predictedValue must be a number')
      return
    }
    if (prophetForm.confidence < 1 || prophetForm.confidence > 100) {
      toast.error(t('common.error') + ': confidence must be 1-100')
      return
    }
    setActionLoading('createPrediction')
    try {
      await hostApiFetch('/api/trinity/prophet/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...prophetForm,
          predictedValue: predictedNum,
          stakeAmount: stakeNum,
        }),
      })
      toast.success(t('toast.predictionCreated'))
      setShowProphetForm(false)
      setProphetForm({ claim: '', category: 'market', targetMetric: '', predictedValue: '', confidence: 70, verifyAfter: '', stakeAmount: '' })
      loadData()
    } catch (err) {
      console.error('createPrediction failed:', err)
      toast.error(t('common.error') + ': ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setActionLoading(null)
    }
  }

  async function purchaseListing(id: string) {
    setActionLoading(`purchase-${id}`)
    try {
      await hostApiFetch(`/api/trinity/market/buy/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerId: 'local-node' }),
      })
      toast.success(t('toast.purchaseComplete'))
      loadData()
    } catch (err) {
      console.error('purchaseListing failed:', err)
      toast.error(t('common.error') + ': ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setActionLoading(null)
      setConfirmPurchase(null)
    }
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'prophet', label: t('market.tab.prophet'), icon: <TrendingUp className="w-4 h-4" /> },
    { key: 'market', label: t('market.tab.market'), icon: <ShoppingCart className="w-4 h-4" /> },
  ]

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    verified: 'bg-green-500/20 text-green-400',
    correct: 'bg-green-500/20 text-green-400',
    incorrect: 'bg-red-500/20 text-red-400',
    expired: 'bg-foreground/10 text-foreground/40',
    active: 'bg-blue-500/20 text-blue-400',
    sold: 'bg-purple-500/20 text-purple-400',
  }

  const levelColors: Record<string, string> = {
    H1: 'bg-red-500/20 text-red-400',
    H2: 'bg-yellow-500/20 text-yellow-400',
    H3: 'bg-blue-500/20 text-blue-400',
    H4: 'bg-green-500/20 text-green-400',
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <h1 className="text-2xl font-bold text-foreground">{t('market.title')}</h1>

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

      {/* Prophet Mining Tab */}
      {tab === 'prophet' && (
        <div className="space-y-3">
          {/* Stats summary */}
          {prophetStats && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: t('market.stats.total'), value: prophetStats.totalPredictions, color: 'text-foreground' },
                { label: t('market.stats.verified'), value: prophetStats.verified, color: 'text-blue-400' },
                { label: t('market.stats.correct'), value: prophetStats.correct, color: 'text-green-400' },
                { label: t('market.stats.accuracy'), value: `${prophetStats.avgAccuracy?.toFixed(1) ?? '0'}%`, color: 'text-purple-400' },
                { label: t('market.stats.staked'), value: `${prophetStats.totalStaked} NB`, color: 'text-yellow-400' },
              ].map((s) => (
                <div key={s.label} className="glass-card-purple rounded-lg p-3 text-center">
                  <p className="text-xs text-foreground/50">{s.label}</p>
                  <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Create prediction button */}
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => setShowProphetForm(!showProphetForm)}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Plus className="w-4 h-4 mr-1" /> {t('market.createPrediction')}
            </Button>
          </div>

          {/* Creation form */}
          {showProphetForm && (
            <div className="glass-card-purple rounded-xl p-5 space-y-3">
              <h3 className="text-lg font-semibold text-foreground">{t('market.createPrediction')}</h3>
              <input
                type="text" placeholder={t('market.form.claim')}
                value={prophetForm.claim}
                onChange={(e) => setProphetForm({ ...prophetForm, claim: e.target.value })}
                className="w-full px-3 py-2 rounded-md bg-background/50 border border-border text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={prophetForm.category}
                  onChange={(e) => setProphetForm({ ...prophetForm, category: e.target.value })}
                  className="px-3 py-2 rounded-md bg-background/50 border border-border text-foreground text-sm"
                >
                  <option value="market">{t('market.form.category.market')}</option>
                  <option value="technology">{t('market.form.category.technology')}</option>
                  <option value="security">{t('market.form.category.security')}</option>
                  <option value="performance">{t('market.form.category.performance')}</option>
                  <option value="social">{t('market.form.category.social')}</option>
                </select>
                <input
                  type="text" placeholder={t('market.form.targetMetric')}
                  value={prophetForm.targetMetric}
                  onChange={(e) => setProphetForm({ ...prophetForm, targetMetric: e.target.value })}
                  className="px-3 py-2 rounded-md bg-background/50 border border-border text-foreground text-sm placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="number" placeholder={t('market.form.predictedValue')}
                  value={prophetForm.predictedValue}
                  onChange={(e) => setProphetForm({ ...prophetForm, predictedValue: e.target.value })}
                  className="px-3 py-2 rounded-md bg-background/50 border border-border text-foreground text-sm placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                />
                <input
                  type="date"
                  value={prophetForm.verifyAfter}
                  onChange={(e) => setProphetForm({ ...prophetForm, verifyAfter: e.target.value })}
                  className="px-3 py-2 rounded-md bg-background/50 border border-border text-foreground text-sm"
                />
                <input
                  type="number" placeholder={t('market.form.stakeAmount')}
                  value={prophetForm.stakeAmount}
                  onChange={(e) => setProphetForm({ ...prophetForm, stakeAmount: e.target.value })}
                  className="px-3 py-2 rounded-md bg-background/50 border border-border text-foreground text-sm placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-xs text-foreground/50 mb-1 block">
                  {t('market.form.confidence', { value: prophetForm.confidence })}
                </label>
                <input
                  type="range" min={1} max={100}
                  value={prophetForm.confidence}
                  onChange={(e) => setProphetForm({ ...prophetForm, confidence: Number(e.target.value) })}
                  className="w-full accent-purple-500"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setShowProphetForm(false)}>{t('market.form.cancel')}</Button>
                <Button
                  size="sm"
                  onClick={createPrediction}
                  disabled={!prophetForm.claim || !prophetForm.targetMetric || actionLoading === 'createPrediction'}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {t('market.form.submit')}
                </Button>
              </div>
            </div>
          )}

          {/* Predictions list */}
          {predictions.length === 0 ? (
            <p className="text-foreground/40 text-center py-8">{t('market.noPredictions')}</p>
          ) : (
            predictions.slice().reverse().map((p) => (
              <div key={p.id} className="glass-card-purple rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={cn('text-xs', statusColors[p.status] ?? '')}>
                      {p.status}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{p.category}</Badge>
                    {p.accuracy != null && (
                      <Badge className={cn('text-xs',
                        p.accuracy >= 80 ? 'bg-green-500/20 text-green-400' :
                        p.accuracy >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      )}>
                        {t('market.accuracyBadge', { value: p.accuracy.toFixed(1) })}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Flame className="w-3 h-3 text-orange-400" />
                    <span className="text-xs text-foreground/50">{p.stakeAmount} New.B</span>
                  </div>
                </div>
                <p className="text-sm text-foreground/80">{p.claim}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-foreground/40">
                  <span>{t('market.targetDisplay', { metric: p.targetMetric, value: p.predictedValue })}</span>
                  <span>{t('market.confidenceDisplay', { value: p.confidence })}</span>
                  <span>{t('market.verifyDate', { date: new Date(p.verifyAfter).toLocaleDateString() })}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Market Tab */}
      {tab === 'market' && (
        <div className="space-y-3">
          {/* Market stats */}
          {marketStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: t('market.auction.active'), value: marketStats.activeListings, color: 'text-foreground' },
                { label: t('market.auction.totalSales'), value: marketStats.totalSales, color: 'text-green-400' },
                { label: t('market.auction.volume'), value: `${marketStats.totalVolume} NB`, color: 'text-blue-400' },
                { label: t('market.auction.avgSuccessRate'), value: `${marketStats.avgSuccessRate?.toFixed(1) ?? '0'}%`, color: 'text-purple-400' },
              ].map((s) => (
                <div key={s.label} className="glass-card-purple rounded-lg p-3 text-center">
                  <p className="text-xs text-foreground/50">{s.label}</p>
                  <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Listings */}
          {listings.length === 0 ? (
            <p className="text-foreground/40 text-center py-8">{t('market.auction.noAuctions')}</p>
          ) : (
            listings.slice().reverse().map((l) => (
              <div key={l.id} className="glass-card-purple rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-foreground">{l.title}</h3>
                      <Badge className={cn('text-xs', statusColors[l.status] ?? '')}>
                        {l.status}
                      </Badge>
                      {l.evidenceLevel && (
                        <Badge className={cn('text-xs', levelColors[l.evidenceLevel] ?? '')}>
                          {l.evidenceLevel}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-foreground/60">{l.description}</p>
                    <div className="flex gap-1 mt-2">
                      {l.tags?.map((tagItem) => (
                        <Badge key={tagItem} variant="outline" className="text-xs">
                          <Tag className="w-3 h-3 mr-1" />{tagItem}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <p className="text-lg font-bold text-green-400">{l.currentPrice} NB</p>
                    {l.startPrice !== l.currentPrice && (
                      <p className="text-xs text-foreground/30 line-through">{l.startPrice} NB</p>
                    )}
                    <p className="text-xs text-foreground/40 mt-1">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {new Date(l.expiresAt).toLocaleDateString()}
                    </p>
                    {l.status === 'active' && (
                      <Button
                        size="sm"
                        className="mt-2 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => setConfirmPurchase(l.id)}
                        disabled={actionLoading === `purchase-${l.id}`}
                      >
                        <ShoppingCart className="w-3 h-3 mr-1" /> {t('market.auction.purchase')}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmPurchase !== null}
        title={t('toast.confirmPurchaseTitle')}
        message={t('toast.confirmPurchaseMessage')}
        confirmLabel={t('market.auction.purchase')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => { if (confirmPurchase) purchaseListing(confirmPurchase) }}
        onCancel={() => setConfirmPurchase(null)}
      />
    </div>
  )
}
