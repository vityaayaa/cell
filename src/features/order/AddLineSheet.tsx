import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { db } from '@/data/db'
import type { OrderLine, Product } from '@/data/db'
import { mutateInsert } from '@/data/mutate'
import { getProductShortName } from '@/features/shelf/cellUtils'
import {
  ProductSortBar,
  compareByDimensions,
  type SortMode,
  type LengthMode,
} from '@/features/catalog/ProductSortBar'
import { accordionDuration } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { packsWord } from '@/lib/plural'

// Full dimensions shown on the right of a product row (all types, partials ok).
function getProductDims(p: Product): string | null {
  if (p.type === 'round') {
    const parts = [
      p.diameter_mm != null ? `⌀${p.diameter_mm}` : null,
      p.length_mm != null ? String(p.length_mm) : null,
    ].filter((v): v is string => v != null)
    return parts.length ? parts.join('×') : null
  }
  const dims = [p.height_mm, p.width_mm, p.length_mm].filter(
    (v): v is number => v != null,
  )
  return dims.length ? dims.join('×') : null
}

interface AddLineSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  existingProductIds: Set<string>
}

export function AddLineSheet({
  open,
  onOpenChange,
  orderId,
  existingProductIds,
}: AddLineSheetProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Product | null>(null)
  const [packCount, setPackCount] = useState(1)
  const [saving, setSaving] = useState(false)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const [materialId, setMaterialId] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('alpha-asc')

  // Sort in JS — `name` is not a Dexie index, so .orderBy('name') would throw.
  const products = useLiveQuery(
    async () => (await db.products.toArray()).sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [],
  )
  const groups = useLiveQuery(() => db.groups.orderBy('name').toArray()) ?? []
  const materials = useLiveQuery(() => db.materials.toArray()) ?? []

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return (products ?? []).filter((p) => {
      if (existingProductIds.has(p.id)) return false
      if (materialId && p.material_id !== materialId) return false
      if (!q) return true
      return getProductShortName(p).toLowerCase().includes(q)
    })
  }, [products, query, existingProductIds, materialId])

  // Group the filtered products by group_id (groups alphabetical, like the
  // catalog). Items inside a group are ordered by cross-section; length only
  // participates when the «Длина» sort is on.
  const sections = useMemo(() => {
    const lengthMode: LengthMode =
      sortMode === 'length-asc' ? 'asc' : sortMode === 'length-desc' ? 'desc' : false
    const groupMap = new Map(groups.map((g) => [g.id, g]))
    const byGroup = new Map<string, Product[]>()
    for (const p of filtered) {
      const key = groupMap.has(p.group_id) ? p.group_id : '__none__'
      const arr = byGroup.get(key)
      if (arr) arr.push(p)
      else byGroup.set(key, [p])
    }
    const out: { id: string; name: string; items: Product[] }[] = []
    for (const g of groups) {
      const items = byGroup.get(g.id)
      if (items && items.length > 0) {
        items.sort((a, b) => compareByDimensions(a, b, lengthMode))
        out.push({ id: g.id, name: g.name, items })
      }
    }
    // «Я-А» flips the order of NAMED groups; «Без группы» stays last.
    if (sortMode === 'alpha-desc') out.reverse()
    const orphan = byGroup.get('__none__')
    if (orphan && orphan.length > 0) {
      orphan.sort((a, b) => compareByDimensions(a, b, lengthMode))
      out.push({ id: '__none__', name: 'Без группы', items: orphan })
    }
    return out
  }, [filtered, groups, sortMode])

  function toggleGroup(id: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSelect(product: Product) {
    setSelected(product)
    setPackCount(1)
  }

  function handleClose() {
    setQuery('')
    setSelected(null)
    setPackCount(1)
    onOpenChange(false)
  }

  async function handleAdd() {
    if (!selected || packCount < 1) return
    setSaving(true)
    const now = new Date().toISOString()
    const line: OrderLine = {
      id: crypto.randomUUID(),
      order_id: orderId,
      product_id: selected.id,
      product_name: getProductShortName(selected),
      quantity_packs: packCount,
      quantity_units: packCount * selected.pack_size,
      deficit_units: null,
      is_manual: true,
      is_boundary: false,
      created_at: now,
      updated_at: now,
    }
    await mutateInsert('order_lines', db.order_lines, line)
    setSaving(false)
    handleClose()
  }

  function renderProductRow(product: Product) {
    const dims = getProductDims(product)
    const material = materials.find((m) => m.id === product.material_id)
    return (
      <button
        key={product.id}
        className="w-full flex items-center justify-between rounded-md border px-4 gap-3 text-left"
        style={{ minHeight: 56, color: 'var(--foreground)', borderColor: 'var(--border)', background: 'var(--background)' }}
        onClick={() => handleSelect(product)}
      >
        <span className="flex items-center gap-2 min-w-0">
          {material && (
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ background: material.color }}
            />
          )}
          <span className="text-sm font-medium truncate">{getProductShortName(product)}</span>
        </span>
        {dims && <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>{dims}</span>}
      </button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить позицию</DialogTitle>
        </DialogHeader>

        {selected ? (
          /* Step 2: pack count */
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                {getProductShortName(selected)}
              </p>
              <p className="ui-hint mt-0.5">
                {selected.pack_size} шт/пачка
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                className="w-11 h-11 rounded-md border text-lg font-medium flex items-center justify-center flex-shrink-0"
                style={{ borderColor: 'var(--border)' }}
                onClick={() => setPackCount((p) => Math.max(1, p - 1))}
                disabled={packCount <= 1}
              >
                −
              </button>
              <Input
                type="number"
                inputMode="numeric"
                value={packCount}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  if (!isNaN(v) && v >= 1) setPackCount(v)
                }}
                className="w-20 text-center text-base"
                style={{ fontSize: '16px' }}
              />
              <button
                className="w-11 h-11 rounded-md border text-lg font-medium flex items-center justify-center flex-shrink-0"
                style={{ borderColor: 'var(--border)' }}
                onClick={() => setPackCount((p) => p + 1)}
              >
                +
              </button>
              <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {packsWord(packCount)} · {packCount * selected.pack_size} шт
              </span>
            </div>

            <Button className="btn-primary w-full h-14" onClick={handleAdd} disabled={saving}>
              {saving ? '…' : 'Добавить в заявку'}
            </Button>

            <Separator />

            <button
              className="w-full py-2 text-sm text-center"
              style={{ color: 'var(--muted-foreground)' }}
              onClick={() => setSelected(null)}
            >
              ← Выбрать другой товар
            </button>
          </div>
        ) : (
          /* Step 1: search + sort bar + grouped list (like the cell picker) */
          <div className="flex flex-col gap-2">
            <Input
              type="text"
              inputMode="search"
              placeholder="Поиск по названию"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="text-base"
            />

            <ProductSortBar
              materials={materials}
              materialId={materialId}
              sortMode={sortMode}
              onMaterialId={setMaterialId}
              onSortMode={setSortMode}
            />

            <div className="flex flex-col gap-2 h-[45dvh] overflow-y-auto">
              {sections.length === 0 ? (
                <p
                  className="text-sm py-6 text-center"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {query ? 'Ничего не найдено' : 'Все товары уже в заявке'}
                </p>
              ) : (
                sections.map((section) => {
                  const isOpen = openGroups.has(section.id)
                  return (
                    <div
                      key={section.id}
                      className="rounded-lg border overflow-hidden flex-shrink-0"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <button
                        className="w-full flex items-center gap-2 px-4"
                        style={{ height: 48, background: 'var(--muted)', textAlign: 'left' }}
                        onClick={() => toggleGroup(section.id)}
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
                              {section.items.map((p) => renderProductRow(p))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
