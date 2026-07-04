import { motion, AnimatePresence } from 'motion/react'
import { X } from 'lucide-react'

const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export interface DrawerSection {
  id: string
  title: string
  admin?: boolean
}

interface SectionsDrawerProps {
  open: boolean
  sections: DrawerSection[]
  activeId: string | null
  onClose: () => void
  onSelect: (id: string) => void
}

export function SectionsDrawer({
  open,
  sections,
  activeId,
  onClose,
  onSelect,
}: SectionsDrawerProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0"
            style={{ background: 'rgba(0,0,0,0.45)', zIndex: 60 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.2 }}
            onClick={onClose}
          />

          {/* Panel — slides up from bottom */}
          <motion.div
            className="fixed left-0 right-0 bottom-0"
            style={{
              zIndex: 61,
              maxHeight: '72dvh',
              background: 'color-mix(in srgb, var(--card) 92%, transparent)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderTop: '1px solid var(--border)',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: 'env(safe-area-inset-bottom)',
              boxShadow: '0 -12px 40px rgba(0,0,0,0.28)',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={
              prefersReduced
                ? { duration: 0 }
                : { type: 'spring', stiffness: 420, damping: 40, mass: 0.8 }
            }
            role="dialog"
            aria-label="Разделы справки"
          >
            {/* Grab handle */}
            <div className="flex justify-center pt-2.5 pb-1">
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border)' }} />
            </div>

            {/* Header */}
            <div
              className="flex items-center justify-between px-4 pb-2"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <span className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                Разделы
              </span>
              <button
                onClick={onClose}
                className="flex items-center justify-center rounded-md"
                style={{ minWidth: 40, minHeight: 40 }}
                aria-label="Закрыть"
              >
                <X size={20} strokeWidth={1.5} style={{ color: 'var(--muted-foreground)' }} />
              </button>
            </div>

            {/* List */}
            <div className="overflow-y-auto px-2 py-2" style={{ maxHeight: 'calc(72dvh - 64px)' }}>
              {sections.map((s, i) => {
                const showAdminDivider = s.admin && (i === 0 || !sections[i - 1].admin)
                const active = s.id === activeId
                return (
                  <div key={s.id}>
                    {showAdminDivider && (
                      <div
                        className="flex items-center gap-2 px-2 pt-3 pb-1"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                        <span
                          className="text-[11px] font-semibold uppercase"
                          style={{ letterSpacing: '0.08em' }}
                        >
                          Для администратора
                        </span>
                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                      </div>
                    )}
                    <button
                      onClick={() => onSelect(s.id)}
                      className="w-full flex items-center gap-3 text-left rounded-lg px-3"
                      style={{
                        minHeight: 44,
                        background: active
                          ? 'color-mix(in srgb, var(--primary) 12%, transparent)'
                          : 'transparent',
                        color: active ? 'var(--primary)' : 'var(--foreground)',
                        fontWeight: active ? 600 : 400,
                      }}
                      aria-current={active ? 'true' : undefined}
                    >
                      <span
                        className="flex-shrink-0 rounded-full"
                        style={{
                          width: 6,
                          height: 6,
                          background: active ? 'var(--primary)' : 'var(--border)',
                        }}
                      />
                      <span className="text-sm">{s.title}</span>
                    </button>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
