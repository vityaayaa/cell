import { db } from '@/data/db'
import type { Product } from '@/data/db'
import { mutateInsert, mutateInsertMany } from '@/data/mutate'
import { getEffectiveCapacity } from '@/domain/capacity'
import type { ProductDimensions } from '@/domain/capacity'
import { buildOrderLines } from '@/domain/request'
import type { CellStock } from '@/domain/request'
import { getProductShortName } from '@/features/shelf/cellUtils'
import { updateSessionStatus } from './updateSessionStatus'

function productDimensions(product: Product): ProductDimensions {
  if (product.type === 'unit') {
    return { type: 'unit', width_mm: product.width_mm ?? 0, height_mm: product.height_mm ?? 0 }
  }
  if (product.type === 'round') {
    return { type: 'round', diameter_mm: product.diameter_mm ?? 0 }
  }
  return { type: 'bulk' }
}

export async function generateOrder(sessionId: string): Promise<string> {
  // Collect latest stock entry per cell in this session
  const entries = await db.stock_entries
    .where('session_id')
    .equals(sessionId)
    .sortBy('created_at')

  const latestByCell = new Map<string, (typeof entries)[number]>()
  for (const e of entries) {
    latestByCell.set(e.cell_id, e)
  }

  // Build CellStock array
  const cellStocks: CellStock[] = []
  for (const [cellId, entry] of latestByCell) {
    const cell = await db.cells.get(cellId)
    if (!cell?.product_id || cell.is_disabled) continue
    const product = await db.products.get(cell.product_id)
    if (!product) continue
    const capacity = getEffectiveCapacity(
      { computed_width_mm: cell.computed_width_mm, computed_height_mm: cell.computed_height_mm },
      productDimensions(product),
      { rotation_allowed: cell.rotation_allowed, capacity_override: cell.capacity_override },
    )
    cellStocks.push({
      cell_id: cellId,
      product_id: product.id,
      product_type: product.type,
      pack_size: product.pack_size,
      capacity,
      current_stock: entry.value,
    })
  }

  const orderLines = buildOrderLines(cellStocks)

  const now = new Date().toISOString()
  const orderId = crypto.randomUUID()
  const order = {
    id: orderId,
    session_id: sessionId,
    created_at: now,
    finalized_at: null,
    updated_at: now,
  }

  const lines = await Promise.all(
    orderLines.map(async (l) => {
      const product = await db.products.get(l.product_id)
      const product_name = product ? getProductShortName(product) : 'Неизвестный товар'
      return {
        id: crypto.randomUUID(),
        order_id: orderId,
        product_id: l.product_id,
        product_name,
        quantity_packs: l.quantity_packs,
        quantity_units: l.quantity_units,
        deficit_units: l.deficit_units,
        is_manual: false,
        is_boundary: l.is_boundary,
        created_at: now,
        updated_at: now,
      }
    }),
  )

  // Пишем в Dexie + облако; при офлайне записи уходят в очередь и НЕ теряются.
  // Локальные строки уже есть, поэтому страница заявки отрисуется из Dexie.
  await mutateInsert('orders', db.orders, order)
  await mutateInsertMany('order_lines', db.order_lines, lines)

  await updateSessionStatus(sessionId, 'ordering')

  return orderId
}
