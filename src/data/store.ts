import { create } from 'zustand'

interface AppStore {
  isOnline: boolean
  isSyncing: boolean
  syncQueueLength: number

  userId: string | null
  userRole: 'admin' | 'employee' | null

  activeSessionId: string | null
  isSessionMode: boolean

  setOnline: (v: boolean) => void
  setSyncing: (v: boolean) => void
  setSyncQueueLength: (n: number) => void
  setUser: (id: string, role: 'admin' | 'employee') => void
  clearUser: () => void
  setActiveSession: (id: string | null) => void
  setSessionMode: (v: boolean) => void
}

export const useAppStore = create<AppStore>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  syncQueueLength: 0,

  userId: null,
  userRole: null,

  activeSessionId: null,
  isSessionMode: false,

  setOnline: (v) => set({ isOnline: v }),
  setSyncing: (v) => set({ isSyncing: v }),
  setSyncQueueLength: (n) => set({ syncQueueLength: n }),
  setUser: (id, role) => set({ userId: id, userRole: role }),
  clearUser: () => set({ userId: null, userRole: null, activeSessionId: null, isSessionMode: false }),
  setActiveSession: (id) => set({ activeSessionId: id }),
  setSessionMode: (v) => set({ isSessionMode: v }),
}))
