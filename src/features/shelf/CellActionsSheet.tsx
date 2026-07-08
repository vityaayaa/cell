import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion, AnimatePresence } from 'motion/react'
import { Package, Settings, Minus, Plus, ChevronDown, ChevronRight, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { ProductSortBar, compareByDimensions, type SortMode, type LengthMode } from '@/features/catalog/ProductSortBar'
import { accordionDuration } from '@/lib/utils'
import { getProductShortName } from './cellUtils'
import type { Cell, Product, Material } from '@/data/db'

import { db } from '@/data/db'
import { mutateUpsertMany, mutateUpdate, mutateDelete } from '@/data/mutate'
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
 * split node; children are born EMPTY and inherit nothing from the parent.
 */
async function splitCell(cell: Cell, direction: 'H' | 'V', count: number) {
  const now = new Date().toISOString()

  // Одна ось сохраняется от родителя, вторую пользователь задаёт сам:
  // • V (делим на СТОЛБЦЫ вертикальной линией) — высота у всех остаётся
  //   родительской, ширину каждой ячейки вводят вручную.
  // • H (делим на РЯДЫ горизонтальной линией) — ширина остаётся родительской,
  //   высоту вводят вручную.
  const inheritHeight = direction === 'V'
  const parentHeight = cell.computed_height_mm > 0 ? cell.computed_height_mm : null
  const parentWidth = cell.computed_width_mm > 0 ? cell.computed_width_mm : null

  const children: Cell[] = Array.from({ length: count }, (_, i) => ({
    id: crypto.randomUUID(),
    shelf_id: cell.shelf_id,
    parent_id: cell.id,
    row_index: cell.row_index,
    col_index: cell.col_index,
    split_direction: null,
    child_index: i,
    width_mm: inheritHeight ? null : parentWidth,
    height_mm: inheritHeight ? parentHeight : null,
    computed_width_mm: inheritHeight ? 0 : (parentWidth ?? 0),
    computed_height_mm: inheritHeight ? (parentHeight ?? 0) : 0,
    product_id: null,
    capacity_override: null,
    rotation_allowed: false,
    needs_review: false,
    is_disabled: false,
    created_at: now,
    updated_at: now,
  }))

  const updatedCell: Cell = {
    ...cell,
    split_direction: direction,
    product_id: null,
    updated_at: now,
  }

  // Dexie-запись делает mutateUpsertMany; при офлайне уходит в очередь без отката.
  await mutateUpsertMany('cells', db.cells, [updatedCell, ...children])
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

  // Родитель снова становится листом (upsert), дети удаляются. Через mutate:
  // Dexie-запись + облако, при офлайне обе операции уходят в очередь.
  await mutateUpsertMany('cells', db.cells, [restoredParent])
  for (const childId of childIds) {
    await mutateDelete('cells', db.cells, childId)
  }
}

async function assignProduct(cellId: string, productId: string) {
  const now = new Date().toISOString()
  await db.cells.update(cellId, { product_id: productId, capacity_override: null, updated_at: now })
  const updated = await db.cells.get(cellId)
  if (updated) await mutateUpdate('cells', db.cells, updated)
}

async function removeProduct(cell: Cell) {
  const now = new Date().toISOString()
  await db.cells.update(cell.id, { product_id: null, updated_at: now })
  const updated = await db.cells.get(cell.id)
  if (updated) await mutateUpdate('cells', db.cells, updated)
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
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerMaterialId, setPickerMaterialId] = useState<string | null>(null)
  const [pickerSort, setPickerSort] = useState<SortMode>('alpha-asc')
  const [pickerOpenGroups, setPickerOpenGroups] = useState<Set<string>>(new Set())

  const groups = useLiveQuery(() => db.groups.orderBy('name').toArray()) ?? []

  if (!cell) return null

  const leaf = isLeaf(cell.id, allCells)
  if (!leaf) return null

  const currentProduct = products.find(p => p.id === cell.product_id)
  const assignedProductIds = new Set(
    allCells.map(c => c.product_id).filter((id): id is string => id != null),
  )

  // Product picker: filter by material + name search, then group by group_id
  // (groups in alphabetical order) like the catalog. Within each group items
  // are ordered by cross-section (length desc → height → width).
  const filteredPickerProducts = products.filter(p => {
    if (pickerMaterialId && p.material_id !== pickerMaterialId) return false
    const q = pickerSearch.trim().toLowerCase()
    return q === '' || getProductShortName(p).toLowerCase().includes(q)
  })
  const groupMap = new Map(groups.map(g => [g.id, g]))
  const pickerByGroup = new Map<string, Product[]>()
  for (const p of filteredPickerProducts) {
    const key = groupMap.has(p.group_id) ? p.group_id : '__none__'
    const arr = pickerByGroup.get(key)
    if (arr) arr.push(p)
    else pickerByGroup.set(key, [p])
  }
  // Length only participates when the «Длина» sort is active; otherwise sort
  // by cross-section (height → width) and ignore length.
  const pickerLengthMode: LengthMode =
    pickerSort === 'length-asc' ? 'asc' : pickerSort === 'length-desc' ? 'desc' : false
  const pickerSections: { id: string; name: string; items: Product[] }[] = []
  for (const g of groups) {
    const items = pickerByGroup.get(g.id)
    if (items && items.length > 0) {
      items.sort((a, b) => compareByDimensions(a, b, pickerLengthMode))
      pickerSections.push({ id: g.id, name: g.name, items })
    }
  }
  // «Я-А» flips the order of NAMED groups; «Без группы» stays last.
  if (pickerSort === 'alpha-desc') pickerSections.reverse()
  const pickerOrphan = pickerByGroup.get('__none__')
  if (pickerOrphan && pickerOrphan.length > 0) {
    pickerOrphan.sort((a, b) => compareByDimensions(a, b, pickerLengthMode))
    pickerSections.push({ id: '__none__', name: 'Без группы', items: pickerOrphan })
  }
  const pickerHasResults = pickerSections.length > 0

  function togglePickerGroup(id: string) {
    setPickerOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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

  function renderPickerButton(p: Product) {
    const name = getProductShortName(p)
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
          {inShelf && (
            <span title="Уже в стеллаже" className="flex-shrink-0 flex items-center">
              <Check size={16} strokeWidth={2} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            </span>
          )}
        </span>
      </button>
    )
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
                onClick={() => { setPickerSearch(''); setShowProductList(true) }}
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
        <DialogContent preventOutsideClose className="p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>Выбрать товар</DialogTitle>
          </DialogHeader>

          <div className="px-4 pt-2 pb-1">
            <Input
              type="text"
              inputMode="search"
              placeholder="Поиск по названию"
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              className="text-base"
            />
          </div>

          <ProductSortBar
            materials={materials}
            materialId={pickerMaterialId}
            sortMode={pickerSort}
            onMaterialId={setPickerMaterialId}
            onSortMode={setPickerSort}
          />

          <div className="flex flex-col gap-2 h-[50dvh] overflow-y-auto px-4 py-3">
            {pickerSections.map(section => {
              const isOpen = pickerOpenGroups.has(section.id)
              return (
                <div
                  key={section.id}
                  className="rounded-lg border overflow-hidden flex-shrink-0"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <button
                    className="w-full flex items-center gap-2 px-4"
                    style={{ height: 48, background: 'var(--muted)', textAlign: 'left' }}
                    onClick={() => togglePickerGroup(section.id)}
                    aria-expanded={isOpen}
                    aria-label={`${section.name} (${section.items.length})`}
                  >
                    {isOpen
                      ? <ChevronDown size={18} strokeWidth={1.5} style={{ color: 'var(--muted-foreground)' }} />
                      : <ChevronRight size={18} strokeWidth={1.5} style={{ color: 'var(--muted-foreground)' }} />}
                    <span className="flex-1 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                      {section.name}{' '}
                      <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>
                        ({section.items.length})
                      </span>
                    </span>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: accordionDuration(section.items.length), ease: 'easeOut' }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div className="flex flex-col gap-2 p-2">
                          {section.items.map(p => renderPickerButton(p))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
            {products.length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: 'var(--muted-foreground)' }}>
                Каталог пуст. Добавьте товары в разделе Каталог.
              </p>
            )}
            {products.length > 0 && !pickerHasResults && (
              <p className="text-sm text-center py-4" style={{ color: 'var(--muted-foreground)' }}>
                Ничего не найдено.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
