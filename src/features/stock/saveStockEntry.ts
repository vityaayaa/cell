import { db } from '@/data/db'
import { supabase } from '@/data/supabase'

export interface SaveStockEntryArgs {
  cellId: string
  sessionId: string
  userId: string
  value: number
}

/**
 * Local-first stock save. Writes to Dexie immediately (this is what sweep
 * progress + order generation read), then races a Supabase insert against an 8s
 * timeout. Returns 'ok' when the cloud write succeeds, 'local' when it fails or
 * times out — the local entry is kept either way so the sweep is never blocked.
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
  await db.stock_entries.put(entry)
  try {
    const result = (await Promise.race([
      supabase.from('stock_entries').insert(entry),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
    ])) as { error: unknown }
    if (result.error) throw result.error
    return 'ok'
  } catch {
    return 'local'
  }
}
