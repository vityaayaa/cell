import { motion } from 'motion/react'
import { useNavigate, useLocation } from 'react-router'
import {
  Home,
  LayoutGrid,
  FileText,
  ClipboardList,
  Warehouse,
  Package,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAppStore } from '@/data/store'
import { db } from '@/data/db'
import type { Enums } from '@/data/database.types'

type NavItem = {
  label: string
  icon: React.ElementType
  to: string
  disabled?: boolean
}

type SessionStatus = Enums<'session_status'>

const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function getNavItems(
  mode: 'home-employee' | 'home-admin' | 'session',
  status: SessionStatus | undefined,
  activeSessionId: string | null,
): NavItem[] {
  if (mode === 'home-employee') {
    return [{ label: 'Главная', icon: Home, to: '/app/home' }]
  }

  if (mode === 'home-admin') {
    return [
      { label: 'Главная', icon: Home, to: '/app/home' },
      { label: 'Стеллаж', icon: Warehouse, to: '/app/shelf-config' },
      { label: 'Каталог', icon: Package, to: '/app/catalog' },
    ]
  }

  const orderDisabled = status === 'sweeping' || status === 'fulfilling'
  const checklistDisabled = status !== 'fulfilling'

  return [
    { label: 'Главная', icon: Home, to: '/app/home' },
    { label: 'Стеллаж', icon: LayoutGrid, to: '/app/shelf' },
    {
      label: 'Заявка',
      icon: FileText,
      to: '/app/order',
      disabled: orderDisabled,
    },
    {
      label: 'Чеклист',
      icon: ClipboardList,
      to: activeSessionId ? `/app/checklist/${activeSessionId}` : '/app/home',
      disabled: checklistDisabled,
    },
  ]
}

export function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const userRole = useAppStore((s) => s.userRole)
  const isSessionMode = useAppStore((s) => s.isSessionMode)
  const activeSessionId = useAppStore((s) => s.activeSessionId)
  const setSessionMode = useAppStore((s) => s.setSessionMode)

  const activeSession = useLiveQuery(
    () => (activeSessionId ? db.sessions.get(activeSessionId) : undefined),
    [activeSessionId],
  )

  const mode: 'home-employee' | 'home-admin' | 'session' = isSessionMode
    ? 'session'
    : userRole === 'admin'
      ? 'home-admin'
      : 'home-employee'

  const items = getNavItems(mode, activeSession?.status, activeSessionId)

  function handleTap(item: NavItem) {
    if (item.disabled) return

    if (isSessionMode && item.to === '/app/home') {
      setSessionMode(false)
      navigate('/app/home')
      return
    }

    navigate(item.to)
  }

  return (
    <nav
      className="flex justify-around items-center border-t"
      style={{
        height: 64,
        background: 'var(--card)',
        borderColor: 'var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        flexShrink: 0,
      }}
    >
      {items.map((item) => {
        const Icon = item.icon
        const isActive =
          location.pathname === item.to ||
          location.pathname.startsWith(item.to + '/')
        const isDisabled = item.disabled

        return (
          <motion.button
            key={item.label}
            layout
            transition={
              prefersReduced
                ? { duration: 0 }
                : { type: 'spring', stiffness: 500, damping: 35, mass: 0.6 }
            }
            onClick={() => handleTap(item)}
            disabled={isDisabled}
            style={{ minHeight: 48, minWidth: 48 }}
            className="relative flex flex-col items-center justify-center gap-0.5 flex-1 transition-opacity"
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
          >
            {isActive && (
              <motion.div
                layoutId="activeTabPill"
                transition={
                  prefersReduced
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 500, damping: 35, mass: 0.6 }
                }
                className="absolute rounded-2xl"
                style={{
                  background: 'var(--primary)',
                  opacity: 0.12,
                  top: 6,
                  bottom: 6,
                  left: 12,
                  right: 12,
                }}
              />
            )}
            <Icon
              size={22}
              strokeWidth={1.5}
              style={{
                position: 'relative',
                color: isDisabled
                  ? 'var(--muted-foreground)'
                  : isActive
                    ? 'var(--primary)'
                    : 'var(--muted-foreground)',
                opacity: isDisabled ? 0.38 : 1,
              }}
            />
            <span
              className="text-[11px] leading-none"
              style={{
                position: 'relative',
                color: isDisabled
                  ? 'var(--muted-foreground)'
                  : isActive
                    ? 'var(--primary)'
                    : 'var(--muted-foreground)',
                opacity: isDisabled ? 0.38 : 1,
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {item.label}
            </span>
          </motion.button>
        )
      })}
    </nav>
  )
}
