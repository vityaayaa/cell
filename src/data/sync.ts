import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { db } from './db'
import { useAppStore } from './store'

export type { RealtimeChannel }

export async function initialLoad(): Promise<void> {
  const store = useAppStore.getState()
  store.setSyncing(true)

  try {
    const [
      materialsRes, productsRes, shelvesRes, cellsRes,
      sessionsRes, ordersRes, orderLinesRes, checklistRes, stockRes, profilesRes,
    ] = await Promise.all([
      supabase.from('materials').select('*'),
      supabase.from('products').select('*'),
      supabase.from('shelves').select('*'),
      supabase.from('cells').select('*'),
      supabase.from('sessions').select('*'),
      supabase.from('orders').select('*'),
      supabase.from('order_lines').select('*'),
      supabase.from('checklist_entries').select('*'),
      supabase.from('stock_entries').select('*'),
      supabase.from('user_profiles').select('*'),
    ])

    await db.transaction('rw', [
      db.materials, db.products, db.shelves, db.cells,
      db.sessions, db.orders, db.order_lines, db.checklist_entries,
      db.stock_entries, db.user_profiles,
    ], async () => {
      if (materialsRes.data) await db.materials.bulkPut(materialsRes.data)
      if (productsRes.data) await db.products.bulkPut(productsRes.data)
      if (shelvesRes.data) await db.shelves.bulkPut(shelvesRes.data)
      if (cellsRes.data) await db.cells.bulkPut(cellsRes.data)
      if (sessionsRes.data) await db.sessions.bulkPut(sessionsRes.data)
      if (ordersRes.data) await db.orders.bulkPut(ordersRes.data)
      if (orderLinesRes.data) await db.order_lines.bulkPut(orderLinesRes.data)
      if (checklistRes.data) await db.checklist_entries.bulkPut(checklistRes.data)
      if (stockRes.data) await db.stock_entries.bulkPut(stockRes.data)
      if (profilesRes.data) await db.user_profiles.bulkPut(profilesRes.data)
    })
  } finally {
    store.setSyncing(false)
  }
}

export function subscribeToTable(
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChanged: (payload: any) => void,
): RealtimeChannel {
  // Unique channel name per subscriber. supabase.channel(topic) returns the
  // SAME instance for a repeated topic, and calling .on() on an already
  // subscribed channel throws "cannot add postgres_changes callbacks ...
  // after subscribe()". A unique suffix gives each mount its own channel,
  // so overlapping subscribers (e.g. shelf grid + stock-entry dialog) coexist.
  return supabase
    .channel(`public:${table}:${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, onChanged)
    .subscribe()
}

export async function flushQueue(): Promise<void> {
  const store = useAppStore.getState()
  const items = await db.sync_queue.orderBy('created_at').toArray()

  if (items.length === 0) return

  store.setSyncing(true)

  try {
    for (const item of items) {
      try {
        if (item.operation === 'upsert') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase.from(item.table_name as any) as any).upsert(item.payload)
          if (error) throw error
        } else if (item.operation === 'delete') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase.from(item.table_name as any) as any)
            .delete()
            .eq('id', item.record_id)
          if (error) throw error
        }
        await db.sync_queue.delete(item.id)
      } catch {
        await db.sync_queue.update(item.id, { retry_count: item.retry_count + 1 })
      }
    }
  } finally {
    const remaining = await db.sync_queue.count()
    store.setSyncQueueLength(remaining)
    store.setSyncing(false)
  }
}

export async function checkOnline(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false
  try {
    const { error } = await supabase.from('materials').select('id').limit(1)
    return !error
  } catch {
    return false
  }
}
