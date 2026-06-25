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
import { getRootAddress } from './cellUtils'

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

  // The size belongs to the whole SECTION (the base ancestor); compartments
  // derive their size equally from it. Editing size from any cell edits the
  // section.
  function baseAncestor(c: Cell): Cell {
    let cur = c
    while (cur.parent_id) {
      const p = allCells.find(x => x.id === cur.parent_id)
      if (!p) break
      cur = p
    }
    return cur
  }

  useEffect(() => {
    if (!cell) return
    setOverrideInput(cell.capacity_override != null ? String(cell.capacity_override) : '')
    setRotationAllowed(cell.rotation_allowed)
    const base = baseAncestor(cell)
    setWidthInput(base.width_mm != null ? String(base.width_mm) : '')
    setHeightInput(base.height_mm != null ? String(base.height_mm) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell])

  if (!cell) return null

  const sizeTarget = baseAncestor(cell)
  const editingSection = sizeTarget.id !== cell.id
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
    const cellUpdates: Partial<Cell> = {
      rotation_allowed: rotationAllowed,
      capacity_override: isNaN(override as number) ? null : override,
      updated_at: now,
    }

    const newWidth = parseInt(widthInput)
    const newHeight = parseInt(heightInput)
    const sizeChanged =
      (!isNaN(newWidth) && newWidth > 0) || (!isNaN(newHeight) && newHeight > 0)

    if (sizeChanged) {
      // Set the SECTION's real mm and recompute its whole subtree equally; the
      // current cell also gets its rotation / override applied.
      const sizeUpdates: Partial<Cell> = {}
      if (!isNaN(newWidth) && newWidth > 0) sizeUpdates.width_mm = newWidth
      if (!isNaN(newHeight) && newHeight > 0) sizeUpdates.height_mm = newHeight

      const subtreeCells = allCells.filter(c => {
        let cur: Cell | undefined = c
        while (cur) {
          if (cur.id === sizeTarget.id) return true
          cur = allCells.find(x => x.id === cur!.parent_id)
        }
        return false
      })

      const rootNode: BspNode = {
        ...cellToBspNode(sizeTarget),
        computed_width_mm: sizeUpdates.width_mm ?? sizeTarget.width_mm ?? 0,
        computed_height_mm: sizeUpdates.height_mm ?? sizeTarget.height_mm ?? 0,
      }
      const subtreeNodes = subtreeCells.map(c =>
        c.id === sizeTarget.id ? rootNode : cellToBspNode(c),
      )
      const recomputed = recomputeDescendants(subtreeNodes)
      const updatedCells: Cell[] = recomputed.map(node => {
        const orig = allCells.find(c => c.id === node.id)!
        let next: Cell = {
          ...orig,
          computed_width_mm: node.computed_width_mm,
          computed_height_mm: node.computed_height_mm,
          updated_at: now,
        }
        if (node.id === sizeTarget.id) next = { ...next, ...sizeUpdates }
        if (node.id === cell.id) next = { ...next, ...cellUpdates }
        return next
      })

      try {
        await db.cells.bulkPut(updatedCells)
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

    // No size change: only the current cell's rotation / override.
    try {
      await db.cells.update(cell.id, cellUpdates)
      const { error } = await supabase.from('cells').update(cellUpdates).eq('id', cell.id)
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
    const isRoot = cell.parent_id === null

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
          <div className="flex items-center gap-5" style={{ paddingRight: 36 }}>
            <DialogTitle>Настройки {address}</DialogTitle>
            {showRotation && (
              <button
                onClick={() => setRotationAllowed(v => !v)}
                className="flex flex-col items-center gap-0.5 flex-shrink-0"
                aria-label="Поворот товара"
              >
                <div
                  className="relative rounded-full transition-colors"
                  style={{ width: 40, height: 22, background: rotationAllowed ? 'var(--primary)' : 'var(--border)' }}
                >
                  <div
                    className="absolute rounded-full transition-transform"
                    style={{
                      top: 2, width: 18, height: 18, background: 'white',
                      transform: rotationAllowed ? 'translateX(20px)' : 'translateX(2px)',
                    }}
                  />
                </div>
                <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>поворот</span>
              </button>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 max-h-[60dvh] overflow-y-auto pr-1">
          {/* Размеры секции — приоритетная секция, карточка */}
          <div
            className="flex flex-col gap-3 rounded-lg p-4"
            style={{ background: 'var(--muted)' }}
          >
            <p className="ui-section-title">
              {editingSection ? `Размер секции ${getRootAddress(sizeTarget)}` : 'Размеры ячейки'}
            </p>

            <div className="flex gap-3">
              <div className="flex-1 flex flex-col gap-1">
                <Label htmlFor="height" className="ui-field-label">Высота, мм</Label>
                <Input
                  id="height"
                  type="text"
                  inputMode="numeric"
                  value={heightInput}
                  onChange={e => setHeightInput(e.target.value.replace(/[^0-9]/g, ''))}
                  className="text-base"
                />
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <Label htmlFor="width" className="ui-field-label">Ширина, мм</Label>
                <Input
                  id="width"
                  type="text"
                  inputMode="numeric"
                  value={widthInput}
                  onChange={e => setWidthInput(e.target.value.replace(/[^0-9]/g, ''))}
                  className="text-base"
                />
              </div>
            </div>
            {editingSection && (
              <p className="ui-hint">
                Это размер всей секции {getRootAddress(sizeTarget)} — отсеки внутри делятся поровну.
              </p>
            )}

            {calculatedCapacity != null && (
              <p style={{ fontSize: 16, color: 'var(--foreground)' }}>
                Расчётная вместимость:{' '}
                <span style={{ fontWeight: 700 }}>{calculatedCapacity} шт</span>
              </p>
            )}
          </div>

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
