import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock factories are hoisted above top-level vars, so mock refs and mutable
// test state live in vi.hoisted().
const h = vi.hoisted(() => {
  const state: {
    stockEntries: Array<{
      id: string
      session_id: string
      cell_id: string
      value: number
      created_at: string
    }>
    cells: Map<string, Record<string, unknown>>
    products: Map<string, Record<string, unknown>>
  } = { stockEntries: [], cells: new Map(), products: new Map() }

  // stock_entries.where('session_id').equals(id).sortBy('created_at')
  const sortByMock = vi.fn(async (_key: string) =>
    [...state.stockEntries].sort((a, b) => a.created_at.localeCompare(b.created_at)),
  )
  const eqMock = vi.fn(() => ({ sortBy: sortByMock }))
  const whereMock = vi.fn(() => ({ equals: eqMock }))
  const cellsGet = vi.fn(async (id: string) => state.cells.get(id))
  const productsGet = vi.fn(async (id: string) => state.products.get(id))

  const mutateInsert = vi.fn(async () => 'ok' as const)
  const mutateInsertMany = vi.fn(async () => 'ok' as const)
  const updateSessionStatus = vi.fn(async () => {})

  return {
    state,
    sortByMock,
    eqMock,
    whereMock,
    cellsGet,
    productsGet,
    mutateInsert,
    mutateInsertMany,
    updateSessionStatus,
  }
})

vi.mock('@/data/db', () => ({
  db: {
    stock_entries: { where: h.whereMock },
    cells: { get: h.cellsGet },
    products: { get: h.productsGet },
    orders: {},
    order_lines: {},
  },
}))

vi.mock('@/data/mutate', () => ({
  mutateInsert: h.mutateInsert,
  mutateInsertMany: h.mutateInsertMany,
}))

vi.mock('./updateSessionStatus', () => ({
  updateSessionStatus: h.updateSessionStatus,
}))

import { generateOrder } from './generateOrder'

// --- Helpers -------------------------------------------------------------
// Unit product 50×40 in a 545×400 cell → floor(545/50)=10 × floor(400/40)=10 = 100 capacity.
function makeUnitCell(id: string, productId: string | null) {
  return {
    id,
    product_id: productId,
    computed_width_mm: 545,
    computed_height_mm: 400,
    rotation_allowed: false,
    capacity_override: null,
  }
}
function makeUnitProduct(id: string, opts: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    type: 'unit',
    name: 'Доска',
    width_mm: 50,
    height_mm: 40,
    pack_size: 10,
    display_name: null,
    ...opts,
  }
}

beforeEach(() => {
  h.state.stockEntries = []
  h.state.cells = new Map()
  h.state.products = new Map()
  vi.clearAllMocks()
})

describe('generateOrder — orchestration', () => {
  it('uses the LATEST stock entry per cell (by created_at)', async () => {
    // capacity=100. Earlier entry value=90 (deficit 10 → 1 pack),
    // later entry value=50 (deficit 50 → 5 packs). Latest must win → 5 packs.
    h.state.cells.set('cell-A', makeUnitCell('cell-A', 'prod-1'))
    h.state.products.set('prod-1', makeUnitProduct('prod-1'))
    h.state.stockEntries = [
      { id: 'e2', session_id: 's1', cell_id: 'cell-A', value: 50, created_at: '2026-01-02T00:00:00Z' },
      { id: 'e1', session_id: 's1', cell_id: 'cell-A', value: 90, created_at: '2026-01-01T00:00:00Z' },
    ]

    await generateOrder('s1')

    const lines = (h.mutateInsertMany.mock.calls[0] as unknown[])[2] as Array<Record<string, unknown>>
    expect(lines).toHaveLength(1)
    expect(lines[0].quantity_packs).toBe(5) // deficit 50 / pack 10
  })

  it('skips cells with no product_id (not in order_lines)', async () => {
    h.state.cells.set('cell-A', makeUnitCell('cell-A', 'prod-1'))
    h.state.cells.set('cell-B', makeUnitCell('cell-B', null)) // no product
    h.state.products.set('prod-1', makeUnitProduct('prod-1'))
    h.state.stockEntries = [
      { id: 'a', session_id: 's1', cell_id: 'cell-A', value: 50, created_at: '2026-01-01T00:00:00Z' },
      { id: 'b', session_id: 's1', cell_id: 'cell-B', value: 0, created_at: '2026-01-01T00:00:00Z' },
    ]

    await generateOrder('s1')

    const lines = (h.mutateInsertMany.mock.calls[0] as unknown[])[2] as Array<Record<string, unknown>>
    expect(lines).toHaveLength(1)
    expect(lines[0].product_id).toBe('prod-1')
  })

  it('skips disabled (buffer) cells even when they have a product', async () => {
    h.state.cells.set('cell-A', makeUnitCell('cell-A', 'prod-1'))
    h.state.cells.set('cell-B', { ...makeUnitCell('cell-B', 'prod-1'), is_disabled: true })
    h.state.products.set('prod-1', makeUnitProduct('prod-1'))
    h.state.stockEntries = [
      { id: 'a', session_id: 's1', cell_id: 'cell-A', value: 50, created_at: '2026-01-01T00:00:00Z' },
      { id: 'b', session_id: 's1', cell_id: 'cell-B', value: 0, created_at: '2026-01-01T00:00:00Z' },
    ]

    await generateOrder('s1')

    const lines = (h.mutateInsertMany.mock.calls[0] as unknown[])[2] as Array<Record<string, unknown>>
    // Both cells hold prod-1; the disabled one must not add to the deficit.
    expect(lines).toHaveLength(1)
    expect(lines[0].quantity_packs).toBe(5) // only cell-A's deficit 50 / pack 10
  })

  it('skips a cell whose product is missing from products table', async () => {
    h.state.cells.set('cell-A', makeUnitCell('cell-A', 'prod-1'))
    h.state.cells.set('cell-B', makeUnitCell('cell-B', 'ghost')) // product not in map
    h.state.products.set('prod-1', makeUnitProduct('prod-1'))
    h.state.stockEntries = [
      { id: 'a', session_id: 's1', cell_id: 'cell-A', value: 50, created_at: '2026-01-01T00:00:00Z' },
      { id: 'b', session_id: 's1', cell_id: 'cell-B', value: 0, created_at: '2026-01-01T00:00:00Z' },
    ]

    await generateOrder('s1')

    const lines = (h.mutateInsertMany.mock.calls[0] as unknown[])[2] as Array<Record<string, unknown>>
    expect(lines).toHaveLength(1)
    expect(lines[0].product_id).toBe('prod-1')
  })

  it('order_lines carry correct fields (is_manual=false, order_id, short product_name)', async () => {
    h.state.cells.set('cell-A', makeUnitCell('cell-A', 'prod-1'))
    // display_name set → getProductShortName returns the short/custom name
    h.state.products.set('prod-1', makeUnitProduct('prod-1', { display_name: 'Доска строганая' }))
    h.state.stockEntries = [
      { id: 'a', session_id: 's1', cell_id: 'cell-A', value: 50, created_at: '2026-01-01T00:00:00Z' },
    ]

    const orderId = await generateOrder('s1')

    const order = (h.mutateInsert.mock.calls[0] as unknown[])[2] as Record<string, unknown>
    expect(order.id).toBe(orderId)

    const lines = (h.mutateInsertMany.mock.calls[0] as unknown[])[2] as Array<Record<string, unknown>>
    expect(lines).toHaveLength(1)
    expect(lines[0].is_manual).toBe(false)
    expect(lines[0].order_id).toBe(orderId)
    expect(lines[0].product_name).toBe('Доска строганая')
  })

  it('calls updateSessionStatus(sessionId, "ordering") and returns the created orderId', async () => {
    h.state.cells.set('cell-A', makeUnitCell('cell-A', 'prod-1'))
    h.state.products.set('prod-1', makeUnitProduct('prod-1'))
    h.state.stockEntries = [
      { id: 'a', session_id: 's1', cell_id: 'cell-A', value: 50, created_at: '2026-01-01T00:00:00Z' },
    ]

    const orderId = await generateOrder('s1')

    expect(h.updateSessionStatus).toHaveBeenCalledWith('s1', 'ordering')
    const order = (h.mutateInsert.mock.calls[0] as unknown[])[2] as Record<string, unknown>
    expect(order.id).toBe(orderId)
    expect(typeof orderId).toBe('string')
    expect(orderId.length).toBeGreaterThan(0)
  })
})
