import { db } from '@/data/db'
import { mutateInsert } from '@/data/mutate'

export async function startSweep(userId: string): Promise<string> {
  const now = new Date().toISOString()
  const session = {
    id: crypto.randomUUID(),
    user_id: userId,
    started_at: now,
    finished_at: null,
    status: 'sweeping' as const,
    created_at: now,
    updated_at: now,
  }
  // Пишем в Dexie + облако; при офлайне уходит в очередь, обход не блокируется.
  await mutateInsert('sessions', db.sessions, session)
  return session.id
}
