import type { OrderLine, Product, Material } from '@/data/db'

export function sortOrderLines(
  lines: OrderLine[],
  products: Map<string, Product>,
  materials: Map<string, Material>,
  priorityMaterialId: string | null,
): OrderLine[] {
  return [...lines].sort((a, b) =>
    compareOrderLines(a, b, products, materials, priorityMaterialId),
  )
}

function compareOrderLines(
  a: OrderLine,
  b: OrderLine,
  products: Map<string, Product>,
  materials: Map<string, Material>,
  priorityMaterialId: string | null,
): number {
  const pa = products.get(a.product_id ?? '')
  const pb = products.get(b.product_id ?? '')
  const ma = pa?.material_id ? materials.get(pa.material_id) : undefined
  const mb = pb?.material_id ? materials.get(pb.material_id) : undefined

  // 1. Priority material first
  const aIsPri = priorityMaterialId != null && ma?.id === priorityMaterialId
  const bIsPri = priorityMaterialId != null && mb?.id === priorityMaterialId
  if (aIsPri !== bIsPri) return aIsPri ? -1 : 1

  // 2. Other material names A→Z
  const matCmp = (ma?.name ?? '').localeCompare(mb?.name ?? '', 'ru')
  if (matCmp !== 0) return matCmp

  // 3. Length descending (longest boards first)
  const aLen = pa?.length_mm ?? 0
  const bLen = pb?.length_mm ?? 0
  if (aLen !== bLen) return bLen - aLen

  // 4. Display name A→Z
  return a.product_name.localeCompare(b.product_name, 'ru')
}
