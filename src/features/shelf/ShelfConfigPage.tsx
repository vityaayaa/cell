import { useEffect, useRef, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { useAppStore } from '@/data/store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Cell } from '@/data/db'
import { db } from '@/data/db'
import { supabase } from '@/data/supabase'
import { subscribeToTable } from '@/data/sync'
import { mutateUpdate, mutateInsertMany, mutateDelete } from '@/data/mutate'
import { useRegisterHeaderAction } from '@/app/HeaderActionContext'
import { useShelfData } from './useShelfData'
import { ShelfSetupPage } from './ShelfSetupPage'
import { ShelfGrid } from './ShelfGrid'
import { CellActionsSheet } from './CellActionsSheet'
import { CellSettingsSheet } from './CellSettingsSheet'
import { NeedsReviewDialog } from './NeedsReviewDialog'
import { getRootAddress, isCapacityMissing } from './cellUtils'

export default function ShelfConfigPage() {
  const { shelf, cells, products, materials } = useShelfData()
  const [selectedCell, setSelectedCell] = useState<Cell | null>(null)
  const [settingsCell, setSettingsCell] = useState<Cell | null>(null)
  const [reviewCell, setReviewCell] = useState<Cell | null>(null)
  const [shelfActionsOpen, setShelfActionsOpen] = useState(false)
  const [addingRow, setAddingRow] = useState(false)
  const [addingCol, setAddingCol] = useState(false)
  const [confirmRecreate, setConfirmRecreate] = useState(false)
  const [recreating, setRecreating] = useState(false)

  // Restore zoom/pan on mount only — read the stored value ONCE (via a ref) so a
  // fresh onTransformChange never re-inits the grid. Subscribing to the setter
  // alone keeps this page from re-rendering on every pan/zoom tick.
  const setShelfTransform = useAppStore((s) => s.setShelfTransform)
  const initialTransformRef = useRef(useAppStore.getState().shelfTransform)

  // A leaf «has a warning» if it needs review OR its capacity works out to 0
  // (the red flag on the card) — both must feed the badge / stats.
  const productById = new Map(products.map(p => [p.id, p]))
  function leafHasWarning(l: Cell): boolean {
    if (cells.some(x => x.parent_id === l.id)) return false // not a leaf
    return l.needs_review === true || isCapacityMissing(l, productById.get(l.product_id ?? ''))
  }
  const flaggedCount = cells.filter(leafHasWarning).length
  useRegisterHeaderAction({ label: 'Управление', icon: SlidersHorizontal, onClick: () => setShelfActionsOpen(true), badge: flaggedCount })

  useEffect(() => {
    const channel = subscribeToTable('cells', async (payload) => {
      if (payload.eventType === 'DELETE') {
        await db.cells.delete(payload.old.id)
      } else {
        await db.cells.put(payload.new)
      }
    })
    return () => { supabase.removeChannel(channel) }
  }, [])

  if (shelf === undefined) {
    return <div className="flex items-center justify-center h-full"><div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} /></div>
  }

  if (shelf === null || !shelf) {
    return <ShelfSetupPage />
  }

  async function handleAddRow() {
    if (!shelf) return
    setAddingRow(true)
    const newRow = shelf.rows_count + 1
    const now = new Date().toISOString()
    const newCells = Array.from({ length: shelf.cols_count }, (_, i) => ({
      id: crypto.randomUUID(),
      shelf_id: shelf.id,
      parent_id: null as null,
      row_index: newRow,
      col_index: i + 1,
      split_direction: null as null,
      child_index: null as null,
      width_mm: null as null,
      height_mm: null as null,
      computed_width_mm: 0,
      computed_height_mm: 0,
      product_id: null as null,
      capacity_override: null as null,
      rotation_allowed: true,
      needs_review: false,
      created_at: now,
      updated_at: now,
    }))

    // Локальная запись + облако через mutate; при офлайне уходит в очередь.
    await db.shelves.update(shelf.id, { rows_count: newRow, updated_at: now })
    const updatedShelf = await db.shelves.get(shelf.id)
    if (updatedShelf) await mutateUpdate('shelves', db.shelves, updatedShelf)
    await mutateInsertMany('cells', db.cells, newCells)

    setAddingRow(false)
    setShelfActionsOpen(false)
  }

  async function handleAddCol() {
    if (!shelf) return
    setAddingCol(true)
    const newCol = shelf.cols_count + 1
    const now = new Date().toISOString()
    const newCells = Array.from({ length: shelf.rows_count }, (_, i) => ({
      id: crypto.randomUUID(),
      shelf_id: shelf.id,
      parent_id: null as null,
      row_index: i + 1,
      col_index: newCol,
      split_direction: null as null,
      child_index: null as null,
      width_mm: null as null,
      height_mm: null as null,
      computed_width_mm: 0,
      computed_height_mm: 0,
      product_id: null as null,
      capacity_override: null as null,
      rotation_allowed: true,
      needs_review: false,
      created_at: now,
      updated_at: now,
    }))

    await db.shelves.update(shelf.id, { cols_count: newCol, updated_at: now })
    const updatedShelf = await db.shelves.get(shelf.id)
    if (updatedShelf) await mutateUpdate('shelves', db.shelves, updatedShelf)
    await mutateInsertMany('cells', db.cells, newCells)

    setAddingCol(false)
    setShelfActionsOpen(false)
  }

  async function handleRecreate() {
    if (!shelf) return
    setRecreating(true)
    try {
      const cellRows = await db.cells.where('shelf_id').equals(shelf.id).toArray()
      const cellIds = cellRows.map((c) => c.id)
      // Локальный каскад: сервер сам каскадит cells → stock_entries (миграция
      // 005), здесь зеркалим это в Dexie. История заявок/обходов не ссылается на
      // ячейки, поэтому сохраняется.
      await db.transaction('rw', [db.cells, db.stock_entries], async () => {
        await db.cells.where('shelf_id').equals(shelf.id).delete()
        if (cellIds.length) await db.stock_entries.where('cell_id').anyOf(cellIds).delete()
      })
      // Удаление стеллажа через очередь: при офлайне не теряется.
      await mutateDelete('shelves', db.shelves, shelf.id)
      // shelf is now null → ShelfSetupPage renders, asking for the new size.
    } finally {
      setRecreating(false)
      setConfirmRecreate(false)
      setShelfActionsOpen(false)
    }
  }

  function getCellAddress(cell: Cell): string {
    return getRootAddress(cell)
  }

  // Leaf = a cell with no children. The stats count only leaves.
  const leaves = cells.filter(c => !cells.some(x => x.parent_id === c.id))
  const withProduct = leaves.filter(l => l.product_id != null).length
  const empty = leaves.length - withProduct
  // Same «warning» rule as the badge: needs review OR capacity missing.
  const flagged = flaggedCount

  return (
    <div className="flex flex-col h-full">
      <ShelfGrid
        mode="edit"
        shelf={shelf}
        cells={cells}
        products={products}
        materials={materials}
        zoomable
        initialTransform={initialTransformRef.current}
        onTransformChange={setShelfTransform}
        onEditTap={cell => setSelectedCell(cell)}
        onFlagTap={cell => {
          if (cell.needs_review) setReviewCell(cell)
        }}
      />

      {/* Cell actions sheet */}
      <CellActionsSheet
        cell={selectedCell}
        allCells={cells}
        products={products}
        materials={materials}
        address={selectedCell ? getCellAddress(selectedCell) : ''}
        open={selectedCell !== null}
        onClose={() => setSelectedCell(null)}
        onOpenSettings={cell => setSettingsCell(cell)}
      />

      {/* Cell settings sheet */}
      <CellSettingsSheet
        cell={settingsCell}
        allCells={cells}
        products={products}
        address={settingsCell ? getCellAddress(settingsCell) : ''}
        open={settingsCell !== null}
        onClose={() => setSettingsCell(null)}
      />

      {/* Needs review dialog */}
      <NeedsReviewDialog
        cell={reviewCell}
        address={reviewCell ? getCellAddress(reviewCell) : ''}
        open={reviewCell !== null}
        onClose={() => setReviewCell(null)}
        onOpenSettings={cell => setSettingsCell(cell)}
      />

      {/* Shelf actions dialog */}
      <Dialog open={shelfActionsOpen} onOpenChange={v => !v && setShelfActionsOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Управление стеллажом</DialogTitle>
          </DialogHeader>
          <div
            className="grid grid-cols-2 gap-2 mb-1"
          >
            <div
              className="flex items-baseline justify-between rounded-md px-3 py-2"
              style={{ background: 'var(--muted)' }}
            >
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Ячеек</span>
              <span className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{leaves.length}</span>
            </div>
            <div
              className="flex items-baseline justify-between rounded-md px-3 py-2"
              style={{ background: 'var(--muted)' }}
            >
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>С товаром</span>
              <span className="text-base font-semibold" style={{ color: '#10B981' }}>{withProduct}</span>
            </div>
            <div
              className="flex items-baseline justify-between rounded-md px-3 py-2"
              style={{ background: 'var(--muted)' }}
            >
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Пустых</span>
              <span className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{empty}</span>
            </div>
            <div
              className="flex items-baseline justify-between rounded-md px-3 py-2"
              style={{ background: flagged > 0 ? 'color-mix(in oklab, #F59E0B 14%, transparent)' : 'var(--muted)' }}
            >
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                <span aria-hidden>⚠</span> Проверить
              </span>
              <span className="text-base font-semibold" style={{ color: flagged > 0 ? '#F59E0B' : 'var(--muted-foreground)' }}>{flagged}</span>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              className="h-14 justify-start text-base"
              onClick={handleAddRow}
              disabled={addingRow}
            >
              {addingRow ? 'Добавляем...' : '+ Добавить ряд снизу'}
            </Button>
            <Button
              variant="outline"
              className="h-14 justify-start text-base"
              onClick={handleAddCol}
              disabled={addingCol}
            >
              {addingCol ? 'Добавляем...' : '+ Добавить столбец справа'}
            </Button>
            <button
              className="w-full rounded-md font-medium text-base"
              style={{ height: 52, color: 'var(--destructive)', border: '1px solid var(--destructive)', background: 'transparent' }}
              onClick={() => { setShelfActionsOpen(false); setConfirmRecreate(true) }}
            >
              Пересоздать стеллаж
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recreate shelf confirmation */}
      <Dialog open={confirmRecreate} onOpenChange={v => !v && setConfirmRecreate(false)}>
        <DialogContent preventOutsideClose>
          <DialogHeader>
            <DialogTitle>Пересоздать стеллаж?</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Текущий стеллаж и все ячейки будут удалены — дальше зададите новый размер.
            История заявок и обходов сохранится; удалятся только замеры остатков по ячейкам.
          </p>
          <div className="flex gap-3 mt-2">
            <button
              className="flex-1 rounded-md font-medium text-base border"
              style={{ height: 48, color: 'var(--foreground)', borderColor: 'var(--border)', background: 'var(--background)' }}
              onClick={() => setConfirmRecreate(false)}
              disabled={recreating}
            >
              Отмена
            </button>
            <button
              className="flex-1 rounded-md font-semibold text-base"
              style={{ height: 52, background: 'var(--destructive)', color: 'var(--destructive-foreground)' }}
              onClick={handleRecreate}
              disabled={recreating}
            >
              {recreating ? '…' : 'Пересоздать'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
