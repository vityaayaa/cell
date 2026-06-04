import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
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
    is_first_child: c.is_first_child,
    width_mm: c.width_mm ?? undefined,
    height_mm: c.height_mm ?? undefined,
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

  useEffect(() => {
    if (!cell) return
    setOverrideInput(cell.capacity_override != null ? String(cell.capacity_override) : '')
    setRotationAllowed(cell.rotation_allowed)
    setWidthInput(cell.width_mm != null ? String(cell.width_mm) : '')
    setHeightInput(cell.height_mm != null ? String(cell.height_mm) : '')
  }, [cell])

  if (!cell) return null

  const isRoot = cell.parent_id === null
  const product = products.find(p => p.id === cell.product_id)
  const showRotation =
    product?.type === 'unit' &&
    product.width_mm != null &&
    product.height_mm != null &&
    product.width_mm !== product.height_mm

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

    // If root and dimensions changed: update and recompute descendants
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

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="bottom" className="pb-safe max-h-[85dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Настройки {address}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 mt-4">
          {/* Capacity */}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              Вместимость
            </p>
            {calculatedCapacity != null && (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Расчётная: {calculatedCapacity} шт
              </p>
            )}
            <Label htmlFor="override">Переопределение</Label>
            <Input
              id="override"
              type="number"
              min={1}
              placeholder="пусто = по формуле"
              value={overrideInput}
              onChange={e => setOverrideInput(e.target.value)}
              className="text-base"
            />
          </div>

          {/* Rotation */}
          {showRotation && (
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Поворот
              </p>
              <button
                onClick={() => setRotationAllowed(v => !v)}
                className="flex items-center gap-2"
              >
                <div
                  className="relative w-12 h-6 rounded-full transition-colors"
                  style={{
                    background: rotationAllowed ? 'var(--primary)' : 'var(--muted)',
                  }}
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

          {/* Root dimensions */}
          {isRoot && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Размеры ячейки
              </p>
              <div className="flex gap-3">
                <div className="flex-1 flex flex-col gap-1">
                  <Label htmlFor="width">Ширина, мм</Label>
                  <Input
                    id="width"
                    type="number"
                    min={1}
                    value={widthInput}
                    onChange={e => setWidthInput(e.target.value)}
                    className="text-base"
                  />
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <Label htmlFor="height">Высота, мм</Label>
                  <Input
                    id="height"
                    type="number"
                    min={1}
                    value={heightInput}
                    onChange={e => setHeightInput(e.target.value)}
                    className="text-base"
                  />
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={saving}
            className="h-14 text-base"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
