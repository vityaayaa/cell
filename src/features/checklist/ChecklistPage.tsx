import { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, Printer } from 'lucide-react'
import { db } from '@/data/db'
import type { ChecklistEntry, OrderLine } from '@/data/db'
import { saveChecklistEntry } from './saveChecklistEntry'
import { ChecklistRow } from './ChecklistRow'
import { ChecklistActionSheet } from './ChecklistActionSheet'
import './checklist-print.css'

type EntryWithLine = { entry: ChecklistEntry; line: OrderLine }

function sortPairs(pairs: EntryWithLine[]): EntryWithLine[] {
  return [...pairs].sort((a, b) =>
    a.line.product_name.localeCompare(b.line.product_name, 'ru'),
  )
}

export default function ChecklistPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  const [sheetEntry, setSheetEntry] = useState<ChecklistEntry | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const order = useLiveQuery(
    () =>
      sessionId ? db.orders.where('session_id').equals(sessionId).first() : undefined,
    [sessionId],
  )

  const orderLines = useLiveQuery<OrderLine[]>(
    async () =>
      order ? db.order_lines.where('order_id').equals(order.id).toArray() : [],
    [order?.id],
  )

  const checklistEntries = useLiveQuery<ChecklistEntry[]>(
    async () => {
      const ids = orderLines?.map((l) => l.id) ?? []
      return ids.length > 0
        ? db.checklist_entries.where('order_line_id').anyOf(ids).toArray()
        : []
    },
    [orderLines],
  )

  const lineMap = new Map((orderLines ?? []).map((l) => [l.id, l]))

  const allPairs: EntryWithLine[] = (checklistEntries ?? [])
    .filter((e) => lineMap.has(e.order_line_id))
    .map((e) => ({ entry: e, line: lineMap.get(e.order_line_id)! }))

  const pending = sortPairs(allPairs.filter((p) => p.entry.status === 'pending'))
  const resolved = sortPairs(allPairs.filter((p) => p.entry.status !== 'pending'))

  const total = allPairs.length
  const completedCount = resolved.length
  const progress = total > 0 ? (completedCount / total) * 100 : 0

  const sheetLine = sheetEntry ? (lineMap.get(sheetEntry.order_line_id) ?? null) : null

  function openSheet(entry: ChecklistEntry) {
    setSheetEntry(entry)
    setSheetOpen(true)
  }

  async function handleQuickDone(entry: ChecklistEntry, line: OrderLine) {
    await saveChecklistEntry(
      entry.id,
      { status: 'done', actual_packs: line.quantity_packs },
      sessionId!,
    )
  }

  return (
    <>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 no-print" style={{ background: 'var(--background)' }}>
        {/* Title bar */}
        <div
          className="flex items-center justify-between px-2"
          style={{ height: 56, borderBottom: '1px solid var(--border)' }}
        >
          <button
            onClick={() => navigate('/app/home')}
            className="flex items-center justify-center rounded-md"
            style={{ minWidth: 44, minHeight: 44, color: 'var(--primary)' }}
            aria-label="Назад"
          >
            <ChevronLeft size={22} strokeWidth={1.5} />
          </button>
          <span className="font-semibold text-base" style={{ color: 'var(--foreground)' }}>
            Чеклист
          </span>
          <button
            onClick={() => window.print()}
            className="flex items-center justify-center rounded-md"
            style={{ minWidth: 44, minHeight: 44, color: 'var(--muted-foreground)' }}
            aria-label="Печать"
          >
            <Printer size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              Взято{' '}
              <span style={{ color: 'var(--primary)' }}>{completedCount}</span> из {total}
            </span>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: 'var(--muted)' }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{ width: `${progress}%`, background: 'var(--primary)' }}
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div>
        {total === 0 && (
          <div
            className="flex items-center justify-center"
            style={{ height: 120 }}
          >
            <p style={{ color: 'var(--muted-foreground)' }}>Загрузка...</p>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {pending.map(({ entry, line }) => (
            <motion.div
              key={entry.id}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.15 }}
            >
              <ChecklistRow
                entry={entry}
                line={line}
                onQuickDone={() => handleQuickDone(entry, line)}
                onRowTap={() => openSheet(entry)}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {resolved.length > 0 && (
          <>
            <div
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wide no-print"
              style={{
                color: 'var(--muted-foreground)',
                background: 'var(--muted)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              Взятые и отсутствующие
            </div>
            {resolved.map(({ entry, line }) => (
              <ChecklistRow
                key={entry.id}
                entry={entry}
                line={line}
                onQuickDone={() => {}}
                onRowTap={() => openSheet(entry)}
              />
            ))}
          </>
        )}

        <div style={{ height: 32 }} />
      </div>

      {/* Print-only table */}
      <table className="checklist-print-table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Товар</th>
            <th>Пачек</th>
            <th>Взял ☐</th>
            <th>Нет на складе ☐</th>
            <th>Взял столько: ___</th>
          </tr>
        </thead>
        <tbody>
          {[...pending, ...resolved].map(({ line }) => (
            <tr key={line.id} className="checklist-row">
              <td>{line.product_name}</td>
              <td style={{ textAlign: 'center' }}>{line.quantity_packs}</td>
              <td style={{ textAlign: 'center' }}></td>
              <td style={{ textAlign: 'center' }}></td>
              <td></td>
            </tr>
          ))}
        </tbody>
      </table>

      <ChecklistActionSheet
        entry={sheetEntry}
        line={sheetLine}
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o)
          if (!o) setSheetEntry(null)
        }}
        sessionId={sessionId!}
      />
    </>
  )
}
