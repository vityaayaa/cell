import type { Cell } from '@/data/db'

/**
 * Sweep order = all LEAF cells that have a product_id, in reading order:
 * base cells sorted by row_index then col_index; within a base cell, descendant
 * leaves depth-first sorted by child_index. Leaves without a product are skipped.
 */
export function buildSweepOrder(cells: Cell[]): Cell[] {
  const childrenOf = (id: string) =>
    cells
      .filter((c) => c.parent_id === id)
      .sort((a, b) => (a.child_index ?? 0) - (b.child_index ?? 0))

  const collectLeaves = (cell: Cell): Cell[] => {
    const children = childrenOf(cell.id)
    if (children.length === 0) return [cell]
    return children.flatMap(collectLeaves)
  }

  const baseCells = cells
    .filter((c) => c.parent_id === null)
    .sort((a, b) => {
      const r = (a.row_index ?? 0) - (b.row_index ?? 0)
      if (r !== 0) return r
      return (a.col_index ?? 0) - (b.col_index ?? 0)
    })

  return baseCells.flatMap(collectLeaves).filter((c) => c.product_id && !c.is_disabled)
}

/** The base-cell ancestor of a leaf (the node with parent_id === null). */
export function getBaseAncestor(cell: Cell, cells: Cell[]): Cell | undefined {
  let current: Cell | undefined = cell
  while (current && current.parent_id !== null) {
    current = cells.find((c) => c.id === current!.parent_id)
  }
  return current
}
