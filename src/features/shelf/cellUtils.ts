import type { Cell, Material, Product } from '@/data/db'
import { getEffectiveCapacity, type ProductDimensions } from '@/domain/capacity'

const ROW_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** True when a cell HAS a product but its effective capacity works out to 0 —
 *  i.e. the red «вместимость не задана» flag on the cell card. */
export function isCapacityMissing(cell: Cell, product: Product | undefined): boolean {
  if (!product) return false
  const dims: ProductDimensions =
    product.type === 'unit'
      ? { type: 'unit', width_mm: product.width_mm ?? 0, height_mm: product.height_mm ?? 0 }
      : product.type === 'round'
        ? { type: 'round', diameter_mm: product.diameter_mm ?? 0 }
        : { type: 'bulk' }
  return getEffectiveCapacity(
    { computed_width_mm: cell.computed_width_mm, computed_height_mm: cell.computed_height_mm },
    dims,
    { rotation_allowed: cell.rotation_allowed, capacity_override: cell.capacity_override },
  ) === 0
}

export function getRootAddress(cell: Cell): string {
  const row = cell.row_index != null ? ROW_LETTERS[cell.row_index - 1] ?? cell.row_index : '?'
  const col = cell.col_index ?? '?'
  return `${row}${col}`
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * The name shown to employees on the WORKING screens (shelf, sweep, order,
 * checklist): the manual «отображаемое название» if set, else the full auto
 * name. The catalog always uses getProductDisplayName (the full one).
 */
export function getProductShortName(product: Product): string {
  const custom = product.display_name?.trim()
  return custom ? custom : getProductDisplayName(product)
}

export function getProductDisplayName(product: Product): string {
  if (product.type === 'round') {
    const parts = [
      product.diameter_mm != null ? `⌀${product.diameter_mm}` : null,
      product.length_mm,
    ].filter((v) => v != null)
    return parts.length ? `${product.name} ${parts.join('×')}` : product.name
  }
  // unit & bulk: show whatever dimensions are set, in height×width×length order
  // (skip the missing ones). E.g. плинтус with only width+length → «Плинтус 26×2200».
  const dims = [product.height_mm, product.width_mm, product.length_mm].filter(
    (v): v is number => v != null,
  )
  return dims.length ? `${product.name} ${dims.join('×')}` : product.name
}

/** The unit word for a product's stock value: 'шт' for pieces, 'пачки' for bulk slider. */
export function productUnitLabel(product: Product): string {
  return product.type === 'bulk' ? 'пачки' : 'шт'
}

/**
 * True when stock is entered as a piece count (editable number + ± buttons):
 * 'unit' and 'round' (both counted in pieces). 'bulk' uses a fill slider.
 */
export function isPiecesInput(product: Product): boolean {
  return product.type !== 'bulk'
}

export function getMaterialForProduct(
  product: Product | undefined,
  materials: Material[],
): Material | undefined {
  if (!product) return undefined
  return materials.find(m => m.id === product.material_id)
}
