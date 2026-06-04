import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search } from 'lucide-react'
import { db } from '@/data/db'
import type { OrderLine, Product } from '@/data/db'
import { supabase } from '@/data/supabase'
import { getProductDisplayName } from '@/features/shelf/cellUtils'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

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

  const products = useLiveQuery(() => db.products.orderBy('name').toArray(), [])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return (products ?? []).filter((p) => {
      if (existingProductIds.has(p.id)) return false
      if (!q) return true
      return getProductDisplayName(p).toLowerCase().includes(q)
    })
  }, [products, query, existingProductIds])

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
      product_name: getProductDisplayName(selected),
      quantity_packs: packCount,
      quantity_units: packCount * selected.pack_size,
      deficit_units: null,
      is_manual: true,
      is_boundary: false,
      created_at: now,
      updated_at: now,
    }
    await db.order_lines.put(line)
    await supabase.from('order_lines').insert(line)
    setSaving(false)
    handleClose()
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="bottom"
        className="rounded-t-xl flex flex-col"
        style={{ maxHeight: '85dvh' }}
      >
        <SheetHeader className="pb-2 flex-shrink-0">
          <SheetTitle>Добавить позицию</SheetTitle>
        </SheetHeader>

        {selected ? (
          /* Step 2: pack count for selected product */
          <div className="flex flex-col gap-4 px-1 pb-4">
            <div>
              <p className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                {getProductDisplayName(selected)}
              </p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
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
                пачек · {packCount * selected.pack_size} шт
              </span>
            </div>

            <Button className="w-full h-14" onClick={handleAdd} disabled={saving}>
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
          /* Step 1: product search + list */
          <>
            <div className="relative flex-shrink-0 px-1 pb-2">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--muted-foreground)' }}
              />
              <input
                type="text"
                placeholder="Поиск товара..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-md border pl-9 pr-3 text-sm"
                style={{
                  height: 44,
                  fontSize: '16px',
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                  outline: 'none',
                }}
                autoFocus
              />
            </div>

            <div className="overflow-y-auto flex-1 -mx-4 px-4">
              {filtered.length === 0 ? (
                <p
                  className="text-sm py-6 text-center"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {query ? 'Ничего не найдено' : 'Все товары уже в заявке'}
                </p>
              ) : (
                filtered.map((product) => (
                  <button
                    key={product.id}
                    className="w-full text-left py-3 border-b"
                    style={{ borderColor: 'var(--border)' }}
                    onClick={() => handleSelect(product)}
                  >
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {getProductDisplayName(product)}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      {product.pack_size} шт/пачка
                    </p>
                  </button>
                ))
              )}
              <div style={{ height: 24 }} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
