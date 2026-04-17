import type { ChatGet, ChatSet, RuntimeActions } from './store-api';

export function createRuntimeUiActions(set: ChatSet, get: ChatGet): Pick<RuntimeActions, 'toggleThinking' | 'refresh' | 'clearError' | 'renameSession' | 'setChatMode'> {
  return {
    toggleThinking: () => set((s) => ({ showThinking: !s.showThinking })),

    renameSession: (sessionKey, label) =>
      set((s) => {
        const trimmed = label.trim();
        // 空输入不修改，保持原有标签
        if (!trimmed) return {};
        const updated = { ...s.sessionLabels, [sessionKey]: trimmed };
        try { localStorage.setItem('nc-session-labels', JSON.stringify(updated)); } catch {}
        return { sessionLabels: updated };
      }),

    // ── Refresh: reload history + sessions ──

    refresh: async () => {
      const { loadHistory, loadSessions } = get();
      await Promise.all([loadHistory(), loadSessions()]);
    },

    clearError: () => set({ error: null }),

    setChatMode: (mode) => set({ chatMode: mode }),
  };
}
