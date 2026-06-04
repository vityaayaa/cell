import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router'
import { useAuth } from './useAuth'
import { initialLoad, flushQueue, checkOnline } from '@/data/sync'
import { useAppStore } from '@/data/store'

export function AppShell() {
  const { session, isLoading } = useAuth()
  const setOnline = useAppStore((s) => s.setOnline)

  useEffect(() => {
    initialLoad()
    navigator.storage?.persist?.()
  }, [])

  useEffect(() => {
    const handleOnline = async () => {
      setOnline(true)
      if (await checkOnline()) {
        await flushQueue()
        await initialLoad()
      }
    }
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [setOnline])

  if (isLoading) return <LoadingSkeleton />
  if (!session) return <Navigate to="/login" replace />

  return <Outlet />
}

function LoadingSkeleton() {
  return (
    <div
      className="flex flex-col"
      style={{ minHeight: '100dvh', background: 'var(--background)' }}
    >
      <div
        style={{
          height: 56,
          background: 'var(--card)',
          borderBottom: '1px solid var(--border)',
        }}
      />
      <div className="flex-1 p-4 space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-20 rounded-lg animate-pulse"
            style={{ background: 'var(--muted)' }}
          />
        ))}
      </div>
      <div
        style={{
          height: 64,
          background: 'var(--card)',
          borderTop: '1px solid var(--border)',
        }}
      />
    </div>
  )
}
