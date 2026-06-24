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
  selectMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  onLeafTap: (cell: Cell) => void
  onSplitTap: (cell: Cell) => void
  onFlagTap: (cell: Cell) => void
}

// Base = the size of a normal shelf cell (~viewport / 3.5 rows, like the main grid).
// Each horizontal split halves the height, floored at half the base. Vertical
// splits keep the height and divide the width equally. Scrolls when tall.
function baseHeight(): number {
  const vh = typeof window !== 'undefined' ? window.innerHeight : 760
  return Math.max(120, Math.round((vh - 168) / 3.5))
}

function leafHeight(hDepth: number, base: number): number {
  return Math.max(Math.round(base / 2), Math.round(base / 2 ** Math.max(0, hDepth - 1)))
}

function sortChildren(children: Cell[]): Cell[] {
  return [...children].sort((a, b) => {
    if (a.is_first_child && !b.is_first_child) return -1
    if (!a.is_first_child && b.is_first_child) return 1
    return 0
  })
}

/** Leaf ids in reading order (top→bottom, left→right) for sequential numbering. */
function leafOrder(cell: Cell, allCells: Cell[]): string[] {
  const children = sortChildren(allCells.filter(c => c.parent_id === cell.id))
  if (children.length === 0) return [cell.id]
  return children.flatMap(c => leafOrder(c, allCells))
}

interface NodeProps {
  cell: Cell
  hDepth: number
  base: number
  numberById: Map<string, number>
  allCells: Cell[]
  products: Product[]
  materials: Material[]
  mode: 'edit' | 'view'
  sessionId?: string
  visitedCellIds?: Set<string>
  selectMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  onLeafTap: (cell: Cell) => void
  onFlagTap: (cell: Cell) => void
}

function Node(props: NodeProps) {
  const { cell, hDepth, base, numberById, allCells, mode } = props
  const children = sortChildren(allCells.filter(c => c.parent_id === cell.id))

  if (children.length === 0) {
    return (
      <div style={{ height: leafHeight(hDepth, base), width: '100%' }}>
        <CellCard
          cell={cell}
          allCells={allCells}
          products={props.products}
          materials={props.materials}
          mode={mode}
          address={`№${numberById.get(cell.id) ?? ''}`}
          dense
          selected={props.selectMode && props.selectedIds?.has(cell.id)}
          sessionId={props.sessionId}
          visitedCellIds={props.visitedCellIds}
          onTap={props.selectMode ? () => props.onToggleSelect?.(cell.id) : props.onLeafTap}
          onFlagTap={props.onFlagTap}
        />
      </div>
    )
  }

  const isV = cell.split_direction === 'V'
  const childDepth = hDepth + (isV ? 0 : 1)

  return (
    <div style={{ display: 'flex', flexDirection: isV ? 'row' : 'column', gap: 3, width: '100%' }}>
      {children.map(child => (
        <div key={child.id} style={isV ? { flex: 1, minWidth: 0 } : { width: '100%' }}>
          <Node {...props} cell={child} hDepth={childDepth} />
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
  selectMode,
  selectedIds,
  onToggleSelect,
  onLeafTap,
  onFlagTap,
}: ShelfLevelViewProps) {
  const hasChildren = allCells.some(c => c.parent_id === parentCell.id)
  if (!hasChildren) return null

  const base = baseHeight()
  const order = leafOrder(parentCell, allCells)
  const numberById = new Map(order.map((id, i) => [id, i + 1]))

  return (
    <div className="flex-1 min-h-0 overflow-auto p-3">
      <Node
        cell={parentCell}
        hDepth={0}
        base={base}
        numberById={numberById}
        allCells={allCells}
        products={products}
        materials={materials}
        mode={mode}
        sessionId={sessionId}
        visitedCellIds={visitedCellIds}
        selectMode={selectMode}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        onLeafTap={onLeafTap}
        onFlagTap={onFlagTap}
      />
    </div>
  )
}
