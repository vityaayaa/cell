import { ChevronsUpDown } from 'lucide-react'
import { useRef } from 'react'
import { packs } from '@/lib/plural'

/**
 * Vertical "beaker" fill meter for bulk stock entry. Fills bottom-up like the
 * cell itself; tap or drag along its height to set the value. Works directly in
 * units (packs) — value/capacity — and snaps to whole packs in 0..capacity.
 * Cell info (address, product name, capacity) sits inside so no duplicate card
 * is needed above.
 */
export function BulkFillMeter({
  value,
  capacity,
  onChange,
  address,
  productName,
  positionNo,
  total,
}: {
  value: number
  capacity: number
  onChange: (v: number) => void
  address: string
  productName: string
  positionNo: number
  total: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  function valueFromClientY(clientY: number): number {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || rect.height === 0 || capacity <= 0) return 0
    const rel = (clientY - rect.top) / rect.height
    const frac = Math.max(0, Math.min(1, 1 - rel))
    return Math.max(0, Math.min(capacity, Math.round(frac * capacity)))
  }

  function handlePointer(e: React.PointerEvent) {
    if (e.type === 'pointermove' && e.buttons === 0) return
    onChange(valueFromClientY(e.clientY))
  }

  const percent = capacity > 0 ? (value / capacity) * 100 : 0
  const light = percent >= 50

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-xl border overflow-hidden relative select-none"
      style={{
        touchAction: 'none',
        cursor: 'ns-resize',
        background: 'var(--card)',
        borderColor: 'var(--border)',
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        handlePointer(e)
      }}
      onPointerMove={handlePointer}
    >
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: `${percent}%`, background: 'var(--primary)', opacity: 0.85 }}
      />
      {/* Subtle tick at each pack boundary (k/capacity), so a mark sits exactly
          where the fill line lands. capacity−1 internal ticks (4 packs → 3). */}
      {capacity > 1 && capacity <= 20 && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: capacity - 1 }, (_, i) => (
            <div
              key={i}
              className="absolute right-1"
              style={{ bottom: `${((i + 1) / capacity) * 100}%`, width: 6, height: 1, background: 'var(--muted-foreground)', opacity: 0.3 }}
            />
          ))}
        </div>
      )}
      {/* Fill line + drag handle — makes it obvious you drag to fill. */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center"
        style={{ bottom: `calc(${percent}% - 11px)`, height: 22, pointerEvents: 'none' }}
      >
        <div className="absolute left-0 right-0" style={{ top: 10, height: 2, background: 'var(--primary)' }} />
        <div
          className="relative flex items-center justify-center rounded-full"
          style={{ width: 34, height: 22, background: 'var(--primary)', color: 'white' }}
        >
          <ChevronsUpDown size={16} strokeWidth={2.5} />
        </div>
      </div>
      {/* Cell info at the top, the fill value centred below it. */}
      <div className="absolute inset-0 flex flex-col items-center px-3 pt-4 pb-4 pointer-events-none text-center">
        <span className="text-xs" style={{ color: light ? 'rgba(255,255,255,0.85)' : 'var(--muted-foreground)' }}>
          №{positionNo} из {total}
        </span>
        <span
          className="text-base font-semibold leading-tight mt-0.5"
          style={{ color: light ? 'white' : 'var(--foreground)' }}
        >
          {address} · {productName}
        </span>
        <div className="flex-1 flex flex-col items-center justify-center gap-1">
          <span
            className="font-bold leading-none"
            style={{ fontSize: 44, color: light ? 'white' : 'var(--foreground)' }}
          >
            {packs(value)}
          </span>
          <span
            className="text-sm"
            style={{ color: light ? 'rgba(255,255,255,0.85)' : 'var(--muted-foreground)' }}
          >
            из {capacity}
          </span>
        </div>
      </div>
    </div>
  )
}
