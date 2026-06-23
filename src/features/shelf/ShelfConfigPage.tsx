import { useEffect, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
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
import { recomputeDescendants } from '@/domain/bsp'
import type { BspNode } from '@/domain/bsp'
import { subscribeToTable } from '@/data/sync'
import { useRegisterHeaderAction } from '@/app/HeaderActionContext'
import { useShelfData } from './useShelfData'
import { ShelfSetupPage } from './ShelfSetupPage'
import { ShelfGrid } from './ShelfGrid'
import { CellActionsSheet } from './CellActionsSheet'
import { CellSettingsSheet } from './CellSettingsSheet'
import { NeedsReviewDialog } from './NeedsReviewDialog'
import { getRootAddress } from './cellUtils'

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

  useRegisterHeaderAction({ label: 'Управление', icon: SlidersHorizontal, onClick: () => setShelfActionsOpen(true) })

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
      is_first_child: null as null,
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

    const { error: shelfErr } = await supabase
      .from('shelves')
      .update({ rows_count: newRow, updated_at: now })
      .eq('id', shelf.id)
    const { error: cellsErr } = await supabase.from('cells').insert(newCells)

    if (shelfErr || cellsErr) {
      toast.error('Не удалось добавить ряд.')
    } else {
      await db.shelves.update(shelf.id, { rows_count: newRow, updated_at: now })
      await db.cells.bulkPut(newCells)
    }
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
      is_first_child: null as null,
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

    const { error: shelfErr } = await supabase
      .from('shelves')
      .update({ cols_count: newCol, updated_at: now })
      .eq('id', shelf.id)
    const { error: cellsErr } = await supabase.from('cells').insert(newCells)

    if (shelfErr || cellsErr) {
      toast.error('Не удалось добавить столбец.')
    } else {
      await db.shelves.update(shelf.id, { cols_count: newCol, updated_at: now })
      await db.cells.bulkPut(newCells)
    }
    setAddingCol(false)
    setShelfActionsOpen(false)
  }

  async function handleRecreate() {
    if (!shelf) return
    setRecreating(true)
    try {
      // Server delete cascades cells → stock_entries (migration 005). Order /
      // checklist history doesn't reference cells, so it stays.
      const { error } = await supabase.from('shelves').delete().eq('id', shelf.id)
      if (error) throw error
      const cellRows = await db.cells.where('shelf_id').equals(shelf.id).toArray()
      const cellIds = cellRows.map((c) => c.id)
      await db.transaction('rw', [db.shelves, db.cells, db.stock_entries], async () => {
        await db.shelves.delete(shelf.id)
        await db.cells.where('shelf_id').equals(shelf.id).delete()
        if (cellIds.length) await db.stock_entries.where('cell_id').anyOf(cellIds).delete()
      })
      // shelf is now null → ShelfSetupPage renders, asking for the new size.
    } catch {
      toast.error('Не удалось пересоздать. Попробуйте ещё раз.')
    } finally {
      setRecreating(false)
      setConfirmRecreate(false)
      setShelfActionsOpen(false)
    }
  }

  function getCellAddress(cell: Cell): string {
    return getRootAddress(cell)
  }

  async function handleEqualize(drillCell: Cell) {
    function countLeaves(cellId: string): number {
      const ch = cells.filter(c => c.parent_id === cellId)
      if (ch.length === 0) return 1
      return ch.reduce((sum, c) => sum + countLeaves(c.id), 0)
    }

    const overrides = new Map<string, { width_mm?: number; height_mm?: number }>()

    function processNode(cell: Cell, availW: number, availH: number) {
      const ch = cells.filter(c => c.parent_id === cell.id)
      if (ch.length < 2) return
      const first = ch.find(c => c.is_first_child)!
      const second = ch.find(c => !c.is_first_child)!
      const firstLeaves = countLeaves(first.id)
      const total = firstLeaves + countLeaves(second.id)
      if (cell.split_direction === 'V') {
        const firstW = Math.floor((firstLeaves / total) * availW)
        overrides.set(first.id, { width_mm: firstW })
        processNode(first, firstW, availH)
        processNode(second, availW - firstW, availH)
      } else if (cell.split_direction === 'H') {
        const firstH = Math.floor((firstLeaves / total) * availH)
        overrides.set(first.id, { height_mm: firstH })
        processNode(first, availW, firstH)
        processNode(second, availW, availH - firstH)
      }
    }

    processNode(drillCell, drillCell.computed_width_mm, drillCell.computed_height_mm)
    if (overrides.size === 0) return

    function getDescendants(cellId: string): Cell[] {
      const ch = cells.filter(c => c.parent_id === cellId)
      return [...ch, ...ch.flatMap(c => getDescendants(c.id))]
    }

    const subtreeCells = [drillCell, ...getDescendants(drillCell.id)]
    const subtreeWithOverrides = subtreeCells.map(c => {
      const ov = overrides.get(c.id)
      return ov ? { ...c, ...ov } : c
    })

    const nodes: BspNode[] = subtreeWithOverrides.map(c => ({
      id: c.id,
      parent_id: c.parent_id,
      split_direction: c.split_direction,
      is_first_child: c.is_first_child,
      width_mm: c.width_mm,
      height_mm: c.height_mm,
      computed_width_mm: c.computed_width_mm,
      computed_height_mm: c.computed_height_mm,
    }))

    const recomputed = recomputeDescendants(nodes)
    const now = new Date().toISOString()
    const toSave: Cell[] = recomputed.map(node => {
      const orig = subtreeCells.find(c => c.id === node.id)!
      const ov = overrides.get(node.id)
      return { ...orig, ...(ov ?? {}), computed_width_mm: node.computed_width_mm, computed_height_mm: node.computed_height_mm, updated_at: now }
    })

    await db.cells.bulkPut(toSave)
    const { error } = await supabase.from('cells').upsert(toSave)
    if (error) {
      await db.cells.bulkPut(subtreeCells)
      toast.error('Не сохранилось. Попробуйте ещё раз.')
      return
    }
    toast.success('Ячейки выровнены')
  }

  return (
    <div className="flex flex-col h-full">
      <ShelfGrid
        mode="edit"
        shelf={shelf}
        cells={cells}
        products={products}
        materials={materials}
        onEditTap={cell => setSelectedCell(cell)}
        onFlagTap={cell => {
          if (cell.needs_review) setReviewCell(cell)
        }}
        onEqualize={handleEqualize}
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
