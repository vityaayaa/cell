import { useState } from 'react'
import { Package, Settings, Minus, Plus } from 'lucide-react'
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

const MIN_SPLIT = 2
const MAX_SPLIT = 12

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

/**
 * Split a leaf into N equal children along `direction`. The leaf becomes a
 * split node; children are computed by dividing its computed_* equally.
 */
async function splitCell(cell: Cell, direction: 'H' | 'V', count: number) {
  const now = new Date().toISOString()

  const childW = direction === 'V'
    ? Math.floor(cell.computed_width_mm / count)
    : cell.computed_width_mm
  const childH = direction === 'H'
    ? Math.floor(cell.computed_height_mm / count)
    : cell.computed_height_mm

  const children: Cell[] = Array.from({ length: count }, (_, i) => ({
    id: crypto.randomUUID(),
    shelf_id: cell.shelf_id,
    parent_id: cell.id,
    row_index: cell.row_index,
    col_index: cell.col_index,
    split_direction: null,
    child_index: i,
    width_mm: null,
    height_mm: null,
    computed_width_mm: childW,
    computed_height_mm: childH,
    product_id: null,
    capacity_override: null,
    rotation_allowed: true,
    needs_review: false,
    created_at: now,
    updated_at: now,
  }))

  const updatedCell: Cell = {
    ...cell,
    split_direction: direction,
    product_id: null,
    updated_at: now,
  }

  await db.transaction('rw', [db.cells], async () => {
    await db.cells.put(updatedCell)
    await db.cells.bulkPut(children)
  })

  const { error } = await supabase.from('cells').upsert([updatedCell, ...children])
  if (error) {
    await db.transaction('rw', [db.cells], async () => {
      await db.cells.put(cell)
      await db.cells.bulkDelete(children.map(c => c.id))
    })
    toast.error('Не сохранилось. Попробуйте ещё раз.')
  }
}

/**
 * Collapse the parent split: delete all the parent's children, the parent
 * becomes a leaf again.
 */
async function collapseParent(parent: Cell, children: Cell[]) {
  const now = new Date().toISOString()
  const restoredParent: Cell = {
    ...parent,
    split_direction: null,
    product_id: null,
    needs_review: parent.capacity_override != null,
    updated_at: now,
  }
  const childIds = children.map(c => c.id)

  await db.transaction('rw', [db.cells], async () => {
    await db.cells.put(restoredParent)
    await db.cells.bulkDelete(childIds)
  })

  const { error } = await supabase.from('cells').upsert([restoredParent])
  if (!error) {
    await supabase.from('cells').delete().in('id', childIds)
  } else {
    await db.transaction('rw', [db.cells], async () => {
      await db.cells.put(parent)
      await db.cells.bulkPut(children)
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
  const [splitDir, setSplitDir] = useState<'H' | 'V' | null>(null)
  const [splitCount, setSplitCount] = useState(2)

  if (!cell) return null

  const leaf = isLeaf(cell.id, allCells)
  if (!leaf) return null

  const currentProduct = products.find(p => p.id === cell.product_id)
  const assignedProductIds = new Set(
    allCells.map(c => c.product_id).filter((id): id is string => id != null),
  )

  // Parent context: if this leaf is a child of a split, we can collapse it.
  const parent = cell.parent_id ? allCells.find(c => c.id === cell.parent_id) ?? null : null
  const siblings = parent ? allCells.filter(c => c.parent_id === parent.id) : []
  const siblingsHaveProduct = siblings.some(s => s.product_id != null)

  function resetSplitPicker() {
    setSplitDir(null)
    setSplitCount(2)
  }

  async function handleSplitConfirm() {
    if (!splitDir) return
    setLoadingAction('split')
    await splitCell(cell!, splitDir, splitCount)
    setLoadingAction(null)
    resetSplitPicker()
    onClose()
  }

  async function handleMergeConfirm() {
    if (!parent) return
    setLoadingAction('merge')
    await collapseParent(parent, siblings)
    setLoadingAction(null)
    setConfirmMerge(false)
    onClose()
  }

  function handleMergeClick() {
    if (siblingsHaveProduct) setConfirmMerge(true)
    else handleMergeConfirm()
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

  function closeAll() {
    resetSplitPicker()
    onClose()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={v => !v && closeAll()}>
        <DialogContent preventOutsideClose>
          <DialogHeader>
            <DialogTitle>{address}</DialogTitle>
          </DialogHeader>

          {splitDir ? (
            /* Split count picker */
            <div className="flex flex-col gap-4">
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {splitDir === 'V' ? 'На сколько столбцов разделить?' : 'На сколько рядов разделить?'}
              </p>
              <div className="flex items-center justify-center gap-6">
                <button
                  className="flex items-center justify-center rounded-full border disabled:opacity-40"
                  style={{ width: 48, height: 48, borderColor: 'var(--border)', background: 'var(--background)' }}
                  onClick={() => setSplitCount(n => Math.max(MIN_SPLIT, n - 1))}
                  disabled={splitCount <= MIN_SPLIT}
                  aria-label="Меньше"
                >
                  <Minus size={20} />
                </button>
                <span className="text-3xl font-semibold tabular-nums" style={{ minWidth: 40, textAlign: 'center' }}>
                  {splitCount}
                </span>
                <button
                  className="flex items-center justify-center rounded-full border disabled:opacity-40"
                  style={{ width: 48, height: 48, borderColor: 'var(--border)', background: 'var(--background)' }}
                  onClick={() => setSplitCount(n => Math.min(MAX_SPLIT, n + 1))}
                  disabled={splitCount >= MAX_SPLIT}
                  aria-label="Больше"
                >
                  <Plus size={20} />
                </button>
              </div>
              <div className="flex gap-3 mt-2">
                <button
                  className="flex-1 rounded-md border text-sm font-medium"
                  style={{ height: 48, color: 'var(--foreground)', borderColor: 'var(--border)', background: 'var(--background)' }}
                  onClick={resetSplitPicker}
                  disabled={!!loadingAction}
                >
                  Назад
                </button>
                <button
                  className="btn-primary flex-1 rounded-md text-sm font-semibold"
                  style={{ height: 52 }}
                  onClick={handleSplitConfirm}
                  disabled={!!loadingAction}
                >
                  {loadingAction === 'split' ? '...' : 'Разделить'}
                </button>
              </div>
            </div>
          ) : (
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

              {/* Split into columns / rows */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col items-center gap-1">
                  <button
                    className="w-full rounded-md border text-sm font-medium"
                    style={{ height: 52, color: 'var(--foreground)', borderColor: 'var(--border)', background: 'var(--background)' }}
                    onClick={() => { setSplitDir('V'); setSplitCount(2) }}
                    disabled={!!loadingAction}
                  >
                    | Разделить
                  </button>
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>на столбцы</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <button
                    className="w-full rounded-md border text-sm font-medium"
                    style={{ height: 52, color: 'var(--foreground)', borderColor: 'var(--border)', background: 'var(--background)' }}
                    onClick={() => { setSplitDir('H'); setSplitCount(2) }}
                    disabled={!!loadingAction}
                  >
                    — Разделить
                  </button>
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>на ряды</span>
                </div>
              </div>

              {/* Collapse parent split */}
              {parent && (
                <button
                  className="w-full flex items-center rounded-md border text-sm font-medium"
                  style={{ height: 52, paddingLeft: 16, color: 'var(--foreground)', borderColor: 'var(--border)', background: 'var(--background)' }}
                  onClick={handleMergeClick}
                  disabled={!!loadingAction}
                >
                  Убрать перегородки
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
          )}
        </DialogContent>
      </Dialog>

      {/* Merge (collapse) confirmation — only when a sibling has a product */}
      <Dialog open={confirmMerge} onOpenChange={v => !v && setConfirmMerge(false)}>
        <DialogContent preventOutsideClose>
          <DialogHeader>
            <DialogTitle>Убрать перегородки?</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Все отсеки этой ячейки и назначенные в них товары будут удалены. Это действие нельзя отменить напрямую.
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
              {loadingAction === 'merge' ? '...' : 'Убрать'}
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
