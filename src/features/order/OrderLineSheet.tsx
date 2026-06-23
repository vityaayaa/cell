import { useEffect, useState } from 'react'
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
import { packs } from '@/lib/plural'

interface OrderLineSheetProps {
  line: OrderLine | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OrderLineSheet({ line, open, onOpenChange }: OrderLineSheetProps) {
  // String state so the field can be edited freely (cleared, retyped).
  const [packStr, setPackStr] = useState('1')
  const [saving, setSaving] = useState(false)

  // Sync from the line only when it changes / the sheet opens — NOT every
  // render (a render-time setState here reset every +/- and keystroke).
  useEffect(() => {
    if (line) setPackStr(String(line.quantity_packs))
  }, [line?.id, open])

  if (!line) return null

  const count = parseInt(packStr, 10)
  const valid = !isNaN(count) && count >= 1
  const packSize = line.quantity_packs > 0
    ? Math.round(line.quantity_units / line.quantity_packs)
    : 1

  async function handleSave() {
    if (!line || !valid) return
    setSaving(true)
    const packCount = count
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
              Дефицит: {line.deficit_units} шт · расчётное {packs(line.quantity_packs)}
            </p>
          )}
        </DialogHeader>

        {/* Pack counter — large, centered */}
        <div className="flex items-center justify-center gap-4 py-2">
          <button
            className="rounded-lg border text-3xl font-medium flex items-center justify-center disabled:opacity-40"
            style={{ width: 60, height: 60, borderColor: 'var(--border)', color: 'var(--foreground)' }}
            onClick={() => setPackStr(String(Math.max(1, (isNaN(count) ? 1 : count) - 1)))}
            disabled={!valid || count <= 1}
            aria-label="Меньше"
          >
            −
          </button>
          <Input
            type="text"
            inputMode="numeric"
            value={packStr}
            onChange={(e) => setPackStr(e.target.value.replace(/[^0-9]/g, ''))}
            className="text-center"
            style={{ width: 100, height: 60, fontSize: 28, fontWeight: 700 }}
          />
          <button
            className="rounded-lg border text-3xl font-medium flex items-center justify-center"
            style={{ width: 60, height: 60, borderColor: 'var(--border)', color: 'var(--foreground)' }}
            onClick={() => setPackStr(String((isNaN(count) ? 0 : count) + 1))}
            aria-label="Больше"
          >
            +
          </button>
        </div>
        <p className="text-center ui-hint">{valid ? `${count * packSize} шт` : 'Введите число пачек'}</p>

        <Button className="btn-primary w-full h-14" onClick={handleSave} disabled={saving || !valid}>
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

        <Button className="btn-primary w-full h-14" onClick={handleInclude} disabled={saving}>
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
            {totalPositions} позиций · {packs(totalPacks)}
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
            className="btn-primary flex-1 h-14"
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
