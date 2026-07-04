import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './store'

// The bug: after a full page reload the Zustand store re-initialised with
// activeSessionId=null, so OrderDraftPage / ChecklistPage stayed on an infinite
// spinner (order query keyed by a null session never resolves). Fix: persist
// activeSessionId (+ isSessionMode) to localStorage so a reload restores it.
describe('app store persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    useAppStore.setState({ activeSessionId: null, isSessionMode: false })
  })

  it('writes activeSessionId to localStorage under the store key', () => {
    useAppStore.getState().setActiveSession('sess-123')
    const raw = localStorage.getItem('cell-app-store')
    expect(raw).toBeTruthy()
    expect(raw).toContain('sess-123')
  })

  it('persists ONLY the session fields, not user or transient state', () => {
    useAppStore.getState().setUser('user-abc', 'admin')
    useAppStore.getState().setActiveSession('sess-123')
    const persisted = JSON.parse(localStorage.getItem('cell-app-store')!).state
    expect(persisted.activeSessionId).toBe('sess-123')
    // userId comes back from the Supabase session, not from here — must NOT leak
    // into localStorage.
    expect(persisted.userId).toBeUndefined()
    expect(persisted.isOnline).toBeUndefined()
  })

  it('rehydrates activeSessionId from localStorage (simulated reload)', async () => {
    // Seed storage as if a previous page-load had saved the session.
    localStorage.setItem(
      'cell-app-store',
      JSON.stringify({ state: { activeSessionId: 'sess-xyz', isSessionMode: true }, version: 0 }),
    )
    // Re-run rehydration (what happens on a fresh page load).
    await useAppStore.persist.rehydrate()
    expect(useAppStore.getState().activeSessionId).toBe('sess-xyz')
    expect(useAppStore.getState().isSessionMode).toBe(true)
  })
})
