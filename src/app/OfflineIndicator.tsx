import { useEffect, useState } from 'react'
import { useAppStore } from '@/data/store'

export function OfflineIndicator() {
  const isOnline = useAppStore((s) => s.isOnline)
  const isSyncing = useAppStore((s) => s.isSyncing)
  const syncQueueLength = useAppStore((s) => s.syncQueueLength)
  const [showReconnected, setShowReconnected] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true)
    } else if (wasOffline) {
      setShowReconnected(true)
      setWasOffline(false)
      const t = setTimeout(() => setShowReconnected(false), 3000)
      return () => clearTimeout(t)
    }
  }, [isOnline, wasOffline])

  if (isOnline && !isSyncing && !showReconnected) return null

  if (showReconnected) {
    return (
      <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-progress)' }}>
        <span className="inline-block w-2 h-2 rounded-full bg-[var(--color-progress)]" />
        Снова онлайн
      </span>
    )
  }

  if (isSyncing) {
    return (
      <span className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
        <span className="inline-block animate-spin">↻</span>
        Синхронизация...
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
      <span className="inline-block w-2 h-2 rounded-full bg-[var(--muted-foreground)]" />
      {syncQueueLength > 0 ? `Офлайн · ${syncQueueLength} записей` : 'Офлайн'}
    </span>
  )
}
