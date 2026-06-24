import type { Cell, Material, Product } from '@/data/db'
import { CellCard } from './CellCard'

interface ShelfLevelViewProps {
  parentCell: Cell
  allCells: Cell[]
  products: Product[]
  materials: Material[]
  mode: 'edit' | 'view'
  addressPrefix: string
  sessionId?: string
  visitedCellIds?: Set<string>
  onLeafTap: (cell: Cell) => void
  onSplitTap: (cell: Cell) => void
  onFlagTap: (cell: Cell) => void
}

/** Address segment of a child relative to its parent: (row,col). */
function relSegment(parent: Cell, child: Cell): string {
  if (parent.split_direction === 'V') return `(1,${child.is_first_child ? 1 : 2})`
  if (parent.split_direction === 'H') return `(${child.is_first_child ? 1 : 2},1)`
  return ''
}

function sortChildren(children: Cell[]): Cell[] {
  return [...children].sort((a, b) => {
    if (a.is_first_child && !b.is_first_child) return -1
    if (!a.is_first_child && b.is_first_child) return 1
    return 0
  })
}

interface NodeProps {
  cell: Cell
  addr: string
  allCells: Cell[]
  products: Product[]
  materials: Material[]
  mode: 'edit' | 'view'
  sessionId?: string
  visitedCellIds?: Set<string>
  onLeafTap: (cell: Cell) => void
  onFlagTap: (cell: Cell) => void
}

/** Renders a cell (and its subtree) scaled to its real proportions:
 *  a V-split lays children left↔right by width, an H-split top↔bottom by height. */
function ProportionalNode({
  cell,
  addr,
  allCells,
  products,
  materials,
  mode,
  sessionId,
  visitedCellIds,
  onLeafTap,
  onFlagTap,
}: NodeProps) {
  const children = sortChildren(allCells.filter(c => c.parent_id === cell.id))

  if (children.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}>
        <CellCard
          cell={cell}
          allCells={allCells}
          products={products}
          materials={materials}
          mode={mode}
          address={addr}
          sessionId={sessionId}
          visitedCellIds={visitedCellIds}
          onTap={onLeafTap}
          onFlagTap={onFlagTap}
        />
      </div>
    )
  }

  const isV = cell.split_direction === 'V'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isV ? 'row' : 'column',
        width: '100%',
        height: '100%',
        gap: 4,
        minWidth: 0,
        minHeight: 0,
      }}
    >
      {children.map(child => {
        const basis = Math.max(1, isV ? child.computed_width_mm : child.computed_height_mm)
        return (
          <div key={child.id} style={{ flexGrow: basis, flexBasis: 0, minWidth: 0, minHeight: 0 }}>
            <ProportionalNode
              cell={child}
              addr={addr + relSegment(cell, child)}
              allCells={allCells}
              products={products}
              materials={materials}
              mode={mode}
              sessionId={sessionId}
              visitedCellIds={visitedCellIds}
              onLeafTap={onLeafTap}
              onFlagTap={onFlagTap}
            />
          </div>
        )
      })}
    </div>
  )
}

export function ShelfLevelView({
  parentCell,
  allCells,
  products,
  materials,
  mode,
  sessionId,
  visitedCellIds,
  onLeafTap,
  onFlagTap,
}: ShelfLevelViewProps) {
  const hasChildren = allCells.some(c => c.parent_id === parentCell.id)
  if (!hasChildren) return null

  return (
    <div className="flex-1 min-h-0 overflow-auto p-3">
      <div style={{ width: '100%', height: '100%', minHeight: 320 }}>
        <ProportionalNode
          cell={parentCell}
          addr=""
          allCells={allCells}
          products={products}
          materials={materials}
          mode={mode}
          sessionId={sessionId}
          visitedCellIds={visitedCellIds}
          onLeafTap={onLeafTap}
          onFlagTap={onFlagTap}
        />
      </div>
    </div>
  )
}
