import { db } from '@/data/db'
import { mutateUpsert } from '@/data/mutate'

export interface SaveStockEntryArgs {
  cellId: string
  sessionId: string
  userId: string
  value: number
}

/**
 * Local-first сохранение остатка. Пишет в Dexie сразу (это читают прогресс обхода
 * и генерация заявки), затем через mutate шлёт в облако. При неудаче/офлайне запись
 * НЕ теряется — уходит в sync_queue. Возвращает 'ok' если облако приняло сразу,
 * 'local' если запись ушла в очередь (досошлётся позже).
 *
 * Схлопывание: одна запись = одна ячейка × обход. Повторное внесение в ту же
 * ячейку в рамках обхода ОБНОВЛЯЕТ существующую запись (upsert по её id), а не
 * плодит новую. Так stock_entries не растёт на каждый тап. Логика «последняя
 * оценка» сохраняется — запись всегда одна и хранит актуальное значение.
 */
export async function saveStockEntry({
  cellId,
  sessionId,
  userId,
  value,
}: SaveStockEntryArgs): Promise<'ok' | 'local'> {
  const existing = await db.stock_entries
    .where('session_id')
    .equals(sessionId)
    .and((e) => e.cell_id === cellId)
    .first()

  const entry = {
    id: existing?.id ?? crypto.randomUUID(),
    cell_id: cellId,
    session_id: sessionId,
    user_id: userId,
    value,
    created_at: new Date().toISOString(),
  }
  const result = await mutateUpsert('stock_entries', db.stock_entries, entry)
  return result === 'ok' ? 'ok' : 'local'
}
