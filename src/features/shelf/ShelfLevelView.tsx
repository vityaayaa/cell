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

// Readable, structural sizing (not squished to screen):
// base cell = 100px tall; each horizontal split halves the height, floored at 50px.
// Vertical splits keep the height and divide the width equally. Scrolls if tall.
const BASE_H = 100
const MIN_H = 50

function leafHeight(hDepth: number): number {
  return Math.max(MIN_H, Math.round(BASE_H / 2 ** Math.max(0, hDepth - 1)))
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
  hDepth: number
  allCells: Cell[]
  products: Product[]
  materials: Material[]
  mode: 'edit' | 'view'
  sessionId?: string
  visitedCellIds?: Set<string>
  onLeafTap: (cell: Cell) => void
  onFlagTap: (cell: Cell) => void
}

function Node({
  cell,
  hDepth,
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
      <div style={{ height: leafHeight(hDepth), width: '100%' }}>
        <CellCard
          cell={cell}
          allCells={allCells}
          products={products}
          materials={materials}
          mode={mode}
          address=""
          dense
          sessionId={sessionId}
          visitedCellIds={visitedCellIds}
          onTap={onLeafTap}
          onFlagTap={onFlagTap}
        />
      </div>
    )
  }

  const isV = cell.split_direction === 'V'
  const childDepth = hDepth + (isV ? 0 : 1)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isV ? 'row' : 'column',
        gap: 3,
        width: '100%',
      }}
    >
      {children.map(child => (
        <div key={child.id} style={isV ? { flex: 1, minWidth: 0 } : { width: '100%' }}>
          <Node
            cell={child}
            hDepth={childDepth}
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
      ))}
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
      <Node
        cell={parentCell}
        hDepth={0}
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
}
