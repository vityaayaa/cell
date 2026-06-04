import Dexie, { type EntityTable } from 'dexie'
import type { Tables } from './database.types'

export type Material = Tables<'materials'>
export type Product = Tables<'products'>
export type Shelf = Tables<'shelves'>
export type Cell = Tables<'cells'>
export type UserProfile = Tables<'user_profiles'>
export type Session = Tables<'sessions'>
export type StockEntry = Tables<'stock_entries'>
export type Order = Tables<'orders'>
export type OrderLine = Tables<'order_lines'>
export type ChecklistEntry = Tables<'checklist_entries'>

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
