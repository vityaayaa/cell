import { AlertTriangle, RotateCcwSquare, Pencil, ChevronRight } from 'lucide-react'
import type { Cell, Material, Product } from '@/data/db'
import { isLeaf } from '@/domain/bsp'
import { getEffectiveCapacity } from '@/domain/capacity'
import type { ProductDimensions } from '@/domain/capacity'
import { toastInfo } from '@/lib/toast'
import { packs } from '@/lib/plural'
import {
  getRootAddress,
  hexToRgba,
  getProductDisplayName,
  getMaterialForProduct,
  getLeafMaterials,
  countVisitedLeaves,
} from './cellUtils'

export interface CellCardProps {
  cell: Cell
  allCells: Cell[]
  products: Product[]
  materials: Material[]
  mode: 'edit' | 'view'
  address?: string
  sessionId?: string
  visitedCellIds?: Set<string>
  lastEntryDate?: string | null
  onTap: (cell: Cell) => void
  onFlagTap?: (cell: Cell) => void
}

function FlagArea({
  cell,
  onFlagTap,
  capacityMissing,
  capacityUnit,
}: {
  cell: Cell
  onFlagTap?: () => void
  capacityMissing?: boolean
  capacityUnit?: string
}) {
  // Each flag is a 32x32 tap target (padding) with a compensating negative
  // margin so the compact cell layout doesn't grow.
  const flagBtnClass =
    'flex items-center justify-center -m-[9px] p-[9px]'
  return (
    <div className="flex items-center gap-0.5 flex-shrink-0" style={{ minWidth: 18, minHeight: 18 }}>
      {cell.needs_review && (
        <button
          type="button"
          className={flagBtnClass}
          onClick={e => { e.stopPropagation(); onFlagTap?.() }}
          aria-label="Нужна проверка"
        >
          <AlertTriangle size={14} color="#F59E0B" />
        </button>
      )}
      {capacityMissing && (
        <button
          type="button"
          className={flagBtnClass}
          onClick={e => { e.stopPropagation(); toastInfo(`Вместимость не задана${capacityUnit ? ` (${capacityUnit})` : ''}. Откройте настройки ячейки и укажите вручную.`) }}
          aria-label="Вместимость не задана"
        >
          <AlertTriangle size={14} color="#EF4444" />
        </button>
      )}
      {!cell.rotation_allowed && (
        <button
          type="button"
          className={flagBtnClass}
          onClick={e => { e.stopPropagation(); toastInfo('Поворот товара запрещён для этой ячейки.') }}
          aria-label="Поворот запрещён"
        >
          <RotateCcwSquare size={13} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
        </button>
      )}
      {cell.capacity_override != null && (
        <button
          type="button"
          className={flagBtnClass}
          onClick={e => { e.stopPropagation(); toastInfo(`Вместимость задана вручную: ${capacityUnit === 'пачки' ? packs(cell.capacity_override!) : `${cell.capacity_override} шт`}.`) }}
          aria-label="Вместимость переопределена"
        >
          <Pencil size={13} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
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

export function CellCard({
  cell,
  allCells,
  products,
  materials,
  mode,
  address,
  sessionId,
  visitedCellIds,
  lastEntryDate,
  onTap,
  onFlagTap,
}: CellCardProps) {
  const leaf = isLeaf(cell.id, allCells)
  const displayAddress = address ?? getRootAddress(cell)

  const product = leaf ? products.find(p => p.id === cell.product_id) : undefined
  const material = getMaterialForProduct(product, materials)

  const capacityMissing = (() => {
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
  })()

  const capacityUnit = product
    ? product.type === 'unit'
      ? 'шт'
      : 'пачки'
    : undefined

  const bgColor = leaf && material
    ? hexToRgba(material.color, 0.1)
    : leaf
    ? 'var(--muted)'
    : 'var(--card)'

  if (leaf) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onTap(cell)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(cell) } }}
        className="rounded-lg border p-2 flex flex-col justify-between w-full h-full text-left cursor-pointer"
        style={{
          background: bgColor,
          borderColor: 'var(--border)',
          minHeight: 72,
        }}
      >
        <div className="flex items-start justify-between gap-1">
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {displayAddress}
          </span>
          <FlagArea cell={cell} onFlagTap={() => onFlagTap?.(cell)} capacityMissing={capacityMissing} capacityUnit={capacityUnit} />
        </div>

        <span
          className="text-sm font-medium text-center block px-1 leading-tight"
          style={{ color: product ? 'var(--foreground)' : 'var(--muted-foreground)' }}
        >
          {product
            ? getProductDisplayName(product)
            : mode === 'edit'
              ? (cell.computed_width_mm > 0 && cell.computed_height_mm > 0
                  ? 'Назначьте товар'
                  : 'Задайте размеры')
              : '—'}
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

  // Splitted cell
  const leafMaterials = getLeafMaterials(cell, allCells, products, materials)
  const progress = sessionId && visitedCellIds
    ? countVisitedLeaves(cell, allCells, visitedCellIds)
    : null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onTap(cell)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(cell) } }}
      className="rounded-lg border p-2 flex flex-col justify-between w-full h-full text-left cursor-pointer"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
        minHeight: 72,
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {displayAddress}
        </span>
        <FlagArea cell={cell} onFlagTap={() => onFlagTap?.(cell)} />
      </div>

      <div className="flex flex-col gap-0.5 overflow-hidden">
        {leafMaterials.slice(0, 3).map(({ product: p, material: m }) => (
          <div key={p.id} className="flex items-center gap-1 min-w-0">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: m.color }}
            />
            <span
              className="text-xs truncate"
              style={{ color: 'var(--foreground)' }}
            >
              {getProductDisplayName(p)}
            </span>
          </div>
        ))}
        {leafMaterials.length > 3 && (
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            ещё {leafMaterials.length - 3}...
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        {progress != null ? (
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {progress.visited} из {progress.total} ✓
          </span>
        ) : (
          <span />
        )}
        <ChevronRight size={16} style={{ color: 'var(--muted-foreground)' }} />
      </div>
    </div>
  )
}
