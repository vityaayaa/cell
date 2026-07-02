import { db } from '@/data/db'
import type { Session } from '@/data/db'
import { mutateUpdate } from '@/data/mutate'

export async function updateSessionStatus(
  sessionId: string,
  status: Session['status'],
): Promise<void> {
  const now = new Date().toISOString()
  const isTerminal = status === 'abandoned' || status === 'completed'

  await db.sessions.update(sessionId, {
    status,
    updated_at: now,
    ...(isTerminal ? { finished_at: now } : {}),
  })

  // Читаем полную строку после локального обновления — в очередь нужен весь
  // объект, чтобы досылка через upsert была корректной.
  const updated = await db.sessions.get(sessionId)
  if (updated) {
    await mutateUpdate('sessions', db.sessions, updated)
  }
}
