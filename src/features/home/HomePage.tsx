import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/data/db'
import { useAppStore } from '@/data/store'
import { startSweep } from '@/features/sessions/startSweep'
import { SessionCard } from './SessionCard'

const RU_MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]}`
}

export default function HomePage() {
  const navigate = useNavigate()
  const { userId, userRole, setActiveSession, setSessionMode } = useAppStore()
  const [starting, setStarting] = useState(false)

  const sessions = useLiveQuery(() => db.sessions.orderBy('started_at').reverse().toArray())
  const profiles = useLiveQuery(() => db.user_profiles.toArray())
  const orders = useLiveQuery(() => db.orders.toArray())
  const orderLines = useLiveQuery(() => db.order_lines.toArray())

  if (!sessions || !profiles || !orders || !orderLines) {
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

  // Build a map: orderId → lineCount
  const orderLineCount = new Map<string, number>()
  for (const line of orderLines) {
    orderLineCount.set(line.order_id, (orderLineCount.get(line.order_id) ?? 0) + 1)
  }
  // Build: sessionId → lineCount
  const sessionLineCount = new Map<string, number>()
  for (const order of orders) {
    const count = orderLineCount.get(order.id) ?? 0
    if (count > 0) sessionLineCount.set(order.session_id, count)
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
    <div className="flex flex-col">
      {/* Active sessions */}
      {(activeSessions.length > 0 || true) && (
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

          {/* Start new sweep button */}
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

          {/* Admin-only actions */}
          {userRole === 'admin' && (
            <div className="flex flex-col gap-2">
              <button
                className="h-10 rounded-md text-sm border text-left px-3"
                style={{ color: 'var(--foreground)', borderColor: 'var(--border)' }}
                onClick={() => navigate('/app/admin/aggregates')}
              >
                Агрегаты по товарам →
              </button>
              <button
                className="h-10 rounded-md text-sm border text-left px-3"
                style={{ color: 'var(--foreground)', borderColor: 'var(--border)' }}
                onClick={() => toast.info('Экспорт Excel — будет в I-07')}
              >
                Экспорт Excel ↓
              </button>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {historySessions.length > 0 && (
        <div className="mt-4">
          <div
            className="px-4 py-2 text-xs font-semibold uppercase tracking-wide"
            style={{
              color: 'var(--muted-foreground)',
              background: 'var(--muted)',
              borderTop: '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            История
          </div>
          {historySessions.map((session) => {
            const isCompleted = session.status === 'completed'
            const lineCount = sessionLineCount.get(session.id)
            return (
              <button
                key={session.id}
                className="w-full flex items-center gap-3 px-4 py-3 border-b text-left"
                style={{ borderColor: 'var(--border)' }}
                onClick={() => navigate(`/app/session/${session.id}`)}
              >
                {isCompleted ? (
                  <CheckCircle2
                    size={16}
                    strokeWidth={1.5}
                    style={{ color: '#10B981', flexShrink: 0 }}
                    aria-hidden
                  />
                ) : (
                  <XCircle
                    size={16}
                    strokeWidth={1.5}
                    style={{ color: 'var(--muted-foreground)', flexShrink: 0 }}
                    aria-hidden
                  />
                )}
                <span
                  className="flex-1 text-sm font-medium"
                  style={{ color: 'var(--foreground)' }}
                >
                  {formatDate(session.started_at)} · {isCompleted ? 'Завершена' : 'Брошена'}
                </span>
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {lineCount != null ? `${lineCount} позиций` : '—'}
                </span>
                <span className="text-sm ml-1" style={{ color: 'var(--muted-foreground)' }}>
                  ›
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div style={{ height: 32 }} />
    </div>
  )
}
