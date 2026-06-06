import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import type { Cell, Material, Product, Shelf } from '@/data/db'
import { isLeaf } from '@/domain/bsp'
import { CellCard } from './CellCard'
import { ShelfLevelView } from './ShelfLevelView'
import { getRootAddress } from './cellUtils'

export interface ShelfGridProps {
  mode: 'edit' | 'view'
  shelf: Shelf
  cells: Cell[]
  products: Product[]
  materials: Material[]
  sessionId?: string
  visitedCellIds?: Set<string>
  /** Extra px taken up by subheaders above the grid (progress bar, sweep bar, etc.) */
  subheaderHeight?: number
  onLeafTap?: (cell: Cell) => void
  onEditTap?: (cell: Cell) => void
  onFlagTap?: (cell: Cell) => void
}

interface DrillEntry {
  cell: Cell
  address: string
}

export function ShelfGrid({
  mode,
  shelf,
  cells,
  products,
  materials,
  sessionId,
  visitedCellIds = new Set(),
  subheaderHeight = 0,
  onLeafTap,
  onEditTap,
  onFlagTap,
}: ShelfGridProps) {
  const [drillStack, setDrillStack] = useState<DrillEntry[]>([])

  const currentDrill = drillStack[drillStack.length - 1] ?? null

  function handleCellTap(cell: Cell) {
    if (isLeaf(cell.id, cells)) {
      if (mode === 'edit') {
        onEditTap?.(cell)
      } else {
        onLeafTap?.(cell)
      }
    } else {
      const address = currentDrill
        ? buildSubAddress(currentDrill.cell, cell, currentDrill.address)
        : getRootAddress(cell)
      setDrillStack(prev => [...prev, { cell, address }])
    }
  }

  function handleFlagTap(cell: Cell) {
    onFlagTap?.(cell)
  }

  function goBack() {
    setDrillStack(prev => prev.slice(0, -1))
  }

  const rootCells = cells
    .filter(c => c.parent_id === null)
    .sort((a, b) => {
      if (a.row_index !== b.row_index) return (a.row_index ?? 0) - (b.row_index ?? 0)
      return (a.col_index ?? 0) - (b.col_index ?? 0)
    })

  // 2.5 columns visible (half column signals scrollability)
  // 3.5 rows visible in the available viewport space
  const overhead = 120 + subheaderHeight // header(56) + bottomnav(64) + any subheader
  const cellWidth = 'calc(40vw)'
  const cellHeight = `calc((100dvh - ${overhead}px - env(safe-area-inset-bottom)) / 3.5)`

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${shelf.cols_count}, ${cellWidth})`,
    gridTemplateRows: `repeat(${shelf.rows_count}, ${cellHeight})`,
    gap: '3px',
  }

  const headerLabel = currentDrill
    ? `← ${currentDrill.address}`
    : null

  return (
    <div className="flex flex-col h-full">
      {/* Header breadcrumb */}
      {currentDrill && (
        <div
          className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <button
            onClick={goBack}
            className="flex items-center gap-1"
            style={{ color: 'var(--primary)' }}
          >
            <ChevronLeft size={20} />
            <span className="text-sm font-medium">{currentDrill.address}</span>
          </button>
        </div>
      )}

      {/* Grid level */}
      {!currentDrill ? (
        <div className="flex-1 overflow-auto">
          <div style={gridStyle}>
            {rootCells.map(cell => (
              <CellCard
                key={cell.id}
                cell={cell}
                allCells={cells}
                products={products}
                materials={materials}
                mode={mode}
                sessionId={sessionId}
                visitedCellIds={visitedCellIds}
                onTap={handleCellTap}
                onFlagTap={handleFlagTap}
              />
            ))}
          </div>
        </div>
      ) : (
        <ShelfLevelView
          parentCell={currentDrill.cell}
          allCells={cells}
          products={products}
          materials={materials}
          mode={mode}
          addressPrefix={currentDrill.address}
          sessionId={sessionId}
          visitedCellIds={visitedCellIds}
          onLeafTap={cell => {
            if (mode === 'edit') onEditTap?.(cell)
            else onLeafTap?.(cell)
          }}
          onSplitTap={cell => {
            const addr = buildSubAddress(currentDrill.cell, cell, currentDrill.address)
            setDrillStack(prev => [...prev, { cell, address: addr }])
          }}
          onFlagTap={handleFlagTap}
        />
      )}

      {headerLabel && <span className="sr-only">{headerLabel}</span>}
    </div>
  )
}

function buildSubAddress(parent: Cell, child: Cell, parentAddress: string): string {
  if (parent.split_direction === 'V') {
    const col = child.is_first_child ? 1 : 2
    return `${parentAddress}(1,${col})`
  }
  if (parent.split_direction === 'H') {
    const row = child.is_first_child ? 1 : 2
    return `${parentAddress}(${row},1)`
  }
  return parentAddress
}
