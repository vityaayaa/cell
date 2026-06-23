import { useState } from 'react'
import { Package, Settings } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import type { Cell, Product, Material } from '@/data/db'

function getProductParts(p: Product): { name: string; dims: string | null } {
  if (p.type === 'unit') return { name: p.name, dims: `${p.width_mm}×${p.height_mm}×${p.length_mm}` }
  if (p.type === 'round') return { name: p.name, dims: `⌀${p.diameter_mm}×${p.length_mm}` }
  return { name: p.name, dims: null }
}
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
  materials,
  address,
  open,
  onClose,
  onOpenSettings,
}: CellActionsSheetProps) {
  const [confirmMerge, setConfirmMerge] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [showProductList, setShowProductList] = useState(false)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  if (!cell) return null

  const leaf = isLeaf(cell.id, allCells)
  const currentProduct = leaf ? products.find(p => p.id === cell.product_id) : undefined
  const assignedProductIds = new Set(
    allCells.map(c => c.product_id).filter((id): id is string => id != null),
  )
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

  async function handleRemoveProductConfirm() {
    setLoadingAction('remove-product')
    await removeProduct(cell!)
    setLoadingAction(null)
    setConfirmRemove(false)
    onClose()
  }

  async function handleSelectProduct(product: Product) {
    setLoadingAction('assign-product')
    await assignProduct(cell!.id, product.id)
    setLoadingAction(null)
    setShowProductList(false)
    onClose()
  }

  // Non-leaf (split cell)
  if (!leaf) {
    return (
      <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent preventOutsideClose>
          <DialogHeader>
            <DialogTitle>{address}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <button
              className="w-full flex items-center rounded-md border text-sm font-medium"
              style={{ height: 56, paddingLeft: 16, color: 'var(--foreground)', borderColor: 'var(--border)', background: 'var(--background)' }}
              onClick={onClose}
            >
              Открыть ячейку →
            </button>
            {!cell.parent_id && (
              <button
                className="w-full flex items-center gap-3 rounded-md border text-sm font-medium"
                style={{ height: 56, paddingLeft: 16, color: 'var(--foreground)', borderColor: 'var(--border)', background: 'var(--background)' }}
                onClick={() => { onOpenSettings(cell!); onClose() }}
              >
                <Settings size={18} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                Размеры базовой ячейки
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Leaf cell
  return (
    <>
      <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent preventOutsideClose>
          <DialogHeader>
            <DialogTitle>{address}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {/* Assign / Change product */}
            <button
              className="w-full flex items-center gap-3 rounded-md border text-sm font-medium"
              style={{ height: 56, paddingLeft: 16, color: 'var(--foreground)', borderColor: 'var(--border)', background: 'var(--background)' }}
              onClick={() => setShowProductList(true)}
              disabled={!!loadingAction}
            >
              <Package size={18} strokeWidth={1.5} style={{ flexShrink: 0 }} />
              {currentProduct ? 'Сменить товар' : 'Назначить товар'}
            </button>

            {/* Settings */}
            <button
              className="w-full flex items-center gap-3 rounded-md border text-sm font-medium"
              style={{ height: 56, paddingLeft: 16, color: 'var(--foreground)', borderColor: 'var(--border)', background: 'var(--background)' }}
              onClick={() => { onOpenSettings(cell!); onClose() }}
            >
              <Settings size={18} strokeWidth={1.5} style={{ flexShrink: 0 }} />
              Настройки ячейки
            </button>

            <Separator />

            {/* Split */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center gap-1">
                <button
                  className="w-full rounded-md border text-sm font-medium"
                  style={{ height: 52, color: 'var(--foreground)', borderColor: 'var(--border)', background: 'var(--background)' }}
                  onClick={() => handleSplit('V')}
                  disabled={!!loadingAction}
                >
                  {loadingAction === 'split-V' ? '...' : '| Разделить'}
                </button>
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>по вертикали</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <button
                  className="w-full rounded-md border text-sm font-medium"
                  style={{ height: 52, color: 'var(--foreground)', borderColor: 'var(--border)', background: 'var(--background)' }}
                  onClick={() => handleSplit('H')}
                  disabled={!!loadingAction}
                >
                  {loadingAction === 'split-H' ? '...' : '— Разделить'}
                </button>
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>по горизонтали</span>
              </div>
            </div>

            {sibling && (
              <button
                className="w-full flex items-center rounded-md border text-sm font-medium"
                style={{ height: 52, paddingLeft: 16, color: 'var(--foreground)', borderColor: 'var(--border)', background: 'var(--background)' }}
                onClick={() => setConfirmMerge(true)}
                disabled={!!loadingAction}
              >
                Объединить с {siblingAddress ?? 'соседом'}
              </button>
            )}

            {/* Remove product — always at the very bottom */}
            {currentProduct && (
              <>
                <Separator />
                <button
                  className="w-full flex items-center justify-center rounded-md text-sm font-medium"
                  style={{ height: 52, color: '#EF4444', background: 'var(--muted)' }}
                  onClick={() => setConfirmRemove(true)}
                  disabled={!!loadingAction}
                >
                  Убрать товар
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Merge confirmation */}
      <Dialog open={confirmMerge} onOpenChange={v => !v && setConfirmMerge(false)}>
        <DialogContent preventOutsideClose>
          <DialogHeader>
            <DialogTitle>Объединить ячейки?</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Товар из {siblingAddress ?? 'соседней ячейки'} будет удалён. Это действие нельзя отменить напрямую.
          </p>
          <div className="flex gap-3 mt-2">
            <button
              className="flex-1 rounded-md border text-sm font-medium"
              style={{ height: 48, color: 'var(--foreground)', borderColor: 'var(--border)', background: 'var(--background)' }}
              onClick={() => setConfirmMerge(false)}
            >
              Отмена
            </button>
            <button
              className="flex-1 rounded-md text-sm font-semibold"
              style={{ height: 52, background: 'var(--destructive)', color: 'var(--destructive-foreground)' }}
              onClick={handleMergeConfirm}
              disabled={loadingAction === 'merge'}
            >
              {loadingAction === 'merge' ? '...' : 'Объединить'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove product confirmation */}
      <Dialog open={confirmRemove} onOpenChange={v => !v && setConfirmRemove(false)}>
        <DialogContent preventOutsideClose>
          <DialogHeader>
            <DialogTitle>Убрать товар из ячейки?</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Ячейка станет пустой. Товар можно будет назначить заново.
          </p>
          <div className="flex gap-3 mt-2">
            <button
              className="flex-1 rounded-md border text-sm font-medium"
              style={{ height: 48, color: 'var(--foreground)', borderColor: 'var(--border)', background: 'var(--background)' }}
              onClick={() => setConfirmRemove(false)}
            >
              Отмена
            </button>
            <button
              className="flex-1 rounded-md text-sm font-semibold"
              style={{ height: 52, background: 'var(--destructive)', color: 'var(--destructive-foreground)' }}
              onClick={handleRemoveProductConfirm}
              disabled={loadingAction === 'remove-product'}
            >
              {loadingAction === 'remove-product' ? '...' : 'Убрать'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product picker */}
      <Dialog open={showProductList} onOpenChange={v => !v && setShowProductList(false)}>
        <DialogContent preventOutsideClose>
          <DialogHeader>
            <DialogTitle>Выбрать товар</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 max-h-[50dvh] overflow-y-auto">
            {products.map(p => {
              const { name, dims } = getProductParts(p)
              const material = materials.find(m => m.id === p.material_id)
              const inShelf = assignedProductIds.has(p.id)
              return (
                <button
                  key={p.id}
                  className="w-full flex items-center justify-between rounded-md border px-4 gap-3 text-left"
                  style={{ minHeight: 56, color: 'var(--foreground)', borderColor: 'var(--border)', background: 'var(--background)' }}
                  onClick={() => handleSelectProduct(p)}
                  disabled={loadingAction === 'assign-product'}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {material && (
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ background: material.color }}
                      />
                    )}
                    <span className="text-sm font-medium truncate">{name}</span>
                    {inShelf && <span className="ui-hint flex-shrink-0">в стеллаже</span>}
                  </span>
                  {dims && <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>{dims}</span>}
                </button>
              )
            })}
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
