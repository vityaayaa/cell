import { useEffect, useState } from 'react'
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StockEntryDialog } from '@/features/stock/StockEntryDialog'

export default function ShelfPage() {
  const activeSessionId = useAppStore((s) => s.activeSessionId)
  const userId = useAppStore((s) => s.userId)
  const setActiveSession = useAppStore((s) => s.setActiveSession)
  const setSessionMode = useAppStore((s) => s.setSessionMode)
  const { shelf, cells, products, materials } = useShelfData()
  const { visited, total, visitedCellIds } = useSweepProgress(activeSessionId)
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false)
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null)
  const [startingNewSweep, setStartingNewSweep] = useState(false)
  const [stockCellId, setStockCellId] = useState<string | null>(null)

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
    setStockCellId(cell.id)
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
              className="btn-primary text-sm font-semibold px-3 py-1.5 rounded-md disabled:opacity-50"
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
          subheaderHeight={48}
          onLeafTap={handleLeafTap}
        />
      </div>

      <Dialog open={showAbandonConfirm} onOpenChange={setShowAbandonConfirm}>
        <DialogContent preventOutsideClose>
          <DialogHeader>
            <DialogTitle>Незавершённый обход</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Уже есть активный обход. Начать новый — старый будет отмечен как брошенный. Введённые данные сохранятся.
          </p>
          <div className="flex flex-col gap-3 pt-2">
            <button
              className="w-full rounded-md font-semibold text-base"
              style={{ height: 52, background: 'var(--destructive)', color: 'var(--destructive-foreground)' }}
              onClick={handleAbandonAndStart}
            >
              Начать новый обход
            </button>
            <button
              className="w-full py-2 text-sm text-center rounded-md"
              style={{ color: 'var(--muted-foreground)' }}
              onClick={() => setShowAbandonConfirm(false)}
            >
              Продолжить старый
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <StockEntryDialog
        cellId={stockCellId}
        onClose={() => setStockCellId(null)}
      />
    </>
  )
}
