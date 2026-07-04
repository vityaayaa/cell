import { useLayoutEffect, useRef, useState } from 'react'
import { Maximize2 } from 'lucide-react'
import type { Cell, Shelf } from '@/data/db'
import { getBaseAncestor } from '../sweepOrder'
import { getRootAddress } from '../cellUtils'

function miniSort(children: Cell[]): Cell[] {
  return [...children].sort((a, b) => (a.child_index ?? 0) - (b.child_index ?? 0))
}

/** Tiny faithful render of a base cell's subtree for the radar (no text). */
function MiniNode({
  cell,
  cells,
  currentId,
  visitedCellIds,
}: {
  cell: Cell
  cells: Cell[]
  currentId: string | null
  visitedCellIds: Set<string>
}) {
  const children = miniSort(cells.filter((c) => c.parent_id === cell.id))
  if (children.length === 0) {
    const isCurrent = cell.id === currentId
    const isVisited = visitedCellIds.has(cell.id)
    const bg = isCurrent
      ? 'var(--primary)'
      : isVisited
        ? 'rgba(16,185,129,0.55)'
        : 'rgba(148,163,184,0.3)'
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: bg,
          borderRadius: 1.5,
          outline: isCurrent ? '1.5px solid var(--primary)' : undefined,
          outlineOffset: isCurrent ? 1 : undefined,
        }}
      />
    )
  }
  const isV = cell.split_direction === 'V'
  return (
    <div style={{ display: 'flex', flexDirection: isV ? 'row' : 'column', gap: 1, width: '100%', height: '100%' }}>
      {children.map((ch) => (
        <div key={ch.id} style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          <MiniNode cell={ch} cells={cells} currentId={currentId} visitedCellIds={visitedCellIds} />
        </div>
      ))}
    </div>
  )
}

function clampN(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/** How many leaf cells the subtree spans across (cols) and down (rows). */
function footprint(cell: Cell, cells: Cell[]): { cols: number; rows: number } {
  const ch = cells.filter((c) => c.parent_id === cell.id)
  if (ch.length === 0) return { cols: 1, rows: 1 }
  const fs = ch.map((c) => footprint(c, cells))
  if (cell.split_direction === 'V')
    return { cols: fs.reduce((s, f) => s + f.cols, 0), rows: Math.max(...fs.map((f) => f.rows)) }
  return { cols: Math.max(...fs.map((f) => f.cols)), rows: fs.reduce((s, f) => s + f.rows, 0) }
}

/**
 * Radar = a true scaled-down minimap of the shelf: sections keep the same
 * proportions as the real grid (sized by their footprint), so it actually looks
 * like the shelf. Panned to keep the current section centered (smooth
 * transition), clamped at the edges, zoomed so ~2.5 sections fit across and
 * ≥1.5 down. No text — just sub-cells, a faint orange address, current accent.
 */
export function RadarStrip({
  shelf,
  cells,
  currentCell,
  visitedCellIds,
  onOpen,
}: {
  shelf: Shelf
  cells: Cell[]
  currentCell: Cell | null
  visitedCellIds: Set<string>
  onOpen: () => void
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const C = shelf.cols_count
  const R = shelf.rows_count
  const byPos = new Map<string, Cell>()
  for (const c of cells) {
    if (c.parent_id === null && c.row_index != null && c.col_index != null) {
      byPos.set(`${c.row_index}:${c.col_index}`, c)
    }
  }
  // Section track sizes in footprint-units — same proportions as the real grid.
  const colUnits = Array.from({ length: C }, (_, ci) => {
    let m = 1
    for (let r = 1; r <= R; r++) {
      const c = byPos.get(`${r}:${ci + 1}`)
      if (c) m = Math.max(m, footprint(c, cells).cols)
    }
    return m
  })
  const rowUnits = Array.from({ length: R }, (_, ri) => {
    let m = 1
    for (let cl = 1; cl <= C; cl++) {
      const c = byPos.get(`${ri + 1}:${cl}`)
      if (c) m = Math.max(m, footprint(c, cells).rows)
    }
    return m
  })
  const avgCol = colUnits.reduce((a, b) => a + b, 0) / Math.max(1, C)
  const avgRow = rowUnits.reduce((a, b) => a + b, 0) / Math.max(1, R)

  // px per footprint-unit: ~2.5 average sections across AND ≥1.5 down.
  const U =
    size.w > 0 && size.h > 0
      ? Math.min(size.w / (2.5 * avgCol), size.h / (1.5 * avgRow))
      : 24

  const colW = colUnits.map((u) => u * U)
  const rowH = rowUnits.map((u) => u * U)
  const colX: number[] = []
  { let a = 0; for (const w of colW) { colX.push(a); a += w } }
  const rowY: number[] = []
  { let a = 0; for (const h of rowH) { rowY.push(a); a += h } }
  const totalW = colW.reduce((a, b) => a + b, 0)
  const totalH = rowH.reduce((a, b) => a + b, 0)

  const currentId = currentCell?.id ?? null
  const section = currentCell ? getBaseAncestor(currentCell, cells) : null
  const cr = section?.row_index ?? 1
  const cc = section?.col_index ?? 1
  const ccx = (colX[cc - 1] ?? 0) + (colW[cc - 1] ?? 0) / 2
  const ccy = (rowY[cr - 1] ?? 0) + (rowH[cr - 1] ?? 0) / 2
  const tx = totalW <= size.w ? (size.w - totalW) / 2 : clampN(size.w / 2 - ccx, size.w - totalW, 0)
  const ty = totalH <= size.h ? (size.h - totalH) / 2 : clampN(size.h / 2 - ccy, size.h - totalH, 0)

  return (
    <button
      onClick={onOpen}
      aria-label="Открыть карту стеллажа"
      className="w-full flex-1 min-h-0 border-b px-3 py-2 relative"
      style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
    >
      <div
        ref={viewportRef}
        className="w-full h-full rounded-md overflow-hidden relative"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div
          className="absolute top-0 left-0"
          style={{
            width: totalW,
            height: totalH,
            transform: `translate(${tx}px, ${ty}px)`,
            transition: 'transform 0.28s ease',
          }}
        >
          {[...byPos.values()].map((s) => {
            const r = s.row_index!
            const cl = s.col_index!
            const w = colW[cl - 1] ?? U
            const h = rowH[r - 1] ?? U
            const isCurrent = section != null && s.id === section.id
            return (
              <div
                key={s.id}
                className="absolute"
                style={{ left: colX[cl - 1] ?? 0, top: rowY[r - 1] ?? 0, width: w, height: h, padding: 2 }}
              >
                <div
                  className="relative w-full h-full rounded-sm overflow-hidden"
                  style={{
                    outline: isCurrent ? '2px solid var(--primary)' : '1px solid var(--border)',
                    opacity: isCurrent ? 1 : 0.72,
                  }}
                >
                  <MiniNode cell={s} cells={cells} currentId={currentId} visitedCellIds={visitedCellIds} />
                  {/* faint orange address number, spanning the section */}
                  <span
                    className="absolute inset-0 flex items-center justify-center font-bold pointer-events-none"
                    style={{ color: 'var(--primary)', opacity: 0.15, fontSize: Math.min(w, h) * 0.45, lineHeight: 1 }}
                  >
                    {getRootAddress(s)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <span
        className="absolute flex items-center gap-1 rounded px-1.5 py-0.5"
        style={{ top: 6, right: 6, fontSize: 10, color: 'var(--muted-foreground)', background: 'var(--card)' }}
      >
        <Maximize2 size={11} /> вся карта
      </span>
    </button>
  )
}
