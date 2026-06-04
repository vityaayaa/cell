import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import type { Order, OrderLine } from '@/data/db'
import { supabase } from '@/data/supabase'
import { useAppStore } from '@/data/store'
import { updateSessionStatus } from './updateSessionStatus'
import { OrderLineSheet, BoundaryLineSheet, FinalizeSheet } from './OrderLineSheet'

function sortMainLines(lines: OrderLine[]): OrderLine[] {
  return [...lines].sort((a, b) => {
    // Sort: by product_name (includes material in name prefix), then A→Z
    // For now: simple alphabetical on product_name which naturally groups by material
    return a.product_name.localeCompare(b.product_name, 'ru')
  })
}

export default function OrderDraftPage() {
  const navigate = useNavigate()
  const { activeSessionId, userId } = useAppStore((s) => ({
    activeSessionId: s.activeSessionId,
    userId: s.userId,
  }))

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

  const mainLines = sortMainLines((allLines ?? []).filter((l) => !l.is_boundary))
  const boundaryLines = (allLines ?? []).filter((l) => l.is_boundary)

  const [editLine, setEditLine] = useState<OrderLine | null>(null)
  const [editBoundary, setEditBoundary] = useState<OrderLine | null>(null)
  const [editLineOpen, setEditLineOpen] = useState(false)
  const [editBoundaryOpen, setEditBoundaryOpen] = useState(false)
  const [finalizeOpen, setFinalizeOpen] = useState(false)

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

    // Lock order
    await db.orders.update(order.id, { finalized_at: now, updated_at: now })
    await supabase
      .from('orders')
      .update({ finalized_at: now, updated_at: now })
      .eq('id', order.id)

    // Create checklist entries
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

    // Update session status
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
        <div className="px-4 pt-4 pb-2">
          <h1 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
            Заявка
          </h1>
        </div>

        <div
          className="mx-4 border-t"
          style={{ borderColor: 'var(--border)' }}
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
                  </span>
                  <span
                    className="text-sm flex-shrink-0"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {line.quantity_packs} пачек · {line.quantity_units} шт
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
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--muted-foreground)' }}
              >
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

        {/* Spacer + finalize */}
        <div className="flex-1" />
        <div
          className="mx-4 border-t mb-4"
          style={{ borderColor: 'var(--border)' }}
        />
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

      {/* Sheets */}
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
    </>
  )
}
