import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'motion/react'
import { RefreshCw, FileText, ClipboardList } from 'lucide-react'
import { db } from '@/data/db'
import type { Session, UserProfile } from '@/data/db'
import { updateSessionStatus } from '@/features/order/updateSessionStatus'
import { useAppStore } from '@/data/store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface SessionCardProps {
  session: Session
  profiles: UserProfile[]
  userId: string
  userRole: 'admin' | 'employee'
}

const RU_MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]}`
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / 3_600_000)
  const minutes = Math.floor((diff % 3_600_000) / 60_000)
  if (hours >= 1) return `${hours} ч назад`
  if (minutes >= 1) return `${minutes} мин назад`
  return 'только что'
}

function PhaseIcon({ status }: { status: Session['status'] }) {
  const style = { color: 'var(--primary)', flexShrink: 0 } as const
  if (status === 'ordering') return <FileText size={18} strokeWidth={1.5} style={style} />
  if (status === 'fulfilling') return <ClipboardList size={18} strokeWidth={1.5} style={style} />
  return <RefreshCw size={18} strokeWidth={1.5} style={style} />
}

function phaseLabel(status: Session['status']): string {
  if (status === 'ordering') return 'Заявка: черновик'
  if (status === 'fulfilling') return 'Чеклист'
  return 'Обход'
}

function continueRoute(session: Session): string {
  switch (session.status) {
    case 'sweeping': return '/app/shelf'
    case 'ordering': return '/app/order'
    case 'fulfilling': return `/app/checklist/${session.id}`
    default: return '/app/home'
  }
}

export function SessionCard({ session, profiles, userId, userRole }: SessionCardProps) {
  const navigate = useNavigate()
  const setActiveSession = useAppStore((s) => s.setActiveSession)
  const setSessionMode = useAppStore((s) => s.setSessionMode)
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const [abandoning, setAbandoning] = useState(false)

  const isOwn = session.user_id === userId
  const owner = profiles.find((p) => p.id === session.user_id)
  const ownerName = owner?.name ?? 'Сотрудник'

  const sweepProgress = useLiveQuery(async () => {
    if (session.status !== 'sweeping') return null
    const [entries, cells] = await Promise.all([
      db.stock_entries.where('session_id').equals(session.id).toArray(),
      db.cells.toArray(),
    ])
    const leafCells = cells.filter((c) => c.product_id != null && !c.is_disabled)
    const visitedIds = new Set(entries.map((e) => e.cell_id))
    return { visited: visitedIds.size, total: leafCells.length }
  }, [session.id, session.status])

  const fulfillingProgress = useLiveQuery(async () => {
    if (session.status !== 'fulfilling') return null
    const order = await db.orders.where('session_id').equals(session.id).first()
    if (!order) return null
    const lines = await db.order_lines.where('order_id').equals(order.id).toArray()
    const entries = await db.checklist_entries
      .where('order_line_id')
      .anyOf(lines.map((l) => l.id))
      .toArray()
    const done = entries.filter((e) => e.status !== 'pending').length
    return { done, total: entries.length }
  }, [session.id, session.status])

  function handleContinue() {
    setActiveSession(session.id)
    setSessionMode(true)
    navigate(continueRoute(session))
  }

  async function handleAbandon() {
    setAbandoning(true)
    await updateSessionStatus(session.id, 'abandoned')
    if (isOwn) {
      setActiveSession(null)
      setSessionMode(false)
    }
    setAbandoning(false)
    setConfirmAbandon(false)
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="rounded-lg p-4"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        {/* Header row */}
        <div className="flex items-center gap-2 mb-2">
          <PhaseIcon status={session.status} />
          <span className="font-semibold text-sm leading-tight" style={{ color: 'var(--foreground)' }}>
            {!isOwn && `${ownerName} · `}
            {phaseLabel(session.status)} · {formatDate(session.started_at)}
          </span>
        </div>

        {/* Progress sub-line */}
        {session.status === 'sweeping' && sweepProgress && (
          <p className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
            {isOwn
              ? `${sweepProgress.visited} из ${sweepProgress.total} `
              : `Начат ${formatRelative(session.started_at)} · ${sweepProgress.visited}/${sweepProgress.total} `}
            <span style={{ color: '#10B981' }}>✓</span>
          </p>
        )}
        {session.status === 'fulfilling' && fulfillingProgress && (
          <p className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
            Взято {fulfillingProgress.done} из {fulfillingProgress.total}
          </p>
        )}
        {session.status === 'ordering' && (
          <div className="mb-3" />
        )}

        {/* Own session buttons */}
        {isOwn && (
          <>
            <button
              className="btn-primary w-full rounded-md font-semibold text-sm"
              style={{
                height: 52,
              }}
              onClick={handleContinue}
            >
              Продолжить →
            </button>
            <button
              className="w-full py-2 mt-1 text-sm text-center"
              style={{ color: 'var(--destructive)' }}
              onClick={() => setConfirmAbandon(true)}
            >
              Отменить
            </button>
          </>
        )}

        {/* Admin can abandon any other's session */}
        {!isOwn && userRole === 'admin' && (
          <button
            className="w-full rounded-md font-medium text-sm border mt-1"
            style={{
              height: 40,
              color: 'var(--destructive)',
              borderColor: 'var(--destructive)',
              background: 'transparent',
            }}
            onClick={() => setConfirmAbandon(true)}
          >
            Завершить ×
          </button>
        )}
      </motion.div>

      <Dialog open={confirmAbandon} onOpenChange={setConfirmAbandon}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отменить сессию?</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Сессия будет отменена. Введённые данные обхода сохранятся.
          </p>
          <div className="flex flex-col gap-3 pt-2">
            <button
              className="w-full rounded-md font-semibold text-base disabled:opacity-50"
              style={{ height: 52, background: 'var(--destructive)', color: 'var(--destructive-foreground)' }}
              onClick={handleAbandon}
              disabled={abandoning}
            >
              {abandoning ? '…' : 'Отменить сессию'}
            </button>
            <button
              className="w-full py-2 text-sm text-center rounded-md"
              style={{ color: 'var(--muted-foreground)' }}
              onClick={() => setConfirmAbandon(false)}
              disabled={abandoning}
            >
              Назад
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
