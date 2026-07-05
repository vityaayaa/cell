import { AlertTriangle, RotateCcwSquare, Pencil } from 'lucide-react'
import type { Cell, Material, Product } from '@/data/db'
import { toastInfo } from '@/lib/toast'
import { packs } from '@/lib/plural'
import {
  getRootAddress,
  hexToRgba,
  getProductShortName,
  getMaterialForProduct,
  isCapacityMissing,
} from './cellUtils'

export interface CellCardProps {
  cell: Cell
  allCells: Cell[]
  products: Product[]
  materials: Material[]
  mode: 'edit' | 'view'
  /** Override the label shown top-left (defaults to the base address A1…). */
  address?: string
  sessionId?: string
  visitedCellIds?: Set<string>
  lastEntryDate?: string | null
  /** Compartment inside a grouped base cell: lighter chrome, no address label. */
  bare?: boolean
  /** Outline this cell with the accent (e.g. the sweep's current cell). */
  highlighted?: boolean
  onTap: (cell: Cell) => void
  onFlagTap?: (cell: Cell) => void
}

function FlagArea({
  cell,
  onFlagTap,
  capacityMissing,
  capacityUnit,
  rotationOn,
}: {
  cell: Cell
  onFlagTap?: () => void
  capacityMissing?: boolean
  capacityUnit?: string
  /** Rotation flag shows ONLY when the cell has a rotatable product AND rotation
   *  is turned on. Computed by CellCard (needs product info). */
  rotationOn?: boolean
}) {
  // Each flag is a 34x34 tap target (padding) with a compensating negative
  // margin so the compact cell layout doesn't grow. gap spaces them apart so
  // two adjacent flags aren't hard to hit.
  const flagBtnClass =
    'flex items-center justify-center -m-[9px] p-[9px]'
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0" style={{ minWidth: 18, minHeight: 18 }}>
      {cell.needs_review && (
        <button
          type="button"
          className={flagBtnClass}
          onClick={e => { e.stopPropagation(); onFlagTap?.() }}
          aria-label="Нужна проверка"
        >
          <AlertTriangle size={16} color="#F59E0B" />
        </button>
      )}
      {capacityMissing && (
        <button
          type="button"
          className={flagBtnClass}
          onClick={e => { e.stopPropagation(); toastInfo(`Вместимость не задана${capacityUnit ? ` (${capacityUnit})` : ''}. Откройте настройки ячейки и укажите вручную.`) }}
          aria-label="Вместимость не задана"
        >
          <AlertTriangle size={16} color="#EF4444" />
        </button>
      )}
      {rotationOn && (
        <button
          type="button"
          className={flagBtnClass}
          onClick={e => { e.stopPropagation(); toastInfo('Поворот товара разрешён — повёрнутые на 90° добавляются к вместимости.') }}
          aria-label="Поворот разрешён"
        >
          <RotateCcwSquare size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
        </button>
      )}
      {cell.capacity_override != null && (
        <button
          type="button"
          className={flagBtnClass}
          onClick={e => { e.stopPropagation(); toastInfo(`Вместимость задана вручную: ${capacityUnit === 'пачки' ? packs(cell.capacity_override!) : `${cell.capacity_override} шт`}.`) }}
          aria-label="Вместимость переопределена"
        >
          <Pencil size={15} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
        </button>
      )}
    </div>
  )
}

function DateLabel({
  cell,
  sessionId,
  visitedCellIds,
  lastEntryDate,
}: {
  cell: Cell
  sessionId?: string
  visitedCellIds?: Set<string>
  lastEntryDate?: string | null
}) {
  if (sessionId && visitedCellIds?.has(cell.id)) {
    return (
      <span className="text-xs" style={{ color: '#10B981' }}>
        ✓ Внесено сегодня
      </span>
    )
  }
  if (lastEntryDate) {
    return (
      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
        {lastEntryDate}
      </span>
    )
  }
  return (
    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
      Не вносилось
    </span>
  )
}

/** Leaf cell card. Split nodes are laid out by ShelfGrid, never reach here. */
export function CellCard({
  cell,
  products,
  materials,
  mode,
  address,
  sessionId,
  visitedCellIds,
  lastEntryDate,
  bare = false,
  highlighted = false,
  onTap,
  onFlagTap,
}: CellCardProps) {
  // Only base cells (top of the frame) carry an address; sub-отсеки don't.
  const displayAddress = bare ? '' : address ?? (cell.parent_id === null ? getRootAddress(cell) : '')

  const product = products.find(p => p.id === cell.product_id)
  const material = getMaterialForProduct(product, materials)

  const capacityMissing = isCapacityMissing(cell, product)

  // Rotation flag only when the cell actually has a rotatable product (unit with
  // different width/height) AND rotation is turned on. Without a product — or
  // for a square/round/bulk product — the flag never shows.
  const rotationOn =
    cell.rotation_allowed &&
    product?.type === 'unit' &&
    product.width_mm != null &&
    product.height_mm != null &&
    product.width_mm !== product.height_mm

  const capacityUnit = product
    ? product.type === 'unit'
      ? 'шт'
      : 'пачки'
    : undefined

  const bgColor = material
    ? hexToRgba(material.color, 0.1)
    : 'var(--muted)'

  const leafLabel = product
    ? getProductShortName(product)
    : mode === 'edit'
      ? (cell.computed_width_mm > 0 && cell.computed_height_mm > 0 ? 'Назначьте товар' : 'Задайте размеры')
      : '—'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onTap(cell)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(cell) } }}
      className={`${bare ? 'rounded-md' : 'rounded-lg'} border p-2 flex flex-col justify-between w-full h-full text-left cursor-pointer overflow-hidden`}
      style={{
        background: bgColor,
        borderColor: bare ? 'rgba(148,163,184,0.25)' : 'var(--border)',
        boxShadow: highlighted ? 'inset 0 0 0 2px var(--primary)' : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>
          {displayAddress}
        </span>
        <FlagArea cell={cell} onFlagTap={() => onFlagTap?.(cell)} capacityMissing={capacityMissing} capacityUnit={capacityUnit} rotationOn={rotationOn} />
      </div>

      <span
        className="text-sm font-medium text-center block px-1 leading-tight"
        style={{ color: product ? 'var(--foreground)' : 'var(--muted-foreground)' }}
      >
        {leafLabel}
      </span>

      <DateLabel
        cell={cell}
        sessionId={sessionId}
        visitedCellIds={visitedCellIds}
        lastEntryDate={lastEntryDate}
      />
    </div>
  )
}
