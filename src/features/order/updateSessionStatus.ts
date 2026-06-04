import { db } from '@/data/db'
import type { Session } from '@/data/db'
import { supabase } from '@/data/supabase'

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

  await supabase
    .from('sessions')
    .update({ status, updated_at: now, ...(isTerminal ? { finished_at: now } : {}) })
    .eq('id', sessionId)
}
