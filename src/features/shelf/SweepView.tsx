import { useMemo, useState } from 'react'
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
  BulkFillMeter,
} from '@/features/stock/StockEntryDialog'
import { saveStockEntry } from '@/features/stock/saveStockEntry'
import { ShelfGrid } from './ShelfGrid'
import { SweepProgressBar } from './SweepProgressBar'
import { buildSweepOrder, getBaseAncestor } from './sweepOrder'
import {
  getProductDisplayName,
  getMaterialForProduct,
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
      <div className="flex flex-col h-full">
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
    <div className="flex flex-col h-full">
      <SweepProgressBar visited={visited} total={total} sessionId={sessionId} />

      <RadarStrip
        shelf={shelf}
        cells={cells}
        currentCell={currentCell}
        visitedCellIds={visitedCellIds}
        onOpen={() => setRadarOpen(true)}
      />

      <div className="flex-1 min-h-0 flex flex-col">
        {currentCell && (
          <CurrentCellCard
            cell={currentCell}
            cells={cells}
            products={products}
            materials={materials}
            sessionId={sessionId}
            positionNo={currentIndex + 1}
            total={order.length}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            canPrev={currentIndex > 0}
            canNext={currentIndex < order.length - 1}
          />
        )}

        {allVisited && (
          <div
            className="mx-4 mt-2 rounded-lg p-3 text-center"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <p className="text-sm font-semibold" style={{ color: '#10B981' }}>
              ✓ Обход завершён
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Все ячейки внесены. Перейдите к заявке кнопкой выше.
            </p>
          </div>
        )}

        {currentCell && (
          <InputZone
            key={currentCell.id}
            cell={currentCell}
            products={products}
            sessionId={sessionId}
            userId={userId}
            alreadyVisited={visitedCellIds.has(currentCell.id)}
            onSaved={(cellId) => advanceAfterSave(cellId)}
            onSkip={() => step(1)}
          />
        )}
      </div>

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

/** A centered window of track positions of `size`, clamped to [1, max]. */
function windowRange(center: number, size: number, max: number): number[] {
  const span = Math.min(size, max)
  let start = center - Math.floor(span / 2)
  if (start < 1) start = 1
  if (start + span - 1 > max) start = max - span + 1
  return Array.from({ length: span }, (_, i) => start + i)
}

/**
 * Radar = a LOCAL view: a small window of sections around the current one (with
 * their sub-cells), so you see where you are and what's right next to you. The
 * whole shelf opens only on tap.
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
  const byPos = new Map<string, Cell>()
  for (const c of cells) {
    if (c.parent_id === null && c.row_index != null && c.col_index != null) {
      byPos.set(`${c.row_index}:${c.col_index}`, c)
    }
  }
  const currentId = currentCell?.id ?? null
  const section = currentCell ? getBaseAncestor(currentCell, cells) : null
  const cr = section?.row_index ?? 1
  const cc = section?.col_index ?? 1

  const rowRange = windowRange(cr, 3, shelf.rows_count)
  const colRange = windowRange(cc, 3, shelf.cols_count)

  return (
    <button
      onClick={onOpen}
      aria-label="Открыть карту стеллажа"
      className="w-full flex-shrink-0 border-b px-3 py-2 relative"
      style={{ height: 124, borderColor: 'var(--border)', background: 'var(--background)' }}
    >
      <div
        className="w-full h-full rounded-md p-2"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div
          className="grid w-full h-full"
          style={{
            gap: 5,
            gridTemplateColumns: `repeat(${colRange.length}, 1fr)`,
            gridTemplateRows: `repeat(${rowRange.length}, 1fr)`,
          }}
        >
          {rowRange.flatMap((r) =>
            colRange.map((cl) => {
              const c = byPos.get(`${r}:${cl}`)
              const isCurrentSection = c && section && c.id === section.id
              return (
                <div
                  key={`${r}:${cl}`}
                  className="rounded-sm"
                  style={{
                    minWidth: 0,
                    minHeight: 0,
                    padding: isCurrentSection ? 2 : 0,
                    outline: isCurrentSection ? '2px solid var(--primary)' : undefined,
                    opacity: c ? (isCurrentSection ? 1 : 0.55) : 0,
                  }}
                >
                  {c ? (
                    <MiniNode cell={c} cells={cells} currentId={currentId} visitedCellIds={visitedCellIds} />
                  ) : null}
                </div>
              )
            }),
          )}
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
  sessionId,
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
  sessionId: string
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
  const isBulk = product?.type === 'bulk' || product?.type === 'round'

  const entered = useEnteredValue(sessionId, cell.id)

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
              {product ? getProductDisplayName(product) : '—'}
            </span>
          </div>

          <p className="text-sm mt-2" style={{ color: 'var(--muted-foreground)' }}>
            Вместимость: {isBulk ? packs(capacity) : `${capacity} шт`}
          </p>

          {entered != null && (
            <p className="text-sm mt-1" style={{ color: '#10B981' }}>
              Внесено: {entered}
            </p>
          )}
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

function InputZone({
  cell,
  products,
  sessionId,
  userId,
  alreadyVisited,
  onSaved,
  onSkip,
}: {
  cell: Cell
  products: Product[]
  sessionId: string
  userId: string | null
  alreadyVisited: boolean
  onSaved: (cellId: string) => void
  onSkip: () => void
}) {
  const product = products.find((p) => p.id === cell.product_id)
  const capacity = product ? getCapacity(cell, product) : 0
  const isBulk = product?.type === 'bulk' || product?.type === 'round'

  const [unitValue, setUnitValue] = useState(0)
  const [bulkPercent, setBulkPercent] = useState(0)
  const [saving, setSaving] = useState(false)

  const packsValue = Math.round((bulkPercent / 100) * capacity)
  const value = isBulk ? packsValue : unitValue
  const isOverCapacity = !isBulk && unitValue > capacity

  function bump(delta: number) {
    setUnitValue((v) => Math.max(0, v + delta))
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
        const msg = isBulk
          ? `✓ Внесено: ${value} из ${packs(capacity)}`
          : `✓ Внесено: ${value} из ${capacity} шт`
        toastSuccess(msg)
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

  return (
    <div className="px-4 pt-4 pb-4 mt-auto">
      {isBulk ? (
        <BulkFillMeter percent={bulkPercent} onChange={setBulkPercent} capacity={capacity} height={200} />
      ) : (
        <div className="flex flex-col gap-2">
          <div
            className="rounded-lg flex items-center justify-center gap-1"
            style={{
              height: 58,
              background: 'var(--card)',
              border: `1px solid ${isOverCapacity ? 'var(--destructive)' : 'var(--border)'}`,
            }}
          >
            <input
              type="text"
              inputMode="numeric"
              aria-label="Количество, шт"
              placeholder="0"
              value={unitValue === 0 ? '' : String(unitValue)}
              onChange={(e) => {
                const n = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10)
                setUnitValue(isNaN(n) ? 0 : n)
              }}
              className="text-center font-bold bg-transparent outline-none"
              style={{ fontSize: 30, width: '5ch', color: 'var(--foreground)' }}
            />
            <span className="text-base" style={{ color: 'var(--muted-foreground)' }}>шт</span>
          </div>
          {isOverCapacity && (
            <p className="text-xs text-center" style={{ color: 'var(--destructive)' }}>
              Больше вместимости ({capacity} шт)
            </p>
          )}
          <div className="flex gap-2">
            <button className={bumpBtn} style={{ height: 46, background: 'var(--card)', border: '1px solid var(--border)' }} onClick={() => bump(-10)}>−10</button>
            <button className={bumpBtn} style={{ height: 46, background: 'var(--card)', border: '1px solid var(--border)' }} onClick={() => bump(-1)}>−1</button>
            <button className={bumpBtn} style={{ height: 46, background: 'var(--card)', border: '1px solid var(--border)' }} onClick={() => bump(1)}>+1</button>
            <button className={bumpBtn} style={{ height: 46, background: 'var(--card)', border: '1px solid var(--border)' }} onClick={() => bump(10)}>+10</button>
          </div>
        </div>
      )}

      <motion.button
        className="btn-primary w-full rounded-md font-semibold text-base mt-3 disabled:opacity-40"
        style={{ height: 52 }}
        whileTap={!saving ? { scale: 0.97 } : undefined}
        onClick={handleSaveAndNext}
        disabled={saving}
      >
        {saving ? '…' : alreadyVisited ? 'Перезаписать и дальше' : 'Записать и дальше'}
      </motion.button>

      <button
        className="w-full py-3 text-sm text-center rounded-md mt-1"
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
