import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, Printer } from 'lucide-react'
import { db } from '@/data/db'
import type { ChecklistEntry, OrderLine, Product, Material } from '@/data/db'
import { ProductSortBar, sortByMode, type SortMode } from '@/features/catalog/ProductSortBar'
import { ChecklistRow } from './ChecklistRow'
import { ChecklistActionSheet } from './ChecklistActionSheet'
import './checklist-print.css'

type EntryWithLine = { entry: ChecklistEntry; line: OrderLine }

function sortPairsAlpha(pairs: EntryWithLine[]): EntryWithLine[] {
  return [...pairs].sort((a, b) =>
    a.line.product_name.localeCompare(b.line.product_name, 'ru'),
  )
}

export default function ChecklistPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  const [sheetEntry, setSheetEntry] = useState<ChecklistEntry | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [materialId, setMaterialId] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('alpha-asc')

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

  const pendingPairs = allPairs
    .filter((p) => p.entry.status === 'pending')
    .filter(
      (p) =>
        materialId == null ||
        productMap.get(p.line.product_id ?? '')?.material_id === materialId,
    )

  const pending = sortByMode(
    pendingPairs,
    (p) => productMap.get(p.line.product_id ?? ''),
    materialMap,
    sortMode,
  )

  const resolved = sortPairsAlpha(allPairs.filter((p) => p.entry.status !== 'pending'))

  const total = allPairs.length
  const completedCount = resolved.length
  const progress = total > 0 ? (completedCount / total) * 100 : 0

  // Print-form meta
  const printPairs = [...pending, ...resolved]
  const printDate = new Date().toLocaleDateString('ru-RU')
  const totalPacks = printPairs.reduce((s, p) => s + p.line.quantity_packs, 0)

  const sheetLine = sheetEntry ? (lineMap.get(sheetEntry.order_line_id) ?? null) : null

  function openSheet(entry: ChecklistEntry) {
    setSheetEntry(entry)
    setSheetOpen(true)
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

        {/* Sort bar */}
        <ProductSortBar
          materials={materials ?? []}
          materialId={materialId}
          sortMode={sortMode}
          onMaterialId={setMaterialId}
          onSortMode={setSortMode}
        />
      </div>

      {/* List */}
      <div className="no-print">
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
                onRowTap={() => openSheet(entry)}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {resolved.length > 0 && (
          <>
            <div
              className="px-4 py-2 ui-section-title no-print"
              style={{
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
                onRowTap={() => openSheet(entry)}
              />
            ))}
          </>
        )}

        <div style={{ height: 32 }} />
      </div>

      {/* Print-only document header */}
      <div className="checklist-print-header">
        <h1>Заявка на склад</h1>
        <div className="meta">
          <span>Дата печати: {printDate}</span>
          <span>Позиций: {total} · всего пачек: {totalPacks}</span>
        </div>
        <div className="fields">
          <span>Кладовщик (ФИО): _____________________________</span>
          <span>Дата: ______________</span>
          <span>Подпись: ______________</span>
        </div>
        <p className="note">Нужное отметить крестиком (✗)</p>
      </div>

      {/* Print-only table */}
      <table className="checklist-print-table">
        <thead>
          <tr>
            <th className="col-product">Товар</th>
            <th>Пачек</th>
            <th>Взял всё</th>
            <th>Взял, шт/уп</th>
            <th>Нет на складе</th>
          </tr>
        </thead>
        <tbody>
          {printPairs.map(({ line }) => (
            <tr key={line.id} className="checklist-row">
              <td className="col-product">{line.product_name}</td>
              <td className="col-center">{line.quantity_packs}</td>
              <td className="col-center"><span className="box" /></td>
              <td className="col-center"><span className="blank-line" /> шт/уп</td>
              <td className="col-center"><span className="box" /></td>
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
