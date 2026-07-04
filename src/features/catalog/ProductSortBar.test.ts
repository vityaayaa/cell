import { describe, it, expect } from 'vitest'
import { compareByDimensions } from './ProductSortBar'
import type { Product } from '@/data/db'

/** Build a minimal Product-like object with only the fields the sort reads. */
function p(
  name: string,
  height_mm: number | null,
  width_mm: number | null,
  length_mm: number | null,
  diameter_mm: number | null = null,
): Product {
  return { name, height_mm, width_mm, length_mm, diameter_mm } as unknown as Product
}

/** Compact key for asserting order: "name HxW/L". */
function key(x: Product): string {
  return `${x.name} ${x.height_mm ?? 0}×${x.width_mm ?? x.diameter_mm ?? 0}/${x.length_mm ?? 0}`
}

describe('compareByDimensions', () => {
  it('name is the top level; then section; then length asc as tie-breaker (lengthMode off)', () => {
    // Same section (50×50), different length: must be ordered by length ascending.
    const items = [
      p('труба серая', 110, 110, 1000),
      p('труба красная', 50, 50, 3000),
      p('труба красная', 160, 160, 1000),
      p('труба серая', 50, 50, 2000),
      p('труба красная', 50, 50, 2000),
      p('труба красная', 110, 110, 1000),
    ]
    const sorted = [...items].sort((a, b) => compareByDimensions(a, b, false))
    expect(sorted.map(key)).toEqual([
      // красная before серая (А-Я); inside красная by section, ties by length asc
      'труба красная 50×50/2000',
      'труба красная 50×50/3000',
      'труба красная 110×110/1000',
      'труба красная 160×160/1000',
      'труба серая 50×50/2000',
      'труба серая 110×110/1000',
    ])
  })

  it("lengthMode='asc' lifts length above section but NOT above name", () => {
    const items = [
      p('труба серая', 110, 110, 1000),
      p('труба красная', 160, 160, 3000),
      p('труба красная', 50, 50, 1000),
      p('труба серая', 50, 50, 2000),
    ]
    const sorted = [...items].sort((a, b) => compareByDimensions(a, b, 'asc'))
    expect(sorted.map((x) => x.name)).toEqual([
      // Names never interleave: all красная first, then all серая.
      'труба красная',
      'труба красная',
      'труба серая',
      'труба серая',
    ])
    // Within красная: length ascending wins over the larger section.
    expect(sorted.map(key)).toEqual([
      'труба красная 50×50/1000',
      'труба красная 160×160/3000',
      'труба серая 110×110/1000',
      'труба серая 50×50/2000',
    ])
  })
})
