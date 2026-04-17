/**
 * Trinity AI Executor
 *
 * Connects Trinity roles (AI-1/AI-2/AI-3) to real AI providers
 * Uses the configured provider keys from OpenAGI settings
 */
import { getSetting } from '../utils/store'
import { logger } from '../utils/logger'
import type { TrinityRole } from './index'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AIExecutorConfig {
  /** Provider to use: 'openai' | 'anthropic' | 'deepseek' | 'local' etc. */
  provider: string
  /** Model identifier */
  model: string
  /** API base URL (for custom/local providers) */
  baseUrl?: string
  /** API key (resolved from settings) */
  apiKey?: string
  /** Max tokens per response */
  maxTokens: number
  /** Temperature (0-1) */
  temperature: number
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ProviderResponse {
  content: string
  tokensUsed: number
  model: string
  finishReason: string
}

// ─── Default Configs Per Role ─────────────────────────────────────────────────

const ROLE_CONFIGS: Record<TrinityRole, Partial<AIExecutorConfig>> = {
  'AI-1': { temperature: 0.8, maxTokens: 2000 },  // Creative/strategic
  'AI-2': { temperature: 0.2, maxTokens: 1500 },  // Precise/analytical
  'AI-3': { temperature: 0.4, maxTokens: 1000 },  // Balanced/decisive
}

// ─── AI Executor ──────────────────────────────────────────────────────────────

export class AIExecutor {
  private config: AIExecutorConfig

  constructor(config?: Partial<AIExecutorConfig>) {
    this.config = {
      provider: config?.provider ?? 'openai',
      model: config?.model ?? 'gpt-4o-mini',
      baseUrl: config?.baseUrl,
      apiKey: config?.apiKey,
      maxTokens: config?.maxTokens ?? 2000,
      temperature: config?.temperature ?? 0.5,
    }
  }

  /**
   * Execute a Trinity role prompt against the configured AI provider
   */
  async execute(role: TrinityRole, systemPrompt: string, context: string): Promise<string> {
    const roleConfig = ROLE_CONFIGS[role]
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: context },
    ]

    try {
      const response = await this.callProvider(messages, {
        ...this.config,
        ...roleConfig,
      })

      logger.info(`[Trinity:${role}] AI response received (${response.tokensUsed} tokens)`)
      return response.content
    } catch (err: any) {
      logger.error(`[Trinity:${role}] AI call failed: ${err.message}`)
      // Return a safe fallback that the parser can handle
      return this.generateFallbackResponse(role, err.message)
    }
  }

  /**
   * Resolve API key from OpenAGI settings store
   */
  async resolveApiKey(): Promise<string | null> {
    try {
      // Try to get from explicit config first
      if (this.config.apiKey) return this.config.apiKey

      // Try settings store based on provider
      const keyMap: Record<string, string> = {
        openai: 'openaiApiKey',
        anthropic: 'anthropicApiKey',
        deepseek: 'deepseekApiKey',
        glm: 'glmApiKey',
      }

      const settingKey = keyMap[this.config.provider]
      if (settingKey) {
        const key = await getSetting(settingKey as any)
        if (key && typeof key === 'string') return key
      }

      return null
    } catch {
      return null
    }
  }

  /**
   * Update executor configuration
   */
  updateConfig(partial: Partial<AIExecutorConfig>): void {
    Object.assign(this.config, partial)
  }

  getConfig(): AIExecutorConfig {
    return { ...this.config }
  }

  // ─── Provider Calls ───────────────────────────────────────────────────────

  private async callProvider(messages: ChatMessage[], config: AIExecutorConfig): Promise<ProviderResponse> {
    const apiKey = config.apiKey || await this.resolveApiKey()

    // Route to appropriate provider
    switch (config.provider) {
      case 'anthropic':
        return this.callAnthropic(messages, config, apiKey)
      case 'deepseek':
        return this.callOpenAICompatible(messages, config, apiKey, 'https://api.deepseek.com/v1')
      case 'local':
        return this.callOpenAICompatible(messages, config, apiKey, config.baseUrl ?? 'http://localhost:11434/v1')
      case 'openai':
      default:
        return this.callOpenAICompatible(messages, config, apiKey, config.baseUrl ?? 'https://api.openai.com/v1')
    }
  }

  private async callOpenAICompatible(
    messages: ChatMessage[],
    config: AIExecutorConfig,
    apiKey: string | null,
    baseUrl: string,
  ): Promise<ProviderResponse> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    const body = {
      model: config.model,
      messages,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Provider error ${response.status}: ${errorText.substring(0, 200)}`)
    }

    const data = await response.json() as any
    const choice = data.choices?.[0]

    return {
      content: choice?.message?.content ?? '',
      tokensUsed: data.usage?.total_tokens ?? 0,
      model: data.model ?? config.model,
      finishReason: choice?.finish_reason ?? 'unknown',
    }
  }

  private async callAnthropic(
    messages: ChatMessage[],
    config: AIExecutorConfig,
    apiKey: string | null,
  ): Promise<ProviderResponse> {
    if (!apiKey) throw new Error('Anthropic API key required')

    const systemMsg = messages.find((m) => m.role === 'system')?.content ?? ''
    const userMsgs = messages.filter((m) => m.role !== 'system')

    const body = {
      model: config.model.startsWith('claude') ? config.model : 'claude-sonnet-4-20250514',
      max_tokens: config.maxTokens,
      system: systemMsg,
      messages: userMsgs.map((m) => ({ role: m.role, content: m.content })),
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Anthropic error ${response.status}: ${errorText.substring(0, 200)}`)
    }

    const data = await response.json() as any
    const content = data.content?.[0]?.text ?? ''

    return {
      content,
      tokensUsed: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      model: data.model ?? config.model,
      finishReason: data.stop_reason ?? 'unknown',
    }
  }

  // ─── Fallback ─────────────────────────────────────────────────────────────

  private generateFallbackResponse(role: TrinityRole, errorMsg: string): string {
    const fallbacks: Record<TrinityRole, object> = {
      'AI-1': {
        title: 'Fallback: API Error Recovery',
        description: `AI-1 could not reach provider: ${errorMsg}. Suggesting diagnostic task.`,
        actionPlan: ['Check API key configuration', 'Verify network connectivity', 'Try alternative provider'],
        estimatedValue: 0,
        estimatedCost: 0,
        evidenceLevel: 'H4',
        supportingData: [`error: ${errorMsg}`],
      },
      'AI-2': {
        riskLevel: 'high',
        findings: [{
          category: 'technical',
          severity: 'error',
          description: `AI provider unreachable: ${errorMsg}`,
          recommendation: 'Pause operations until provider connectivity is restored',
        }],
        approved: false,
        confidence: 20,
      },
      'AI-3': {
        approved: false,
        evidenceLevel: 'H4',
        reasoning: `Cannot make informed decision — AI provider error: ${errorMsg}`,
        scoreComponents: { goalFit: 0, pooOutcome: 0, evidenceLevel: 25, cost: 100, debtImpact: 0 },
        priorityScore: 0,
      },
    }

    return JSON.stringify(fallbacks[role])
  }
}
