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
      materialsRes, groupsRes, productsRes, shelvesRes, cellsRes,
      sessionsRes, ordersRes, orderLinesRes, checklistRes, stockRes, profilesRes,
      auditRes,
    ] = await Promise.all([
      supabase.from('materials').select('*'),
      supabase.from('groups').select('*'),
      supabase.from('products').select('*'),
      supabase.from('shelves').select('*'),
      supabase.from('cells').select('*'),
      supabase.from('sessions').select('*'),
      supabase.from('orders').select('*'),
      supabase.from('order_lines').select('*'),
      supabase.from('checklist_entries').select('*'),
      supabase.from('stock_entries').select('*'),
      supabase.from('user_profiles').select('*'),
      // Журнал аудита растёт вечно — грузим только последние 500 записей, а не
      // всю таблицу, чтобы не тянуть тысячи строк на телефон при каждом старте.
      supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(500),
    ])

    await db.transaction('rw', [
      db.materials, db.groups, db.products, db.shelves, db.cells,
      db.sessions, db.orders, db.order_lines, db.checklist_entries,
      db.stock_entries, db.user_profiles, db.audit_log,
    ], async () => {
      if (materialsRes.data) await db.materials.bulkPut(materialsRes.data)
      if (groupsRes.data) await db.groups.bulkPut(groupsRes.data)
      if (productsRes.data) await db.products.bulkPut(productsRes.data)
      if (shelvesRes.data) await db.shelves.bulkPut(shelvesRes.data)
      if (cellsRes.data) await db.cells.bulkPut(cellsRes.data)
      if (sessionsRes.data) await db.sessions.bulkPut(sessionsRes.data)
      if (ordersRes.data) await db.orders.bulkPut(ordersRes.data)
      if (orderLinesRes.data) await db.order_lines.bulkPut(orderLinesRes.data)
      if (checklistRes.data) await db.checklist_entries.bulkPut(checklistRes.data)
      if (stockRes.data) await db.stock_entries.bulkPut(stockRes.data)
      if (profilesRes.data) await db.user_profiles.bulkPut(profilesRes.data)
      // Журнал заменяем целиком последними 500 с сервера (а не bulkPut поверх),
      // иначе локально накопленные старые записи никогда не вытеснятся.
      if (auditRes.data) {
        await db.audit_log.clear()
        await db.audit_log.bulkPut(auditRes.data)
      }
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

// Parent-before-child order so a queued child never hits a missing-FK error
// (e.g. order_lines before their order). Lower number = flushed first.
const TABLE_FLUSH_PRIORITY: Record<string, number> = {
  materials: 0,
  groups: 0,
  products: 1,
  shelves: 0,
  cells: 1,
  sessions: 0,
  orders: 1,
  order_lines: 2,
  checklist_entries: 3,
  stock_entries: 1,
}

// A delete that keeps failing is safe to drop (re-deleting a row is a no-op),
// but an upsert carries user data — dropping it loses that data forever. So we
// only ever give up on deletes; upserts stay queued and retry indefinitely.
const MAX_DELETE_RETRIES = 10

// Guard against overlapping runs (a flappy connection fires `online` repeatedly).
let flushing = false

export async function flushQueue(): Promise<void> {
  if (flushing) return
  flushing = true
  const store = useAppStore.getState()
  try {
    const items = await db.sync_queue.orderBy('created_at').toArray()
    if (items.length === 0) return

    // Stable sort: parent tables before child tables, then by created_at, so
    // FK-dependent rows are sent after what they reference.
    items.sort((a, b) => {
      const pa = TABLE_FLUSH_PRIORITY[a.table_name] ?? 9
      const pb = TABLE_FLUSH_PRIORITY[b.table_name] ?? 9
      if (pa !== pb) return pa - pb
      return a.created_at.localeCompare(b.created_at)
    })

    store.setSyncing(true)

    for (const item of items) {
      // Give up only on repeatedly-failing DELETES (safe — re-delete is a no-op).
      // Upserts hold data, so they are never dropped; they keep retrying.
      if (item.operation === 'delete' && item.retry_count >= MAX_DELETE_RETRIES) {
        console.warn('[sync] drop delete after retries', item.table_name, item.record_id)
        await db.sync_queue.delete(item.id)
        continue
      }
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
    flushing = false
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
