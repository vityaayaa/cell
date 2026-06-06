import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, XCircle, ChevronDown, Download, BarChart2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/data/db'
import { useAppStore } from '@/data/store'
import { startSweep } from '@/features/sessions/startSweep'
import { exportAggregatesExcel } from '@/features/admin/exportExcel'
import type { ProductAggregate } from '@/features/admin/exportExcel'
import { SessionCard } from './SessionCard'
import { supabase } from '@/data/supabase'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

const RU_MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]}`
}

export default function HomePage() {
  const navigate = useNavigate()
  const { userId, userRole, setActiveSession, setSessionMode } = useAppStore((s) => ({
    userId: s.userId,
    userRole: s.userRole,
    setActiveSession: s.setActiveSession,
    setSessionMode: s.setSessionMode,
  }))
  const [starting, setStarting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const sessions = useLiveQuery(
    () => db.sessions.orderBy('started_at').reverse().toArray(),
    [],
  )
  const profiles = useLiveQuery(() => db.user_profiles.toArray(), [])
  const orders = useLiveQuery(() => db.orders.toArray(), [])
  const orderLines = useLiveQuery(() => db.order_lines.toArray(), [])
  const checklistEntries = useLiveQuery(() => db.checklist_entries.toArray(), [])

  if (!sessions || !profiles || !orders || !orderLines || !checklistEntries) {
    return (
      <div className="flex items-center justify-center" style={{ height: 120 }}>
        <div
          className="w-5 h-5 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }}
        />
      </div>
    )
  }

  const activeSessions = sessions.filter((s) =>
    ['sweeping', 'ordering', 'fulfilling'].includes(s.status),
  )
  const historySessions = sessions.filter((s) =>
    ['completed', 'abandoned'].includes(s.status),
  )

  const hasSweepingOrOrdering = activeSessions.some(
    (s) => s.status === 'sweeping' || s.status === 'ordering',
  )

  const orderLineCount = new Map<string, number>()
  for (const line of orderLines) {
    orderLineCount.set(line.order_id, (orderLineCount.get(line.order_id) ?? 0) + 1)
  }
  const sessionLineCount = new Map<string, number>()
  for (const order of orders) {
    const count = orderLineCount.get(order.id) ?? 0
    if (count > 0) sessionLineCount.set(order.session_id, count)
  }

  async function handleExportExcel() {
    if (exporting || !sessions || !orders || !orderLines || !checklistEntries) return
    setExporting(true)
    try {
      const completedIds = new Set(
        sessions.filter((s) => s.status === 'completed').map((s) => s.id),
      )
      const relevantOrderIds = new Set(
        orders.filter((o) => completedIds.has(o.session_id)).map((o) => o.id),
      )
      const relevantLines = orderLines.filter((l) => relevantOrderIds.has(l.order_id))

      if (relevantLines.length === 0) {
        toast.info('Нет данных для экспорта')
        return
      }

      const lineIdToName = new Map(relevantLines.map((l) => [l.id, l.product_name]))
      const byName = new Map<string, { lines: typeof relevantLines; entries: NonNullable<typeof checklistEntries> }>()
      for (const line of relevantLines) {
        if (!byName.has(line.product_name)) byName.set(line.product_name, { lines: [], entries: [] })
        byName.get(line.product_name)!.lines.push(line)
      }
      for (const entry of checklistEntries) {
        const name = lineIdToName.get(entry.order_line_id)
        if (name && byName.has(name)) byName.get(name)!.entries.push(entry)
      }

      const aggregates: ProductAggregate[] = []
      for (const [name, { lines, entries }] of byName) {
        const timesOrdered = lines.length
        const avgOrdered = lines.reduce((s, l) => s + l.quantity_packs, 0) / lines.length
        const done = entries.filter((e) => e.status === 'done' && e.actual_packs != null)
        const avgTaken = done.length > 0 ? done.reduce((s, e) => s + (e.actual_packs ?? 0), 0) / done.length : 0
        const timesUnavailable = entries.filter((e) => e.status === 'unavailable').length
        aggregates.push({ name, timesOrdered, avgOrdered, avgTaken, timesUnavailable })
      }
      aggregates.sort((a, b) => b.timesOrdered - a.timesOrdered)

      await exportAggregatesExcel(aggregates)
      toast.success('Excel скачан')
    } catch {
      toast.error('Ошибка при экспорте')
    } finally {
      setExporting(false)
    }
  }

  async function handleStartSweep() {
    if (!userId) return
    setStarting(true)
    try {
      const sessionId = await startSweep(userId)
      setActiveSession(sessionId)
      setSessionMode(true)
      navigate('/app/shelf')
    } catch {
      toast.error('Не удалось начать обход. Попробуйте ещё раз.')
      setStarting(false)
    }
  }

  async function handleDeleteSession() {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      await db.sessions.delete(deleteTarget)
      await supabase.from('sessions').delete().eq('id', deleteTarget)
      toast.success('Обход удалён')
    } catch {
      toast.error('Не удалось удалить')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  if (sessions.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-5 px-8"
        style={{ minHeight: 'calc(100dvh - 120px)' }}
      >
        <p className="text-base" style={{ color: 'var(--muted-foreground)' }}>
          Обходов пока нет
        </p>
        <button
          className="h-14 px-8 rounded-md font-semibold text-base"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          onClick={handleStartSweep}
          disabled={starting}
        >
          {starting ? '…' : 'Начать обход →'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col pb-4">
      {/* Active sessions */}
      <div className="px-4 pt-4 flex flex-col gap-3">
        {activeSessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            profiles={profiles}
            userId={userId!}
            userRole={userRole!}
          />
        ))}

        <button
          className="h-12 rounded-md font-semibold text-sm border"
          style={{
            color: hasSweepingOrOrdering ? 'var(--muted-foreground)' : 'var(--primary)',
            borderColor: hasSweepingOrOrdering ? 'var(--border)' : 'var(--primary)',
            background: 'transparent',
            cursor: hasSweepingOrOrdering ? 'not-allowed' : 'pointer',
            opacity: hasSweepingOrOrdering ? 0.5 : 1,
          }}
          onClick={hasSweepingOrOrdering ? undefined : handleStartSweep}
          disabled={starting || hasSweepingOrOrdering}
        >
          {hasSweepingOrOrdering
            ? 'Сначала завершите текущий обход'
            : starting
              ? '…'
              : '+ Начать новый обход'}
        </button>
      </div>

      {/* Admin action buttons */}
      {userRole === 'admin' && (
        <div
          className="flex gap-3 px-4 mt-4"
        >
          <button
            className="flex-1 flex flex-col items-center justify-center gap-1 rounded-xl border py-3"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--card)',
              color: 'var(--foreground)',
              opacity: exporting ? 0.6 : 1,
            }}
            onClick={handleExportExcel}
            disabled={exporting}
          >
            <Download size={20} strokeWidth={1.5} style={{ color: 'var(--primary)' }} />
            <span className="text-xs font-medium">{exporting ? 'Экспорт…' : 'Экспорт'}</span>
          </button>
          <button
            className="flex-1 flex flex-col items-center justify-center gap-1 rounded-xl border py-3"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--card)',
              color: 'var(--foreground)',
            }}
            onClick={() => navigate('/app/admin/aggregates')}
          >
            <BarChart2 size={20} strokeWidth={1.5} style={{ color: 'var(--primary)' }} />
            <span className="text-xs font-medium">Статистика</span>
          </button>
        </div>
      )}

      {/* History section */}
      {historySessions.length > 0 && (
        <div className="mt-4">
          <button
            className="w-full flex items-center justify-between px-4 py-2"
            style={{
              background: 'var(--muted)',
              borderTop: '1px solid var(--border)',
              borderBottom: historyOpen ? 'none' : '1px solid var(--border)',
            }}
            onClick={() => setHistoryOpen((v) => !v)}
          >
            <span
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--muted-foreground)' }}
            >
              История · {historySessions.length}
            </span>
            <ChevronDown
              size={16}
              strokeWidth={1.5}
              style={{
                color: 'var(--muted-foreground)',
                transform: historyOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 200ms',
              }}
            />
          </button>

          {historyOpen && (
            <div style={{ borderBottom: '1px solid var(--border)' }}>
              {historySessions.map((session) => {
                const isCompleted = session.status === 'completed'
                const lineCount = sessionLineCount.get(session.id)
                return (
                  <div
                    key={session.id}
                    className="flex items-center gap-3 px-4 border-b"
                    style={{ borderColor: 'var(--border)', minHeight: 56 }}
                  >
                    <button
                      className="flex items-center gap-3 flex-1 py-3 text-left min-w-0"
                      onClick={() => navigate(`/app/session/${session.id}`)}
                    >
                      {isCompleted ? (
                        <CheckCircle2
                          size={16}
                          strokeWidth={1.5}
                          style={{ color: '#10B981', flexShrink: 0 }}
                        />
                      ) : (
                        <XCircle
                          size={16}
                          strokeWidth={1.5}
                          style={{ color: 'var(--muted-foreground)', flexShrink: 0 }}
                        />
                      )}
                      <span
                        className="flex-1 text-sm font-medium truncate"
                        style={{ color: 'var(--foreground)' }}
                      >
                        {formatDate(session.started_at)} · {isCompleted ? 'Завершён' : 'Брошен'}
                      </span>
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                        {lineCount != null ? `${lineCount} поз.` : '—'}
                      </span>
                    </button>
                    <button
                      className="flex items-center justify-center flex-shrink-0 rounded-md"
                      style={{ width: 36, height: 36, color: 'var(--destructive)' }}
                      onClick={() => setDeleteTarget(session.id)}
                      aria-label="Удалить обход"
                    >
                      <Trash2 size={16} strokeWidth={1.5} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить обход?</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Обход и все связанные данные будут удалены безвозвратно.
          </p>
          <DialogFooter className="flex-col gap-2">
            <button
              className="w-full rounded-md font-semibold text-base text-white"
              style={{ height: 52, background: 'var(--destructive)', opacity: deleting ? 0.7 : 1 }}
              onClick={handleDeleteSession}
              disabled={deleting}
            >
              {deleting ? '…' : 'Удалить'}
            </button>
            <button
              className="w-full rounded-md font-medium text-base border"
              style={{ height: 52, color: 'var(--foreground)', borderColor: 'var(--border)', background: 'var(--background)' }}
              onClick={() => setDeleteTarget(null)}
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
