import { useState, useEffect } from 'react'
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
import { mutateUpdate } from '@/data/mutate'
import { getEffectiveCapacity } from '@/domain/capacity'
import { parseDecimalMm, sanitizeDecimalInput } from '@/lib/utils'

interface CellSettingsSheetProps {
  cell: Cell | null
  allCells: Cell[]
  products: Product[]
  address: string
  open: boolean
  onClose: () => void
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
  const [rotationAllowed, setRotationAllowed] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [widthInput, setWidthInput] = useState('')
  const [heightInput, setHeightInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => {
    if (!cell) return
    setOverrideInput(cell.capacity_override != null ? String(cell.capacity_override) : '')
    setRotationAllowed(cell.rotation_allowed)
    setDisabled(cell.is_disabled)
    setWidthInput(cell.width_mm != null ? String(cell.width_mm) : '')
    setHeightInput(cell.height_mm != null ? String(cell.height_mm) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell])

  if (!cell) return null

  const product = products.find(p => p.id === cell.product_id)
  const showRotation =
    product?.type === 'unit' &&
    product.width_mm != null &&
    product.height_mm != null &&
    product.width_mm !== product.height_mm

  // Only bulk is counted in packs; round & unit are counted in pieces (round
  // auto-computes capacity from its diameter, so its manual override is «шт»).
  const isBulk = product?.type === 'bulk'
  const overrideUnitLabel = isBulk ? 'пачек' : product ? 'шт' : 'ед.'

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
      is_disabled: disabled,
      updated_at: now,
    }

    const newWidth = parseDecimalMm(widthInput)
    const newHeight = parseDecimalMm(heightInput)

    // Each compartment is fully independent: write size only to THIS cell.
    // Since nothing is divided, the given size equals the computed size.
    const updates: Partial<Cell> = { ...cellUpdates }
    if (newWidth != null) {
      updates.width_mm = newWidth
      updates.computed_width_mm = newWidth
    }
    if (newHeight != null) {
      updates.height_mm = newHeight
      updates.computed_height_mm = newHeight
    }

    await db.cells.update(cell.id, updates)
    const updated = await db.cells.get(cell.id)
    if (updated) await mutateUpdate('cells', db.cells, updated)
    setSaving(false)
    onClose()
  }

  async function handleReset() {
    if (!cell) return
    setSaving(true)

    const now = new Date().toISOString()
    const hasChildren = allCells.some(c => c.parent_id === cell.id)

    // Reset affects ONLY this cell. Leaves get their product cleared too;
    // split nodes keep no product anyway.
    const updates: Partial<Cell> = {
      computed_width_mm: 0,
      computed_height_mm: 0,
      width_mm: null,
      height_mm: null,
      capacity_override: null,
      rotation_allowed: false,
      is_disabled: false,
      updated_at: now,
    }
    if (!hasChildren) updates.product_id = null

    await db.cells.update(cell.id, updates)
    const updated = await db.cells.get(cell.id)
    if (updated) await mutateUpdate('cells', db.cells, updated)
    setSaving(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent preventOutsideClose showCloseButton className="flex flex-col max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Настройки {address}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {/* Поворот + Деактивация — две кнопки в один ряд. Поворот неактивен,
              если товар неповорачиваемый (не unit или квадратный/круглый). */}
          <div className="flex gap-3">
            <button
              onClick={() => showRotation && setRotationAllowed(v => !v)}
              disabled={!showRotation}
              className="flex-1 flex items-center justify-between gap-2 rounded-lg px-3 py-3 text-left disabled:opacity-40"
              style={{
                background: rotationAllowed && showRotation
                  ? 'color-mix(in srgb, var(--primary) 12%, var(--muted))'
                  : 'var(--muted)',
                border: `1px solid ${rotationAllowed && showRotation ? 'var(--primary)' : 'var(--border)'}`,
              }}
              aria-pressed={rotationAllowed}
            >
              <span className="min-w-0 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                Поворот
              </span>
              <div
                className="relative rounded-full transition-colors flex-shrink-0"
                style={{ width: 44, height: 26, background: rotationAllowed && showRotation ? 'var(--primary)' : 'var(--border)' }}
                aria-hidden
              >
                <div
                  className="absolute rounded-full transition-transform"
                  style={{
                    top: 3, left: 3, width: 20, height: 20, background: 'white',
                    transform: rotationAllowed && showRotation ? 'translateX(18px)' : 'translateX(0)',
                  }}
                />
              </div>
            </button>

            <button
              onClick={() => setDisabled(v => !v)}
              className="flex-1 flex items-center justify-between gap-2 rounded-lg px-3 py-3 text-left"
              style={{
                background: disabled
                  ? 'color-mix(in srgb, var(--primary) 12%, var(--muted))'
                  : 'var(--muted)',
                border: `1px solid ${disabled ? 'var(--primary)' : 'var(--border)'}`,
              }}
              aria-pressed={disabled}
            >
              <span className="min-w-0 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                Не учитывать
              </span>
              <div
                className="relative rounded-full transition-colors flex-shrink-0"
                style={{ width: 44, height: 26, background: disabled ? 'var(--primary)' : 'var(--border)' }}
                aria-hidden
              >
                <div
                  className="absolute rounded-full transition-transform"
                  style={{
                    top: 3, left: 3, width: 20, height: 20, background: 'white',
                    transform: disabled ? 'translateX(18px)' : 'translateX(0)',
                  }}
                />
              </div>
            </button>
          </div>

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
                  inputMode="decimal"
                  value={heightInput}
                  onChange={e => setHeightInput(sanitizeDecimalInput(e.target.value))}
                  className="text-base"
                />
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <Label htmlFor="width" className="ui-field-label">Ширина, мм</Label>
                <Input
                  id="width"
                  type="text"
                  inputMode="decimal"
                  value={widthInput}
                  onChange={e => setWidthInput(sanitizeDecimalInput(e.target.value))}
                  className="text-base"
                />
              </div>
            </div>
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
              {isBulk
                ? 'Для навалом вместимость в пачках задаётся вручную — приложение её не считает.'
                : 'Обычно приложение само считает вместимость по размерам ячейки и товара. Заполните это поле, только если нужно задать число вручную.'}
            </p>
            <Input
              id="override"
              type="text"
              inputMode="numeric"
              placeholder={isBulk ? 'число пачек' : 'по желанию'}
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
