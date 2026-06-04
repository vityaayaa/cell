import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/data/supabase'
import { db } from '@/data/db'
import type { Cell } from '@/data/db'

export function ShelfSetupPage() {
  const [rows, setRows] = useState(4)
  const [cols, setCols] = useState(6)
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (rows < 1 || cols < 1) return
    setLoading(true)

    try {
      const shelfId = crypto.randomUUID()
      const now = new Date().toISOString()

      const shelf = { id: shelfId, name: 'Стеллаж', rows_count: rows, cols_count: cols, created_at: now, updated_at: now }

      const cells: Cell[] = []
      for (let r = 1; r <= rows; r++) {
        for (let c = 1; c <= cols; c++) {
          cells.push({
            id: crypto.randomUUID(),
            shelf_id: shelfId,
            parent_id: null,
            row_index: r,
            col_index: c,
            split_direction: null,
            is_first_child: null,
            width_mm: null,
            height_mm: null,
            computed_width_mm: 0,
            computed_height_mm: 0,
            product_id: null,
            capacity_override: null,
            rotation_allowed: true,
            needs_review: false,
            created_at: now,
            updated_at: now,
          })
        }
      }

      const { error: shelfError } = await supabase.from('shelves').insert(shelf)
      if (shelfError) throw shelfError

      const { error: cellsError } = await supabase.from('cells').insert(cells)
      if (cellsError) throw cellsError

      await db.transaction('rw', [db.shelves, db.cells], async () => {
        await db.shelves.put(shelf)
        await db.cells.bulkPut(cells)
      })
    } catch {
      toast.error('Не удалось создать стеллаж. Попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 gap-6">
      <div className="text-center">
        <p className="text-lg font-medium" style={{ color: 'var(--foreground)' }}>
          Стеллаж ещё не настроен
        </p>
      </div>

      <div className="w-full max-w-xs flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="rows">Рядов</Label>
          <Input
            id="rows"
            type="number"
            min={1}
            max={26}
            value={rows}
            onChange={e => setRows(Math.max(1, parseInt(e.target.value) || 1))}
            className="text-center text-base"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cols">Столбцов</Label>
          <Input
            id="cols"
            type="number"
            min={1}
            max={99}
            value={cols}
            onChange={e => setCols(Math.max(1, parseInt(e.target.value) || 1))}
            className="text-center text-base"
          />
        </div>

        <Button
          onClick={handleCreate}
          disabled={loading}
          className="h-14 text-base"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          {loading ? 'Создаём...' : 'Создать →'}
        </Button>
      </div>
    </div>
  )
}
