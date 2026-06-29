import Dexie, { type EntityTable } from 'dexie'
import type { Tables } from './database.types'

export type Material = Tables<'materials'>
export type Group = Tables<'groups'>
export type Product = Tables<'products'>
export type Shelf = Tables<'shelves'>
export type Cell = Tables<'cells'>
export type UserProfile = Tables<'user_profiles'>
export type Session = Tables<'sessions'>
export type StockEntry = Tables<'stock_entries'>
export type Order = Tables<'orders'>
export type OrderLine = Tables<'order_lines'>
export type ChecklistEntry = Tables<'checklist_entries'>
export type AuditLog = Tables<'audit_log'>

export interface SyncQueueItem {
  id: string
  table_name: string
  record_id: string
  operation: 'upsert' | 'delete'
  payload: object
  created_at: string
  retry_count: number
}

export const db = new Dexie('CellDB') as Dexie & {
  materials: EntityTable<Material, 'id'>
  groups: EntityTable<Group, 'id'>
  products: EntityTable<Product, 'id'>
  shelves: EntityTable<Shelf, 'id'>
  cells: EntityTable<Cell, 'id'>
  user_profiles: EntityTable<UserProfile, 'id'>
  sessions: EntityTable<Session, 'id'>
  stock_entries: EntityTable<StockEntry, 'id'>
  orders: EntityTable<Order, 'id'>
  order_lines: EntityTable<OrderLine, 'id'>
  checklist_entries: EntityTable<ChecklistEntry, 'id'>
  sync_queue: EntityTable<SyncQueueItem, 'id'>
  audit_log: EntityTable<AuditLog, 'id'>
}

db.version(1).stores({
  materials: '&id, name, updated_at',
  products: '&id, material_id, type, updated_at',
  shelves: '&id, updated_at',
  cells: '&id, shelf_id, parent_id, product_id, updated_at',
  user_profiles: '&id, role',
  sessions: '&id, user_id, status, updated_at',
  stock_entries: '&id, session_id, cell_id, created_at',
  orders: '&id, session_id, updated_at',
  order_lines: '&id, order_id, product_id, updated_at',
  checklist_entries: '&id, order_line_id, updated_at',
  sync_queue: '&id, created_at',
})

db.version(2).stores({
  audit_log: '&id, actor_id, entity_type, event_type, created_at',
})

db.version(3).stores({
  sessions: '&id, user_id, status, updated_at, started_at',
})

// v4 — flat shelf model (N-ary equal splits via child_index; dropped
// is_first_child / split_ratio). Purge shelf-dependent caches so stale rows
// from the old binary model don't linger; they re-sync from Supabase.
db.version(4).upgrade(async (tx) => {
  await Promise.all([
    tx.table('cells').clear(),
    tx.table('shelves').clear(),
    tx.table('stock_entries').clear(),
    tx.table('sessions').clear(),
    tx.table('orders').clear(),
    tx.table('order_lines').clear(),
    tx.table('checklist_entries').clear(),
  ])
})

// v5 — product groups (вид товара). New `groups` table; products gain a
// mandatory group_id. Clear products so stale rows without a group_id don't
// linger; they re-sync from Supabase on next load.
db.version(5)
  .stores({
    groups: '&id, name, updated_at',
    products: '&id, material_id, group_id, type, updated_at',
  })
  .upgrade(async (tx) => {
    await tx.table('products').clear()
  })
