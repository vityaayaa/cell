import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { generateOrder } from '@/features/order/generateOrder'

interface SweepProgressBarProps {
  visited: number
  total: number
  sessionId: string
}

export function SweepProgressBar({ visited, total, sessionId }: SweepProgressBarProps) {
  const navigate = useNavigate()
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  async function goToOrder() {
    setLoading(true)
    try {
      await generateOrder(sessionId)
      navigate('/app/order')
    } catch {
      toast.error('Не удалось создать заявку. Попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoToOrderClick() {
    // Confirm whenever the sweep isn't fully done — any un-entered cell won't
    // make it into the order.
    if (total > 0 && visited < total) {
      setShowConfirm(true)
      return
    }
    await goToOrder()
  }

  return (
    <>
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 border-b flex-shrink-0"
        style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
      >
        <span className="text-sm" style={{ color: 'var(--foreground)' }}>
          Обход:{' '}
          <span className="font-medium">
            {visited} из {total}
          </span>{' '}
          <span style={{ color: '#10B981' }}>✓</span>
        </span>
        <button
          className="btn-primary text-sm font-semibold px-3 py-1.5 rounded-md disabled:opacity-50"
          onClick={handleGoToOrderClick}
          disabled={loading || total === 0}
        >
          {loading ? '…' : '→ К заявке'}
        </button>
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Продолжить к заявке?</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Внесено только {visited} из {total} ячеек. Ненаполненные ячейки не войдут в заявку.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="w-full" style={{ height: 48 }} onClick={() => setShowConfirm(false)}>
              Отмена
            </Button>
            <Button
              className="btn-primary w-full"
              style={{ height: 52 }}
              disabled={loading}
              onClick={async () => {
                setShowConfirm(false)
                await goToOrder()
              }}
            >
              {loading ? '…' : 'Продолжить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
