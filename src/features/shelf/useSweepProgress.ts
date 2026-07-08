import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { isLeaf } from '@/domain/bsp'
import type { BspNode } from '@/domain/bsp'
import type { Cell } from '@/data/db'

export interface SweepProgress {
  visited: number
  total: number
  visitedCellIds: Set<string>
}

const EMPTY: SweepProgress = { visited: 0, total: 0, visitedCellIds: new Set() }

export function useSweepProgress(sessionId: string | null): SweepProgress {
  const result = useLiveQuery<SweepProgress>(async () => {
    if (!sessionId) return EMPTY

    const allCells: Cell[] = await db.cells.toArray()
    const leafCells = allCells.filter(
      (c) => isLeaf(c.id, allCells as unknown as BspNode[]) && c.product_id && !c.is_disabled,
    )
    const total = leafCells.length

    const entries = await db.stock_entries
      .where('session_id')
      .equals(sessionId)
      .toArray()

    const visitedCellIds = new Set(entries.map((e) => e.cell_id))
    const visited = leafCells.filter((c) => visitedCellIds.has(c.id)).length

    return { visited, total, visitedCellIds }
  }, [sessionId])

  return result ?? EMPTY
}
