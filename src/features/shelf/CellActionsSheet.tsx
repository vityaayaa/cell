import { useState } from 'react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import type { Cell, Product, Material } from '@/data/db'
import { db } from '@/data/db'
import { supabase } from '@/data/supabase'
import { isLeaf } from '@/domain/bsp'
import { computeChildDimensions } from '@/domain/bsp'
import type { BspNode } from '@/domain/bsp'
import { getRootAddress } from './cellUtils'

interface CellActionsSheetProps {
  cell: Cell | null
  allCells: Cell[]
  products: Product[]
  materials: Material[]
  address: string
  open: boolean
  onClose: () => void
  onOpenSettings: (cell: Cell) => void
}

function getBspSibling(cell: Cell, allCells: Cell[]): Cell | null {
  if (!cell.parent_id) return null
  return allCells.find(c => c.parent_id === cell.parent_id && c.id !== cell.id) ?? null
}

async function splitCell(cell: Cell, direction: 'H' | 'V') {
  const now = new Date().toISOString()
  const parentNode: BspNode = {
    id: cell.id,
    parent_id: cell.parent_id,
    split_direction: direction,
    is_first_child: cell.is_first_child,
    computed_width_mm: cell.computed_width_mm,
    computed_height_mm: cell.computed_height_mm,
  }

  const dims1 = computeChildDimensions(parentNode, direction, true)
  const dims2 = computeChildDimensions(parentNode, direction, false)

  const child1: Cell = {
    id: crypto.randomUUID(),
    shelf_id: cell.shelf_id,
    parent_id: cell.id,
    row_index: cell.row_index,
    col_index: cell.col_index,
    split_direction: null,
    is_first_child: true,
    width_mm: null,
    height_mm: null,
    computed_width_mm: dims1.computed_width_mm,
    computed_height_mm: dims1.computed_height_mm,
    product_id: null,
    capacity_override: null,
    rotation_allowed: true,
    needs_review: false,
    created_at: now,
    updated_at: now,
  }

  const child2: Cell = {
    ...child1,
    id: crypto.randomUUID(),
    is_first_child: false,
    computed_width_mm: dims2.computed_width_mm,
    computed_height_mm: dims2.computed_height_mm,
  }

  const updatedCell: Cell = {
    ...cell,
    split_direction: direction,
    product_id: null,
    updated_at: now,
  }

  await db.transaction('rw', [db.cells], async () => {
    await db.cells.put(updatedCell)
    await db.cells.bulkPut([child1, child2])
  })

  const { error } = await supabase.from('cells').upsert([updatedCell, child1, child2])
  if (error) {
    await db.transaction('rw', [db.cells], async () => {
      await db.cells.put(cell)
      await db.cells.delete(child1.id)
      await db.cells.delete(child2.id)
    })
    toast.error('Не сохранилось. Попробуйте ещё раз.')
  }
}

async function mergeCell(cell: Cell, sibling: Cell, allCells: Cell[]) {
  const parent = allCells.find(c => c.id === cell.parent_id)
  if (!parent) return

  const now = new Date().toISOString()
  const restoredParent: Cell = {
    ...parent,
    split_direction: null,
    product_id: null,
    needs_review: parent.capacity_override != null,
    updated_at: now,
  }

  await db.transaction('rw', [db.cells], async () => {
    await db.cells.put(restoredParent)
    await db.cells.delete(cell.id)
    await db.cells.delete(sibling.id)
  })

  const { error } = await supabase.from('cells').upsert([restoredParent])
  if (!error) {
    await supabase.from('cells').delete().eq('id', cell.id)
    await supabase.from('cells').delete().eq('id', sibling.id)
  } else {
    await db.transaction('rw', [db.cells], async () => {
      await db.cells.put(parent)
      await db.cells.bulkPut([cell, sibling])
    })
    toast.error('Не сохранилось. Попробуйте ещё раз.')
  }
}

async function assignProduct(cellId: string, productId: string) {
  const now = new Date().toISOString()
  await db.cells.update(cellId, { product_id: productId, capacity_override: null, updated_at: now })
  const { error } = await supabase
    .from('cells')
    .update({ product_id: productId, capacity_override: null, updated_at: now })
    .eq('id', cellId)
  if (error) {
    await db.cells.update(cellId, { product_id: null, updated_at: now })
    toast.error('Не сохранилось. Попробуйте ещё раз.')
  }
}

async function removeProduct(cell: Cell) {
  const now = new Date().toISOString()
  await db.cells.update(cell.id, { product_id: null, updated_at: now })
  const { error } = await supabase
    .from('cells')
    .update({ product_id: null, updated_at: now })
    .eq('id', cell.id)
  if (error) {
    await db.cells.update(cell.id, { product_id: cell.product_id, updated_at: now })
    toast.error('Не сохранилось. Попробуйте ещё раз.')
  }
}

export function CellActionsSheet({
  cell,
  allCells,
  products,
  address,
  open,
  onClose,
  onOpenSettings,
}: CellActionsSheetProps) {
  const [confirmMerge, setConfirmMerge] = useState(false)
  const [showProductList, setShowProductList] = useState(false)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  if (!cell) return null

  const leaf = isLeaf(cell.id, allCells)
  const currentProduct = leaf ? products.find(p => p.id === cell.product_id) : undefined
  const sibling = leaf ? getBspSibling(cell, allCells) : null
  const siblingAddress = sibling ? getRootAddress(sibling) : null

  async function handleSplit(direction: 'H' | 'V') {
    setLoadingAction(`split-${direction}`)
    await splitCell(cell!, direction)
    setLoadingAction(null)
    onClose()
  }

  async function handleMergeConfirm() {
    if (!sibling) return
    setLoadingAction('merge')
    await mergeCell(cell!, sibling, allCells)
    setLoadingAction(null)
    setConfirmMerge(false)
    onClose()
  }

  async function handleRemoveProduct() {
    setLoadingAction('remove-product')
    await removeProduct(cell!)
    setLoadingAction(null)
    onClose()
  }

  async function handleSelectProduct(product: Product) {
    setLoadingAction('assign-product')
    await assignProduct(cell!.id, product.id)
    setLoadingAction(null)
    setShowProductList(false)
    onClose()
  }

  // Non-leaf (split cell) — only drill-down + base sizes
  if (!leaf) {
    return (
      <Sheet open={open} onOpenChange={v => !v && onClose()}>
        <SheetContent side="bottom" className="pb-safe">
          <SheetHeader>
            <SheetTitle>{address}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button
              variant="outline"
              className="h-14 justify-start text-base"
              onClick={onClose}
            >
              Открыть ячейку →
            </Button>
            {!cell.parent_id && (
              <Button
                variant="outline"
                className="h-14 justify-start text-base"
                onClick={() => { onOpenSettings(cell!); onClose() }}
              >
                Размеры базовой ячейки
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  // Leaf cell
  return (
    <>
      <Sheet open={open} onOpenChange={v => !v && onClose()}>
        <SheetContent side="bottom" className="pb-safe">
          <SheetHeader>
            <SheetTitle>{address}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 mt-4">
            {currentProduct ? (
              <>
                <Button
                  variant="outline"
                  className="h-14 justify-start text-base"
                  onClick={() => setShowProductList(true)}
                  disabled={!!loadingAction}
                >
                  Сменить товар
                </Button>
                <Button
                  variant="outline"
                  className="h-14 justify-start text-base"
                  onClick={handleRemoveProduct}
                  disabled={!!loadingAction}
                  style={{ color: 'var(--destructive)' }}
                >
                  Убрать товар
                </Button>
                <Separator />
              </>
            ) : (
              <Button
                variant="outline"
                className="h-14 justify-start text-base"
                onClick={() => setShowProductList(true)}
                disabled={!!loadingAction}
              >
                Назначить товар
              </Button>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-14 text-base"
                onClick={() => handleSplit('V')}
                disabled={!!loadingAction}
              >
                {loadingAction === 'split-V' ? '...' : 'Разделить →'}
              </Button>
              <Button
                variant="outline"
                className="h-14 text-base"
                onClick={() => handleSplit('H')}
                disabled={!!loadingAction}
              >
                {loadingAction === 'split-H' ? '...' : 'Разделить ↓'}
              </Button>
            </div>

            {sibling && (
              <Button
                variant="outline"
                className="h-14 justify-start text-base"
                onClick={() => setConfirmMerge(true)}
                disabled={!!loadingAction}
              >
                Объединить с {siblingAddress ?? 'соседом'}
              </Button>
            )}

            <Button
              variant="outline"
              className="h-14 justify-start text-base"
              onClick={() => { onOpenSettings(cell!); onClose() }}
            >
              Настройки ячейки
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Merge confirmation */}
      <Dialog open={confirmMerge} onOpenChange={v => !v && setConfirmMerge(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Объединить ячейки?</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Товар из {siblingAddress ?? 'соседней ячейки'} будет удалён. Это действие нельзя отменить напрямую.
          </p>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="flex-1 h-12" onClick={() => setConfirmMerge(false)}>
              Отмена
            </Button>
            <Button
              className="flex-1 h-12"
              onClick={handleMergeConfirm}
              disabled={loadingAction === 'merge'}
              style={{ background: 'var(--destructive)', color: 'var(--destructive-foreground)' }}
            >
              {loadingAction === 'merge' ? '...' : 'Объединить'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product picker */}
      <Dialog open={showProductList} onOpenChange={v => !v && setShowProductList(false)}>
        <DialogContent className="max-h-[80dvh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Выбрать товар</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 flex flex-col gap-2 mt-2">
            {products.map(p => (
              <Button
                key={p.id}
                variant="outline"
                className="h-14 justify-start text-base"
                onClick={() => handleSelectProduct(p)}
                disabled={loadingAction === 'assign-product'}
              >
                {p.name}
              </Button>
            ))}
            {products.length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: 'var(--muted-foreground)' }}>
                Каталог пуст. Добавьте товары в разделе Каталог.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
