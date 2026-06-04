import { useEffect, useState } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { supabase } from '@/data/supabase'
import { AppShell } from './AppShell'
import { AppLayout } from './AppLayout'
import LoginPage from '@/features/auth/LoginPage'
import OnboardingPage from '@/features/auth/OnboardingPage'
import HomePage from '@/features/home/HomePage'
import SessionDetailPage from '@/features/home/SessionDetailPage'
import ShelfPage from '@/features/shelf/ShelfPage'
import ShelfConfigPage from '@/features/shelf/ShelfConfigPage'
import OrderDraftPage from '@/features/order/OrderDraftPage'
import ChecklistPage from '@/features/checklist/ChecklistPage'
import CatalogPage from '@/features/catalog/CatalogPage'
import SettingsPage from '@/features/admin/SettingsPage'
import UsersPage from '@/features/admin/UsersPage'
import AuditPage from '@/features/admin/AuditPage'
import AggregatesPage from '@/features/admin/AggregatesPage'
import StockEntryPage from '@/features/stock/StockEntryPage'
import { useAppStore } from '@/data/store'

function AdminGuard({ children }: { children: React.ReactNode }) {
  const userRole = useAppStore((s) => s.userRole)
  if (userRole !== null && userRole !== 'admin') {
    return <Navigate to="/app/home" replace />
  }
  return <>{children}</>
}

function RedirectByAuth() {
  const [status, setStatus] = useState<'loading' | 'authed' | 'first-run' | 'login'>('loading')

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setStatus('authed')
        return
      }

      try {
        const { data, error } = await supabase.functions.invoke('create-first-admin', {
          body: {},
        })
        if (!error && !data?.alreadyExists) {
          setStatus('first-run')
        } else {
          setStatus('login')
        }
      } catch {
        setStatus('login')
      }
    }

    check()
  }, [])

  if (status === 'loading') {
    return (
      <div
        className="flex items-center justify-center min-h-dvh"
        style={{ background: 'var(--background)' }}
      >
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }}
        />
      </div>
    )
  }

  if (status === 'authed') return <Navigate to="/app/home" replace />
  if (status === 'first-run') return <Navigate to="/onboarding" replace />
  return <Navigate to="/login" replace />
}

const router = createBrowserRouter([
  { path: '/', element: <RedirectByAuth /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/onboarding', element: <OnboardingPage /> },
  {
    path: '/app',
    element: <AppShell />,
    children: [
      // Admin full-screen routes (no AppLayout header/BottomNav)
      {
        path: 'settings',
        element: (
          <AdminGuard>
            <SettingsPage />
          </AdminGuard>
        ),
      },
      {
        path: 'settings/users',
        element: (
          <AdminGuard>
            <UsersPage />
          </AdminGuard>
        ),
      },
      {
        path: 'settings/audit',
        element: (
          <AdminGuard>
            <AuditPage />
          </AdminGuard>
        ),
      },
      {
        path: 'admin/aggregates',
        element: (
          <AdminGuard>
            <AggregatesPage />
          </AdminGuard>
        ),
      },
      // Main app screens wrapped in AppLayout (header + BottomNav)
      {
        element: <AppLayout />,
        children: [
          { path: 'home', element: <HomePage /> },
          { path: 'shelf', element: <ShelfPage /> },
          { path: 'order', element: <OrderDraftPage /> },
          { path: 'checklist/:sessionId', element: <ChecklistPage /> },
          { path: 'session/:id', element: <SessionDetailPage /> },
          { path: 'stock-entry/:cellId', element: <StockEntryPage /> },
          {
            path: 'shelf-config',
            element: (
              <AdminGuard>
                <ShelfConfigPage />
              </AdminGuard>
            ),
          },
          {
            path: 'catalog',
            element: (
              <AdminGuard>
                <CatalogPage />
              </AdminGuard>
            ),
          },
        ],
      },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
