import { describe, it, expect } from 'vitest'
import {
  calculateDeficitPacks,
  buildOrderLines,
  type CellStock,
} from './request'

function makeUnit(
  overrides: Partial<CellStock> & {
    capacity: number
    current_stock: number
    pack_size: number
  },
): CellStock {
  return {
    cell_id: 'c1',
    product_id: 'p1',
    product_type: 'unit',
    ...overrides,
  }
}

describe('calculateDeficitPacks', () => {
  it('unit: deficit 10 units, pack_size 10 → 1 full pack, not boundary', () => {
    const result = calculateDeficitPacks(makeUnit({ capacity: 50, current_stock: 40, pack_size: 10 }))
    expect(result.full_packs).toBe(1)
    expect(result.is_boundary).toBe(false)
    expect(result.deficit).toBe(10)
  })

  it('unit boundary: deficit 3 units, pack_size 10 → 0 full packs, is_boundary', () => {
    const result = calculateDeficitPacks(makeUnit({ capacity: 50, current_stock: 47, pack_size: 10 }))
    expect(result.full_packs).toBe(0)
    expect(result.is_boundary).toBe(true)
    expect(result.deficit).toBe(3)
  })

  it('unit full stock: deficit 0 → 0 full packs, not boundary', () => {
    const result = calculateDeficitPacks(makeUnit({ capacity: 50, current_stock: 50, pack_size: 10 }))
    expect(result.full_packs).toBe(0)
    expect(result.is_boundary).toBe(false)
    expect(result.deficit).toBe(0)
  })

  it('bulk: capacity 8 packs, stock 4 packs → 4 full packs', () => {
    const result = calculateDeficitPacks({
      cell_id: 'c1', product_id: 'p1', product_type: 'bulk',
      capacity: 8, current_stock: 4, pack_size: 100,
    })
    expect(result.full_packs).toBe(4)
    expect(result.is_boundary).toBe(false)
    expect(result.deficit).toBe(4)
  })

  it('bulk full stock: deficit 0 → 0 full packs, not boundary', () => {
    const result = calculateDeficitPacks({
      cell_id: 'c1', product_id: 'p1', product_type: 'bulk',
      capacity: 8, current_stock: 8, pack_size: 100,
    })
    expect(result.full_packs).toBe(0)
    expect(result.is_boundary).toBe(false)
  })
})

describe('buildOrderLines', () => {
  it('aggregates deficit across 2 cells before applying floor — not poячеечно', () => {
    // Per-cell: deficit 7 and 6, pack_size 10 → per-cell gives 0+0=0 (wrong)
    // Aggregated: floor(13/10)=1 (correct)
    const cells: CellStock[] = [
      { cell_id: 'c1', product_id: 'p1', product_type: 'unit', capacity: 50, current_stock: 43, pack_size: 10 },
      { cell_id: 'c2', product_id: 'p1', product_type: 'unit', capacity: 50, current_stock: 44, pack_size: 10 },
    ]
    const lines = buildOrderLines(cells)
    expect(lines).toHaveLength(1)
    expect(lines[0].product_id).toBe('p1')
    expect(lines[0].quantity_packs).toBe(1)
  })

  it('places non-boundary lines before boundary lines', () => {
    const cells: CellStock[] = [
      // p1: boundary — deficit 3, pack_size 10
      { cell_id: 'c1', product_id: 'p1', product_type: 'unit', capacity: 50, current_stock: 47, pack_size: 10 },
      // p2: normal — deficit 20, pack_size 10 → 2 packs
      { cell_id: 'c2', product_id: 'p2', product_type: 'unit', capacity: 50, current_stock: 30, pack_size: 10 },
    ]
    const lines = buildOrderLines(cells)
    expect(lines).toHaveLength(2)
    expect(lines[0].product_id).toBe('p2')       // non-boundary first
    expect(lines[0].is_boundary).toBe(false)
    expect(lines[1].product_id).toBe('p1')       // boundary last
    expect(lines[1].is_boundary).toBe(true)
  })

  it('excludes products with zero deficit and not boundary', () => {
    const cells: CellStock[] = [
      { cell_id: 'c1', product_id: 'p1', product_type: 'unit', capacity: 50, current_stock: 50, pack_size: 10 },
    ]
    const lines = buildOrderLines(cells)
    expect(lines).toHaveLength(0)
  })

  it('sets deficit_units to null for bulk products', () => {
    const cells: CellStock[] = [
      { cell_id: 'c1', product_id: 'p1', product_type: 'bulk', capacity: 8, current_stock: 4, pack_size: 100 },
    ]
    const lines = buildOrderLines(cells)
    expect(lines).toHaveLength(1)
    expect(lines[0].deficit_units).toBeNull()
    expect(lines[0].quantity_packs).toBe(4)
  })
})
