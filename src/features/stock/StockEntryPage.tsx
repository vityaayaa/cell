import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'
import { motion } from 'motion/react'
import { ChevronLeft } from 'lucide-react'
import { db } from '@/data/db'
import type { Cell, Product } from '@/data/db'
import { supabase } from '@/data/supabase'
import { subscribeToTable } from '@/data/sync'
import { useAppStore } from '@/data/store'
import { getEffectiveCapacity } from '@/domain/capacity'
import type { ProductDimensions } from '@/domain/capacity'
import { getProductDisplayName } from '@/features/shelf/cellUtils'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'

function buildCellAddress(cell: Cell, allCells: Cell[]): string {
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (!cell.parent_id) {
    const row = cell.row_index != null ? (LETTERS[cell.row_index - 1] ?? String(cell.row_index)) : '?'
    const col = cell.col_index ?? '?'
    return `${row}${col}`
  }
  const parent = allCells.find((c) => c.id === cell.parent_id)
  if (!parent) {
    const row = cell.row_index != null ? (LETTERS[cell.row_index - 1] ?? String(cell.row_index)) : '?'
    const col = cell.col_index ?? '?'
    return `${row}${col}`
  }
  const parentAddr = buildCellAddress(parent, allCells)
  if (parent.split_direction === 'V') {
    const col = cell.is_first_child ? 1 : 2
    return `${parentAddr}(1,${col})`
  }
  if (parent.split_direction === 'H') {
    const row = cell.is_first_child ? 1 : 2
    return `${parentAddr}(${row},1)`
  }
  return parentAddr
}

function getCapacity(cell: Cell, product: Product): number {
  const productDims: ProductDimensions =
    product.type === 'unit'
      ? { type: 'unit', width_mm: product.width_mm ?? 0, height_mm: product.height_mm ?? 0 }
      : product.type === 'round'
        ? { type: 'round', diameter_mm: product.diameter_mm ?? 0 }
        : { type: 'bulk' }

  return getEffectiveCapacity(
    { computed_width_mm: cell.computed_width_mm, computed_height_mm: cell.computed_height_mm },
    productDims,
    { rotation_allowed: cell.rotation_allowed, capacity_override: cell.capacity_override },
  )
}

interface ToastProgressProps {
  message: string
  duration?: number
}

function ToastProgress({ message, duration = 2000 }: ToastProgressProps) {
  return (
    <div
      className="relative overflow-hidden rounded-lg px-4 py-3 w-full"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
        {message}
      </p>
      <motion.div
        className="absolute bottom-0 left-0 h-0.5"
        style={{ background: '#10B981' }}
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: duration / 1000, ease: 'linear' }}
      />
    </div>
  )
}

export default function StockEntryPage() {
  const { cellId } = useParams<{ cellId: string }>()
  const navigate = useNavigate()
  const { activeSessionId, userId } = useAppStore((s) => ({
    activeSessionId: s.activeSessionId,
    userId: s.userId,
  }))

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
  const [sliderPercent, setSliderPercent] = useState(0)
  const [saving, setSaving] = useState(false)

  // Realtime protection: if cell params changed while form is open, close
  useEffect(() => {
    if (!cellId) return
    const ch = subscribeToTable('cells', (payload) => {
      if (payload.new?.id === cellId && payload.eventType === 'UPDATE') {
        toast('Параметры ячейки изменились. Откройте снова.')
        navigate(-1)
      }
    })
    return () => { supabase.removeChannel(ch) }
  }, [cellId, navigate])

  if (data === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }}
        />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col h-full">
        <div
          className="flex items-center gap-2 px-4 py-3 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <button onClick={() => navigate(-1)} className="p-1 -ml-1">
            <ChevronLeft size={20} style={{ color: 'var(--foreground)' }} />
          </button>
        </div>
        <div className="flex items-center justify-center flex-1 p-6">
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Ячейка не найдена или товар не назначен.
          </p>
        </div>
      </div>
    )
  }

  if (!activeSessionId || !userId) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
          Нет активного обхода. Вернитесь к стеллажу и начните обход.
        </p>
      </div>
    )
  }

  const { product, address, capacity } = data
  const isBulk = product.type === 'bulk'
  const packsValue = Math.round((sliderPercent / 100) * capacity)
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
    await db.stock_entries.put(entry)
    const { error } = await supabase.from('stock_entries').insert(entry)
    if (error) {
      await db.stock_entries.delete(entry.id)
      toast.error('Не сохранилось. Попробуйте ещё раз.')
      setSaving(false)
      return
    }

    const toastMsg = isBulk
      ? `✓ Внесено: ≈ ${value} из ${capacity} пачек (${sliderPercent}%)`
      : `✓ Внесено: ${value} из ${capacity} шт`

    toast.custom(() => <ToastProgress message={toastMsg} duration={2000} />, {
      duration: 2000,
    })
    navigate(-1)
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <button onClick={() => navigate(-1)} className="p-1 -ml-1">
          <ChevronLeft size={20} style={{ color: 'var(--foreground)' }} />
        </button>
        <span className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
          {address}
        </span>
      </div>

      {/* Form */}
      <div className="flex flex-col gap-6 p-5 flex-1">
        {/* Product info */}
        <div className="flex flex-col gap-1">
          <p className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            {getProductDisplayName(product)}
          </p>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Вместимость:{' '}
            {isBulk ? `${capacity} пачек` : `${capacity} шт`}
          </p>
        </div>

        {/* Input */}
        {isBulk ? (
          <div className="flex flex-col gap-3">
            <Slider
              min={0}
              max={100}
              step={1}
              value={[sliderPercent]}
              onValueChange={([v]: number[]) => setSliderPercent(v)}
            />
            <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
              ≈ {packsValue} пачек
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <Input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={numericValue}
                onChange={(e) => setNumericValue(e.target.value)}
                className="text-base w-28"
                style={{
                  fontSize: '16px',
                  borderColor: isOverCapacity ? 'var(--destructive)' : undefined,
                }}
                autoFocus
              />
              <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                шт
              </span>
            </div>
            {isOverCapacity && (
              <p className="text-sm" style={{ color: 'var(--destructive)' }}>
                Максимум {capacity} шт
              </p>
            )}
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="px-5 pb-6 flex-shrink-0">
        <button
          className="w-full rounded-md font-semibold text-base disabled:opacity-40"
          style={{
            height: '56px',
            background: canSave ? 'var(--primary)' : 'var(--muted)',
            color: canSave ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
          }}
          onClick={handleSave}
          disabled={!canSave || saving}
        >
          {saving ? '…' : 'Сохранить'}
        </button>
      </div>
    </div>
  )
}
