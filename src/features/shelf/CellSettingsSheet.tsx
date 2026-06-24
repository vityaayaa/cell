import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Cell, Product } from '@/data/db'
import { db } from '@/data/db'
import { supabase } from '@/data/supabase'
import { getEffectiveCapacity } from '@/domain/capacity'
import { recomputeDescendants } from '@/domain/bsp'
import type { BspNode } from '@/domain/bsp'

interface CellSettingsSheetProps {
  cell: Cell | null
  allCells: Cell[]
  products: Product[]
  address: string
  open: boolean
  onClose: () => void
}

function cellToBspNode(c: Cell): BspNode {
  return {
    id: c.id,
    parent_id: c.parent_id,
    split_direction: c.split_direction,
    child_index: c.child_index,
    computed_width_mm: c.computed_width_mm,
    computed_height_mm: c.computed_height_mm,
  }
}

export function CellSettingsSheet({
  cell,
  allCells,
  products,
  address,
  open,
  onClose,
}: CellSettingsSheetProps) {
  const [overrideInput, setOverrideInput] = useState('')
  const [rotationAllowed, setRotationAllowed] = useState(true)
  const [widthInput, setWidthInput] = useState('')
  const [heightInput, setHeightInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => {
    if (!cell) return
    setOverrideInput(cell.capacity_override != null ? String(cell.capacity_override) : '')
    setRotationAllowed(cell.rotation_allowed)
    if (cell.parent_id === null) {
      setWidthInput(cell.width_mm != null ? String(cell.width_mm) : '')
      setHeightInput(cell.height_mm != null ? String(cell.height_mm) : '')
    } else {
      setWidthInput(cell.computed_width_mm ? String(cell.computed_width_mm) : '')
      setHeightInput(cell.computed_height_mm ? String(cell.computed_height_mm) : '')
    }
  }, [cell])

  if (!cell) return null

  // Only the base cell carries real mm; sub-cells inherit their size from the
  // equal split and show it read-only.
  const isRoot = cell.parent_id === null
  const product = products.find(p => p.id === cell.product_id)
  const showRotation =
    product?.type === 'unit' &&
    product.width_mm != null &&
    product.height_mm != null &&
    product.width_mm !== product.height_mm

  const isPackUnit = product?.type === 'bulk' || product?.type === 'round'
  const overrideUnitLabel = isPackUnit ? 'пачек' : product?.type === 'unit' ? 'шт' : 'ед.'

  const calculatedCapacity =
    product?.type === 'unit'
      ? getEffectiveCapacity(
          { computed_width_mm: cell.computed_width_mm, computed_height_mm: cell.computed_height_mm },
          { type: 'unit', width_mm: product.width_mm!, height_mm: product.height_mm! },
          { rotation_allowed: rotationAllowed, capacity_override: null },
        )
      : null

  async function handleSave() {
    if (!cell) return
    setSaving(true)

    const now = new Date().toISOString()
    const override = overrideInput.trim() !== '' ? parseInt(overrideInput) : null
    const updates: Partial<Cell> = {
      rotation_allowed: rotationAllowed,
      capacity_override: isNaN(override as number) ? null : override,
      updated_at: now,
    }

    // Base cell: real mm changed → recompute the whole subtree equally.
    if (isRoot) {
      const newWidth = parseInt(widthInput)
      const newHeight = parseInt(heightInput)
      if (!isNaN(newWidth) && newWidth > 0) updates.width_mm = newWidth
      if (!isNaN(newHeight) && newHeight > 0) updates.height_mm = newHeight

      if (updates.width_mm != null || updates.height_mm != null) {
        const updatedRoot: Cell = { ...cell, ...updates }
        const subtreeCells = allCells.filter(c => {
          let cur: Cell | undefined = c
          while (cur) {
            if (cur.id === cell.id) return true
            cur = allCells.find(x => x.id === cur!.parent_id)
          }
          return false
        })

        const updatedRootNode: BspNode = {
          ...cellToBspNode(updatedRoot),
          computed_width_mm: updates.width_mm ?? cell.width_mm ?? 0,
          computed_height_mm: updates.height_mm ?? cell.height_mm ?? 0,
        }

        const subtreeNodes = subtreeCells.map(c =>
          c.id === cell.id ? updatedRootNode : cellToBspNode(c),
        )

        const recomputed = recomputeDescendants(subtreeNodes)
        const updatedCells: Cell[] = recomputed.map(node => {
          const orig = allCells.find(c => c.id === node.id)!
          return {
            ...orig,
            computed_width_mm: node.computed_width_mm,
            computed_height_mm: node.computed_height_mm,
            ...(node.id === cell.id ? updates : {}),
            updated_at: now,
          }
        })

        try {
          await db.transaction('rw', [db.cells], async () => {
            await db.cells.bulkPut(updatedCells)
          })
          const { error } = await supabase.from('cells').upsert(updatedCells)
          if (error) throw error
        } catch {
          toast.error('Не сохранилось. Попробуйте ещё раз.')
        } finally {
          setSaving(false)
          onClose()
        }
        return
      }
    }

    // Sub-cell (or base cell without size change): only rotation / override.
    try {
      await db.cells.update(cell.id, updates)
      const { error } = await supabase.from('cells').update(updates).eq('id', cell.id)
      if (error) throw error
    } catch {
      toast.error('Не сохранилось. Попробуйте ещё раз.')
    } finally {
      setSaving(false)
      onClose()
    }
  }

  async function handleReset() {
    if (!cell) return
    setSaving(true)

    const now = new Date().toISOString()

    try {
      if (isRoot) {
        const subtreeCells = allCells.filter(c => {
          let cur: Cell | undefined = c
          while (cur) {
            if (cur.id === cell.id) return true
            cur = allCells.find(x => x.id === cur!.parent_id)
          }
          return false
        })

        const hasChildren = allCells.some(c => c.parent_id === cell.id)

        const updated: Cell[] = subtreeCells.map(c => {
          const next: Cell = {
            ...c,
            computed_width_mm: 0,
            computed_height_mm: 0,
            capacity_override: null,
            rotation_allowed: true,
            updated_at: now,
          }
          if (c.id === cell.id) {
            next.width_mm = null
            next.height_mm = null
            if (!hasChildren) next.product_id = null
          }
          return next
        })

        await db.cells.bulkPut(updated)
        const { error } = await supabase.from('cells').upsert(updated)
        if (error) throw error
      } else {
        const updates: Partial<Cell> = {
          product_id: null,
          capacity_override: null,
          rotation_allowed: true,
          updated_at: now,
        }
        await db.cells.update(cell.id, updates)
        const { error } = await supabase.from('cells').update(updates).eq('id', cell.id)
        if (error) throw error
      }
    } catch {
      toast.error('Не сохранилось. Попробуйте ещё раз.')
    } finally {
      setSaving(false)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent preventOutsideClose showCloseButton>
        <DialogHeader>
          <DialogTitle>Настройки {address}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 max-h-[60dvh] overflow-y-auto pr-1">
          {/* Размеры ячейки — приоритетная секция, карточка */}
          <div
            className="flex flex-col gap-3 rounded-lg p-4"
            style={{ background: 'var(--muted)' }}
          >
            <p className="ui-section-title">Размеры ячейки</p>

            <div className="flex gap-3">
              <div className="flex-1 flex flex-col gap-1">
                <Label htmlFor="height" className="ui-field-label">Высота, мм</Label>
                <Input
                  id="height"
                  type="text"
                  inputMode="numeric"
                  value={heightInput}
                  disabled={!isRoot}
                  onChange={e => setHeightInput(e.target.value.replace(/[^0-9]/g, ''))}
                  className="text-base"
                  style={!isRoot ? { opacity: 0.55 } : undefined}
                />
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <Label htmlFor="width" className="ui-field-label">Ширина, мм</Label>
                <Input
                  id="width"
                  type="text"
                  inputMode="numeric"
                  value={widthInput}
                  disabled={!isRoot}
                  onChange={e => setWidthInput(e.target.value.replace(/[^0-9]/g, ''))}
                  className="text-base"
                  style={!isRoot ? { opacity: 0.55 } : undefined}
                />
              </div>
            </div>
            {!isRoot && (
              <p className="ui-hint">
                Размер отсека рассчитывается автоматически — поровну от базовой ячейки.
              </p>
            )}

            {calculatedCapacity != null && (
              <p style={{ fontSize: 16, color: 'var(--foreground)' }}>
                Расчётная вместимость:{' '}
                <span style={{ fontWeight: 700 }}>{calculatedCapacity} шт</span>
              </p>
            )}
          </div>

          {/* Поворот */}
          {showRotation && (
            <div
              className="flex items-center justify-between rounded-lg p-4"
              style={{ background: 'var(--muted)' }}
            >
              <p className="ui-section-title">Поворот</p>
              <button
                onClick={() => setRotationAllowed(v => !v)}
                className="flex items-center gap-2"
              >
                <div
                  className="relative w-12 h-6 rounded-full transition-colors"
                  style={{ background: rotationAllowed ? 'var(--primary)' : 'var(--background)' }}
                >
                  <div
                    className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
                    style={{
                      background: 'white',
                      transform: rotationAllowed ? 'translateX(26px)' : 'translateX(2px)',
                    }}
                  />
                </div>
                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  {rotationAllowed ? 'Разрешён' : 'Запрещён'}
                </span>
              </button>
            </div>
          )}

          {/* Указать вручную — редкое исключение, карточка */}
          <div
            className="flex flex-col gap-2 rounded-lg p-4"
            style={{ background: 'var(--muted)' }}
          >
            <p className="ui-section-title">Указать вручную, {overrideUnitLabel}</p>
            <p className="ui-hint">
              {isPackUnit
                ? 'Для навалом и круглых товаров вместимость в пачках задаётся вручную — приложение её не считает.'
                : 'Обычно приложение само считает вместимость по размерам ячейки и товара. Заполните это поле, только если нужно задать число вручную.'}
            </p>
            <Input
              id="override"
              type="text"
              inputMode="numeric"
              placeholder={isPackUnit ? 'число пачек' : 'по желанию'}
              value={overrideInput}
              onChange={e => setOverrideInput(e.target.value.replace(/[^0-9]/g, ''))}
              className="text-base"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full rounded-md font-semibold text-base mt-2 disabled:opacity-50"
          style={{ height: 52 }}
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>

        <button
          onClick={() => setConfirmReset(true)}
          disabled={saving}
          className="w-full rounded-md font-semibold text-base mt-2 disabled:opacity-50"
          style={{
            height: 48,
            color: 'var(--destructive)',
            border: '1px solid var(--destructive)',
            background: 'transparent',
          }}
        >
          Сбросить ячейку
        </button>

        <Dialog open={confirmReset} onOpenChange={v => !v && setConfirmReset(false)}>
          <DialogContent preventOutsideClose>
            <DialogHeader>
              <DialogTitle>Сбросить ячейку?</DialogTitle>
            </DialogHeader>
            <p style={{ fontSize: 16, color: 'var(--muted-foreground)' }}>
              Будут очищены товар, размеры и настройки этой ячейки.
            </p>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setConfirmReset(false)}
                disabled={saving}
                className="flex-1 rounded-md font-semibold text-base disabled:opacity-50"
                style={{
                  height: 48,
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                }}
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  setConfirmReset(false)
                  handleReset()
                }}
                disabled={saving}
                className="flex-1 rounded-md font-semibold text-base text-white disabled:opacity-50"
                style={{ height: 52, background: 'var(--destructive)' }}
              >
                Сбросить
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
