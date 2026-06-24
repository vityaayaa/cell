import { useLayoutEffect, useRef, useState } from 'react'
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

function sortChildren(children: Cell[]): Cell[] {
  return [...children].sort((a, b) => {
    if (a.is_first_child && !b.is_first_child) return -1
    if (!a.is_first_child && b.is_first_child) return 1
    return 0
  })
}

/** Visual fraction of the first child (0..1); defaults to half. */
function firstFraction(firstChild: Cell): number {
  const r = firstChild.split_ratio
  if (r == null || isNaN(r)) return 0.5
  return Math.min(0.92, Math.max(0.08, r))
}

function leafOrder(cell: Cell, allCells: Cell[]): string[] {
  const children = sortChildren(allCells.filter(c => c.parent_id === cell.id))
  if (children.length === 0) return [cell.id]
  return children.flatMap(c => leafOrder(c, allCells))
}

/** How many cells the subtree resolves to across (cols) and down (rows). */
function footprint(cell: Cell, allCells: Cell[]): { cols: number; rows: number } {
  const children = allCells.filter(c => c.parent_id === cell.id)
  if (children.length === 0) return { cols: 1, rows: 1 }
  const fs = children.map(c => footprint(c, allCells))
  if (cell.split_direction === 'V') {
    return { cols: fs.reduce((s, f) => s + f.cols, 0), rows: Math.max(...fs.map(f => f.rows)) }
  }
  return { cols: Math.max(...fs.map(f => f.cols)), rows: fs.reduce((s, f) => s + f.rows, 0) }
}

interface NodeProps {
  cell: Cell
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
  const { cell, allCells } = props
  const children = sortChildren(allCells.filter(c => c.parent_id === cell.id))

  if (children.length === 0) {
    return (
      <CellCard
        cell={cell}
        allCells={allCells}
        products={props.products}
        materials={props.materials}
        mode={props.mode}
        address={`№${props.numberById.get(cell.id) ?? ''}`}
        dense
        selected={props.selectMode && props.selectedIds?.has(cell.id)}
        sessionId={props.sessionId}
        visitedCellIds={props.visitedCellIds}
        onTap={props.selectMode ? () => props.onToggleSelect?.(cell.id) : props.onLeafTap}
        onFlagTap={props.onFlagTap}
      />
    )
  }

  const isV = cell.split_direction === 'V'
  const f = firstFraction(children[0])

  return (
    <div style={{ display: 'flex', flexDirection: isV ? 'row' : 'column', gap: 3, width: '100%', height: '100%' }}>
      {children.map((child, i) => (
        <div key={child.id} style={{ flexGrow: i === 0 ? f : 1 - f, flexBasis: 0, minWidth: 0, minHeight: 0 }}>
          <Node {...props} cell={child} />
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ w: number; h: number } | null>(null)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const hasChildren = allCells.some(c => c.parent_id === parentCell.id)
  if (!hasChildren) return null

  const order = leafOrder(parentCell, allCells)
  const numberById = new Map(order.map((id, i) => [id, i + 1]))

  // Measure the real drill area, then size the tree in pixels. Fits the screen
  // while sparse; past 3 cells across / 4 down it grows and scrolls on that axis
  // so cells stay readable. Pixels avoid relying on parent height being definite.
  const PAD = 12
  const { cols, rows } = footprint(parentCell, allCells)
  const availW = box ? box.w - PAD * 2 : 0
  const availH = box ? box.h - PAD * 2 : 0
  const treeWidth = !box ? '100%' : cols > 3 ? (cols / 3) * availW : availW
  const treeHeight = !box ? '100%' : rows > 4 ? (rows / 4) * availH : availH

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto" style={{ padding: PAD }}>
      <div style={{ width: treeWidth, height: treeHeight }}>
        <Node
          cell={parentCell}
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
    </div>
  )
}
