import { create } from 'zustand'

export const useStore = create((set, get) => ({
  servers: [],
  activeServerId: null,
  artifactInfo: {},
  syncState: {},
  schedules: {},
  history: {},
  serverRunning: {},
  toasts: [],
  showAddServer: false,

  setServers: (servers) => set({ servers }),
  setActiveServerId: (id) => set({ activeServerId: id }),
  setArtifactInfo: (serverId, info) =>
    set((s) => ({ artifactInfo: { ...s.artifactInfo, [serverId]: info } })),
  setSyncState: (serverId, state) =>
    set((s) => ({ syncState: { ...s.syncState, [serverId]: state } })),
  setSchedule: (serverId, schedule) =>
    set((s) => ({ schedules: { ...s.schedules, [serverId]: schedule } })),
  setHistory: (serverId, history) =>
    set((s) => ({ history: { ...s.history, [serverId]: history } })),
  setServerRunning: (serverId, running) =>
    set((s) => ({ serverRunning: { ...s.serverRunning, [serverId]: running } })),
  setShowAddServer: (v) => set({ showAddServer: v }),

  addToast: (toast) => {
    const id = Date.now()
    set((s) => ({ toasts: [...s.toasts, { id, ...toast }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 4000)
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  getActiveServer: () => {
    const { servers, activeServerId } = get()
    return servers.find((s) => s.id === activeServerId) || servers[0] || null
  }
}))
