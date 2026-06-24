import { describe, it, expect } from 'vitest'
import {
  recomputeDescendants,
  isLeaf,
  getLeafNodes,
  type BspNode,
} from './bsp'

describe('recomputeDescendants', () => {
  it('splits a V-node into N equal columns (floored)', () => {
    // root 545×400 --V-split into 2--> two children of 272×400
    const nodes: BspNode[] = [
      { id: 'root', parent_id: null, split_direction: 'V', child_index: null, computed_width_mm: 545, computed_height_mm: 400 },
      { id: 'c0', parent_id: 'root', split_direction: null, child_index: 0, computed_width_mm: 0, computed_height_mm: 0 },
      { id: 'c1', parent_id: 'root', split_direction: null, child_index: 1, computed_width_mm: 0, computed_height_mm: 0 },
    ]
    const result = recomputeDescendants(nodes)
    const byId = Object.fromEntries(result.map(n => [n.id, n]))
    expect(byId['c0'].computed_width_mm).toBe(272)
    expect(byId['c0'].computed_height_mm).toBe(400)
    expect(byId['c1'].computed_width_mm).toBe(272)
    expect(byId['c1'].computed_height_mm).toBe(400)
  })

  it('splits an H-node into 3 equal rows (floored)', () => {
    // root 600×400 --H-split into 3--> three children of 600×133
    const nodes: BspNode[] = [
      { id: 'root', parent_id: null, split_direction: 'H', child_index: null, computed_width_mm: 600, computed_height_mm: 400 },
      { id: 'c0', parent_id: 'root', split_direction: null, child_index: 0, computed_width_mm: 0, computed_height_mm: 0 },
      { id: 'c1', parent_id: 'root', split_direction: null, child_index: 1, computed_width_mm: 0, computed_height_mm: 0 },
      { id: 'c2', parent_id: 'root', split_direction: null, child_index: 2, computed_width_mm: 0, computed_height_mm: 0 },
    ]
    const result = recomputeDescendants(nodes)
    const byId = Object.fromEntries(result.map(n => [n.id, n]))
    for (const id of ['c0', 'c1', 'c2']) {
      expect(byId[id].computed_width_mm).toBe(600)
      expect(byId[id].computed_height_mm).toBe(133)
    }
  })

  it('keeps the whole subtree at 0 when the root size is 0', () => {
    const nodes: BspNode[] = [
      { id: 'root', parent_id: null, split_direction: 'V', child_index: null, computed_width_mm: 0, computed_height_mm: 0 },
      { id: 'c0', parent_id: 'root', split_direction: null, child_index: 0, computed_width_mm: 0, computed_height_mm: 0 },
      { id: 'c1', parent_id: 'root', split_direction: null, child_index: 1, computed_width_mm: 0, computed_height_mm: 0 },
    ]
    const result = recomputeDescendants(nodes)
    const byId = Object.fromEntries(result.map(n => [n.id, n]))
    expect(byId['c0'].computed_width_mm).toBe(0)
    expect(byId['c1'].computed_height_mm).toBe(0)
  })

  it('handles depth-2 tree: root V-split (3 cols) then one child H-split (2 rows)', () => {
    // root 600×400 --V into 3--> each 200×400; c2 --H into 2--> 200×200 each
    const nodes: BspNode[] = [
      { id: 'root', parent_id: null, split_direction: 'V', child_index: null, computed_width_mm: 600, computed_height_mm: 400 },
      { id: 'c0', parent_id: 'root', split_direction: null, child_index: 0, computed_width_mm: 0, computed_height_mm: 0 },
      { id: 'c1', parent_id: 'root', split_direction: null, child_index: 1, computed_width_mm: 0, computed_height_mm: 0 },
      { id: 'c2', parent_id: 'root', split_direction: 'H', child_index: 2, computed_width_mm: 0, computed_height_mm: 0 },
      { id: 'c2a', parent_id: 'c2', split_direction: null, child_index: 0, computed_width_mm: 0, computed_height_mm: 0 },
      { id: 'c2b', parent_id: 'c2', split_direction: null, child_index: 1, computed_width_mm: 0, computed_height_mm: 0 },
    ]
    const result = recomputeDescendants(nodes)
    const byId = Object.fromEntries(result.map(n => [n.id, n]))
    expect(byId['c0'].computed_width_mm).toBe(200)
    expect(byId['c0'].computed_height_mm).toBe(400)
    expect(byId['c2'].computed_width_mm).toBe(200)
    expect(byId['c2'].computed_height_mm).toBe(400)
    expect(byId['c2a'].computed_width_mm).toBe(200)
    expect(byId['c2a'].computed_height_mm).toBe(200)
    expect(byId['c2b'].computed_width_mm).toBe(200)
    expect(byId['c2b'].computed_height_mm).toBe(200)
  })
})

describe('isLeaf', () => {
  const nodes: BspNode[] = [
    { id: 'root', parent_id: null, split_direction: 'V', child_index: null, computed_width_mm: 545, computed_height_mm: 400 },
    { id: 'child', parent_id: 'root', split_direction: null, child_index: 0, computed_width_mm: 272, computed_height_mm: 400 },
  ]
  it('returns false for a node that has children', () => {
    expect(isLeaf('root', nodes)).toBe(false)
  })
  it('returns true for a node with no children', () => {
    expect(isLeaf('child', nodes)).toBe(true)
  })
})

describe('getLeafNodes', () => {
  it('returns all leaf nodes from a depth-2 tree', () => {
    const nodes: BspNode[] = [
      { id: 'root', parent_id: null, split_direction: 'V', child_index: null, computed_width_mm: 600, computed_height_mm: 400 },
      { id: 'left', parent_id: 'root', split_direction: null, child_index: 0, computed_width_mm: 300, computed_height_mm: 400 },
      { id: 'right', parent_id: 'root', split_direction: 'H', child_index: 1, computed_width_mm: 300, computed_height_mm: 400 },
      { id: 'right_top', parent_id: 'right', split_direction: null, child_index: 0, computed_width_mm: 300, computed_height_mm: 200 },
      { id: 'right_bottom', parent_id: 'right', split_direction: null, child_index: 1, computed_width_mm: 300, computed_height_mm: 200 },
    ]
    const leaves = getLeafNodes(nodes)
    expect(leaves).toHaveLength(3)
    expect(leaves.map(n => n.id).sort()).toEqual(['left', 'right_bottom', 'right_top'])
  })
})
