import type { EntityTable } from 'dexie'
import { supabase } from './supabase'
import { db } from './db'
import type { SyncQueueItem } from './db'
import { useAppStore } from './store'

/**
 * Единый хелпер записи: Dexie (оптимистично) + Supabase, а при неудаче/офлайне —
 * НЕ откатываем локальную запись, а ставим её в sync_queue для досылки.
 *
 * Бизнес-правило проекта: один обход в системе за раз, разные роли не правят одни
 * и те же строки → конфликтов нет. Поэтому офлайн простой: неудачную запись не
 * теряем, а досылаем позже (flushQueue при событии online). CRDT/слияния не нужны.
 *
 * Возвращаемый статус:
 *   'ok'     — облако приняло запись сразу;
 *   'queued' — нет связи / ошибка → запись ушла в очередь (данные не потеряны).
 *
 * Любая неудача (сеть, таймаут, даже RLS) трактуется как «в очередь» — так решил
 * пользователь ради простоты. От вечного ретрая мусора защищает лимит retry_count
 * в flushQueue.
 */
export type MutateResult = 'ok' | 'queued'

// Все записи в проекте имеют строковый id (uuid).
interface HasId {
  id: string
}

const TIMEOUT_MS = 8000

// Гонка запроса с таймаутом — как в saveStockEntry: медленная сеть не должна
// подвесить UI, по таймауту уходим в очередь. Supabase-билдер — thenable,
// возвращающий { error }; типизируем результат явно.
function withTimeout(promise: PromiseLike<{ error: unknown }>): Promise<{ error: unknown }> {
  return Promise.race([
    promise as Promise<{ error: unknown }>,
    new Promise<{ error: unknown }>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS),
    ),
  ])
}

// Кладём одну запись в очередь на досылку.
async function enqueue(
  tableName: string,
  operation: SyncQueueItem['operation'],
  recordId: string,
  payload: object,
): Promise<void> {
  const item: SyncQueueItem = {
    id: crypto.randomUUID(),
    table_name: tableName,
    record_id: recordId,
    operation,
    payload,
    created_at: new Date().toISOString(),
    retry_count: 0,
  }
  await db.sync_queue.put(item)
  await refreshQueueLength()
}

async function refreshQueueLength(): Promise<void> {
  const n = await db.sync_queue.count()
  useAppStore.getState().setSyncQueueLength(n)
}

/**
 * upsert одной записи. Пишем в Dexie, пробуем supabase.upsert. При ошибке/таймауте
 * НЕ откатываем Dexie — ставим в очередь (operation 'upsert').
 */
export async function mutateUpsert<T extends HasId>(
  tableName: string,
  dexieTable: EntityTable<T, 'id'>,
  record: T,
): Promise<MutateResult> {
  await dexieTable.put(record)
  try {
    const { error } = await withTimeout(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from(tableName as any) as any).upsert(record),
    )
    if (error) throw error
    return 'ok'
  } catch {
    await enqueue(tableName, 'upsert', record.id, record)
    return 'queued'
  }
}

/**
 * insert одной записи. По надёжности идентично upsert (в очереди мы всё равно
 * досылаем через upsert — повторная досылка не должна падать на дубликате id).
 */
export async function mutateInsert<T extends HasId>(
  tableName: string,
  dexieTable: EntityTable<T, 'id'>,
  record: T,
): Promise<MutateResult> {
  await dexieTable.put(record)
  try {
    const { error } = await withTimeout(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from(tableName as any) as any).insert(record),
    )
    if (error) throw error
    return 'ok'
  } catch {
    // В очередь кладём как upsert: при повторной досылке частично прошедшего
    // bulk не упадём на «duplicate key».
    await enqueue(tableName, 'upsert', record.id, record)
    return 'queued'
  }
}

/**
 * insert массива записей (bulk). Пишем всё в Dexie, пробуем один insert. При
 * неудаче ставим КАЖДУЮ запись в очередь по отдельности (в очереди только
 * поштучные операции — так flushQueue проще и досылка идемпотентна через upsert).
 */
export async function mutateInsertMany<T extends HasId>(
  tableName: string,
  dexieTable: EntityTable<T, 'id'>,
  records: T[],
): Promise<MutateResult> {
  if (records.length === 0) return 'ok'
  await dexieTable.bulkPut(records)
  try {
    const { error } = await withTimeout(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from(tableName as any) as any).insert(records),
    )
    if (error) throw error
    return 'ok'
  } catch {
    for (const r of records) {
      await enqueue(tableName, 'upsert', r.id, r)
    }
    return 'queued'
  }
}

/**
 * upsert массива записей (bulk). Как mutateInsertMany, но и online-путь идёт
 * через upsert — нужно там, где часть строк уже существует (например разбиение
 * ячейки: родитель обновляется, дети создаются).
 */
export async function mutateUpsertMany<T extends HasId>(
  tableName: string,
  dexieTable: EntityTable<T, 'id'>,
  records: T[],
): Promise<MutateResult> {
  if (records.length === 0) return 'ok'
  await dexieTable.bulkPut(records)
  try {
    const { error } = await withTimeout(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from(tableName as any) as any).upsert(records),
    )
    if (error) throw error
    return 'ok'
  } catch {
    for (const r of records) {
      await enqueue(tableName, 'upsert', r.id, r)
    }
    return 'queued'
  }
}

/**
 * Частичное обновление по id. В Dexie кладём merge локально, в облако шлём upsert
 * ПОЛНОЙ записи (нужен весь объект, чтобы досылка через очередь была корректной).
 * Поэтому caller передаёт полную запись `record` (Dexie-строку после изменений).
 */
export async function mutateUpdate<T extends HasId>(
  tableName: string,
  dexieTable: EntityTable<T, 'id'>,
  record: T,
): Promise<MutateResult> {
  // update+upsert семантически совпадают для существующей строки с известным id.
  return mutateUpsert(tableName, dexieTable, record)
}

/**
 * Удаление по id. Удаляем из Dexie, пробуем supabase delete. При неудаче ставим
 * в очередь (operation 'delete', record_id = id).
 */
export async function mutateDelete<T extends HasId>(
  tableName: string,
  dexieTable: EntityTable<T, 'id'>,
  id: string,
): Promise<MutateResult> {
  // id всех таблиц — строковый uuid; Dexie не выводит это из generic-ограничения.
  await dexieTable.delete(id as never)
  try {
    const { error } = await withTimeout(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from(tableName as any) as any).delete().eq('id', id),
    )
    if (error) throw error
    return 'ok'
  } catch {
    await enqueue(tableName, 'delete', id, { id })
    return 'queued'
  }
}
