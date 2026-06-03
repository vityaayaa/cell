import { describe, it, expect } from 'vitest'
import {
  computeChildDimensions,
  recomputeDescendants,
  isLeaf,
  getLeafNodes,
  type BspNode,
} from './bsp'

function makeRoot(w: number, h: number): BspNode {
  return {
    id: 'root',
    parent_id: null,
    split_direction: null,
    is_first_child: null,
    width_mm: w,
    height_mm: h,
    computed_width_mm: w,
    computed_height_mm: h,
  }
}

describe('computeChildDimensions', () => {
  it('V-split of 545×400 gives both children 272×400 (floor split)', () => {
    const root = makeRoot(545, 400)
    const left = computeChildDimensions(root, 'V', true)
    const right = computeChildDimensions(root, 'V', false)
    expect(left).toEqual({ computed_width_mm: 272, computed_height_mm: 400 })
    expect(right).toEqual({ computed_width_mm: 272, computed_height_mm: 400 })
  })

  it('H-split of 545×400 gives both children 545×200', () => {
    const root = makeRoot(545, 400)
    const top = computeChildDimensions(root, 'H', true)
    const bottom = computeChildDimensions(root, 'H', false)
    expect(top).toEqual({ computed_width_mm: 545, computed_height_mm: 200 })
    expect(bottom).toEqual({ computed_width_mm: 545, computed_height_mm: 200 })
  })
})

describe('recomputeDescendants', () => {
  it('recalculates all descendants when root dimensions change', () => {
    // Tree: root 544×400 --V-split--> left, right (both stale 100×100)
    const nodes: BspNode[] = [
      {
        id: 'root',
        parent_id: null,
        split_direction: 'V',
        is_first_child: null,
        width_mm: 544,
        height_mm: 400,
        computed_width_mm: 544,
        computed_height_mm: 400,
      },
      {
        id: 'left',
        parent_id: 'root',
        split_direction: null,
        is_first_child: true,
        computed_width_mm: 100, // stale — should become 272
        computed_height_mm: 100, // stale — should become 400
      },
      {
        id: 'right',
        parent_id: 'root',
        split_direction: null,
        is_first_child: false,
        computed_width_mm: 100, // stale
        computed_height_mm: 100, // stale
      },
    ]

    const result = recomputeDescendants(nodes)
    const left = result.find(n => n.id === 'left')!
    const right = result.find(n => n.id === 'right')!

    expect(left.computed_width_mm).toBe(272)
    expect(left.computed_height_mm).toBe(400)
    expect(right.computed_width_mm).toBe(272)
    expect(right.computed_height_mm).toBe(400)
  })

  it('handles depth-2 tree: root V-split then right child H-split', () => {
    // root 545×400 --V-split--> left(272×400), right --H-split--> right_top, right_bottom
    const nodes: BspNode[] = [
      {
        id: 'root',
        parent_id: null,
        split_direction: 'V',
        is_first_child: null,
        width_mm: 545,
        height_mm: 400,
        computed_width_mm: 545,
        computed_height_mm: 400,
      },
      {
        id: 'left',
        parent_id: 'root',
        split_direction: null,
        is_first_child: true,
        computed_width_mm: 0,
        computed_height_mm: 0,
      },
      {
        id: 'right',
        parent_id: 'root',
        split_direction: 'H',
        is_first_child: false,
        computed_width_mm: 0,
        computed_height_mm: 0,
      },
      {
        id: 'right_top',
        parent_id: 'right',
        split_direction: null,
        is_first_child: true,
        computed_width_mm: 0,
        computed_height_mm: 0,
      },
      {
        id: 'right_bottom',
        parent_id: 'right',
        split_direction: null,
        is_first_child: false,
        computed_width_mm: 0,
        computed_height_mm: 0,
      },
    ]

    const result = recomputeDescendants(nodes)
    const byId = Object.fromEntries(result.map(n => [n.id, n]))

    expect(byId['left'].computed_width_mm).toBe(272)
    expect(byId['left'].computed_height_mm).toBe(400)
    // right = same width as left (V-split), full height
    expect(byId['right'].computed_width_mm).toBe(272)
    expect(byId['right'].computed_height_mm).toBe(400)
    // right_top and right_bottom: H-split of right (272×400)
    expect(byId['right_top'].computed_width_mm).toBe(272)
    expect(byId['right_top'].computed_height_mm).toBe(200)
    expect(byId['right_bottom'].computed_width_mm).toBe(272)
    expect(byId['right_bottom'].computed_height_mm).toBe(200)
  })
})

describe('isLeaf', () => {
  it('returns false for a node that has children', () => {
    const nodes: BspNode[] = [
      { ...makeRoot(545, 400), id: 'root', split_direction: 'V' },
      { id: 'child', parent_id: 'root', split_direction: null, is_first_child: true, computed_width_mm: 272, computed_height_mm: 400 },
    ]
    expect(isLeaf('root', nodes)).toBe(false)
  })

  it('returns true for a node with no children', () => {
    const nodes: BspNode[] = [
      { ...makeRoot(545, 400), id: 'root', split_direction: 'V' },
      { id: 'child', parent_id: 'root', split_direction: null, is_first_child: true, computed_width_mm: 272, computed_height_mm: 400 },
    ]
    expect(isLeaf('child', nodes)).toBe(true)
  })
})

describe('getLeafNodes', () => {
  it('returns all 3 leaf nodes from a depth-2 tree', () => {
    const nodes: BspNode[] = [
      { id: 'root', parent_id: null, split_direction: 'V', is_first_child: null, width_mm: 545, height_mm: 400, computed_width_mm: 545, computed_height_mm: 400 },
      { id: 'left', parent_id: 'root', split_direction: null, is_first_child: true, computed_width_mm: 272, computed_height_mm: 400 },
      { id: 'right', parent_id: 'root', split_direction: 'H', is_first_child: false, computed_width_mm: 272, computed_height_mm: 400 },
      { id: 'right_top', parent_id: 'right', split_direction: null, is_first_child: true, computed_width_mm: 272, computed_height_mm: 200 },
      { id: 'right_bottom', parent_id: 'right', split_direction: null, is_first_child: false, computed_width_mm: 272, computed_height_mm: 200 },
    ]
    const leaves = getLeafNodes(nodes)
    expect(leaves).toHaveLength(3)
    expect(leaves.map(n => n.id).sort()).toEqual(['left', 'right_bottom', 'right_top'])
  })
})
