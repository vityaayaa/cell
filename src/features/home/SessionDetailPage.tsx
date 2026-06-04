import { useParams, useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, Check, X, Minus } from 'lucide-react'
import { db } from '@/data/db'
import type { OrderLine, ChecklistEntry } from '@/data/db'

const RU_MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]}`
}

function rowStatus(entry: ChecklistEntry | undefined, line: OrderLine) {
  if (!entry || entry.status === 'pending') return 'pending'
  if (entry.status === 'unavailable') return 'unavailable'
  if (entry.actual_packs != null && entry.actual_packs < line.quantity_packs) return 'partial'
  return 'done'
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const session = useLiveQuery(
    () => (id ? db.sessions.get(id) : undefined),
    [id],
  )

  const order = useLiveQuery(
    () => (id ? db.orders.where('session_id').equals(id).first() : undefined),
    [id],
  )

  const lines = useLiveQuery<OrderLine[]>(
    async () =>
      order ? db.order_lines.where('order_id').equals(order.id).toArray() : [],
    [order?.id],
  )

  const entries = useLiveQuery<ChecklistEntry[]>(
    async () => {
      const ids = lines?.map((l) => l.id) ?? []
      return ids.length > 0
        ? db.checklist_entries.where('order_line_id').anyOf(ids).toArray()
        : []
    },
    [lines],
  )

  if (!session) {
    return (
      <div className="flex items-center justify-center" style={{ height: 120 }}>
        <p style={{ color: 'var(--muted-foreground)' }}>Загрузка...</p>
      </div>
    )
  }

  const entryMap = new Map((entries ?? []).map((e) => [e.order_line_id, e]))
  const sortedLines = [...(lines ?? [])].sort((a, b) =>
    a.product_name.localeCompare(b.product_name, 'ru'),
  )

  const isCompleted = session.status === 'completed'
  const isAbandoned = session.status === 'abandoned'

  const title = `Обход ${formatDate(session.started_at)}`

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-2 sticky top-0 z-10"
        style={{
          height: 56,
          background: 'var(--background)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center rounded-md"
          style={{ minWidth: 44, minHeight: 44, color: 'var(--primary)' }}
          aria-label="Назад"
        >
          <ChevronLeft size={22} strokeWidth={1.5} />
        </button>
        <span className="font-semibold text-base" style={{ color: 'var(--foreground)' }}>
          {title}
        </span>
        <span
          className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium"
          style={{
            background: isCompleted ? 'rgba(16,185,129,0.12)' : 'var(--muted)',
            color: isCompleted ? '#10B981' : 'var(--muted-foreground)',
          }}
        >
          {isCompleted ? 'Завершена' : isAbandoned ? 'Брошена' : session.status}
        </span>
      </div>

      {/* No order */}
      {!order && (
        <div className="px-4 py-8 text-center">
          <p style={{ color: 'var(--muted-foreground)' }}>
            {isAbandoned
              ? 'Обход был прерван до создания заявки.'
              : 'Заявка не найдена.'}
          </p>
        </div>
      )}

      {/* Plan vs fact table */}
      {order && sortedLines.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th
                  className="text-left px-4 py-3 font-semibold text-sm"
                  style={{ color: 'var(--foreground)', width: '50%' }}
                >
                  Товар
                </th>
                <th
                  className="px-3 py-3 font-semibold text-sm text-right"
                  style={{ color: 'var(--foreground)' }}
                >
                  Заказали
                </th>
                <th
                  className="px-3 py-3 font-semibold text-sm text-right"
                  style={{ color: 'var(--foreground)' }}
                >
                  Взяли
                </th>
                <th className="px-3 py-3 text-center" style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {sortedLines.map((line) => {
                const entry = entryMap.get(line.id)
                const status = rowStatus(entry, line)

                let takenLabel = '—'
                let StatusIcon = null
                let rowBg = 'transparent'

                if (status === 'done') {
                  takenLabel = `${entry!.actual_packs ?? line.quantity_packs}`
                  StatusIcon = <Check size={14} strokeWidth={2} style={{ color: '#10B981' }} />
                  rowBg = 'rgba(16,185,129,0.05)'
                } else if (status === 'partial') {
                  takenLabel = `${entry!.actual_packs}`
                  StatusIcon = <Minus size={14} strokeWidth={2} style={{ color: '#F59E0B' }} />
                } else if (status === 'unavailable') {
                  takenLabel = '—'
                  StatusIcon = <X size={14} strokeWidth={2} style={{ color: 'var(--muted-foreground)' }} />
                  rowBg = 'var(--muted)'
                }

                return (
                  <tr
                    key={line.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: rowBg,
                    }}
                  >
                    <td
                      className="px-4 py-3 text-sm font-medium"
                      style={{ color: 'var(--foreground)' }}
                    >
                      {line.product_name}
                    </td>
                    <td
                      className="px-3 py-3 text-right tabular-nums"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      {line.quantity_packs}
                    </td>
                    <td
                      className="px-3 py-3 text-right tabular-nums font-medium"
                      style={{ color: 'var(--foreground)' }}
                    >
                      {takenLabel}
                    </td>
                    <td className="px-3 py-3 text-center">{StatusIcon}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {order && sortedLines.length === 0 && (
        <div className="px-4 py-8 text-center">
          <p style={{ color: 'var(--muted-foreground)' }}>Позиций в заявке нет.</p>
        </div>
      )}

      <div style={{ height: 32 }} />
    </div>
  )
}
