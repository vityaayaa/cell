import { describe, it, expect } from 'vitest'
import type { Cell } from '@/data/db'
import { buildSweepOrder } from './sweepOrder'

// Minimal leaf-cell factory: only the fields buildSweepOrder reads matter.
function makeCell(id: string, overrides: Partial<Cell> = {}): Cell {
  return {
    id,
    shelf_id: 'shelf-1',
    parent_id: null,
    row_index: 0,
    col_index: 0,
    split_direction: null,
    child_index: null,
    width_mm: null,
    height_mm: null,
    computed_width_mm: 0,
    computed_height_mm: 0,
    product_id: 'prod-1',
    capacity_override: null,
    rotation_allowed: false,
    needs_review: false,
    is_disabled: false,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('buildSweepOrder', () => {
  it('includes leaf cells with a product in reading order', () => {
    const cells = [
      makeCell('a', { row_index: 0, col_index: 0 }),
      makeCell('b', { row_index: 0, col_index: 1 }),
    ]
    expect(buildSweepOrder(cells).map(c => c.id)).toEqual(['a', 'b'])
  })

  it('skips cells without a product', () => {
    const cells = [
      makeCell('a', { col_index: 0 }),
      makeCell('b', { col_index: 1, product_id: null }),
    ]
    expect(buildSweepOrder(cells).map(c => c.id)).toEqual(['a'])
  })

  it('skips disabled (buffer) cells even with a product', () => {
    const cells = [
      makeCell('a', { col_index: 0 }),
      makeCell('b', { col_index: 1, is_disabled: true }),
    ]
    expect(buildSweepOrder(cells).map(c => c.id)).toEqual(['a'])
  })
})
