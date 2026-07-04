import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock factories are hoisted above top-level vars, so mock refs live in
// vi.hoisted(). The `.and()` predicate is captured so tests can assert the
// filter matches on cell_id; `first()` returns whatever setExisting() stubs.
const h = vi.hoisted(() => {
  const state: {
    existingRow: { id: string; cell_id: string; session_id: string } | undefined
    capturedAndPredicate: ((e: { cell_id: string }) => boolean) | undefined
  } = { existingRow: undefined, capturedAndPredicate: undefined }

  const firstMock = vi.fn(async () => state.existingRow)
  const andMock = vi.fn((pred: (e: { cell_id: string }) => boolean) => {
    state.capturedAndPredicate = pred
    return { first: firstMock }
  })
  const equalsMock = vi.fn(() => ({ and: andMock }))
  const whereMock = vi.fn(() => ({ equals: equalsMock }))
  const mutateUpsert = vi.fn(async () => 'ok' as 'ok' | 'queued')

  return { state, firstMock, andMock, equalsMock, whereMock, mutateUpsert }
})

vi.mock('@/data/db', () => ({
  db: { stock_entries: { where: h.whereMock } },
}))

vi.mock('@/data/mutate', () => ({
  mutateUpsert: h.mutateUpsert,
}))

import { saveStockEntry } from './saveStockEntry'

beforeEach(() => {
  h.state.existingRow = undefined
  h.state.capturedAndPredicate = undefined
  vi.clearAllMocks()
  h.mutateUpsert.mockResolvedValue('ok')
})

describe('saveStockEntry — orchestration', () => {
  it('creates a NEW entry (valid uuid id) when none exists for the cell', async () => {
    h.state.existingRow = undefined

    await saveStockEntry({ cellId: 'c1', sessionId: 's1', userId: 'u1', value: 7 })

    expect(h.mutateUpsert).toHaveBeenCalledTimes(1)
    const entry = (h.mutateUpsert.mock.calls[0] as unknown[])[2] as Record<string, unknown>
    expect(entry.cell_id).toBe('c1')
    expect(entry.session_id).toBe('s1')
    expect(entry.user_id).toBe('u1')
    expect(entry.value).toBe(7)
    expect(typeof entry.id).toBe('string')
    expect((entry.id as string).length).toBeGreaterThan(0)

    // filter queried session_id and matched on cell_id
    expect(h.whereMock).toHaveBeenCalledWith('session_id')
    expect(h.equalsMock).toHaveBeenCalledWith('s1')
    expect(h.state.capturedAndPredicate!({ cell_id: 'c1' } as never)).toBe(true)
    expect(h.state.capturedAndPredicate!({ cell_id: 'other' } as never)).toBe(false)
  })

  it('REUSES the existing row id (collapse, no second record)', async () => {
    h.state.existingRow = { id: 'existing-123', cell_id: 'c1', session_id: 's1' }

    await saveStockEntry({ cellId: 'c1', sessionId: 's1', userId: 'u1', value: 3 })

    expect(h.mutateUpsert).toHaveBeenCalledTimes(1)
    const entry = (h.mutateUpsert.mock.calls[0] as unknown[])[2] as Record<string, unknown>
    expect(entry.id).toBe('existing-123')
  })

  it('propagates value, including value=0 as a valid "empty"', async () => {
    h.state.existingRow = undefined

    await saveStockEntry({ cellId: 'c1', sessionId: 's1', userId: 'u1', value: 0 })

    const entry = (h.mutateUpsert.mock.calls[0] as unknown[])[2] as Record<string, unknown>
    expect(entry.value).toBe(0)
  })

  it('returns "ok" when mutateUpsert resolves "ok"', async () => {
    h.mutateUpsert.mockResolvedValue('ok')
    const r = await saveStockEntry({ cellId: 'c1', sessionId: 's1', userId: 'u1', value: 1 })
    expect(r).toBe('ok')
  })

  it('returns "local" when mutateUpsert resolves "queued"', async () => {
    h.mutateUpsert.mockResolvedValue('queued')
    const r = await saveStockEntry({ cellId: 'c1', sessionId: 's1', userId: 'u1', value: 1 })
    expect(r).toBe('local')
  })
})
