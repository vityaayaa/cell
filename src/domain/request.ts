import type { ProductType } from './capacity'

export interface CellStock {
  cell_id: string
  product_id: string
  product_type: ProductType
  pack_size: number
  capacity: number      // unit/round: штуки; bulk: пачки
  current_stock: number // unit/round: штуки; bulk: пачки
}

export interface OrderLineInput {
  product_id: string
  quantity_packs: number
  quantity_units: number
  deficit_units: number | null // null для bulk
  is_boundary: boolean
  is_manual: false
}

export function calculateDeficitPacks(stock: CellStock): {
  deficit: number
  full_packs: number
  is_boundary: boolean
} {
  if (stock.product_type === 'bulk') {
    const deficit = stock.capacity - stock.current_stock
    return { deficit, full_packs: deficit, is_boundary: false }
  }

  const deficit = stock.capacity - stock.current_stock
  const full_packs = Math.floor(deficit / stock.pack_size)
  const is_boundary = full_packs === 0 && deficit > 0
  return { deficit, full_packs, is_boundary }
}

export function aggregateByProduct(cells: CellStock[]): Map<string, CellStock[]> {
  const map = new Map<string, CellStock[]>()
  for (const cell of cells) {
    const group = map.get(cell.product_id) ?? []
    group.push(cell)
    map.set(cell.product_id, group)
  }
  return map
}

export function buildOrderLines(cells: CellStock[]): OrderLineInput[] {
  const groups = aggregateByProduct(cells)
  const nonBoundary: OrderLineInput[] = []
  const boundary: OrderLineInput[] = []

  for (const [productId, group] of groups) {
    const first = group[0]
    const isBulk = first.product_type === 'bulk'

    const totalDeficit = group.reduce(
      (sum, c) => sum + (c.capacity - c.current_stock),
      0,
    )

    if (totalDeficit <= 0) continue

    if (isBulk) {
      if (totalDeficit === 0) continue
      nonBoundary.push({
        product_id: productId,
        quantity_packs: totalDeficit,
        quantity_units: totalDeficit * first.pack_size,
        deficit_units: null,
        is_boundary: false,
        is_manual: false,
      })
      continue
    }

    const full_packs = Math.floor(totalDeficit / first.pack_size)
    const is_boundary = full_packs === 0 && totalDeficit > 0

    const line: OrderLineInput = {
      product_id: productId,
      quantity_packs: full_packs,
      quantity_units: full_packs * first.pack_size,
      deficit_units: totalDeficit,
      is_boundary,
      is_manual: false,
    }

    if (full_packs >= 1) {
      nonBoundary.push(line)
    } else if (is_boundary) {
      boundary.push(line)
    }
  }

  return [...nonBoundary, ...boundary]
}
