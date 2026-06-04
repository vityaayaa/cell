import { AnimatePresence, motion } from 'motion/react'
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

  const orderDisabled =
    status === 'sweeping' || status === 'fulfilling'
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

const spring = { type: 'spring' as const, stiffness: 400, damping: 30 }

export function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { userRole, isSessionMode, activeSessionId, setSessionMode } = useAppStore()

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
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          className="flex w-full justify-around items-center"
          initial={{ x: mode === 'session' ? 40 : -40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: mode === 'session' ? -40 : 40, opacity: 0 }}
          transition={spring}
        >
          {items.map((item) => {
            const Icon = item.icon
            const isActive =
              location.pathname === item.to ||
              location.pathname.startsWith(item.to + '/')
            const isDisabled = item.disabled

            return (
              <button
                key={item.label}
                onClick={() => handleTap(item)}
                disabled={isDisabled}
                style={{ minHeight: 48, minWidth: 48 }}
                className="flex flex-col items-center justify-center gap-0.5 flex-1 transition-opacity"
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon
                  size={22}
                  strokeWidth={1.5}
                  style={{
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
              </button>
            )
          })}
        </motion.div>
      </AnimatePresence>
    </nav>
  )
}
