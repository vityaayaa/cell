import { db } from '@/data/db'
import { supabase } from '@/data/supabase'

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
  await db.sessions.put(session)
  const { error } = await supabase.from('sessions').insert(session)
  if (error) {
    await db.sessions.delete(session.id)
    throw error
  }
  return session.id
}
