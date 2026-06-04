import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import type { Cell } from '@/data/db'
import { db } from '@/data/db'
import { supabase } from '@/data/supabase'
import { subscribeToTable } from '@/data/sync'
import { useAppStore } from '@/data/store'
import { useShelfData } from './useShelfData'
import { ShelfGrid } from './ShelfGrid'
import { useSweepProgress } from './useSweepProgress'
import { SweepProgressBar } from './SweepProgressBar'
import { startSweep } from '@/features/sessions/startSweep'
import { updateSessionStatus } from '@/features/order/updateSessionStatus'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export default function ShelfPage() {
  const navigate = useNavigate()
  const { activeSessionId, userId, setActiveSession, setSessionMode } = useAppStore((s) => ({
    activeSessionId: s.activeSessionId,
    userId: s.userId,
    setActiveSession: s.setActiveSession,
    setSessionMode: s.setSessionMode,
  }))
  const { shelf, cells, products, materials } = useShelfData()
  const { visited, total, visitedCellIds } = useSweepProgress(activeSessionId)
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false)
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null)
  const [startingNewSweep, setStartingNewSweep] = useState(false)

  // Restore active session from Dexie on mount
  useEffect(() => {
    if (activeSessionId) return
    db.sessions
      .where('status')
      .anyOf(['sweeping', 'ordering'])
      .first()
      .then((session) => {
        if (session) {
          setActiveSession(session.id)
          setSessionMode(true)
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const channel = subscribeToTable('cells', async (payload) => {
      if (payload.eventType === 'DELETE') {
        await db.cells.delete(payload.old.id)
      } else {
        await db.cells.put(payload.new)
      }
    })
    return () => { supabase.removeChannel(channel) }
  }, [])

  function handleLeafTap(cell: Cell) {
    navigate(`/app/stock-entry/${cell.id}`)
  }

  async function handleStartSweep() {
    if (!userId) {
      toast.error('Не авторизован')
      return
    }
    // Check for an existing sweeping session that belongs to someone else
    const existing = await db.sessions
      .where('status')
      .anyOf(['sweeping', 'ordering'])
      .first()
    if (existing && existing.id !== activeSessionId) {
      setPendingSessionId(existing.id)
      setShowAbandonConfirm(true)
      return
    }
    await doStartSweep()
  }

  async function doStartSweep() {
    if (!userId) return
    setStartingNewSweep(true)
    try {
      const sessionId = await startSweep(userId)
      setActiveSession(sessionId)
      setSessionMode(true)
    } catch {
      toast.error('Не удалось начать обход. Попробуйте ещё раз.')
    } finally {
      setStartingNewSweep(false)
    }
  }

  async function handleAbandonAndStart() {
    if (!userId || !pendingSessionId) return
    await updateSessionStatus(pendingSessionId, 'abandoned')
    setShowAbandonConfirm(false)
    setPendingSessionId(null)
    await doStartSweep()
  }

  if (shelf === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }}
        />
      </div>
    )
  }

  if (!shelf) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
          Стеллаж не настроен. Попросите администратора создать стеллаж.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col h-full">
        {activeSessionId ? (
          <SweepProgressBar
            visited={visited}
            total={total}
            sessionId={activeSessionId}
          />
        ) : (
          <div
            className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0"
            style={{ borderColor: 'var(--border)' }}
          >
            <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Нет активного обхода
            </span>
            <button
              className="text-sm font-semibold px-3 py-1.5 rounded-md disabled:opacity-50"
              style={{ color: 'var(--primary-foreground)', background: 'var(--primary)' }}
              onClick={handleStartSweep}
              disabled={startingNewSweep}
            >
              {startingNewSweep ? '…' : 'Начать обход'}
            </button>
          </div>
        )}

        <ShelfGrid
          mode="view"
          shelf={shelf}
          cells={cells}
          products={products}
          materials={materials}
          sessionId={activeSessionId ?? undefined}
          visitedCellIds={visitedCellIds}
          onLeafTap={handleLeafTap}
        />
      </div>

      <Dialog open={showAbandonConfirm} onOpenChange={setShowAbandonConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Незавершённый обход</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Уже есть активный обход. Начать новый — старый будет отмечен как брошенный. Введённые данные сохранятся.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAbandonConfirm(false)}>
              Продолжить старый
            </Button>
            <Button
              variant="destructive"
              onClick={handleAbandonAndStart}
            >
              Начать новый
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
