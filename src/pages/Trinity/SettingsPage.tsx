/**
 * Trinity Settings Page
 * Configure AI executor, auto-runner, PoO thresholds, constraints
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings2, Save, RefreshCw, Swords, Eye, Landmark, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { hostApiFetch } from '@/lib/host-api'
import { cn } from '@/lib/utils'

export default function TrinitySettingsPage() {
  const { t } = useTranslation('trinity')
  const [, setRunnerConfig] = useState<any>(null)
  const [, setPooConfig] = useState<any>(null)
  const [constraints, setConstraints] = useState<any[]>([])
  const [roleConfig, setRoleConfig] = useState<Record<string, { name: string; personality: string; temperature: number }>>({
    'AI-1': { name: '扩张者', personality: '', temperature: 0.8 },
    'AI-2': { name: '风控员', personality: '', temperature: 0.2 },
    'AI-3': { name: '财务官', personality: '', temperature: 0.4 },
  })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  // Local form state
  const [aiProvider, setAiProvider] = useState('openai')
  const [aiModel, setAiModel] = useState('gpt-4o-mini')
  const [aiBaseUrl, setAiBaseUrl] = useState('')
  const [interval, setInterval_] = useState(5)
  const [maxFailures, setMaxFailures] = useState(3)
  const [execThreshold, setExecThreshold] = useState(85)
  const [sandboxTimeout, setSandboxTimeout] = useState(30)
  const [confidencePause, setConfidencePause] = useState(50)

  useEffect(() => { loadConfig() }, [])

  async function loadConfig() {
    try {
      const rc: any = await hostApiFetch('/api/trinity/runner/config')
      setRunnerConfig(rc)
      setAiProvider(rc.aiConfig?.provider ?? 'openai')
      setAiModel(rc.aiConfig?.model ?? 'gpt-4o-mini')
      setAiBaseUrl(rc.aiConfig?.baseUrl ?? '')
      setInterval_(Math.round(rc.intervalMs / 60000))
      setMaxFailures(rc.maxConsecutiveFailures)

      const pc: any = await hostApiFetch('/api/trinity/poo/config')
      setPooConfig(pc)
      setExecThreshold(pc.executionThreshold)
      setSandboxTimeout(Math.round(pc.sandboxTimeoutMs / 1000))
      setConfidencePause(pc.confidencePauseThreshold)

      setConstraints(await hostApiFetch('/api/trinity/constraints'))

      const rc2: any = await hostApiFetch('/api/trinity/roles/config')
      if (rc2 && typeof rc2 === 'object') setRoleConfig(rc2)
    } catch (err) {
      console.error('loadConfig failed:', err)
      toast.error(t('common.error') + ': ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  async function saveAll() {
    setSaving(true)
    try {
      // Save runner config
      await hostApiFetch('/api/trinity/runner/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intervalMs: interval * 60000,
          maxConsecutiveFailures: maxFailures,
          aiConfig: {
            provider: aiProvider,
            model: aiModel,
            ...(aiBaseUrl ? { baseUrl: aiBaseUrl } : {}),
          },
        }),
      })

      // Save PoO config
      await hostApiFetch('/api/trinity/poo/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executionThreshold: execThreshold,
          sandboxTimeoutMs: sandboxTimeout * 1000,
          confidencePauseThreshold: confidencePause,
        }),
      })

      // Save role config
      await hostApiFetch('/api/trinity/roles/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleConfig),
      })

      toast.success(t('toast.settingsSaved'))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('saveAll failed:', err)
      toast.error(t('common.error') + ': ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(false)
    }
  }

  function updateRole(role: string, field: string, value: any) {
    setRoleConfig((prev) => ({
      ...prev,
      [role]: { ...prev[role], [field]: value },
    }))
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings2 className="w-6 h-6" /> {t('settings.title')}
        </h1>
        <Button onClick={saveAll} disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white">
          {saving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> {t('settings.save')}</> : saved ? <><RefreshCw className="w-4 h-4 mr-1" /> {t('settings.saved')}</> : <><Save className="w-4 h-4 mr-1" /> {t('settings.save')}</>}
        </Button>
      </div>

      {/* AI Provider */}
      <section className="glass-card-purple rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{t('settings.aiProvider')}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-foreground/50 mb-1 block">{t('settings.provider')}</label>
            <select value={aiProvider} onChange={(e) => setAiProvider(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-background/50 border border-border text-foreground text-sm">
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="deepseek">DeepSeek</option>
              <option value="local">Local (Ollama)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-foreground/50 mb-1 block">{t('settings.model')}</label>
            <input value={aiModel} onChange={(e) => setAiModel(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-background/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500" />
          </div>
        </div>
        {aiProvider === 'local' && (
          <div>
            <label className="text-xs text-foreground/50 mb-1 block">{t('settings.baseUrl')}</label>
            <input value={aiBaseUrl} onChange={(e) => setAiBaseUrl(e.target.value)}
              placeholder="http://localhost:11434/v1"
              className="w-full px-3 py-2 rounded-md bg-background/50 border border-border text-foreground text-sm placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500" />
          </div>
        )}
        <p className="text-xs text-foreground/40">
          {t('settings.apiKeyHint')}
        </p>
      </section>

      {/* Auto-Runner */}
      <section className="glass-card-purple rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{t('settings.autoRunner')}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-foreground/50 mb-1 block">{t('settings.cycleInterval')}</label>
            <input type="number" min={1} max={120} value={interval} onChange={(e) => setInterval_(+e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-background/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500" />
          </div>
          <div>
            <label className="text-xs text-foreground/50 mb-1 block">{t('settings.maxFailures')}</label>
            <input type="number" min={1} max={20} value={maxFailures} onChange={(e) => setMaxFailures(+e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-background/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500" />
          </div>
        </div>
      </section>

      {/* PoO Thresholds */}
      <section className="glass-card-purple rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{t('settings.pooVerification')}</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-foreground/50 mb-1 block">{t('settings.executionThreshold')}</label>
            <input type="number" min={0} max={100} value={execThreshold} onChange={(e) => setExecThreshold(+e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-background/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500" />
            <p className="text-xs text-foreground/30 mt-1">{t('settings.execThresholdHint', { threshold: execThreshold })}</p>
          </div>
          <div>
            <label className="text-xs text-foreground/50 mb-1 block">{t('settings.sandboxTimeout')}</label>
            <input type="number" min={5} max={300} value={sandboxTimeout} onChange={(e) => setSandboxTimeout(+e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-background/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500" />
          </div>
          <div>
            <label className="text-xs text-foreground/50 mb-1 block">{t('settings.confidencePause')}</label>
            <input type="number" min={0} max={100} value={confidencePause} onChange={(e) => setConfidencePause(+e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-background/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500" />
            <p className="text-xs text-foreground/30 mt-1">{t('settings.confidencePauseHint', { value: confidencePause })}</p>
          </div>
        </div>
      </section>

      {/* AI Role Personality Config */}
      <section className="glass-card-purple rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{t('settings.personality.title')}</h2>
        <p className="text-xs text-foreground/40">{t('settings.personality.description')}</p>
        {(['AI-1', 'AI-2', 'AI-3'] as const).map((role) => {
          const icons = { 'AI-1': <Swords className="w-4 h-4 text-red-400" />, 'AI-2': <Eye className="w-4 h-4 text-cyan-400" />, 'AI-3': <Landmark className="w-4 h-4 text-amber-400" /> }
          const colors = { 'AI-1': 'border-red-500/30', 'AI-2': 'border-cyan-500/30', 'AI-3': 'border-amber-500/30' }
          const roleNames: Record<string, string> = { 'AI-1': t('roles.ai1.name'), 'AI-2': t('roles.ai2.name'), 'AI-3': t('roles.ai3.name') }
          return (
            <div key={role} className={cn('rounded-lg border p-4 space-y-3', colors[role])}>
              <div className="flex items-center gap-2">
                {icons[role]}
                <span className="text-sm font-bold text-foreground">{role}: {roleNames[role]}</span>
              </div>
              <div>
                <label className="text-xs text-foreground/50 mb-1 block">{t('settings.personality.personalityLabel')}</label>
                <textarea
                  value={roleConfig[role]?.personality ?? ''}
                  onChange={(e) => updateRole(role, 'personality', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-md bg-background/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 resize-none"
                  placeholder={t('settings.personality.personalityPlaceholder')}
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-foreground/50">{t('settings.personality.temperature')}</label>
                <input
                  type="range" min={0} max={100}
                  value={Math.round((roleConfig[role]?.temperature ?? 0.5) * 100)}
                  onChange={(e) => updateRole(role, 'temperature', +e.target.value / 100)}
                  className="flex-1 h-2 accent-purple-500"
                />
                <span className="text-xs font-mono text-foreground/60 w-10 text-right">
                  {(roleConfig[role]?.temperature ?? 0.5).toFixed(2)}
                </span>
              </div>
            </div>
          )
        })}
      </section>

      {/* Active Constraints */}
      <section className="glass-card-purple rounded-xl p-5 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">{t('settings.currentConstraints')}</h2>
        {constraints.length === 0 && (
          <p className="text-foreground/40 text-center py-4">{t('settings.noConstraints')}</p>
        )}
        {constraints.map((c: any) => (
          <div key={c.id} className="flex items-start gap-3 py-2 border-b border-border/10 last:border-0">
            <Badge className={cn('text-xs shrink-0 mt-0.5',
              c.severity === 'hard' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
            )}>
              {c.severity}
            </Badge>
            <div>
              <p className="text-sm text-foreground/80">{c.rule}</p>
              <p className="text-xs text-foreground/40">{c.description}</p>
            </div>
            <Badge variant="outline" className="text-xs shrink-0">{c.category}</Badge>
          </div>
        ))}
      </section>
    </div>
  )
}
