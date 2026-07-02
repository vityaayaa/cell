import { db } from '@/data/db'
import { mutateInsert } from '@/data/mutate'

export interface SaveStockEntryArgs {
  cellId: string
  sessionId: string
  userId: string
  value: number
}

/**
 * Local-first stock save. Пишет в Dexie сразу (это читают прогресс обхода и
 * генерация заявки), затем через mutateInsert шлёт в облако. При неудаче/офлайне
 * запись НЕ теряется — уходит в sync_queue. Возвращает 'ok' если облако приняло
 * сразу, 'local' если запись ушла в очередь (досошлётся позже).
 */
export async function saveStockEntry({
  cellId,
  sessionId,
  userId,
  value,
}: SaveStockEntryArgs): Promise<'ok' | 'local'> {
  const entry = {
    id: crypto.randomUUID(),
    cell_id: cellId,
    session_id: sessionId,
    user_id: userId,
    value,
    created_at: new Date().toISOString(),
  }
  const result = await mutateInsert('stock_entries', db.stock_entries, entry)
  return result === 'ok' ? 'ok' : 'local'
}
