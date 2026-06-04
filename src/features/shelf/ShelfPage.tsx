import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import type { Cell } from '@/data/db'
import { db } from '@/data/db'
import { supabase } from '@/data/supabase'
import { subscribeToTable } from '@/data/sync'
import { useAppStore } from '@/data/store'
import { useShelfData } from './useShelfData'
import { ShelfGrid } from './ShelfGrid'

export default function ShelfPage() {
  const navigate = useNavigate()
  const activeSessionId = useAppStore(s => s.activeSessionId)
  const { shelf, cells, products, materials } = useShelfData()

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

  function handleLeafTap(cell: Cell) {
    navigate(`/app/stock-entry/${cell.id}`)
  }

  if (shelf === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }}
        />
      </div>
    )
  }

  if (!shelf) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
          Стеллаж не настроен. Попросите администратора создать стеллаж.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Stub progress bar — реальные данные придут из I-05 */}
      {activeSessionId && (
        <div
          className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0 text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
        >
          <span>Обход: — из — ✓</span>
          <button
            className="font-medium"
            style={{ color: 'var(--primary)' }}
            onClick={() => toast.info('Функция доступна в I-05')}
          >
            → К заявке
          </button>
        </div>
      )}

      <ShelfGrid
        mode="view"
        shelf={shelf}
        cells={cells}
        products={products}
        materials={materials}
        sessionId={activeSessionId ?? undefined}
        onLeafTap={handleLeafTap}
      />
    </div>
  )
}
