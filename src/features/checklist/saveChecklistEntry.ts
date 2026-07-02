import { db } from '@/data/db'
import type { ChecklistEntry } from '@/data/db'
import { mutateUpdate } from '@/data/mutate'
import { toast } from 'sonner'
import { updateSessionStatus } from '@/features/order/updateSessionStatus'

type EntryUpdate = Pick<ChecklistEntry, 'status' | 'actual_packs'>

export async function saveChecklistEntry(
  entryId: string,
  update: EntryUpdate,
  sessionId: string,
): Promise<void> {
  const prev = await db.checklist_entries.get(entryId)
  if (!prev) return

  const now = new Date().toISOString()
  const updated: ChecklistEntry = { ...prev, ...update, updated_at: now }
  await db.checklist_entries.put(updated)

  // При офлайне запись не теряется — уходит в очередь. Красную ошибку не
  // показываем: данные сохранены.
  await mutateUpdate('checklist_entries', db.checklist_entries, updated)

  await checkSessionCompletion(sessionId)
}

async function checkSessionCompletion(sessionId: string): Promise<void> {
  const order = await db.orders.where('session_id').equals(sessionId).first()
  if (!order) return

  const lines = await db.order_lines.where('order_id').equals(order.id).toArray()
  const entries = await db.checklist_entries
    .where('order_line_id')
    .anyOf(lines.map((l) => l.id))
    .toArray()

  const allDone =
    entries.length > 0 &&
    entries.every((e) => e.status === 'done' || e.status === 'unavailable')

  if (allDone) {
    await updateSessionStatus(sessionId, 'completed')
    toast.success('✓ Все позиции отмечены')
  }
}
