import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router'
import { Settings } from 'lucide-react'
import { BottomNav } from './BottomNav'
import { OfflineIndicator } from './OfflineIndicator'
import { SettingsBottomSheet } from './SettingsBottomSheet'
import { PageTransition } from './PageTransition'
import { useAppStore } from '@/data/store'

export function AppLayout() {
  const navigate = useNavigate()
  const userRole = useAppStore((s) => s.userRole)
  const [sheetOpen, setSheetOpen] = useState(false)

  function handleSettings() {
    if (userRole === 'admin') {
      navigate('/app/settings')
    } else {
      setSheetOpen(true)
    }
  }

  return (
    <div
      className="flex flex-col"
      style={{
        height: '100dvh',
        overflow: 'hidden',
        background: 'var(--background)',
      }}
    >
      <header
        className="flex items-center justify-between px-4 flex-shrink-0"
        style={{
          height: 56,
          background: 'var(--card)',
          borderBottom: '1px solid var(--border)',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <span
          className="text-lg font-bold tracking-tight"
          style={{ color: 'var(--foreground)' }}
        >
          CELL
        </span>
        <div className="flex items-center gap-2">
          <OfflineIndicator />
          <button
            onClick={handleSettings}
            className="flex items-center justify-center rounded-md"
            style={{ minWidth: 44, minHeight: 44 }}
            aria-label="Настройки"
          >
            <Settings
              size={20}
              strokeWidth={1.5}
              style={{ color: 'var(--muted-foreground)' }}
            />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto" style={{ position: 'relative' }}>
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>

      <BottomNav />

      {userRole === 'employee' && (
        <SettingsBottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      )}
    </div>
  )
}
