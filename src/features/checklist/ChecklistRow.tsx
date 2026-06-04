import { Check, X } from 'lucide-react'
import type { ChecklistEntry, OrderLine } from '@/data/db'

interface ChecklistRowProps {
  entry: ChecklistEntry
  line: OrderLine
  onQuickDone: () => void
  onRowTap: () => void
}

function pluralPacks(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 19) return 'пачек'
  if (mod10 === 1) return 'пачка'
  if (mod10 >= 2 && mod10 <= 4) return 'пачки'
  return 'пачек'
}

function packsSubline(packs: number, units: number): string {
  return `${packs} ${pluralPacks(packs)} · ${units} шт`
}

export function ChecklistRow({ entry, line, onQuickDone, onRowTap }: ChecklistRowProps) {
  if (entry.status === 'pending') {
    return (
      <div
        className="flex items-center gap-3 px-4 py-3 border-b"
        style={{ borderColor: 'var(--border)', minHeight: 72 }}
        onClick={onRowTap}
      >
        <div className="flex-1 min-w-0">
          <p className="text-base font-medium leading-tight" style={{ color: 'var(--foreground)' }}>
            {line.product_name}
          </p>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {packsSubline(line.quantity_packs, line.quantity_units)}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onQuickDone()
          }}
          className="flex-shrink-0 px-4 rounded-md font-semibold text-sm"
          style={{
            height: 56,
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            minWidth: 72,
          }}
          aria-label={`Взял ${line.product_name}`}
        >
          Взял
        </button>
      </div>
    )
  }

  if (entry.status === 'done') {
    const actual = entry.actual_packs ?? line.quantity_packs
    const actualLabel =
      actual < line.quantity_packs
        ? `Взял ${actual} из ${line.quantity_packs} пачек`
        : `Взял ${actual} ${pluralPacks(actual)}`

    return (
      <div
        className="flex items-center gap-3 px-4 py-3 border-b"
        style={{
          borderColor: 'var(--border)',
          background: 'rgba(16, 185, 129, 0.08)',
          minHeight: 72,
        }}
        onClick={onRowTap}
        role="button"
        aria-label={`${line.product_name}, ${actualLabel}`}
      >
        <Check
          size={18}
          strokeWidth={2}
          style={{ color: '#10B981', flexShrink: 0 }}
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <p
            className="text-base font-medium leading-tight"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {line.product_name}
          </p>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {packsSubline(line.quantity_packs, line.quantity_units)}
          </p>
        </div>
        <span className="text-sm flex-shrink-0 font-medium" style={{ color: '#10B981' }}>
          {actualLabel}
        </span>
      </div>
    )
  }

  // unavailable
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--muted)',
        minHeight: 72,
      }}
      onClick={onRowTap}
      role="button"
      aria-label={`${line.product_name}, нет на складе`}
    >
      <X
        size={18}
        strokeWidth={2}
        style={{ color: 'var(--muted-foreground)', flexShrink: 0 }}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <p
          className="text-base font-medium leading-tight"
          style={{ color: 'var(--muted-foreground)' }}
        >
          {line.product_name}
        </p>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          {packsSubline(line.quantity_packs, line.quantity_units)}
        </p>
      </div>
      <span className="text-sm flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
        Нет на складе
      </span>
    </div>
  )
}
