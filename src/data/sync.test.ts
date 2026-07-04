import { describe, it, expect, vi } from 'vitest'
import { applyRealtimeChange } from './sync'

// Minimal in-memory stand-in for a Dexie table.
function fakeTable(initial: Record<string, { id: string; updated_at?: string; v?: number }> = {}) {
  const store = { ...initial }
  return {
    store,
    get: vi.fn(async (id: string) => store[id]),
    put: vi.fn(async (val: { id: string }) => { store[val.id] = val as never }),
    delete: vi.fn(async (id: string) => { delete store[id] }),
  }
}

describe('applyRealtimeChange', () => {
  it('inserts a new row when none exists locally', async () => {
    const t = fakeTable()
    await applyRealtimeChange(t, { eventType: 'INSERT', new: { id: 'a', updated_at: '2026-01-01T00:00:00Z', v: 1 } })
    expect(t.store['a']).toMatchObject({ v: 1 })
  })

  it('applies a NEWER echo over the local row', async () => {
    const t = fakeTable({ a: { id: 'a', updated_at: '2026-01-01T00:00:00Z', v: 1 } })
    await applyRealtimeChange(t, { eventType: 'UPDATE', new: { id: 'a', updated_at: '2026-01-02T00:00:00Z', v: 2 } })
    expect(t.store['a']).toMatchObject({ v: 2 })
  })

  it('KEEPS the local row when the echo is older (no clobber)', async () => {
    const t = fakeTable({ a: { id: 'a', updated_at: '2026-01-02T00:00:00Z', v: 2 } })
    await applyRealtimeChange(t, { eventType: 'UPDATE', new: { id: 'a', updated_at: '2026-01-01T00:00:00Z', v: 1 } })
    expect(t.store['a']).toMatchObject({ v: 2 }) // local (newer) wins
    expect(t.put).not.toHaveBeenCalled()
  })

  it('deletes on DELETE', async () => {
    const t = fakeTable({ a: { id: 'a', v: 1 } })
    await applyRealtimeChange(t, { eventType: 'DELETE', old: { id: 'a' } })
    expect(t.store['a']).toBeUndefined()
  })
})
