import { useEffect, useRef } from 'react'
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import type { Cell, Material, Product, Shelf } from '@/data/db'
import { CellCard } from './CellCard'
import { getRootAddress } from './cellUtils'

// One отсек (a single, undivided cell) is sized like a normal base cell: ~40vw
// wide (≈2.5 across the screen) and ~1/3.5 of the usable height. A subdivided
// cell multiplies this by how many отсеков it spans, so отсеки stay this big and
// the shelf grows past the screen (scroll), instead of shrinking.
const GAP = 4

// Минимальный читаемый размер листовой ячейки в px. Ширина рассчитана так,
// чтобы надпись «Не вносилось» влезала целиком; высота — чтобы поместились
// адрес, название и дата. Отсеки внутри разделённой ячейки не ужимаются ниже.
const MIN_CELL_W = 116
const MIN_CELL_H = 92

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
  /** Outline this leaf (e.g. the cell the sweep is currently on). */
  highlightCellId?: string
  /** On mount, zoom/pan so this cell's base section is centred (full-map view
   *  opens on the current sweep cell instead of the top-left corner). */
  centerOnCellId?: string
  /** Enable pinch/wheel zoom + pan (for the big admin grid and the full map). */
  zoomable?: boolean
  /** Restore zoom/pan on mount (read ONCE at mount, not a live prop). */
  initialTransform?: { scale: number; positionX: number; positionY: number } | null
  /** Fired on every zoom/pan change so the caller can persist the transform. */
  onTransformChange?: (t: { scale: number; positionX: number; positionY: number }) => void
  onLeafTap?: (cell: Cell) => void
  onEditTap?: (cell: Cell) => void
  onFlagTap?: (cell: Cell) => void
}

function sortChildren(children: Cell[]): Cell[] {
  return [...children].sort((a, b) => (a.child_index ?? 0) - (b.child_index ?? 0))
}

/** How many leaf отсеков the subtree spans across (cols) and down (rows). */
function footprint(cell: Cell, allCells: Cell[]): { cols: number; rows: number } {
  const children = allCells.filter(c => c.parent_id === cell.id)
  if (children.length === 0) return { cols: 1, rows: 1 }
  const fs = children.map(c => footprint(c, allCells))
  if (cell.split_direction === 'V') {
    return { cols: fs.reduce((s, f) => s + f.cols, 0), rows: Math.max(...fs.map(f => f.rows)) }
  }
  return { cols: Math.max(...fs.map(f => f.cols)), rows: fs.reduce((s, f) => s + f.rows, 0) }
}

interface SubtreeProps {
  cell: Cell
  allCells: Cell[]
  products: Product[]
  materials: Material[]
  mode: 'edit' | 'view'
  sessionId?: string
  visitedCellIds?: Set<string>
  /** True when rendering compartments inside a grouped base cell. */
  bare?: boolean
  highlightCellId?: string
  onLeafTap: (cell: Cell) => void
  onFlagTap: (cell: Cell) => void
}

/** Recursively render a base cell's subtree filling 100%×100% of its grid area. */
function Subtree(props: SubtreeProps) {
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
        sessionId={props.sessionId}
        visitedCellIds={props.visitedCellIds}
        bare={props.bare}
        highlighted={props.highlightCellId != null && cell.id === props.highlightCellId}
        onTap={props.onLeafTap}
        onFlagTap={props.onFlagTap}
      />
    )
  }

  const isV = cell.split_direction === 'V'
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isV ? 'row' : 'column',
        gap: GAP,
        width: '100%',
        height: '100%',
      }}
    >
      {children.map(child => (
        <div
          key={child.id}
          style={{
            flex: 1,
            flexBasis: 0,
            // Минимум по оси деления, чтобы отсек не ужимался в нечитаемую
            // полоску (надпись «Не вносилось» должна влезать). По другой оси
            // отсек тянется на 100%, минимум не нужен.
            minWidth: isV ? MIN_CELL_W : 0,
            minHeight: isV ? 0 : MIN_CELL_H,
          }}
        >
          <Subtree {...props} cell={child} />
        </div>
      ))}
    </div>
  )
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
  highlightCellId,
  centerOnCellId,
  zoomable = false,
  initialTransform = null,
  onTransformChange,
  onLeafTap,
  onEditTap,
  onFlagTap,
}: ShelfGridProps) {
  function handleLeafTap(cell: Cell) {
    if (mode === 'edit') onEditTap?.(cell)
    else onLeafTap?.(cell)
  }

  const baseCells = cells.filter(c => c.parent_id === null)

  // Base (top-level) ancestor of the cell to centre on — the full-map view
  // opens focused there instead of the top-left corner.
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null)
  let centerBaseId: string | undefined
  if (centerOnCellId) {
    let cur = cells.find(c => c.id === centerOnCellId)
    while (cur?.parent_id) cur = cells.find(c => c.id === cur!.parent_id)
    centerBaseId = cur?.id
  }
  useEffect(() => {
    if (!zoomable || !centerBaseId) return
    // Let the grid lay out and the dialog finish opening, then centre on that
    // section (zoomToElement needs the element measured).
    const t = setTimeout(() => {
      transformRef.current?.zoomToElement(`cellwrap-${centerBaseId}`, 1, 200)
    }, 40)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Position base cells by row/col so we can find each grid track's max footprint.
  const cols = shelf.cols_count
  const rows = shelf.rows_count
  const byPosition = new Map<string, Cell>()
  for (const c of baseCells) {
    if (c.row_index != null && c.col_index != null) {
      byPosition.set(`${c.row_index}:${c.col_index}`, c)
    }
  }

  // colUnits[c] = max footprint cols of any base cell in column c.
  const colUnits = Array.from({ length: cols }, (_, ci) => {
    const col = ci + 1
    let max = 1
    for (let r = 1; r <= rows; r++) {
      const cell = byPosition.get(`${r}:${col}`)
      if (cell) max = Math.max(max, footprint(cell, cells).cols)
    }
    return max
  })

  // rowUnits[r] = max footprint rows of any base cell in row r.
  const rowUnits = Array.from({ length: rows }, (_, ri) => {
    const row = ri + 1
    let max = 1
    for (let c = 1; c <= cols; c++) {
      const cell = byPosition.get(`${row}:${c}`)
      if (cell) max = Math.max(max, footprint(cell, cells).rows)
    }
    return max
  })

  const overhead = 120 + subheaderHeight // app header (56) + bottom nav (64)
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    // Каждая footprint-единица — не уже MIN_CELL_W и не ниже MIN_CELL_H, так
    // что при делении отсеки остаются читаемыми (текст влезает), а стеллаж
    // растёт за экран (скролл) вместо ужимания ячеек в полоски.
    gridTemplateColumns: colUnits.map(u => `max(calc(40vw * ${u}), ${MIN_CELL_W * u}px)`).join(' '),
    gridTemplateRows: rowUnits
      .map(u => `max(calc((100dvh - ${overhead}px - env(safe-area-inset-bottom)) / 3.5 * ${u}), ${MIN_CELL_H * u}px)`)
      .join(' '),
    gap: GAP,
    padding: GAP,
  }

  const gridInner = (
    <div style={gridStyle}>
      {baseCells.map(cell => {
            if (cell.row_index == null || cell.col_index == null) return null
            const subdivided = cells.some(c => c.parent_id === cell.id)
            const subtree = (
              <Subtree
                cell={cell}
                allCells={cells}
                products={products}
                materials={materials}
                mode={mode}
                sessionId={sessionId}
                visitedCellIds={visitedCellIds}
                bare={subdivided}
                highlightCellId={highlightCellId}
                onLeafTap={handleLeafTap}
                onFlagTap={c => onFlagTap?.(c)}
              />
            )
            return (
              <div
                key={cell.id}
                id={`cellwrap-${cell.id}`}
                style={{ gridColumn: cell.col_index, gridRow: cell.row_index, minWidth: 0, minHeight: 0 }}
              >
                {subdivided ? (
                  // All compartments of one base cell live under one outline ("крыша").
                  <div
                    className="relative w-full h-full rounded-lg overflow-hidden"
                    style={{ border: '2px solid var(--border)', background: 'var(--card)', padding: 6 }}
                  >
                    <span
                      className="absolute z-10 text-xs font-semibold rounded px-1"
                      style={{ top: 5, left: 6, color: 'var(--primary)', background: 'var(--card)' }}
                    >
                      {getRootAddress(cell)}
                    </span>
                    {subtree}
                  </div>
                ) : (
                  subtree
                )}
              </div>
            )
          })}
    </div>
  )

  return (
    <div className="flex flex-col h-full flex-1 min-h-0">
      {zoomable ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <TransformWrapper
            ref={transformRef}
            initialScale={initialTransform?.scale ?? 1}
            initialPositionX={initialTransform?.positionX}
            initialPositionY={initialTransform?.positionY}
            minScale={0.12}
            maxScale={3}
            limitToBounds={false}
            centerOnInit={false}
            doubleClick={{ disabled: true }}
            panning={{ velocityDisabled: true }}
            wheel={{ step: 0.06 }}
            onTransform={(_ref, state) =>
              onTransformChange?.({ scale: state.scale, positionX: state.positionX, positionY: state.positionY })
            }
          >
            <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
              {gridInner}
            </TransformComponent>
          </TransformWrapper>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">{gridInner}</div>
      )}
    </div>
  )
}
