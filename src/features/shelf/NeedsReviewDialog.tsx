import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Cell } from '@/data/db'
import { db } from '@/data/db'
import { supabase } from '@/data/supabase'

interface NeedsReviewDialogProps {
  cell: Cell | null
  address: string
  open: boolean
  onClose: () => void
  onOpenSettings: (cell: Cell) => void
}

export function NeedsReviewDialog({
  cell,
  address,
  open,
  onClose,
  onOpenSettings,
}: NeedsReviewDialogProps) {
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    if (!cell) return
    setLoading(true)
    const now = new Date().toISOString()
    await db.cells.update(cell.id, { needs_review: false, updated_at: now })
    const { error } = await supabase
      .from('cells')
      .update({ needs_review: false, updated_at: now })
      .eq('id', cell.id)
    if (error) {
      await db.cells.update(cell.id, { needs_review: true, updated_at: now })
      toast.error('Не сохранилось. Попробуйте ещё раз.')
    }
    setLoading(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Требует проверки — {address}</DialogTitle>
        </DialogHeader>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Размеры товара или состав ячейки изменились. Проверьте вместимость ячейки.
        </p>
        <div className="flex gap-3 mt-2">
          <Button
            variant="outline"
            className="flex-1 h-12"
            onClick={() => { onOpenSettings(cell!); onClose() }}
          >
            Открыть настройки
          </Button>
          <Button
            className="btn-primary flex-1 h-14"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? '...' : 'Всё в порядке ✓'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
