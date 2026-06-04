import { useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, Download } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/data/db'
import type { Session, Order, OrderLine, ChecklistEntry } from '@/data/db'
import type { ProductAggregate } from './exportExcel'
import { exportAggregatesExcel } from './exportExcel'

function buildAggregates(
  sessions: Session[],
  orders: Order[],
  orderLines: OrderLine[],
  entries: ChecklistEntry[],
): ProductAggregate[] {
  const completedIds = new Set(
    sessions.filter((s) => s.status === 'completed').map((s) => s.id),
  )

  const relevantOrderIds = new Set(
    orders.filter((o) => completedIds.has(o.session_id)).map((o) => o.id),
  )

  const relevantLines = orderLines.filter((l) => relevantOrderIds.has(l.order_id))

  const lineIdToName = new Map(relevantLines.map((l) => [l.id, l.product_name]))

  const byName = new Map<string, { lines: OrderLine[]; entries: ChecklistEntry[] }>()
  for (const line of relevantLines) {
    if (!byName.has(line.product_name)) {
      byName.set(line.product_name, { lines: [], entries: [] })
    }
    byName.get(line.product_name)!.lines.push(line)
  }

  for (const entry of entries) {
    const name = lineIdToName.get(entry.order_line_id)
    if (name && byName.has(name)) {
      byName.get(name)!.entries.push(entry)
    }
  }

  const result: ProductAggregate[] = []
  for (const [name, { lines, entries: ents }] of byName) {
    const timesOrdered = lines.length
    const avgOrdered =
      lines.reduce((s, l) => s + l.quantity_packs, 0) / lines.length

    const doneEntries = ents.filter((e) => e.status === 'done' && e.actual_packs != null)
    const avgTaken =
      doneEntries.length > 0
        ? doneEntries.reduce((s, e) => s + (e.actual_packs ?? 0), 0) / doneEntries.length
        : 0

    const timesUnavailable = ents.filter((e) => e.status === 'unavailable').length

    result.push({ name, timesOrdered, avgOrdered, avgTaken, timesUnavailable })
  }

  return result.sort((a, b) => b.timesOrdered - a.timesOrdered)
}

export default function AggregatesPage() {
  const navigate = useNavigate()

  const sessions = useLiveQuery(() => db.sessions.toArray())
  const orders = useLiveQuery(() => db.orders.toArray())
  const orderLines = useLiveQuery(() => db.order_lines.toArray())
  const entries = useLiveQuery(() => db.checklist_entries.toArray())

  const loading = !sessions || !orders || !orderLines || !entries

  const aggregates = loading
    ? []
    : buildAggregates(sessions, orders, orderLines, entries)

  async function handleExport() {
    if (aggregates.length === 0) {
      toast.info('Нет данных для экспорта')
      return
    }
    try {
      await exportAggregatesExcel(aggregates)
      toast.success('Excel скачан')
    } catch {
      toast.error('Ошибка при экспорте')
    }
  }

  return (
    <div
      className="flex flex-col min-h-dvh"
      style={{ background: 'var(--background)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 pt-safe-top"
        style={{
          height: 56,
          borderBottom: '1px solid var(--border)',
          background: 'var(--background)',
        }}
      >
        <button
          className="flex items-center justify-center rounded-md"
          style={{ width: 40, height: 40, color: 'var(--foreground)' }}
          onClick={() => navigate(-1)}
          aria-label="Назад"
        >
          <ChevronLeft size={20} strokeWidth={1.5} />
        </button>
        <h1 className="flex-1 text-base font-semibold" style={{ color: 'var(--foreground)' }}>
          Агрегаты по товарам
        </h1>
        <button
          className="flex items-center gap-1.5 px-3 rounded-md text-sm font-medium"
          style={{
            height: 36,
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
          }}
          onClick={handleExport}
          disabled={loading || aggregates.length === 0}
          aria-label="Экспорт Excel"
        >
          <Download size={16} strokeWidth={1.5} />
          Excel
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <div
            className="w-5 h-5 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }}
          />
        </div>
      ) : aggregates.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 px-8">
          <p className="text-base text-center" style={{ color: 'var(--muted-foreground)' }}>
            Нет завершённых сессий
          </p>
          <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
            Агрегаты появятся после первого завершённого обхода
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm" style={{ minWidth: 480 }}>
            <thead>
              <tr style={{ background: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                <th
                  className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  Товар
                </th>
                <th
                  className="text-right px-3 py-3 font-semibold text-xs uppercase tracking-wide"
                  style={{ color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}
                >
                  В заявке
                </th>
                <th
                  className="text-right px-3 py-3 font-semibold text-xs uppercase tracking-wide"
                  style={{ color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}
                >
                  Ср. пачки
                </th>
                <th
                  className="text-right px-3 py-3 font-semibold text-xs uppercase tracking-wide"
                  style={{ color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}
                >
                  Взяли
                </th>
                <th
                  className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide"
                  style={{ color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}
                >
                  Не было
                </th>
              </tr>
            </thead>
            <tbody>
              {aggregates.map((a, i) => (
                <tr
                  key={a.name}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: i % 2 === 0 ? 'var(--background)' : 'var(--muted)',
                  }}
                >
                  <td
                    className="px-4 py-3 font-medium"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {a.name}
                  </td>
                  <td
                    className="px-3 py-3 text-right tabular-nums"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {a.timesOrdered}
                  </td>
                  <td
                    className="px-3 py-3 text-right tabular-nums"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {a.avgOrdered.toFixed(1)}
                  </td>
                  <td
                    className="px-3 py-3 text-right tabular-nums"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {a.avgTaken > 0 ? a.avgTaken.toFixed(1) : '—'}
                  </td>
                  <td
                    className="px-4 py-3 text-right tabular-nums"
                    style={{
                      color: a.timesUnavailable > 0 ? '#EF4444' : 'var(--muted-foreground)',
                    }}
                  >
                    {a.timesUnavailable}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
