import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface AppStore {
  isOnline: boolean
  isSyncing: boolean
  syncQueueLength: number

  userId: string | null
  userRole: 'admin' | 'employee' | null

  activeSessionId: string | null
  isSessionMode: boolean

  priorityMaterialId: string | null

  /** Catalog accordion: groups the user has expanded. Lives only while the app
   *  is open — restarting collapses everything. */
  expandedGroupIds: Set<string>

  /** Admin shelf zoom/pan, kept while the app is open so leaving and returning
   *  to the constructor restores the same view. */
  shelfTransform: { scale: number; positionX: number; positionY: number } | null

  setOnline: (v: boolean) => void
  setSyncing: (v: boolean) => void
  setSyncQueueLength: (n: number) => void
  setUser: (id: string, role: 'admin' | 'employee') => void
  clearUser: () => void
  setActiveSession: (id: string | null) => void
  setSessionMode: (v: boolean) => void
  setPriorityMaterialId: (id: string | null) => void
  toggleExpandedGroup: (id: string) => void
  setShelfTransform: (t: { scale: number; positionX: number; positionY: number }) => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  syncQueueLength: 0,

  userId: null,
  userRole: null,

  activeSessionId: null,
  isSessionMode: false,

  priorityMaterialId: null,

  expandedGroupIds: new Set<string>(),

  shelfTransform: null,

  setOnline: (v) => set({ isOnline: v }),
  setSyncing: (v) => set({ isSyncing: v }),
  setSyncQueueLength: (n) => set({ syncQueueLength: n }),
  setUser: (id, role) => set({ userId: id, userRole: role }),
  clearUser: () => set({ userId: null, userRole: null, activeSessionId: null, isSessionMode: false }),
  setActiveSession: (id) => set({ activeSessionId: id }),
  setSessionMode: (v) => set({ isSessionMode: v }),
  setPriorityMaterialId: (id) => set({ priorityMaterialId: id }),
  toggleExpandedGroup: (id) =>
    set((s) => {
      const next = new Set(s.expandedGroupIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { expandedGroupIds: next }
    }),
  setShelfTransform: (t) => set({ shelfTransform: t }),
    }),
    {
      name: 'cell-app-store',
      storage: createJSONStorage(() => localStorage),
      // Persist ТОЛЬКО активную сессию и режим сессии — чтобы после
      // перезагрузки страницы заявка/чеклист знали, какая сессия открыта
      // (иначе activeSessionId=null → вечный кружок загрузки). Всё остальное
      // (userId из Supabase-сессии, онлайн-статус, аккордеон, зум) НЕ
      // сохраняем: оно либо восстанавливается иначе, либо живёт только в сессии.
      partialize: (s) => ({
        activeSessionId: s.activeSessionId,
        isSessionMode: s.isSessionMode,
      }),
    },
  ),
)
