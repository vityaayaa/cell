import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/data/db'
import type { Product, Material } from '@/data/db'
import { useAppStore } from '@/data/store'
import { mutateDelete, mutateInsert, mutateUpdate } from '@/data/mutate'
import { ProductForm } from './ProductForm'
import { MaterialsSection } from './MaterialsSection'
import { GroupsSection } from './GroupsSection'
import { ProductSortBar, sortByMode, compareByDimensions, type SortMode, type LengthMode } from '@/features/catalog/ProductSortBar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { getProductDisplayName } from '@/features/shelf/cellUtils'
import { accordionDuration } from '@/lib/utils'

interface ProductRowProps {
  product: Product
  material: Material | undefined
  onEdit: () => void
  onDelete: () => void
}

function ProductRow({ product: p, material: mat, onEdit, onDelete }: ProductRowProps) {
  return (
    <div
      className="flex items-center"
      style={{ borderTop: '1px solid var(--border)', background: 'var(--card)' }}
    >
      {/* Tap the row → edit */}
      <button
        className="flex-1 min-w-0 flex items-center gap-3 px-4 text-left"
        style={{ minHeight: 64 }}
        onClick={onEdit}
        aria-label={`Редактировать ${p.name}`}
      >
        {/* Material color dot */}
        {mat && (
          <div
            className="flex-shrink-0 rounded-full"
            style={{ width: 10, height: 10, background: mat.color }}
            aria-hidden
          />
        )}
        <div className="flex-1 min-w-0 py-3">
          <p
            className="text-sm font-medium truncate"
            style={{ color: 'var(--foreground)' }}
          >
            {getProductDisplayName(p)}
          </p>
          <p
            className="text-xs mt-0.5"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {mat?.name ?? '—'} · пачка: {p.pack_size} шт
          </p>
        </div>
      </button>

      {/* Delete — same place as in the groups / materials blocks */}
      <button
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: 48, minHeight: 64, color: '#EF4444' }}
        onClick={onDelete}
        aria-label={`Удалить ${p.name}`}
      >
        <Trash2 size={16} strokeWidth={1.5} />
      </button>
    </div>
  )
}

export default function CatalogPage() {
  const userId = useAppStore((s) => s.userId)

  const products = useLiveQuery(() => db.products.toArray())
  const materials = useLiveQuery(() => db.materials.orderBy('name').toArray())
  const groups = useLiveQuery(() => db.groups.orderBy('name').toArray())

  const expandedGroupIds = useAppStore((s) => s.expandedGroupIds)
  const toggleExpandedGroup = useAppStore((s) => s.toggleExpandedGroup)

  const [materialId, setMaterialId] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('alpha-asc')
  const [formOpen, setFormOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)

  const materialMap = useMemo(
    () => new Map((materials ?? []).map((m) => [m.id, m])),
    [materials],
  )

  const groupMap = useMemo(
    () => new Map((groups ?? []).map((g) => [g.id, g])),
    [groups],
  )

  const filteredProducts = useMemo(() => {
    const base = materialId
      ? (products ?? []).filter((p) => p.material_id === materialId)
      : (products ?? [])
    return sortByMode(base, (p) => p, materialMap, sortMode)
  }, [products, materialId, sortMode, materialMap])

  // Group the (already filtered) products by group_id, preserving the
  // alphabetical group order (`groups` is orderBy name). Products whose group
  // no longer exists land under a trailing "Без группы" bucket — shouldn't
  // happen since group_id is mandatory, but handle it safely. Within each
  // group items are ordered by cross-section (compareByDimensions); the
  // «Длина» toggle only flips the length axis.
  const groupedProducts = useMemo(() => {
    // Length only participates when the «Длина» sort is active; otherwise sort
    // by cross-section (height → width) and ignore length.
    const lengthMode: LengthMode =
      sortMode === 'length-asc' ? 'asc' : sortMode === 'length-desc' ? 'desc' : false
    const byGroup = new Map<string, Product[]>()
    for (const p of filteredProducts) {
      const key = groupMap.has(p.group_id) ? p.group_id : '__none__'
      const arr = byGroup.get(key)
      if (arr) arr.push(p)
      else byGroup.set(key, [p])
    }
    const sections: { id: string; name: string; items: Product[] }[] = []
    for (const g of groups ?? []) {
      const items = byGroup.get(g.id)
      if (items && items.length > 0) {
        items.sort((a, b) => compareByDimensions(a, b, lengthMode))
        sections.push({ id: g.id, name: g.name, items })
      }
    }
    // «Я-А» flips the order of NAMED groups; length modes keep A-Z. The
    // «Без группы» bucket always stays last, so reverse before appending it.
    if (sortMode === 'alpha-desc') sections.reverse()
    const orphan = byGroup.get('__none__')
    if (orphan && orphan.length > 0) {
      orphan.sort((a, b) => compareByDimensions(a, b, lengthMode))
      sections.push({ id: '__none__', name: 'Без группы', items: orphan })
    }
    return sections
  }, [filteredProducts, groups, groupMap, sortMode])

  if (!products || !materials || !groups) {
    return (
      <div className="flex items-center justify-center" style={{ height: 200 }}>
        <div
          className="w-5 h-5 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }}
        />
      </div>
    )
  }

  function openAdd() {
    setEditProduct(null)
    setFormOpen(true)
  }

  function openEdit(p: Product) {
    setEditProduct(p)
    setFormOpen(true)
  }

  function openDeleteConfirm(p: Product) {
    setDeleteTarget(p)
    setDeleteConfirmOpen(true)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      // Unassign the product from every cell that used it, flag them for review.
      // Done through Dexie + mutate (not a raw online-only query) so it survives
      // offline — otherwise the product would delete but the cells keep a
      // dangling product_id.
      const now = new Date().toISOString()
      const assignedCells = await db.cells.where('product_id').equals(deleteTarget.id).toArray()
      for (const cell of assignedCells) {
        const updated = { ...cell, product_id: null, needs_review: true, updated_at: now }
        await mutateUpdate('cells', db.cells, updated)
      }

      // Удаление товара — через очередь: при офлайне не теряется, дошлётся позже.
      const outcome = await mutateDelete('products', db.products, deleteTarget.id)

      if (userId) {
        const logEntry = {
          id: crypto.randomUUID(),
          actor_id: userId,
          event_type: 'product_deleted',
          entity_type: 'product',
          entity_id: deleteTarget.id,
          old_value: { name: deleteTarget.name },
          new_value: null,
          created_at: new Date().toISOString(),
        }
        await mutateInsert('audit_log', db.audit_log, logEntry)
      }

      toast.success(outcome === 'queued' ? 'Удалено офлайн — синхронизируется позже' : 'Товар удалён')
      setDeleteConfirmOpen(false)
      setDeleteTarget(null)
    } catch {
      toast.error('Не удалось удалить. Попробуйте ещё раз.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col pb-6">
      {/* Sort bar */}
      <ProductSortBar
        materials={materials}
        materialId={materialId}
        sortMode={sortMode}
        onMaterialId={setMaterialId}
        onSortMode={setSortMode}
      />

      {/* Add button */}
      <div className="px-4 pt-3">
        <button
          className="w-full flex items-center justify-center gap-2 rounded-md font-medium text-sm border"
          style={{
            height: 44,
            color: 'var(--primary)',
            borderColor: 'var(--primary)',
            background: 'transparent',
          }}
          onClick={openAdd}
        >
          <Plus size={16} strokeWidth={1.5} />
          Добавить товар
        </button>
      </div>

      {/* Product list — accordion by group */}
      {filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-8 py-12">
          <p className="text-base text-center" style={{ color: 'var(--muted-foreground)' }}>
            {materialId ? 'Нет товаров с этим материалом' : 'Каталог пуст'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col mt-3 mx-4 gap-2">
          {groupedProducts.map((section) => {
            const isOpen = expandedGroupIds.has(section.id)
            return (
              <div
                key={section.id}
                className="rounded-lg border overflow-hidden"
                style={{ borderColor: 'var(--border)' }}
              >
                {/* Group header */}
                <button
                  className="w-full flex items-center gap-2 px-4"
                  style={{ height: 48, background: 'var(--muted)', textAlign: 'left' }}
                  onClick={() => toggleExpandedGroup(section.id)}
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

                {/* Products inside group — animated open/close */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: accordionDuration(section.items.length), ease: 'easeOut' }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div>
                        {section.items.map((p) => (
                          <ProductRow
                            key={p.id}
                            product={p}
                            material={materialMap.get(p.material_id)}
                            onEdit={() => openEdit(p)}
                            onDelete={() => openDeleteConfirm(p)}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}

      {/* Groups section */}
      <GroupsSection groups={groups} />

      {/* Materials section */}
      <MaterialsSection materials={materials} />

      {/* Product form sheet */}
      <ProductForm
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editProduct}
        materials={materials}
        groups={groups}
        actorId={userId}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить товар?</DialogTitle>
            <DialogDescription>
              Товар будет удалён из каталога. Ячейки, где он назначен, получат флаг проверки.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <button
              className="w-full rounded-md font-semibold text-base text-white"
              style={{ height: 52, background: '#EF4444', opacity: deleting ? 0.7 : 1 }}
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? '…' : 'Удалить'}
            </button>
            <button
              className="w-full rounded-md font-medium text-base border"
              style={{
                height: 52,
                color: 'var(--foreground)',
                borderColor: 'var(--border)',
                background: 'var(--background)',
              }}
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleting}
            >
              Отмена
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
