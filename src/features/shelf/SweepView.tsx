import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
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
  countVisitedLeaves,
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

      <div className="flex-1 min-h-0 overflow-auto flex flex-col">
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
            {nextUnvisitedNo != null && (
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
  const currentBase = currentCell ? getBaseAncestor(currentCell, cells) : undefined
  const baseCells = cells.filter((c) => c.parent_id === null)
  const byPos = new Map<string, Cell>()
  for (const c of baseCells) {
    if (c.row_index != null && c.col_index != null) {
      byPos.set(`${c.row_index}:${c.col_index}`, c)
    }
  }

  return (
    <button
      onClick={onOpen}
      aria-label="Открыть карту стеллажа"
      className="w-full flex-shrink-0 border-b px-3 py-2 flex items-center justify-center overflow-hidden"
      style={{ height: 72, borderColor: 'var(--border)', background: 'var(--background)' }}
    >
      <div
        className="grid gap-[3px] h-full"
        style={{
          gridTemplateColumns: `repeat(${shelf.cols_count}, 1fr)`,
          gridTemplateRows: `repeat(${shelf.rows_count}, 1fr)`,
        }}
      >
        {Array.from({ length: shelf.rows_count }).flatMap((_, ri) =>
          Array.from({ length: shelf.cols_count }).map((__, ci) => {
            const cell = byPos.get(`${ri + 1}:${ci + 1}`)
            const isCurrent = cell && currentBase && cell.id === currentBase.id
            let bg = 'var(--muted)'
            if (cell) {
              const { visited, total } = countVisitedLeaves(cell, cells, visitedCellIds)
              const fullyVisited = total > 0 && visited === total
              if (isCurrent) bg = 'var(--primary)'
              else if (fullyVisited) bg = 'rgba(16,185,129,0.45)'
              else bg = 'rgba(148,163,184,0.35)'
            } else {
              bg = 'transparent'
            }
            return (
              <div
                key={`${ri}:${ci}`}
                style={{
                  background: bg,
                  borderRadius: 3,
                  width: 14,
                  outline: isCurrent ? '2px solid var(--primary)' : undefined,
                }}
              />
            )
          }),
        )}
      </div>
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

          {/* Reserved space for a future product icon. */}
          <div style={{ height: 8 }} />

          <div className="flex items-center gap-2 mt-1">
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
        <BulkFillMeter percent={bulkPercent} onChange={setBulkPercent} capacity={capacity} />
      ) : (
        <div className="flex flex-col gap-3">
          <div
            className="rounded-lg flex items-center justify-center"
            style={{
              height: 72,
              background: 'var(--card)',
              border: `1px solid ${isOverCapacity ? 'var(--destructive)' : 'var(--border)'}`,
            }}
          >
            <span className="font-bold" style={{ fontSize: 40, color: 'var(--foreground)' }}>
              {unitValue}
            </span>
            <span className="text-lg ml-2" style={{ color: 'var(--muted-foreground)' }}>шт</span>
          </div>
          {isOverCapacity && (
            <p className="text-sm text-center" style={{ color: 'var(--destructive)' }}>
              Больше вместимости ({capacity} шт)
            </p>
          )}
          <div className="flex gap-2">
            <button className={bumpBtn} style={{ height: 52, background: 'var(--card)', border: '1px solid var(--border)' }} onClick={() => bump(-10)}>−10</button>
            <button className={bumpBtn} style={{ height: 52, background: 'var(--card)', border: '1px solid var(--border)' }} onClick={() => bump(-1)}>−1</button>
            <button className={bumpBtn} style={{ height: 52, background: 'var(--card)', border: '1px solid var(--border)' }} onClick={() => bump(1)}>+1</button>
            <button className={bumpBtn} style={{ height: 52, background: 'var(--card)', border: '1px solid var(--border)' }} onClick={() => bump(10)}>+10</button>
          </div>
        </div>
      )}

      <motion.button
        className="btn-primary w-full rounded-md font-semibold text-base mt-4 disabled:opacity-40"
        style={{ height: 56 }}
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
