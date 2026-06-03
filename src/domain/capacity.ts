export type ProductType = 'unit' | 'round' | 'bulk'

export interface CellDimensions {
  computed_width_mm: number
  computed_height_mm: number
}

export interface UnitProductDimensions {
  type: 'unit'
  width_mm: number
  height_mm: number
}

export interface RoundProductDimensions {
  type: 'round'
  diameter_mm: number
}

export interface BulkProductDimensions {
  type: 'bulk'
}

export type ProductDimensions =
  | UnitProductDimensions
  | RoundProductDimensions
  | BulkProductDimensions

export function calculateBaseCapacity(
  cell: CellDimensions,
  product: UnitProductDimensions,
): number {
  if (
    cell.computed_width_mm === 0 ||
    cell.computed_height_mm === 0 ||
    product.width_mm === 0 ||
    product.height_mm === 0
  ) {
    return 0
  }
  return (
    Math.floor(cell.computed_width_mm / product.width_mm) *
    Math.floor(cell.computed_height_mm / product.height_mm)
  )
}

export function calculateRotatedCapacity(
  cell: CellDimensions,
  product: UnitProductDimensions,
): number {
  const remaining_width = cell.computed_width_mm % product.width_mm
  if (remaining_width < product.height_mm) return 0
  return (
    Math.floor(remaining_width / product.height_mm) *
    Math.floor(cell.computed_height_mm / product.width_mm)
  )
}

export function getEffectiveCapacity(
  cell: CellDimensions,
  product: ProductDimensions,
  options: { rotation_allowed: boolean; capacity_override: number | null },
): number {
  if (options.capacity_override !== null) return options.capacity_override

  if (product.type !== 'unit') return 0

  const base = calculateBaseCapacity(cell, product)
  const rotated =
    options.rotation_allowed && product.width_mm !== product.height_mm
      ? calculateRotatedCapacity(cell, product)
      : 0

  return base + rotated
}
