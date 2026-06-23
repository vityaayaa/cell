import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'
import { toastSuccess } from '@/lib/toast'
import { db } from '@/data/db'
import type { Cell, Product } from '@/data/db'
import { supabase } from '@/data/supabase'
import { subscribeToTable } from '@/data/sync'
import { useAppStore } from '@/data/store'
import { getEffectiveCapacity } from '@/domain/capacity'
import type { ProductDimensions } from '@/domain/capacity'
import { getProductDisplayName } from '@/features/shelf/cellUtils'
import { packs } from '@/lib/plural'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { motion } from 'motion/react'

function buildCellAddress(cell: Cell, allCells: Cell[]): string {
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (!cell.parent_id) {
    const row = cell.row_index != null ? (LETTERS[cell.row_index - 1] ?? String(cell.row_index)) : '?'
    const col = cell.col_index ?? '?'
    return `${row}${col}`
  }
  const parent = allCells.find((c) => c.id === cell.parent_id)
  if (!parent) return '?'
  const parentAddr = buildCellAddress(parent, allCells)
  if (parent.split_direction === 'V') return `${parentAddr}(1,${cell.is_first_child ? 1 : 2})`
  if (parent.split_direction === 'H') return `${parentAddr}(${cell.is_first_child ? 1 : 2},1)`
  return parentAddr
}

function getCapacity(cell: Cell, product: Product): number {
  const dims: ProductDimensions =
    product.type === 'unit'
      ? { type: 'unit', width_mm: product.width_mm ?? 0, height_mm: product.height_mm ?? 0 }
      : product.type === 'round'
        ? { type: 'round', diameter_mm: product.diameter_mm ?? 0 }
        : { type: 'bulk' }
  return getEffectiveCapacity(
    { computed_width_mm: cell.computed_width_mm, computed_height_mm: cell.computed_height_mm },
    dims,
    { rotation_allowed: cell.rotation_allowed, capacity_override: cell.capacity_override },
  )
}

function BulkFillMeter({
  percent,
  onChange,
  capacity,
}: {
  percent: number
  onChange: (p: number) => void
  capacity: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Snap the raw pointer position to the nearest whole pack, then convert back
  // to a percent that lands exactly on a pack boundary (0/25/50/75/100% for 4).
  function computePercent(clientY: number): number {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return percent
    const rel = (clientY - rect.top) / rect.height
    const rawPercent = Math.max(0, Math.min(100, (1 - rel) * 100))
    if (capacity <= 0) return 0
    const pack = Math.max(0, Math.min(capacity, Math.round((rawPercent / 100) * capacity)))
    return (pack / capacity) * 100
  }

  function handlePointer(e: React.PointerEvent) {
    if (e.type === 'pointermove' && e.buttons === 0) return
    onChange(computePercent(e.clientY))
  }

  const pack = capacity > 0 ? Math.round((percent / 100) * capacity) : 0

  return (
    <div className="flex gap-4 items-stretch" style={{ height: 260 }}>
      {/* Vertical tick labels */}
      <div
        className="flex flex-col justify-between text-xs py-1 flex-shrink-0"
        style={{ color: 'var(--muted-foreground)', width: 32, textAlign: 'right' }}
      >
        <span>100%</span>
        <span>75%</span>
        <span>50%</span>
        <span>25%</span>
        <span>0%</span>
      </div>

      {/* Fill bar */}
      <div
        ref={containerRef}
        className="flex-1 rounded-xl border overflow-hidden relative select-none"
        style={{ touchAction: 'none', cursor: 'ns-resize', borderColor: 'var(--border)' }}
        onPointerDown={handlePointer}
        onPointerMove={handlePointer}
      >
        {/* Unfilled top */}
        <div
          className="absolute top-0 left-0 right-0"
          style={{ height: `${100 - percent}%`, background: 'var(--muted)' }}
        />
        {/* Filled bottom */}
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{ height: `${percent}%`, background: 'var(--primary)', opacity: 0.85 }}
        />
        {/* Divider line */}
        {percent > 2 && percent < 98 && (
          <div
            className="absolute left-0 right-0"
            style={{ top: `${100 - percent}%`, height: 2, background: 'var(--primary)' }}
          />
        )}
        {/* Center label — packs dominate, percent is secondary */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none">
          <span
            className="text-3xl font-bold"
            style={{ color: percent >= 50 ? 'white' : 'var(--foreground)' }}
          >
            {packs(pack)}
          </span>
          <span
            className="text-sm"
            style={{ color: percent >= 50 ? 'rgba(255,255,255,0.8)' : 'var(--muted-foreground)' }}
          >
            есть в ячейке
          </span>
        </div>
      </div>
    </div>
  )
}

interface StockEntryDialogProps {
  cellId: string | null
  onClose: () => void
}

export function StockEntryDialog({ cellId, onClose }: StockEntryDialogProps) {
  const activeSessionId = useAppStore((s) => s.activeSessionId)
  const userId = useAppStore((s) => s.userId)

  const data = useLiveQuery(async () => {
    if (!cellId) return null
    const allCells = await db.cells.toArray()
    const cell = allCells.find((c) => c.id === cellId)
    if (!cell || !cell.product_id) return null
    const product = await db.products.get(cell.product_id)
    if (!product) return null
    const address = buildCellAddress(cell, allCells)
    const capacity = getCapacity(cell, product)
    return { cell, product, address, capacity }
  }, [cellId])

  const [numericValue, setNumericValue] = useState('')
  const [bulkPercent, setBulkPercent] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!cellId) {
      setNumericValue('')
      setBulkPercent(0)
      setSaving(false)
    }
  }, [cellId])

  useEffect(() => {
    if (!cellId) return
    const ch = subscribeToTable('cells', (payload) => {
      if (payload.new?.id === cellId && payload.eventType === 'UPDATE') {
        toast('Параметры ячейки изменились. Откройте снова.')
        onClose()
      }
    })
    return () => { supabase.removeChannel(ch) }
  }, [cellId, onClose])

  if (!cellId) return null

  const open = !!cellId

  if (!data || !activeSessionId || !userId) {
    return (
      <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent preventOutsideClose>
          <DialogHeader><DialogTitle>Внесение остатка</DialogTitle></DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div
              className="w-6 h-6 rounded-full border-2 animate-spin"
              style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }}
            />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const { product, address, capacity } = data
  const isBulk = product.type === 'bulk' || product.type === 'round'
  const packsValue = Math.round((bulkPercent / 100) * capacity)
  const numValue = parseInt(numericValue, 10)
  const isOverCapacity = !isBulk && numericValue !== '' && !isNaN(numValue) && numValue > capacity
  const canSave = isBulk ? true : numericValue !== '' && !isNaN(numValue) && !isOverCapacity

  async function handleSave() {
    if (!canSave || !activeSessionId || !userId || !cellId) return
    const value = isBulk ? packsValue : numValue
    const entry = {
      id: crypto.randomUUID(),
      cell_id: cellId,
      session_id: activeSessionId,
      user_id: userId,
      value,
      created_at: new Date().toISOString(),
    }
    setSaving(true)
    // Local write first — this is what the sweep progress + order generation read,
    // so the sweep can proceed even if the cloud write is slow/unreachable.
    try {
      await db.stock_entries.put(entry)
      // Guard against a hung request so the button never freezes on "…".
      const result = (await Promise.race([
        supabase.from('stock_entries').insert(entry),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
      ])) as { error: unknown }
      if (result.error) throw result.error
      const msg = isBulk
        ? `✓ Внесено: ${value} из ${packs(capacity)}`
        : `✓ Внесено: ${value} из ${capacity} шт`
      toastSuccess(msg)
    } catch {
      // Keep the local entry (don't roll back) so the sweep isn't blocked;
      // the cloud copy will be reconciled on the next full sync.
      toast.error('Сохранено локально — синхронизируется позже')
    } finally {
      setSaving(false)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent preventOutsideClose showCloseButton>
        <DialogHeader>
          <DialogTitle style={{ fontSize: 20 }}>
            Ячейка {address}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1 mb-2">
          <p className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            {getProductDisplayName(product)}
          </p>
          <p className="ui-hint">
            Вместимость: {isBulk ? packs(capacity) : `${capacity} шт`}
          </p>
        </div>

        {isBulk ? (
          <BulkFillMeter
            percent={bulkPercent}
            onChange={setBulkPercent}
            capacity={capacity}
          />
        ) : (
          <div className="flex flex-col gap-2">
            <p className="ui-field-label">
              Сколько сейчас в ячейке?
            </p>
            <div className="flex items-center gap-3">
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0"
                autoFocus
                value={numericValue}
                onChange={(e) => setNumericValue(e.target.value.replace(/[^0-9]/g, ''))}
                className="text-base w-32"
                style={{
                  height: 52,
                  fontSize: 20,
                  fontWeight: 600,
                  borderColor: isOverCapacity ? 'var(--destructive)' : undefined,
                }}
              />
              <span className="text-lg" style={{ color: 'var(--muted-foreground)' }}>шт</span>
            </div>
            {isOverCapacity && (
              <p className="text-sm" style={{ color: 'var(--destructive)' }}>
                Максимум {capacity} шт
              </p>
            )}
          </div>
        )}

        <motion.button
          className="btn-primary w-full rounded-md font-semibold text-base mt-2 disabled:opacity-40"
          style={{ height: 52 }}
          whileTap={canSave && !saving ? { scale: 0.97 } : undefined}
          onClick={handleSave}
          disabled={!canSave || saving}
        >
          {saving ? '…' : 'Сохранить'}
        </motion.button>
      </DialogContent>
    </Dialog>
  )
}
