import type { Cell, Material, Product } from '@/data/db'

const ROW_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

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

export function getProductDisplayName(product: Product): string {
  if (product.type === 'unit') {
    return `${product.name} ${product.height_mm}×${product.width_mm}×${product.length_mm}`
  }
  if (product.type === 'round') {
    return `${product.name} ⌀${product.diameter_mm}×${product.length_mm}`
  }
  if (product.type === 'bulk' && product.width_mm && product.height_mm && product.length_mm) {
    return `${product.name} ${product.height_mm}×${product.width_mm}×${product.length_mm}`
  }
  return product.name
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

export function getLeafMaterials(
  cell: Cell,
  allCells: Cell[],
  products: Product[],
  materials: Material[],
): { product: Product; material: Material }[] {
  const leaves = getLeafDescendants(cell.id, allCells)
  const result: { product: Product; material: Material }[] = []
  const seen = new Set<string>()

  for (const leaf of leaves) {
    if (!leaf.product_id) continue
    const product = products.find(p => p.id === leaf.product_id)
    if (!product) continue
    const material = materials.find(m => m.id === product.material_id)
    if (!material) continue
    const key = `${product.id}-${material.id}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push({ product, material })
    }
  }

  return result
}

function getLeafDescendants(cellId: string, allCells: Cell[]): Cell[] {
  const children = allCells.filter(c => c.parent_id === cellId)
  if (children.length === 0) {
    const self = allCells.find(c => c.id === cellId)
    return self ? [self] : []
  }
  return children.flatMap(child => getLeafDescendants(child.id, allCells))
}

export function countVisitedLeaves(
  cell: Cell,
  allCells: Cell[],
  visitedCellIds: Set<string>,
): { visited: number; total: number } {
  const leaves = getLeafDescendants(cell.id, allCells)
  const total = leaves.length
  const visited = leaves.filter(l => visitedCellIds.has(l.id)).length
  return { visited, total }
}
