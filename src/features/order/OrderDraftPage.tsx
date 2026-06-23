import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus } from 'lucide-react'
import { db } from '@/data/db'
import type { Order, OrderLine, Product, Material } from '@/data/db'
import { supabase } from '@/data/supabase'
import { useAppStore } from '@/data/store'
import { updateSessionStatus } from './updateSessionStatus'
import { packs } from '@/lib/plural'
import { ProductSortBar, sortByMode, type SortMode } from '@/features/catalog/ProductSortBar'
import { OrderLineSheet, BoundaryLineSheet, FinalizeSheet } from './OrderLineSheet'
import { AddLineSheet } from './AddLineSheet'

export default function OrderDraftPage() {
  const navigate = useNavigate()
  // Individual primitive selectors — an inline object selector returns a new
  // object every render and triggers React error #185 (infinite re-render).
  const activeSessionId = useAppStore((s) => s.activeSessionId)
  const userId = useAppStore((s) => s.userId)

  const [materialId, setMaterialId] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('alpha-asc')

  const order = useLiveQuery<Order | undefined>(
    async () =>
      activeSessionId
        ? db.orders.where('session_id').equals(activeSessionId).first()
        : undefined,
    [activeSessionId],
  )

  const allLines = useLiveQuery<OrderLine[]>(
    async () =>
      order ? db.order_lines.where('order_id').equals(order.id).toArray() : [],
    [order?.id],
  )

  const products = useLiveQuery<Product[]>(() => db.products.toArray(), [])
  const materials = useLiveQuery<Material[]>(() => db.materials.toArray(), [])

  const productMap = useMemo(
    () => new Map((products ?? []).map((p) => [p.id, p])),
    [products],
  )
  const materialMap = useMemo(
    () => new Map((materials ?? []).map((m) => [m.id, m])),
    [materials],
  )

  const mainLines = useMemo(() => {
    const base = (allLines ?? []).filter((l) => !l.is_boundary)
    const filtered = materialId
      ? base.filter((l) => productMap.get(l.product_id ?? '')?.material_id === materialId)
      : base
    return sortByMode(filtered, (l) => productMap.get(l.product_id ?? ''), materialMap, sortMode)
  }, [allLines, productMap, materialMap, materialId, sortMode])

  const boundaryLines = useMemo(
    () => (allLines ?? []).filter((l) => l.is_boundary),
    [allLines],
  )

  const existingProductIds = useMemo(
    () => new Set((allLines ?? []).map((l) => l.product_id ?? '').filter(Boolean)),
    [allLines],
  )

  const [editLine, setEditLine] = useState<OrderLine | null>(null)
  const [editBoundary, setEditBoundary] = useState<OrderLine | null>(null)
  const [editLineOpen, setEditLineOpen] = useState(false)
  const [editBoundaryOpen, setEditBoundaryOpen] = useState(false)
  const [finalizeOpen, setFinalizeOpen] = useState(false)
  const [addLineOpen, setAddLineOpen] = useState(false)

  function openEditLine(line: OrderLine) {
    setEditLine(line)
    setEditLineOpen(true)
  }

  function openBoundaryLine(line: OrderLine) {
    setEditBoundary(line)
    setEditBoundaryOpen(true)
  }

  function handleBoundaryIncluded(updatedLine: OrderLine) {
    setEditLine(updatedLine)
    setEditLineOpen(true)
  }

  async function handleFinalize() {
    if (!order || !activeSessionId || !userId) return
    const lines = await db.order_lines.where('order_id').equals(order.id).toArray()
    const now = new Date().toISOString()

    await db.orders.update(order.id, { finalized_at: now, updated_at: now })
    await supabase
      .from('orders')
      .update({ finalized_at: now, updated_at: now })
      .eq('id', order.id)

    const checklistEntries = lines.map((l) => ({
      id: crypto.randomUUID(),
      order_line_id: l.id,
      status: 'pending' as const,
      actual_packs: null,
      updated_at: now,
      user_id: userId,
    }))
    await db.checklist_entries.bulkPut(checklistEntries)
    await supabase.from('checklist_entries').insert(checklistEntries)

    await updateSessionStatus(activeSessionId, 'fulfilling')
    navigate(`/app/checklist/${activeSessionId}`)
  }

  const totalPositions = mainLines.length
  const totalPacks = mainLines.reduce((sum, l) => sum + l.quantity_packs, 0)

  if (order === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }}
        />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
          Нет активной заявки. Перейдите к стеллажу и нажмите «→ К заявке».
        </p>
      </div>
    )
  }

  return (
    <>
      <div
        className="flex flex-col h-full overflow-y-auto"
        style={{ background: 'var(--background)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h1 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
            Заявка
          </h1>
          <button
            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium"
            style={{ color: 'var(--primary)', background: 'transparent' }}
            onClick={() => setAddLineOpen(true)}
            aria-label="Добавить позицию вручную"
          >
            <Plus size={18} strokeWidth={2} />
            Добавить
          </button>
        </div>

        {/* Sort bar */}
        <ProductSortBar
          materials={materials ?? []}
          materialId={materialId}
          sortMode={sortMode}
          onMaterialId={setMaterialId}
          onSortMode={setSortMode}
        />

        {/* Main lines */}
        {mainLines.length > 0 ? (
          <ul>
            {mainLines.map((line) => (
              <li key={line.id}>
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                  onClick={() => openEditLine(line)}
                >
                  <span className="text-sm font-medium mr-4" style={{ color: 'var(--foreground)' }}>
                    {line.product_name}
                    {line.is_manual && (
                      <span
                        className="ml-1.5 text-xs rounded-full px-1.5 py-0.5"
                        style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                      >
                        вручную
                      </span>
                    )}
                  </span>
                  <span
                    className="text-sm flex-shrink-0"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {packs(line.quantity_packs)} · {line.quantity_units} шт
                  </span>
                </button>
                <div className="mx-4 border-t" style={{ borderColor: 'var(--border)' }} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-4 py-6">
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Нет позиций для заказа.
            </p>
          </div>
        )}

        {/* Boundary lines */}
        {boundaryLines.length > 0 && (
          <>
            <div className="mx-4 mt-2 mb-1">
              <p className="ui-section-title">
                Пограничные позиции
              </p>
            </div>
            <div className="mx-4 border-t" style={{ borderColor: 'var(--border)' }} />
            <ul>
              {boundaryLines.map((line) => (
                <li key={line.id}>
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                    onClick={() => openBoundaryLine(line)}
                  >
                    <span
                      className="text-sm font-medium mr-4"
                      style={{ color: 'var(--foreground)' }}
                    >
                      {line.product_name}
                    </span>
                    <span className="text-sm flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                      дефицит {line.deficit_units} шт &lt; пачки
                    </span>
                  </button>
                  <div className="mx-4 border-t" style={{ borderColor: 'var(--border)' }} />
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Finalize */}
        <div className="flex-1" />
        <div className="mx-4 border-t mb-4" style={{ borderColor: 'var(--border)' }} />
        <div className="px-4 pb-6">
          <button
            className="w-full rounded-md font-medium text-sm disabled:opacity-40"
            style={{
              height: '48px',
              background: 'var(--muted)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
            }}
            onClick={() => setFinalizeOpen(true)}
            disabled={mainLines.length === 0}
          >
            Финализировать заявку
          </button>
        </div>
      </div>

      <OrderLineSheet
        line={editLine}
        open={editLineOpen}
        onOpenChange={setEditLineOpen}
      />
      <BoundaryLineSheet
        line={editBoundary}
        open={editBoundaryOpen}
        onOpenChange={setEditBoundaryOpen}
        onIncluded={handleBoundaryIncluded}
      />
      <FinalizeSheet
        open={finalizeOpen}
        onOpenChange={setFinalizeOpen}
        totalPositions={totalPositions}
        totalPacks={totalPacks}
        onFinalize={handleFinalize}
      />
      {order && (
        <AddLineSheet
          open={addLineOpen}
          onOpenChange={setAddLineOpen}
          orderId={order.id}
          existingProductIds={existingProductIds}
        />
      )}
    </>
  )
}
