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
  /** Compact rendering for the proportional drill view (no min height / date). */
  dense?: boolean
  /** Selected state for the "equalize selected" mode. */
  selected?: boolean
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

/** Faint mini-diagram of how a cell is split inside (shown on the main grid). */
function SplitMini({ cell, allCells }: { cell: Cell; allCells: Cell[] }) {
  const children = allCells
    .filter(c => c.parent_id === cell.id)
    .sort((a, b) => (a.is_first_child === b.is_first_child ? 0 : a.is_first_child ? -1 : 1))

  if (children.length === 0) {
    return (
      <div
        style={{ width: '100%', height: '100%', border: '1px solid rgba(148,163,184,0.32)' }}
      />
    )
  }

  const isV = cell.split_direction === 'V'
  const r = children[0].split_ratio
  const f = r == null || isNaN(r) ? 0.5 : Math.min(0.92, Math.max(0.08, r))
  return (
    <div
      style={{ display: 'flex', flexDirection: isV ? 'row' : 'column', width: '100%', height: '100%' }}
    >
      {children.map((ch, i) => (
        <div key={ch.id} style={{ flexGrow: i === 0 ? f : 1 - f, flexBasis: 0, minWidth: 0, minHeight: 0 }}>
          <SplitMini cell={ch} allCells={allCells} />
        </div>
      ))}
    </div>
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
  dense = false,
  selected = false,
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

  const leafLabel = product
    ? getProductDisplayName(product)
    : mode === 'edit'
      ? (cell.computed_width_mm > 0 && cell.computed_height_mm > 0 ? 'Назначьте товар' : 'Задайте размеры')
      : '—'

  // Compact card for the proportional drill view — content centered, number
  // top-left, flags top-right.
  if (leaf && dense) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onTap(cell)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(cell) } }}
        className="rounded-lg border w-full h-full cursor-pointer overflow-hidden relative flex items-center justify-center"
        style={{
          background: bgColor,
          borderColor: 'var(--border)',
          padding: 6,
          boxShadow: selected ? 'inset 0 0 0 2px var(--primary)' : undefined,
        }}
      >
        {displayAddress && (
          <span className="absolute" style={{ top: 4, left: 6, fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>
            {displayAddress}
          </span>
        )}
        <div className="absolute" style={{ top: 2, right: 2 }}>
          <FlagArea cell={cell} onFlagTap={() => onFlagTap?.(cell)} capacityMissing={capacityMissing} capacityUnit={capacityUnit} />
        </div>
        <span
          className="font-medium text-center px-1 leading-tight"
          style={{ fontSize: 12, color: product ? 'var(--foreground)' : 'var(--muted-foreground)' }}
        >
          {leafLabel}
        </span>
      </div>
    )
  }

  if (leaf) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onTap(cell)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(cell) } }}
        className="rounded-lg border p-2 flex flex-col justify-between w-full h-full text-left cursor-pointer"
        style={{ background: bgColor, borderColor: 'var(--border)', minHeight: 72 }}
      >
        <div className="flex items-start justify-between gap-1">
          <span className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>
            {displayAddress}
          </span>
          <FlagArea cell={cell} onFlagTap={() => onFlagTap?.(cell)} capacityMissing={capacityMissing} capacityUnit={capacityUnit} />
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

  // Splitted cell
  const progress = sessionId && visitedCellIds
    ? countVisitedLeaves(cell, allCells, visitedCellIds)
    : null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onTap(cell)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(cell) } }}
      className="rounded-lg border p-2 w-full h-full text-left cursor-pointer relative overflow-hidden"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
        minHeight: 72,
      }}
    >
      {/* Faint "x-ray" of how this cell is divided inside */}
      <div className="absolute" style={{ inset: 8 }}>
        <SplitMini cell={cell} allCells={allCells} />
      </div>

      {/* Overlaid label / flags / progress */}
      <div className="relative flex flex-col justify-between h-full" style={{ pointerEvents: 'none' }}>
        <div className="flex items-start justify-between gap-1">
          <span className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>
            {displayAddress}
          </span>
          <FlagArea cell={cell} onFlagTap={() => onFlagTap?.(cell)} />
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
    </div>
  )
}
