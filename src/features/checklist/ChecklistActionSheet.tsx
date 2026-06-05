import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ChecklistEntry, OrderLine } from '@/data/db'
import { saveChecklistEntry } from './saveChecklistEntry'

interface ChecklistActionSheetProps {
  entry: ChecklistEntry | null
  line: OrderLine | null
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
}

export function ChecklistActionSheet({
  entry,
  line,
  open,
  onOpenChange,
  sessionId,
}: ChecklistActionSheetProps) {
  const [lessOpen, setLessOpen] = useState(false)
  const [lessPacks, setLessPacks] = useState(1)
  const [saving, setSaving] = useState(false)

  if (!entry || !line) return null

  async function handleTakeAll() {
    if (!entry || !line) return
    setSaving(true)
    await saveChecklistEntry(
      entry.id,
      { status: 'done', actual_packs: line.quantity_packs },
      sessionId,
    )
    setSaving(false)
    onOpenChange(false)
  }

  async function handleUnavailable() {
    if (!entry) return
    setSaving(true)
    await saveChecklistEntry(
      entry.id,
      { status: 'unavailable', actual_packs: null },
      sessionId,
    )
    setSaving(false)
    onOpenChange(false)
  }

  function openLess() {
    setLessPacks(line!.quantity_packs)
    setLessOpen(true)
  }

  async function handleConfirmLess() {
    if (!entry) return
    setSaving(true)
    await saveChecklistEntry(
      entry.id,
      { status: 'done', actual_packs: lessPacks },
      sessionId,
    )
    setSaving(false)
    setLessOpen(false)
    onOpenChange(false)
  }

  const title = `${line.product_name} · ${line.quantity_packs} пачек`

  return (
    <>
      {/* Main action dialog */}
      <Dialog open={open && !lessOpen} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-base">{title}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <button
              className="w-full rounded-md font-semibold text-base text-white"
              style={{ height: 56, background: '#10B981' }}
              onClick={handleTakeAll}
              disabled={saving}
            >
              Взял всё
            </button>
            <button
              className="w-full rounded-md font-medium text-base border"
              style={{
                height: 56,
                color: 'var(--foreground)',
                background: 'var(--card)',
                borderColor: 'var(--border)',
              }}
              onClick={openLess}
              disabled={saving}
            >
              Взял меньше...
            </button>
            <button
              className="w-full rounded-md font-medium text-base"
              style={{
                height: 56,
                color: 'var(--muted-foreground)',
                background: 'var(--muted)',
              }}
              onClick={handleUnavailable}
              disabled={saving}
            >
              Нет на складе
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* "Взял меньше" dialog */}
      <Dialog
        open={lessOpen}
        onOpenChange={(o) => { if (!o) setLessOpen(false) }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-base">{line.product_name}</DialogTitle>
          </DialogHeader>

          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Сколько взял?
          </p>

          <div className="flex items-center gap-3">
            <button
              className="flex items-center justify-center rounded-md border text-lg font-medium"
              style={{ width: 44, height: 44, borderColor: 'var(--border)', flexShrink: 0 }}
              onClick={() => setLessPacks((p) => Math.max(1, p - 1))}
              disabled={lessPacks <= 1}
              aria-label="Уменьшить"
            >
              −
            </button>
            <Input
              type="number"
              inputMode="numeric"
              value={lessPacks}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                if (!isNaN(v) && v >= 1 && v <= line.quantity_packs) setLessPacks(v)
              }}
              className="text-center text-base flex-1"
              style={{ fontSize: '16px', height: 44 }}
            />
            <button
              className="flex items-center justify-center rounded-md border text-lg font-medium"
              style={{ width: 44, height: 44, borderColor: 'var(--border)', flexShrink: 0 }}
              onClick={() => setLessPacks((p) => Math.min(line.quantity_packs, p + 1))}
              disabled={lessPacks >= line.quantity_packs}
              aria-label="Увеличить"
            >
              +
            </button>
          </div>

          <Button
            className="w-full"
            style={{ height: 56 }}
            onClick={handleConfirmLess}
            disabled={saving}
          >
            {saving ? '…' : 'Подтвердить'}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
