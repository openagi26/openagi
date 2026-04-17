/**
 * Network & Swarm Page
 * Manage P2P swarm network, peers, and federal defense
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Globe,
  Wifi,
  WifiOff,
  RefreshCw,
  Plus,
  Shield,
  AlertTriangle,
  Activity,
  Users,
  Radio,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { hostApiFetch } from '@/lib/host-api'
import { cn } from '@/lib/utils'

interface Peer {
  nodeId: string
  address: string
  port: number
  status: string
  creditScore: number
  latency: number
  lastSeen: string
}

interface SwarmStats {
  connectedPeers: number
  totalKnown: number
  messagesSent: number
  messagesReceived: number
  uptime: number
  isRunning: boolean
}

export default function SwarmPage() {
  const { t } = useTranslation('trinity')
  const [peers, setPeers] = useState<Peer[]>([])
  const [stats, setStats] = useState<SwarmStats | null>(null)
  const [connectForm, setConnectForm] = useState({ address: '', port: '' })
  const [reportForm, setReportForm] = useState({ nodeId: '', reason: '' })
  const [showReportForm, setShowReportForm] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setPeers(await hostApiFetch('/api/trinity/swarm/peers'))
      setStats(await hostApiFetch('/api/trinity/swarm/stats'))
    } catch (err) {
      console.error('loadData failed:', err)
      toast.error(t('common.error') + ': ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  async function startSwarm() {
    setActionLoading('startSwarm')
    try {
      await hostApiFetch('/api/trinity/swarm/start', { method: 'POST' })
      toast.success(t('toast.swarmStarted'))
      loadData()
    } catch (err) {
      console.error('startSwarm failed:', err)
      toast.error(t('common.error') + ': ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setActionLoading(null)
    }
  }

  async function stopSwarm() {
    setActionLoading('stopSwarm')
    try {
      await hostApiFetch('/api/trinity/swarm/stop', { method: 'POST' })
      toast.success(t('toast.swarmStopped'))
      loadData()
    } catch (err) {
      console.error('stopSwarm failed:', err)
      toast.error(t('common.error') + ': ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setActionLoading(null)
    }
  }

  async function connectPeer() {
    if (!connectForm.address || !connectForm.port) return
    const portNum = Number(connectForm.port)
    if (portNum < 1 || portNum > 65535) {
      toast.error(t('toast.invalidPort'))
      return
    }
    setActionLoading('connectPeer')
    try {
      await hostApiFetch('/api/trinity/swarm/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: connectForm.address, port: portNum }),
      })
      toast.success(t('toast.peerConnected'))
      setConnectForm({ address: '', port: '' })
      loadData()
    } catch (err) {
      console.error('connectPeer failed:', err)
      toast.error(t('common.error') + ': ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setActionLoading(null)
    }
  }

  async function triggerDiscovery() {
    setActionLoading('triggerDiscovery')
    try {
      await hostApiFetch('/api/trinity/swarm/discover', { method: 'POST' })
      toast.success(t('toast.discoveryTriggered'))
      loadData()
    } catch (err) {
      console.error('triggerDiscovery failed:', err)
      toast.error(t('common.error') + ': ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setActionLoading(null)
    }
  }

  async function reportNode() {
    if (!reportForm.nodeId || !reportForm.reason) return
    setActionLoading('reportNode')
    try {
      await hostApiFetch('/api/trinity/swarm/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportForm),
      })
      toast.success(t('toast.reportSubmitted'))
      setReportForm({ nodeId: '', reason: '' })
      setShowReportForm(false)
      loadData()
    } catch (err) {
      console.error('reportNode failed:', err)
      toast.error(t('common.error') + ': ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setActionLoading(null)
    }
  }

  function formatUptime(seconds: number): string {
    if (!seconds) return '0s'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  const statusColors: Record<string, string> = {
    connected: 'bg-green-500/20 text-green-400',
    disconnected: 'bg-red-500/20 text-red-400',
    connecting: 'bg-yellow-500/20 text-yellow-400',
    banned: 'bg-red-500/20 text-red-400',
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('swarm.title')}</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={triggerDiscovery} disabled={actionLoading === 'triggerDiscovery'}>
            <Radio className="w-4 h-4 mr-1" /> {t('swarm.discoverNodes')}
          </Button>
          <Button size="sm" variant="outline" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-1" /> {t('swarm.refresh')}
          </Button>
          {stats?.isRunning ? (
            <Button size="sm" onClick={stopSwarm} disabled={actionLoading === 'stopSwarm'} className="bg-red-500/80 hover:bg-red-600 text-white">
              <WifiOff className="w-4 h-4 mr-1" /> {t('swarm.stopSwarm')}
            </Button>
          ) : (
            <Button size="sm" onClick={startSwarm} disabled={actionLoading === 'startSwarm'} className="bg-green-500/80 hover:bg-green-600 text-white">
              <Wifi className="w-4 h-4 mr-1" /> {t('swarm.startSwarm')}
            </Button>
          )}
        </div>
      </div>

      {/* Swarm status indicator */}
      {stats && (
        <div className="glass-card-purple rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className={cn('w-3 h-3 rounded-full', stats.isRunning ? 'bg-green-400 animate-pulse' : 'bg-foreground/20')} />
            <span className="text-sm font-medium text-foreground">
              {stats.isRunning ? t('swarm.status.running') : t('swarm.status.offline')}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: t('swarm.stats.connected'), value: stats.connectedPeers, icon: <Users className="w-4 h-4" />, color: 'text-green-400' },
              { label: t('swarm.stats.knownNodes'), value: stats.totalKnown, icon: <Globe className="w-4 h-4" />, color: 'text-blue-400' },
              { label: t('swarm.stats.messagesSent'), value: stats.messagesSent, icon: <Activity className="w-4 h-4" />, color: 'text-purple-400' },
              { label: t('swarm.stats.messagesReceived'), value: stats.messagesReceived, icon: <Activity className="w-4 h-4" />, color: 'text-cyan-400' },
              { label: t('swarm.stats.uptime'), value: formatUptime(stats.uptime), icon: <RefreshCw className="w-4 h-4" />, color: 'text-yellow-400' },
            ].map((s) => (
              <div key={s.label} className="glass-card-purple rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1 text-foreground/50">
                  {s.icon}
                  <p className="text-xs">{s.label}</p>
                </div>
                <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connect to peer form */}
      <div className="glass-card-purple rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">{t('swarm.connectPeer.title')}</h3>
        <div className="flex gap-2">
          <input
            type="text" placeholder={t('swarm.connectPeer.addressPlaceholder')}
            value={connectForm.address}
            onChange={(e) => setConnectForm({ ...connectForm, address: e.target.value })}
            className="flex-1 px-3 py-2 rounded-md bg-background/50 border border-border text-foreground text-sm placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
          />
          <input
            type="number" placeholder={t('swarm.connectPeer.portPlaceholder')}
            value={connectForm.port}
            onChange={(e) => setConnectForm({ ...connectForm, port: e.target.value })}
            className="w-24 px-3 py-2 rounded-md bg-background/50 border border-border text-foreground text-sm placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
          />
          <Button size="sm" variant="outline" onClick={connectPeer} disabled={!connectForm.address || !connectForm.port || actionLoading === 'connectPeer'}>
            <Plus className="w-4 h-4 mr-1" /> {t('swarm.connectPeer.connect')}
          </Button>
        </div>
      </div>

      {/* Connected peers table */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">{t('swarm.connectedPeers')}</h2>
        {peers.length === 0 ? (
          <p className="text-foreground/40 text-center py-8">{t('swarm.noPeers')}</p>
        ) : (
          <div className="space-y-2">
            {/* Table header */}
            <div className="grid grid-cols-6 gap-2 px-4 py-2 text-xs text-foreground/40 font-medium">
              <span>{t('swarm.column.nodeId')}</span>
              <span>{t('swarm.column.address')}</span>
              <span>{t('swarm.column.status')}</span>
              <span>{t('swarm.column.creditScore')}</span>
              <span>{t('swarm.column.latency')}</span>
              <span>{t('swarm.column.lastSeen')}</span>
            </div>
            {peers.map((p) => (
              <div key={p.nodeId} className="glass-card-purple rounded-lg p-4 grid grid-cols-6 gap-2 items-center">
                <span className="text-sm font-mono text-foreground/80 truncate" title={p.nodeId}>
                  {p.nodeId.slice(0, 12)}...
                </span>
                <span className="text-sm text-foreground/60">{p.address}:{p.port}</span>
                <Badge className={cn('text-xs w-fit', statusColors[p.status] ?? '')}>
                  {p.status}
                </Badge>
                <div className="flex items-center gap-1">
                  <div className={cn('w-2 h-2 rounded-full',
                    p.creditScore >= 80 ? 'bg-green-400' :
                    p.creditScore >= 50 ? 'bg-yellow-400' : 'bg-red-400'
                  )} />
                  <span className="text-sm text-foreground/70">{p.creditScore}</span>
                </div>
                <span className={cn('text-sm',
                  p.latency < 100 ? 'text-green-400' :
                  p.latency < 500 ? 'text-yellow-400' : 'text-red-400'
                )}>
                  {p.latency}ms
                </span>
                <span className="text-xs text-foreground/40">
                  {new Date(p.lastSeen).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Federal Defense */}
      <div className="glass-card-purple rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-400" /> {t('swarm.federalDefense')}
          </h3>
          <Button size="sm" variant="outline" onClick={() => setShowReportForm(!showReportForm)}>
            <AlertTriangle className="w-4 h-4 mr-1" /> {t('swarm.report.button')}
          </Button>
        </div>
        {showReportForm && (
          <div className="space-y-3 mt-3">
            <input
              type="text" placeholder={t('swarm.report.targetId')}
              value={reportForm.nodeId}
              onChange={(e) => setReportForm({ ...reportForm, nodeId: e.target.value })}
              className="w-full px-3 py-2 rounded-md bg-background/50 border border-border text-foreground text-sm placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
            />
            <textarea
              placeholder={t('swarm.report.reason')}
              value={reportForm.reason}
              onChange={(e) => setReportForm({ ...reportForm, reason: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-md bg-background/50 border border-border text-foreground text-sm placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 resize-none"
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowReportForm(false)}>{t('swarm.report.cancel')}</Button>
              <Button
                size="sm"
                onClick={reportNode}
                disabled={!reportForm.nodeId || !reportForm.reason || actionLoading === 'reportNode'}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {t('swarm.report.submit')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
