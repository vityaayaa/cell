import { useState } from 'react'
import { db } from '@/data/db'
import type { OrderLine } from '@/data/db'
import { supabase } from '@/data/supabase'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

interface OrderLineSheetProps {
  line: OrderLine | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OrderLineSheet({ line, open, onOpenChange }: OrderLineSheetProps) {
  const [packCount, setPackCount] = useState<number>(line?.quantity_packs ?? 1)
  const [saving, setSaving] = useState(false)

  if (line && packCount !== line.quantity_packs && !saving) {
    setPackCount(line.quantity_packs)
  }

  if (!line) return null

  const packSize = line.quantity_packs > 0
    ? Math.round(line.quantity_units / line.quantity_packs)
    : 1

  async function handleSave() {
    if (!line) return
    setSaving(true)
    const newUnits = packCount * packSize
    const now = new Date().toISOString()
    await db.order_lines.update(line.id, {
      quantity_packs: packCount,
      quantity_units: newUnits,
      updated_at: now,
    })
    await supabase
      .from('order_lines')
      .update({ quantity_packs: packCount, quantity_units: newUnits, updated_at: now })
      .eq('id', line.id)
    setSaving(false)
    onOpenChange(false)
  }

  async function handleDelete() {
    if (!line) return
    setSaving(true)
    await db.order_lines.delete(line.id)
    await supabase.from('order_lines').delete().eq('id', line.id)
    setSaving(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base">{line.product_name}</DialogTitle>
          {line.deficit_units != null && (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Дефицит: {line.deficit_units} шт · расчётное {line.quantity_packs} пачек
            </p>
          )}
        </DialogHeader>

        {/* Pack counter */}
        <div className="flex items-center gap-3">
          <button
            className="w-10 h-10 rounded-md border text-lg font-medium flex items-center justify-center"
            style={{ borderColor: 'var(--border)' }}
            onClick={() => setPackCount((p) => Math.max(1, p - 1))}
            disabled={packCount <= 1}
          >
            −
          </button>
          <Input
            type="number"
            inputMode="numeric"
            value={packCount}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10)
              if (!isNaN(v) && v >= 1) setPackCount(v)
            }}
            className="w-20 text-center text-base"
            style={{ fontSize: '16px' }}
          />
          <button
            className="w-10 h-10 rounded-md border text-lg font-medium flex items-center justify-center"
            style={{ borderColor: 'var(--border)' }}
            onClick={() => setPackCount((p) => p + 1)}
          >
            +
          </button>
        </div>

        <Button className="w-full h-14" onClick={handleSave} disabled={saving}>
          {saving ? '…' : 'Сохранить'}
        </Button>

        <Separator />

        <button
          className="w-full py-3 text-sm font-medium text-center disabled:opacity-40"
          style={{ color: 'var(--destructive)' }}
          onClick={handleDelete}
          disabled={saving}
        >
          Удалить из заявки
        </button>
      </DialogContent>
    </Dialog>
  )
}

// ---- Boundary line dialog ----

interface BoundaryLineSheetProps {
  line: OrderLine | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onIncluded: (line: OrderLine) => void
}

export function BoundaryLineSheet({
  line,
  open,
  onOpenChange,
  onIncluded,
}: BoundaryLineSheetProps) {
  const [saving, setSaving] = useState(false)

  if (!line) return null

  async function handleInclude() {
    if (!line) return
    setSaving(true)
    const now = new Date().toISOString()
    const updated = {
      ...line,
      is_boundary: false,
      quantity_packs: 1,
      quantity_units: 1 * (line.quantity_units > 0 ? Math.round(line.quantity_units / Math.max(line.quantity_packs, 1)) : 1),
      updated_at: now,
    }
    await db.order_lines.update(line.id, {
      is_boundary: false,
      quantity_packs: 1,
      updated_at: now,
    })
    await supabase
      .from('order_lines')
      .update({ is_boundary: false, quantity_packs: 1, updated_at: now })
      .eq('id', line.id)
    setSaving(false)
    onOpenChange(false)
    onIncluded(updated)
  }

  const packSizeDisplay =
    line.deficit_units != null ? `(${line.deficit_units} шт)` : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base">{line.product_name}</DialogTitle>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            дефицит{' '}
            {line.deficit_units != null ? `${line.deficit_units} шт` : ''} —{' '}
            меньше одной пачки {packSizeDisplay}
          </p>
        </DialogHeader>

        <Button className="w-full h-14" onClick={handleInclude} disabled={saving}>
          {saving ? '…' : 'Включить в заявку'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

// ---- Finalize dialog ----

interface FinalizeSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  totalPositions: number
  totalPacks: number
  onFinalize: () => Promise<void>
}

export function FinalizeSheet({
  open,
  onOpenChange,
  totalPositions,
  totalPacks,
  onFinalize,
}: FinalizeSheetProps) {
  const [loading, setLoading] = useState(false)

  async function handleFinalize() {
    setLoading(true)
    try {
      await onFinalize()
    } finally {
      setLoading(false)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Готово к финализации</DialogTitle>
          <p className="text-base font-medium" style={{ color: 'var(--foreground)' }}>
            {totalPositions} позиций · {totalPacks} пачек
          </p>
        </DialogHeader>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Это нельзя отменить. Заявка будет зафиксирована.
        </p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-14"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Отмена
          </Button>
          <Button
            className="flex-1 h-14"
            onClick={handleFinalize}
            disabled={loading}
          >
            {loading ? '…' : 'Финализировать →'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
