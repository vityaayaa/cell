import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { Cell, Material, Product, Shelf } from '@/data/db'
import { useAppStore } from '@/data/store'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  buildCellAddress,
} from '@/features/stock/StockEntryDialog'
import { ShelfGrid } from './ShelfGrid'
import { SweepProgressBar } from './SweepProgressBar'
import { buildSweepOrder } from './sweepOrder'
import {
  getProductShortName,
} from './cellUtils'
import { RadarStrip } from './sweep/RadarStrip'
import { CurrentCellCard } from './sweep/CurrentCellCard'
import { InputZone } from './sweep/InputZone'

interface SweepViewProps {
  shelf: Shelf
  cells: Cell[]
  products: Product[]
  materials: Material[]
  sessionId: string
  visited: number
  total: number
  visitedCellIds: Set<string>
}

export function SweepView({
  shelf,
  cells,
  products,
  materials,
  sessionId,
  visited,
  total,
  visitedCellIds,
}: SweepViewProps) {
  const userId = useAppStore((s) => s.userId)

  const order = useMemo(() => buildSweepOrder(cells), [cells])

  // currentCellId resumes at the first unvisited cell; if all visited, the first.
  const firstUnvisited = order.find((c) => !visitedCellIds.has(c.id)) ?? order[0]
  const [currentCellId, setCurrentCellId] = useState<string | null>(
    firstUnvisited?.id ?? null,
  )

  // Keep current valid as the order shifts (shelf edits from another device).
  const currentCell =
    order.find((c) => c.id === currentCellId) ?? firstUnvisited ?? null

  const currentIndex = currentCell
    ? order.findIndex((c) => c.id === currentCell.id)
    : -1

  const currentIsBulk =
    products.find((p) => p.id === currentCell?.product_id)?.type === 'bulk'

  const allVisited = order.length > 0 && order.every((c) => visitedCellIds.has(c.id))

  // 1-based position of the next unvisited cell (for "вернуться к обходу → №N").
  const nextUnvisitedIndex = order.findIndex((c) => !visitedCellIds.has(c.id))
  const nextUnvisitedNo = nextUnvisitedIndex >= 0 ? nextUnvisitedIndex + 1 : null
  const resumeId = nextUnvisitedIndex >= 0 ? order[nextUnvisitedIndex].id : null
  // Only offer "вернуться к обходу" when you've wandered off the next cell —
  // otherwise it would just duplicate the ✕ (close) button.
  const showResume = resumeId != null && currentCell?.id !== resumeId

  const [radarOpen, setRadarOpen] = useState(false)

  function goToFirstUnvisited() {
    const next = order.find((c) => !visitedCellIds.has(c.id))
    if (next) setCurrentCellId(next.id)
  }

  function step(delta: number) {
    if (currentIndex < 0) return
    const next = currentIndex + delta
    if (next < 0 || next >= order.length) return
    setCurrentCellId(order[next].id)
  }

  // After a save, advance to the next cell not yet visited (recomputed against a
  // freshly-updated visited set so the just-saved cell is excluded).
  function advanceAfterSave(savedCellId: string) {
    const updatedVisited = new Set(visitedCellIds)
    updatedVisited.add(savedCellId)
    const fromIdx = order.findIndex((c) => c.id === savedCellId)
    // Prefer the next unvisited at or after the saved position, then wrap.
    const after = order.slice(fromIdx + 1).find((c) => !updatedVisited.has(c.id))
    const before = order.find((c) => !updatedVisited.has(c.id))
    const next = after ?? before
    if (next) setCurrentCellId(next.id)
    // If none remain, leave current as-is; the "обход завершён" UI shows.
  }

  if (order.length === 0) {
    return (
      <div className="absolute inset-0 flex flex-col" style={{ background: 'var(--background)' }}>
        <SweepProgressBar visited={visited} total={total} sessionId={sessionId} />
        <div className="flex-1 flex items-center justify-center p-6">
          <p
            className="text-sm text-center"
            style={{ color: 'var(--muted-foreground)' }}
          >
            В стеллаже нет ячеек с назначенными товарами.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: 'var(--background)' }}>
      <SweepProgressBar visited={visited} total={total} sessionId={sessionId} />

      {/* Radar fills the leftover space (and shrinks on small screens) so the
          card + input below always fit without scrolling. */}
      <RadarStrip
        shelf={shelf}
        cells={cells}
        currentCell={currentCell}
        visitedCellIds={visitedCellIds}
        onOpen={() => setRadarOpen(true)}
      />

      {allVisited && (
        <div
          className="mx-4 mt-2 rounded-lg p-2 text-center flex-shrink-0"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <p className="text-sm font-semibold" style={{ color: '#10B981' }}>
            ✓ Обход завершён — перейдите к заявке кнопкой выше
          </p>
        </div>
      )}

      {/* Pieces/round: info card above the numeric input. Bulk: the card is
          hidden — its info lives inside the fill meter, freeing space for the
          radar and letting the meter grow. */}
      {currentCell && !currentIsBulk && (
        <div className="flex-shrink-0">
          <CurrentCellCard
            cell={currentCell}
            cells={cells}
            products={products}
            materials={materials}
            positionNo={currentIndex + 1}
            total={order.length}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            canPrev={currentIndex > 0}
            canNext={currentIndex < order.length - 1}
          />
        </div>
      )}

      {currentCell && (
        <div className="flex-shrink-0">
          <InputZone
            key={currentCell.id}
            cell={currentCell}
            products={products}
            sessionId={sessionId}
            userId={userId}
            address={buildCellAddress(currentCell, cells)}
            productName={(() => {
              const p = products.find((pr) => pr.id === currentCell.product_id)
              return p ? getProductShortName(p) : '—'
            })()}
            positionNo={currentIndex + 1}
            total={order.length}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            canPrev={currentIndex > 0}
            canNext={currentIndex < order.length - 1}
            alreadyVisited={visitedCellIds.has(currentCell.id)}
            onSaved={(cellId) => advanceAfterSave(cellId)}
            onSkip={() => step(1)}
          />
        </div>
      )}

      <Dialog open={radarOpen} onOpenChange={setRadarOpen}>
        <DialogContent
          preventOutsideClose
          showCloseButton={false}
          className="max-w-none w-screen h-[100dvh] sm:max-w-none sm:rounded-none rounded-none p-0 flex flex-col gap-0 top-0 left-0 translate-x-0 translate-y-0"
          style={{ maxWidth: '100vw' }}
        >
          <DialogTitle className="sr-only">Карта стеллажа</DialogTitle>
          <div
            className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
            style={{ borderColor: 'var(--border)' }}
          >
            <button
              onClick={() => setRadarOpen(false)}
              aria-label="Закрыть карту"
              className="flex items-center justify-center rounded-md"
              style={{ width: 44, height: 44 }}
            >
              <X size={22} />
            </button>
            {showResume && (
              <button
                className="btn-primary text-sm font-semibold px-3 rounded-md"
                style={{ height: 44 }}
                onClick={() => {
                  goToFirstUnvisited()
                  setRadarOpen(false)
                }}
              >
                Вернуться к обходу → №{nextUnvisitedNo}
              </button>
            )}
          </div>
          <div className="flex-1 min-h-0">
            <ShelfGrid
              mode="view"
              shelf={shelf}
              cells={cells}
              products={products}
              materials={materials}
              sessionId={sessionId}
              visitedCellIds={visitedCellIds}
              highlightCellId={currentCell?.id}
              centerOnCellId={currentCell?.id}
              zoomable
              onLeafTap={(cell) => {
                setCurrentCellId(cell.id)
                setRadarOpen(false)
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
