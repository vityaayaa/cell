import { AlertTriangle, RotateCcwSquare, Pencil, ChevronRight } from 'lucide-react'
import type { Cell, Material, Product } from '@/data/db'
import { isLeaf } from '@/domain/bsp'
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

function FlagArea({ cell, onFlagTap }: { cell: Cell; onFlagTap?: () => void }) {
  return (
    <div className="flex items-center gap-0.5 flex-shrink-0" style={{ minWidth: 18, minHeight: 18 }}>
      {cell.needs_review && (
        <button
          onClick={e => { e.stopPropagation(); onFlagTap?.() }}
          aria-label="Нужна проверка"
        >
          <AlertTriangle size={14} color="#F59E0B" />
        </button>
      )}
      {!cell.rotation_allowed && (
        <RotateCcwSquare size={13} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
      )}
      {cell.capacity_override != null && (
        <Pencil size={13} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
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

  const bgColor = leaf && material
    ? hexToRgba(material.color, 0.1)
    : leaf
    ? 'var(--muted)'
    : 'var(--card)'

  if (leaf) {
    return (
      <button
        onClick={() => onTap(cell)}
        className="rounded-lg border p-2 flex flex-col justify-between w-full h-full text-left"
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
          <FlagArea cell={cell} onFlagTap={() => onFlagTap?.(cell)} />
        </div>

        <span
          className="text-sm font-medium text-center block px-1 leading-tight"
          style={{ color: product ? 'var(--foreground)' : 'var(--muted-foreground)' }}
        >
          {product ? getProductDisplayName(product) : mode === 'edit' ? 'Задайте размеры' : '—'}
        </span>

        <DateLabel
          cell={cell}
          sessionId={sessionId}
          visitedCellIds={visitedCellIds}
          lastEntryDate={lastEntryDate}
        />
      </button>
    )
  }

  // Splitted cell
  const leafMaterials = getLeafMaterials(cell, allCells, products, materials)
  const progress = sessionId && visitedCellIds
    ? countVisitedLeaves(cell, allCells, visitedCellIds)
    : null

  return (
    <button
      onClick={() => onTap(cell)}
      className="rounded-lg border p-2 flex flex-col justify-between w-full h-full text-left"
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
    </button>
  )
}
