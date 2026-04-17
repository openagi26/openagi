/**
 * Trinity Zustand Store
 *
 * Frontend state management for Trinity engine, identity, and governance
 */
import { create } from 'zustand'
import { hostApiFetch } from '@/lib/host-api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrinityIdentity {
  nodeId: string
  creditScore: number
  isActive: boolean
  createdAt: string
}

interface TrinityEconomy {
  balance: number
  totalEarned: number
  totalSpent: number
  totalStaked: number
  halvingEpoch: number
  currentRewardRate: number
  recentTransactions: Array<{
    id: string
    timestamp: string
    type: string
    amount: number
    balance: number
    description: string
  }>
}

interface TrinityStatus {
  phase: string
  currentRound: number
  gameMode: string
  roleRotationCounter: number
  isRunning: boolean
  lastActivity: string
  confidence: number
  totalRounds: number
  recentResults: any[]
}

interface PoOStats {
  totalTasks: number
  verified: number
  failed: number
  discarded: number
  avgScore: number
  totalRewards: number
}

interface DashboardData {
  identity: TrinityIdentity | null
  economy: TrinityEconomy | null
  trinity: TrinityStatus
  poo: PoOStats
  value: { avgScore: number; totalTasks: number; totalNewbEarned: number }
  debts: { openCount: number; totalCost: number }
  playbooks: { count: number }
  isGenesisComplete: boolean
}

interface GenesisStatus {
  isComplete: boolean
  hasIdentity: boolean
  hasEconomy: boolean
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface TrinityStore {
  dashboard: DashboardData | null
  genesisStatus: GenesisStatus | null
  isLoading: boolean
  error: string | null

  fetchDashboard: () => Promise<void>
  checkGenesis: () => Promise<void>
  performGenesis: (passphrase: string) => Promise<{ success: boolean; message: string; nodeId?: string }>
  unlockIdentity: (passphrase: string) => Promise<boolean>
  lockIdentity: () => Promise<void>
  setGameMode: (mode: 'debate' | 'competition' | 'refinement') => Promise<void>
}

export const useTrinityStore = create<TrinityStore>((set, get) => ({
  dashboard: null,
  genesisStatus: null,
  isLoading: false,
  error: null,

  fetchDashboard: async () => {
    try {
      set({ isLoading: true, error: null })
      const data = await hostApiFetch<DashboardData>('/api/trinity/dashboard')
      set({ dashboard: data, isLoading: false })
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
    }
  },

  checkGenesis: async () => {
    try {
      const status = await hostApiFetch<GenesisStatus>('/api/trinity/genesis/status')
      set({ genesisStatus: status })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  performGenesis: async (passphrase: string) => {
    try {
      set({ isLoading: true, error: null })
      const result = await hostApiFetch<{ identity: any; balance: number; message: string }>(
        '/api/trinity/genesis',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passphrase }),
        }
      )
      await get().fetchDashboard()
      set({ isLoading: false })
      return { success: true, message: result.message, nodeId: result.identity.nodeId }
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
      return { success: false, message: err.message }
    }
  },

  unlockIdentity: async (passphrase: string) => {
    try {
      const result = await hostApiFetch<{ success: boolean }>(
        '/api/trinity/identity/unlock',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passphrase }),
        }
      )
      return result.success
    } catch {
      return false
    }
  },

  lockIdentity: async () => {
    try {
      await hostApiFetch('/api/trinity/identity/lock', { method: 'POST' })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  setGameMode: async (mode) => {
    try {
      await hostApiFetch('/api/trinity/game-mode', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      await get().fetchDashboard()
    } catch (err: any) {
      set({ error: err.message })
    }
  },
}))
