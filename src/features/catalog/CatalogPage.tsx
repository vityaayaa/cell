import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/data/db'
import type { Product, Material } from '@/data/db'
import { useAppStore } from '@/data/store'
import { supabase } from '@/data/supabase'
import { ProductForm } from './ProductForm'
import { MaterialsSection } from './MaterialsSection'
import { ProductSortBar, sortByMode, type SortMode } from '@/features/catalog/ProductSortBar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'

function getProductDisplayName(p: Product): string {
  if (p.type === 'unit') return `${p.name} ${p.width_mm}×${p.height_mm}×${p.length_mm}`
  if (p.type === 'round') return `${p.name} ⌀${p.diameter_mm}×${p.length_mm}`
  return p.name
}

interface ProductActionsSheetProps {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onDelete: () => void
}

function ProductActionsSheet({ product, open, onOpenChange, onEdit, onDelete }: ProductActionsSheetProps) {
  if (!product) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-base">{getProductDisplayName(product)}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <button
            className="w-full rounded-md font-medium text-base border"
            style={{
              height: 52,
              color: 'var(--foreground)',
              background: 'var(--background)',
              borderColor: 'var(--border)',
            }}
            onClick={() => { onOpenChange(false); onEdit() }}
          >
            Редактировать
          </button>
          <button
            className="w-full rounded-md font-medium text-base"
            style={{ height: 52, color: '#EF4444', background: 'var(--muted)' }}
            onClick={() => { onOpenChange(false); onDelete() }}
          >
            Удалить товар
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function CatalogPage() {
  const userId = useAppStore((s) => s.userId)

  const products = useLiveQuery(() => db.products.toArray())
  const materials = useLiveQuery(() => db.materials.orderBy('name').toArray())

  const [materialId, setMaterialId] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('alpha-asc')
  const [formOpen, setFormOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [actionsProduct, setActionsProduct] = useState<Product | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)

  const materialMap = useMemo(
    () => new Map((materials ?? []).map((m) => [m.id, m])),
    [materials],
  )

  const filteredProducts = useMemo(() => {
    const base = materialId
      ? (products ?? []).filter((p) => p.material_id === materialId)
      : (products ?? [])
    return sortByMode(base, (p) => p, materialMap, sortMode)
  }, [products, materialId, sortMode, materialMap])

  if (!products || !materials) {
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

  function openActions(p: Product) {
    setActionsProduct(p)
    setActionsOpen(true)
  }

  function openDeleteConfirm() {
    setDeleteTarget(actionsProduct)
    setDeleteConfirmOpen(true)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)

    // Remove from Dexie
    await db.products.delete(deleteTarget.id)

    // Unassign from cells + set needs_review
    const { data: assignedCells } = await supabase
      .from('cells')
      .select('id')
      .eq('product_id', deleteTarget.id)

    if (assignedCells && assignedCells.length > 0) {
      await supabase
        .from('cells')
        .update({ product_id: null, needs_review: true })
        .in('id', assignedCells.map((c) => c.id))

      // Sync affected cells locally
      const { data: updatedCells } = await supabase
        .from('cells')
        .select('*')
        .in('id', assignedCells.map((c) => c.id))
      if (updatedCells) {
        for (const cell of updatedCells) {
          await db.cells.put(cell)
        }
      }
    }

    const { error } = await supabase.from('products').delete().eq('id', deleteTarget.id)
    if (error) {
      // Rollback
      await db.products.put(deleteTarget)
      toast.error('Не удалилось — нет связи')
      setDeleting(false)
      setDeleteConfirmOpen(false)
      return
    }

    // Audit log
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
      await db.audit_log.add(logEntry)
      await supabase.from('audit_log').insert(logEntry)
    }

    toast.success('Товар удалён')
    setDeleting(false)
    setDeleteConfirmOpen(false)
    setDeleteTarget(null)
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

      {/* Product list */}
      {filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-8 py-12">
          <p className="text-base text-center" style={{ color: 'var(--muted-foreground)' }}>
            {materialId ? 'Нет товаров с этим материалом' : 'Каталог пуст'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col mt-3 mx-4 rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {filteredProducts.map((p, i) => {
            const mat: Material | undefined = materialMap.get(p.material_id)
            return (
              <button
                key={p.id}
                className="w-full flex items-center gap-3 px-4 text-left"
                style={{
                  minHeight: 64,
                  borderBottom: i < filteredProducts.length - 1 ? '1px solid var(--border)' : undefined,
                  background: 'var(--card)',
                }}
                onClick={() => openActions(p)}
                aria-label={`Действия с ${p.name}`}
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
            )
          })}
        </div>
      )}

      {/* Materials section */}
      <MaterialsSection materials={materials} />

      {/* Product actions sheet */}
      <ProductActionsSheet
        product={actionsProduct}
        open={actionsOpen}
        onOpenChange={setActionsOpen}
        onEdit={() => openEdit(actionsProduct!)}
        onDelete={openDeleteConfirm}
      />

      {/* Product form sheet */}
      <ProductForm
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editProduct}
        materials={materials}
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
