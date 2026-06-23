import { describe, it, expect } from 'vitest'
import {
  calculateBaseCapacity,
  calculateRotatedCapacity,
  getEffectiveCapacity,
} from './capacity'

describe('calculateBaseCapacity', () => {
  it('cell 545×400 with product 50×40 fits 100 units', () => {
    expect(calculateBaseCapacity(
      { computed_width_mm: 545, computed_height_mm: 400 },
      { type: 'unit', width_mm: 50, height_mm: 40 }
    )).toBe(100)
  })

  it('returns 0 when cell has zero width', () => {
    expect(calculateBaseCapacity(
      { computed_width_mm: 0, computed_height_mm: 400 },
      { type: 'unit', width_mm: 50, height_mm: 40 }
    )).toBe(0)
  })

  it('returns 0 when product has zero height', () => {
    expect(calculateBaseCapacity(
      { computed_width_mm: 545, computed_height_mm: 400 },
      { type: 'unit', width_mm: 50, height_mm: 0 }
    )).toBe(0)
  })
})

describe('calculateRotatedCapacity', () => {
  it('adds 8 rotated units when 45mm remainder fits product turned 90deg (height=40)', () => {
    // Cell 545×400, product 50×40
    // Base fills: floor(545/50)=10 columns → remainder = 45mm
    // Rotated: 45 >= 40 (product.height) → floor(45/40)=1 col × floor(400/50)=8 rows = 8
    expect(calculateRotatedCapacity(
      { computed_width_mm: 545, computed_height_mm: 400 },
      { type: 'unit', width_mm: 50, height_mm: 40 }
    )).toBe(8)
  })

  it('returns 0 when remainder is too small for rotated product', () => {
    // Cell 510×400, product 50×40: remainder = 10mm < 40mm (product.height) → 0
    expect(calculateRotatedCapacity(
      { computed_width_mm: 510, computed_height_mm: 400 },
      { type: 'unit', width_mm: 50, height_mm: 40 }
    )).toBe(0)
  })
})

describe('getEffectiveCapacity', () => {
  it('returns 108 for unit product with rotation enabled', () => {
    // 100 base + 8 rotated
    expect(getEffectiveCapacity(
      { computed_width_mm: 545, computed_height_mm: 400 },
      { type: 'unit', width_mm: 50, height_mm: 40 },
      { rotation_allowed: true, capacity_override: null }
    )).toBe(108)
  })

  it('returns only base capacity when rotation_allowed is false', () => {
    expect(getEffectiveCapacity(
      { computed_width_mm: 545, computed_height_mm: 400 },
      { type: 'unit', width_mm: 50, height_mm: 40 },
      { rotation_allowed: false, capacity_override: null }
    )).toBe(100)
  })

  it('does not add rotation for square product even when rotation_allowed is true', () => {
    // Cell 545×400, product 50×50: base = floor(545/50)*floor(400/50) = 10*8 = 80
    // width === height → rotation skipped
    expect(getEffectiveCapacity(
      { computed_width_mm: 545, computed_height_mm: 400 },
      { type: 'unit', width_mm: 50, height_mm: 50 },
      { rotation_allowed: true, capacity_override: null }
    )).toBe(80)
  })

  it('lays the larger side down — input order does not matter (40×50 == 50×40)', () => {
    // Cell 540×400, board 40×50: larger side (50) goes horizontal → 540/50=10,
    // 400/40=10 = 100 base; leftover 40mm fits a rotated column: 1 × (400/50=8) = 8.
    const cell = { computed_width_mm: 540, computed_height_mm: 400 }
    const opts = { rotation_allowed: true, capacity_override: null }
    expect(getEffectiveCapacity(cell, { type: 'unit', width_mm: 40, height_mm: 50 }, opts)).toBe(108)
    expect(getEffectiveCapacity(cell, { type: 'unit', width_mm: 50, height_mm: 40 }, opts)).toBe(108)
  })

  it('rotation off still uses larger-side-down base (40×50 in 540×400 → 100)', () => {
    expect(getEffectiveCapacity(
      { computed_width_mm: 540, computed_height_mm: 400 },
      { type: 'unit', width_mm: 40, height_mm: 50 },
      { rotation_allowed: false, capacity_override: null },
    )).toBe(100)
  })

  it('returns capacity_override and ignores calculation when override is set', () => {
    expect(getEffectiveCapacity(
      { computed_width_mm: 545, computed_height_mm: 400 },
      { type: 'unit', width_mm: 50, height_mm: 40 },
      { rotation_allowed: true, capacity_override: 50 }
    )).toBe(50)
  })

  it('returns 0 for bulk product when override is null', () => {
    expect(getEffectiveCapacity(
      { computed_width_mm: 545, computed_height_mm: 400 },
      { type: 'bulk' },
      { rotation_allowed: false, capacity_override: null }
    )).toBe(0)
  })

  it('returns override for bulk product when override is set', () => {
    expect(getEffectiveCapacity(
      { computed_width_mm: 545, computed_height_mm: 400 },
      { type: 'bulk' },
      { rotation_allowed: false, capacity_override: 12 }
    )).toBe(12)
  })

  it('returns 0 for round product when override is null', () => {
    expect(getEffectiveCapacity(
      { computed_width_mm: 545, computed_height_mm: 400 },
      { type: 'round', diameter_mm: 110 },
      { rotation_allowed: false, capacity_override: null }
    )).toBe(0)
  })
})
