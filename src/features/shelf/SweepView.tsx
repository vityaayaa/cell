import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { db } from '@/data/db'
import type { Cell, Material, Product, Shelf } from '@/data/db'
import { useAppStore } from '@/data/store'
import { packs } from '@/lib/plural'
import { toastSuccess } from '@/lib/toast'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  buildCellAddress,
  getCapacity,
} from '@/features/stock/StockEntryDialog'
import { saveStockEntry } from '@/features/stock/saveStockEntry'
import { ShelfGrid } from './ShelfGrid'
import { SweepProgressBar } from './SweepProgressBar'
import { buildSweepOrder, getBaseAncestor } from './sweepOrder'
import {
  getProductShortName,
  getMaterialForProduct,
  getRootAddress,
  isPiecesInput,
  productUnitLabel,
} from './cellUtils'

interface SweepViewProps {
  shelf: Shelf
  cells: Cell[]
  products: Product[]
  materials: Material[]
  sessionId: string
  visited: number
  total: number
  visitedCellIds: Set<string>
}

export function SweepView({
  shelf,
  cells,
  products,
  materials,
  sessionId,
  visited,
  total,
  visitedCellIds,
}: SweepViewProps) {
  const userId = useAppStore((s) => s.userId)

  const order = useMemo(() => buildSweepOrder(cells), [cells])

  // currentCellId resumes at the first unvisited cell; if all visited, the first.
  const firstUnvisited = order.find((c) => !visitedCellIds.has(c.id)) ?? order[0]
  const [currentCellId, setCurrentCellId] = useState<string | null>(
    firstUnvisited?.id ?? null,
  )

  // Keep current valid as the order shifts (shelf edits from another device).
  const currentCell =
    order.find((c) => c.id === currentCellId) ?? firstUnvisited ?? null

  const currentIndex = currentCell
    ? order.findIndex((c) => c.id === currentCell.id)
    : -1

  const currentIsBulk =
    products.find((p) => p.id === currentCell?.product_id)?.type === 'bulk'

  const allVisited = order.length > 0 && order.every((c) => visitedCellIds.has(c.id))

  // 1-based position of the next unvisited cell (for "вернуться к обходу → №N").
  const nextUnvisitedIndex = order.findIndex((c) => !visitedCellIds.has(c.id))
  const nextUnvisitedNo = nextUnvisitedIndex >= 0 ? nextUnvisitedIndex + 1 : null
  const resumeId = nextUnvisitedIndex >= 0 ? order[nextUnvisitedIndex].id : null
  // Only offer "вернуться к обходу" when you've wandered off the next cell —
  // otherwise it would just duplicate the ✕ (close) button.
  const showResume = resumeId != null && currentCell?.id !== resumeId

  const [radarOpen, setRadarOpen] = useState(false)

  function goToFirstUnvisited() {
    const next = order.find((c) => !visitedCellIds.has(c.id))
    if (next) setCurrentCellId(next.id)
  }

  function step(delta: number) {
    if (currentIndex < 0) return
    const next = currentIndex + delta
    if (next < 0 || next >= order.length) return
    setCurrentCellId(order[next].id)
  }

  // After a save, advance to the next cell not yet visited (recomputed against a
  // freshly-updated visited set so the just-saved cell is excluded).
  function advanceAfterSave(savedCellId: string) {
    const updatedVisited = new Set(visitedCellIds)
    updatedVisited.add(savedCellId)
    const fromIdx = order.findIndex((c) => c.id === savedCellId)
    // Prefer the next unvisited at or after the saved position, then wrap.
    const after = order.slice(fromIdx + 1).find((c) => !updatedVisited.has(c.id))
    const before = order.find((c) => !updatedVisited.has(c.id))
    const next = after ?? before
    if (next) setCurrentCellId(next.id)
    // If none remain, leave current as-is; the "обход завершён" UI shows.
  }

  if (order.length === 0) {
    return (
      <div className="absolute inset-0 flex flex-col" style={{ background: 'var(--background)' }}>
        <SweepProgressBar visited={visited} total={total} sessionId={sessionId} />
        <div className="flex-1 flex items-center justify-center p-6">
          <p
            className="text-sm text-center"
            style={{ color: 'var(--muted-foreground)' }}
          >
            В стеллаже нет ячеек с назначенными товарами.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: 'var(--background)' }}>
      <SweepProgressBar visited={visited} total={total} sessionId={sessionId} />

      {/* Radar fills the leftover space (and shrinks on small screens) so the
          card + input below always fit without scrolling. */}
      <RadarStrip
        shelf={shelf}
        cells={cells}
        currentCell={currentCell}
        visitedCellIds={visitedCellIds}
        onOpen={() => setRadarOpen(true)}
      />

      {allVisited && (
        <div
          className="mx-4 mt-2 rounded-lg p-2 text-center flex-shrink-0"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <p className="text-sm font-semibold" style={{ color: '#10B981' }}>
            ✓ Обход завершён — перейдите к заявке кнопкой выше
          </p>
        </div>
      )}

      {/* Pieces/round: info card above the numeric input. Bulk: the card is
          hidden — its info lives inside the fill meter, freeing space for the
          radar and letting the meter grow. */}
      {currentCell && !currentIsBulk && (
        <div className="flex-shrink-0">
          <CurrentCellCard
            cell={currentCell}
            cells={cells}
            products={products}
            materials={materials}
            positionNo={currentIndex + 1}
            total={order.length}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            canPrev={currentIndex > 0}
            canNext={currentIndex < order.length - 1}
          />
        </div>
      )}

      {currentCell && (
        <div className="flex-shrink-0">
          <InputZone
            key={currentCell.id}
            cell={currentCell}
            products={products}
            sessionId={sessionId}
            userId={userId}
            address={buildCellAddress(currentCell, cells)}
            productName={(() => {
              const p = products.find((pr) => pr.id === currentCell.product_id)
              return p ? getProductShortName(p) : '—'
            })()}
            positionNo={currentIndex + 1}
            total={order.length}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            canPrev={currentIndex > 0}
            canNext={currentIndex < order.length - 1}
            alreadyVisited={visitedCellIds.has(currentCell.id)}
            onSaved={(cellId) => advanceAfterSave(cellId)}
            onSkip={() => step(1)}
          />
        </div>
      )}

      <Dialog open={radarOpen} onOpenChange={setRadarOpen}>
        <DialogContent
          preventOutsideClose
          showCloseButton={false}
          className="max-w-none w-screen h-[100dvh] sm:max-w-none sm:rounded-none rounded-none p-0 flex flex-col gap-0 top-0 left-0 translate-x-0 translate-y-0"
          style={{ maxWidth: '100vw' }}
        >
          <DialogTitle className="sr-only">Карта стеллажа</DialogTitle>
          <div
            className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
            style={{ borderColor: 'var(--border)' }}
          >
            <button
              onClick={() => setRadarOpen(false)}
              aria-label="Закрыть карту"
              className="flex items-center justify-center rounded-md"
              style={{ width: 44, height: 44 }}
            >
              <X size={22} />
            </button>
            {showResume && (
              <button
                className="btn-primary text-sm font-semibold px-3 rounded-md"
                style={{ height: 44 }}
                onClick={() => {
                  goToFirstUnvisited()
                  setRadarOpen(false)
                }}
              >
                Вернуться к обходу → №{nextUnvisitedNo}
              </button>
            )}
          </div>
          <div className="flex-1 min-h-0">
            <ShelfGrid
              mode="view"
              shelf={shelf}
              cells={cells}
              products={products}
              materials={materials}
              sessionId={sessionId}
              visitedCellIds={visitedCellIds}
              highlightCellId={currentCell?.id}
              zoomable
              onLeafTap={(cell) => {
                setCurrentCellId(cell.id)
                setRadarOpen(false)
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

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
function RadarStrip({
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

function CurrentCellCard({
  cell,
  cells,
  products,
  materials,
  positionNo,
  total,
  onPrev,
  onNext,
  canPrev,
  canNext,
}: {
  cell: Cell
  cells: Cell[]
  products: Product[]
  materials: Material[]
  positionNo: number
  total: number
  onPrev: () => void
  onNext: () => void
  canPrev: boolean
  canNext: boolean
}) {
  const product = products.find((p) => p.id === cell.product_id)
  const material = getMaterialForProduct(product, materials)
  const address = buildCellAddress(cell, cells)
  const capacity = product ? getCapacity(cell, product) : 0
  // 'пачки' only for bulk in slider mode; everything counted in pieces shows 'шт'.
  const capacityLabel = product
    ? product.type === 'bulk'
      ? packs(capacity)
      : `${capacity} ${productUnitLabel(product)}`
    : '—'

  const arrowBtn =
    'flex items-center justify-center rounded-md flex-shrink-0 disabled:opacity-30'

  return (
    <div className="px-4 pt-3">
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={!canPrev}
          aria-label="Предыдущая ячейка"
          className={arrowBtn}
          style={{ width: 44, height: 44, background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <ChevronLeft size={24} />
        </button>

        <div
          className="flex-1 rounded-lg p-4"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
              №{positionNo} из {total}
            </span>
            <span className="text-lg font-bold" style={{ color: 'var(--primary)' }}>
              {address}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-2">
            {material && (
              <span
                className="inline-block rounded-full flex-shrink-0"
                style={{ width: 12, height: 12, background: material.color }}
              />
            )}
            <span className="text-base font-semibold leading-tight" style={{ color: 'var(--foreground)' }}>
              {product ? getProductShortName(product) : '—'}
            </span>
          </div>

          <p className="text-sm mt-2" style={{ color: 'var(--muted-foreground)' }}>
            Вместимость: {capacityLabel}
          </p>
        </div>

        <button
          onClick={onNext}
          disabled={!canNext}
          aria-label="Следующая ячейка"
          className={arrowBtn}
          style={{ width: 44, height: 44, background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  )
}

/**
 * Vertical "beaker" fill meter for bulk stock entry. Fills bottom-up like the
 * cell itself; tap or drag along its height to set the value. Works directly in
 * units (packs) — value/capacity — and snaps to whole packs in 0..capacity.
 * Cell info (address, product name, capacity) sits inside so no duplicate card
 * is needed above.
 */
function BulkFillMeter({
  value,
  capacity,
  onChange,
  address,
  productName,
  positionNo,
  total,
}: {
  value: number
  capacity: number
  onChange: (v: number) => void
  address: string
  productName: string
  positionNo: number
  total: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  function valueFromClientY(clientY: number): number {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || rect.height === 0 || capacity <= 0) return 0
    const rel = (clientY - rect.top) / rect.height
    const frac = Math.max(0, Math.min(1, 1 - rel))
    return Math.max(0, Math.min(capacity, Math.round(frac * capacity)))
  }

  function handlePointer(e: React.PointerEvent) {
    if (e.type === 'pointermove' && e.buttons === 0) return
    onChange(valueFromClientY(e.clientY))
  }

  const percent = capacity > 0 ? (value / capacity) * 100 : 0
  const light = percent >= 50

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-xl border overflow-hidden relative select-none"
      style={{
        touchAction: 'none',
        cursor: 'ns-resize',
        background: 'var(--card)',
        borderColor: 'var(--border)',
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        handlePointer(e)
      }}
      onPointerMove={handlePointer}
    >
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: `${percent}%`, background: 'var(--primary)', opacity: 0.85 }}
      />
      {percent > 1 && percent < 99 && (
        <div
          className="absolute left-0 right-0"
          style={{ bottom: `${percent}%`, height: 2, background: 'var(--primary)' }}
        />
      )}
      {/* Cell info at the top, the fill value centred below it. */}
      <div className="absolute inset-0 flex flex-col items-center px-3 pt-4 pb-4 pointer-events-none text-center">
        <span className="text-xs" style={{ color: light ? 'rgba(255,255,255,0.85)' : 'var(--muted-foreground)' }}>
          №{positionNo} из {total}
        </span>
        <span
          className="text-base font-semibold leading-tight mt-0.5"
          style={{ color: light ? 'white' : 'var(--foreground)' }}
        >
          {address} · {productName}
        </span>
        <div className="flex-1 flex flex-col items-center justify-center gap-1">
          <span
            className="font-bold leading-none"
            style={{ fontSize: 44, color: light ? 'white' : 'var(--foreground)' }}
          >
            {packs(value)}
          </span>
          <span
            className="text-sm"
            style={{ color: light ? 'rgba(255,255,255,0.85)' : 'var(--muted-foreground)' }}
          >
            из {packs(capacity)}
          </span>
        </div>
      </div>
    </div>
  )
}

function InputZone({
  cell,
  products,
  sessionId,
  userId,
  address,
  productName,
  positionNo,
  total,
  onPrev,
  onNext,
  canPrev,
  canNext,
  alreadyVisited,
  onSaved,
  onSkip,
}: {
  cell: Cell
  products: Product[]
  sessionId: string
  userId: string | null
  address: string
  productName: string
  positionNo: number
  total: number
  onPrev: () => void
  onNext: () => void
  canPrev: boolean
  canNext: boolean
  alreadyVisited: boolean
  onSaved: (cellId: string) => void
  onSkip: () => void
}) {
  const product = products.find((p) => p.id === cell.product_id)
  const capacity = product ? getCapacity(cell, product) : 0
  const pieces = product ? isPiecesInput(product) : true
  const isBulk = product?.type === 'bulk'
  const unitLabel = product ? productUnitLabel(product) : 'шт'
  // Unit products may exceed capacity (warned, but allowed); slider/packs clamp.
  const clampToCapacity = product?.type !== 'unit'

  const [value, setValue] = useState(0)
  const [saving, setSaving] = useState(false)

  // Prefill with the value already entered for this cell in this session.
  // InputZone is keyed by cell id, so `entered` resolves once per cell; the
  // user's later edits stay because `entered` doesn't change until they save.
  const entered = useEnteredValue(sessionId, cell.id)
  useEffect(() => {
    if (entered != null) setValue(entered)
  }, [entered])

  const isOverCapacity = product?.type === 'unit' && value > capacity

  function setClamped(v: number) {
    let next = Math.max(0, v)
    if (clampToCapacity) next = Math.min(capacity, next)
    setValue(next)
  }

  function bump(delta: number) {
    setClamped(value + delta)
  }

  async function handleSaveAndNext() {
    if (!userId || saving) return
    setSaving(true)
    try {
      const outcome = await saveStockEntry({
        cellId: cell.id,
        sessionId,
        userId,
        value,
      })
      if (outcome === 'ok') {
        toastSuccess(`✓ Внесено: ${value} из ${capacity} ${unitLabel}`)
      } else {
        toast.error('Сохранено локально — синхронизируется позже')
      }
      onSaved(cell.id)
    } finally {
      setSaving(false)
    }
  }

  const bumpBtn =
    'flex-1 flex items-center justify-center rounded-md font-semibold text-base'
  const bumpStyle = { height: 46, background: 'var(--card)', border: '1px solid var(--border)' }

  return (
    <div className="px-4 pt-3 pb-4 mt-auto flex flex-col min-h-0">
      {isBulk ? (
        /* Bulk: fill meter in place of the card + numeric input. Cell info +
           value live inside it; prev/next arrows flank it. Fixed height so the
           radar above keeps the same size as on pieces cells. */
        <div className="flex items-center gap-2" style={{ height: 240 }}>
          <button
            onClick={onPrev}
            disabled={!canPrev}
            aria-label="Предыдущая ячейка"
            className="flex items-center justify-center rounded-md flex-shrink-0 disabled:opacity-30"
            style={{ width: 44, height: 44, background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1 min-w-0 h-full">
            <BulkFillMeter
              value={value}
              capacity={capacity}
              onChange={setClamped}
              address={address}
              productName={productName}
              positionNo={positionNo}
              total={total}
            />
          </div>
          <button
            onClick={onNext}
            disabled={!canNext}
            aria-label="Следующая ячейка"
            className="flex items-center justify-center rounded-md flex-shrink-0 disabled:opacity-30"
            style={{ width: 44, height: 44, background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <ChevronRight size={24} />
          </button>
        </div>
      ) : (
        /* Pieces / round: big numeric readout */
        <div
          className="rounded-lg flex items-center justify-center gap-1"
          style={{
            height: 56,
            background: 'var(--card)',
            border: `1px solid ${isOverCapacity ? 'var(--destructive)' : 'var(--border)'}`,
          }}
        >
          {pieces ? (
            <>
              <input
                type="text"
                inputMode="numeric"
                aria-label={`Количество, ${unitLabel}`}
                placeholder="0"
                value={value === 0 ? '' : String(value)}
                onChange={(e) => {
                  const n = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10)
                  setClamped(isNaN(n) ? 0 : n)
                }}
                className="text-center font-bold bg-transparent outline-none"
                style={{ fontSize: 30, width: '5ch', color: 'var(--foreground)' }}
              />
              <span className="text-base" style={{ color: 'var(--muted-foreground)' }}>{unitLabel}</span>
            </>
          ) : (
            <>
              <span className="text-center font-bold" style={{ fontSize: 30, color: 'var(--foreground)' }}>
                {value}
              </span>
              <span className="text-base" style={{ color: 'var(--muted-foreground)' }}>{unitLabel}</span>
            </>
          )}
        </div>
      )}

      {isOverCapacity && (
        <p className="text-xs text-center mt-1" style={{ color: 'var(--destructive)' }}>
          Больше вместимости ({capacity} {unitLabel})
        </p>
      )}

      {/* ± buttons — pieces / round only; bulk uses the slider to set packs. */}
      {!isBulk && (
        <div className="flex gap-2 mt-2">
          <button className={bumpBtn} style={bumpStyle} onClick={() => bump(-10)}>−10</button>
          <button className={bumpBtn} style={bumpStyle} onClick={() => bump(-1)}>−1</button>
          <button className={bumpBtn} style={bumpStyle} onClick={() => bump(1)}>+1</button>
          <button className={bumpBtn} style={bumpStyle} onClick={() => bump(10)}>+10</button>
        </div>
      )}

      <motion.button
        className="btn-primary w-full rounded-md font-semibold text-base mt-3 disabled:opacity-40 flex-shrink-0"
        style={{ height: 52 }}
        whileTap={!saving ? { scale: 0.97 } : undefined}
        onClick={handleSaveAndNext}
        disabled={saving}
      >
        {saving ? '…' : alreadyVisited ? 'Перезаписать и дальше' : 'Записать и дальше'}
      </motion.button>

      <button
        className="w-full py-3 text-sm text-center rounded-md mt-1 flex-shrink-0"
        style={{ color: 'var(--muted-foreground)' }}
        onClick={onSkip}
      >
        Пропустить
      </button>
    </div>
  )
}

/** The latest value entered for this cell in this session, or null if none. */
function useEnteredValue(sessionId: string, cellId: string): number | null {
  const value = useLiveQuery(
    () =>
      db.stock_entries
        .where('session_id')
        .equals(sessionId)
        .and((e) => e.cell_id === cellId)
        .sortBy('created_at')
        .then((rows) => (rows.length ? rows[rows.length - 1].value : null)),
    [sessionId, cellId],
  )
  return value ?? null
}
