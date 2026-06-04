import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'

export function useShelfData() {
  const shelf = useLiveQuery(() => db.shelves.toArray().then(s => s[0] ?? null))

  const cells = useLiveQuery(
    () => (shelf ? db.cells.where('shelf_id').equals(shelf.id).toArray() : []),
    [shelf?.id],
  )

  const products = useLiveQuery(() => db.products.toArray())
  const materials = useLiveQuery(() => db.materials.toArray())

  return { shelf, cells: cells ?? [], products: products ?? [], materials: materials ?? [] }
}
