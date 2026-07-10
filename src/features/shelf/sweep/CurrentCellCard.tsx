import type { Cell, Material, Product } from '@/data/db'
import { packs } from '@/lib/plural'
import {
  getProductShortName,
  getMaterialForProduct,
  productUnitLabel,
  buildCellAddress,
  getCapacity,
} from '../cellUtils'

/** Height of the info card on pieces cells. Bulk reuses it to place its
 *  prev/next arrows at the exact same vertical position. */
const CARD_H = 104

export function CurrentCellCard({
  cell,
  cells,
  products,
  materials,
  positionNo,
  total,
}: {
  cell: Cell
  cells: Cell[]
  products: Product[]
  materials: Material[]
  positionNo: number
  total: number
}) {
  const product = products.find((p) => p.id === cell.product_id)
  const material = getMaterialForProduct(product, materials)
  const address = buildCellAddress(cell, cells)
  const capacity = product ? getCapacity(cell, product) : 0
  // 'пачки' only for bulk in slider mode; everything counted in pieces shows 'шт'.
  const capacityLabel = product
    ? product.type === 'bulk'
      ? packs(capacity)
      : `${capacity} ${productUnitLabel(product)}`
    : '—'

  return (
    <div className="px-4 pt-3">
      <div
        className="rounded-lg p-4 flex flex-col justify-center"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', minHeight: CARD_H }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
            №{positionNo} из {total}
          </span>
          <span className="text-lg font-bold" style={{ color: 'var(--primary)' }}>
            {address}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-2">
          {material && (
            <span
              className="inline-block rounded-full flex-shrink-0"
              style={{ width: 12, height: 12, background: material.color }}
            />
          )}
          <span className="text-base font-semibold leading-tight" style={{ color: 'var(--foreground)' }}>
            {product ? getProductShortName(product) : '—'}
          </span>
        </div>

        <p className="text-sm mt-2" style={{ color: 'var(--muted-foreground)' }}>
          Вместимость: {capacityLabel}
        </p>
      </div>
    </div>
  )
}
