import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { db } from '@/data/db'
import type { Cell, Product } from '@/data/db'
import { toastSuccess } from '@/lib/toast'
import { getCapacity } from '@/features/stock/StockEntryDialog'
import { saveStockEntry } from '@/features/stock/saveStockEntry'
import { isPiecesInput, productUnitLabel } from '../cellUtils'
import { BulkFillMeter } from './BulkFillMeter'

export function InputZone({
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
  // Capacity not computed (no dimensions / no manual override): the remaining
  // can't be worked out, so block saving instead of recording a bogus 0.
  const capacityMissing = product != null && capacity === 0

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
        <div className="flex items-stretch gap-2" style={{ height: 240 }}>
          <button
            onClick={onPrev}
            disabled={!canPrev}
            aria-label="Предыдущая ячейка"
            className="flex items-center justify-center rounded-md flex-shrink-0 disabled:opacity-30"
            style={{ width: 44, background: 'var(--card)', border: '1px solid var(--border)' }}
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
            style={{ width: 44, background: 'var(--card)', border: '1px solid var(--border)' }}
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

      {capacityMissing && (
        <p className="text-xs text-center mt-1" style={{ color: 'var(--destructive)' }}>
          Вместимость не задана — укажите её в настройках ячейки
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
        whileTap={!saving && !capacityMissing ? { scale: 0.97 } : undefined}
        onClick={handleSaveAndNext}
        disabled={saving || capacityMissing}
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
