import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronDown, Info, AlertTriangle, Lightbulb } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ───────── Text primitives ───────── */

export function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm mt-2" style={{ color: 'var(--muted-foreground)', lineHeight: 1.6 }}>
      {children}
    </p>
  )
}

export function List({ children }: { children: React.ReactNode }) {
  return (
    <ul
      className="flex flex-col gap-2 mt-3"
      style={{ paddingLeft: 18, listStyle: 'disc', color: 'var(--muted-foreground)' }}
    >
      {children}
    </ul>
  )
}

export function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-sm" style={{ lineHeight: 1.55 }}>
      {children}
    </li>
  )
}

/* ───────── Numbered steps ───────── */

export function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="flex flex-col gap-3 mt-3">{children}</ol>
}

export function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3" style={{ listStyle: 'none' }}>
      <span
        className="flex items-center justify-center rounded-full font-semibold flex-shrink-0"
        style={{
          width: 24,
          height: 24,
          fontSize: 12,
          marginTop: 1,
          background: 'color-mix(in srgb, var(--primary) 14%, transparent)',
          color: 'var(--primary)',
        }}
      >
        {n}
      </span>
      <span className="text-sm" style={{ color: 'var(--muted-foreground)', lineHeight: 1.55 }}>
        {children}
      </span>
    </li>
  )
}

/* ───────── Callout ───────── */

type CalloutVariant = 'info' | 'warning' | 'tip'

const CALLOUT_STYLE: Record<
  CalloutVariant,
  { accent: string; icon: LucideIcon; label: string }
> = {
  info: { accent: '#3B82F6', icon: Info, label: 'На заметку' },
  warning: { accent: '#F59E0B', icon: AlertTriangle, label: 'Важно' },
  tip: { accent: '#10B981', icon: Lightbulb, label: 'Совет' },
}

export function Callout({
  variant = 'info',
  title,
  children,
}: {
  variant?: CalloutVariant
  title?: string
  children: React.ReactNode
}) {
  const s = CALLOUT_STYLE[variant]
  return (
    <div
      className="mt-3 rounded-lg flex gap-3"
      style={{
        padding: '12px 14px',
        background: `color-mix(in srgb, ${s.accent} 9%, var(--card))`,
        border: `1px solid color-mix(in srgb, ${s.accent} 32%, var(--border))`,
        borderLeft: `3px solid ${s.accent}`,
      }}
    >
      <span
        className="flex-shrink-0 flex items-center justify-center"
        style={{ width: 18, marginTop: 1 }}
        aria-hidden
      >
        <s.icon size={16} strokeWidth={2} style={{ color: s.accent }} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold" style={{ color: s.accent, letterSpacing: '0.02em' }}>
          {title ?? s.label}
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--foreground)', lineHeight: 1.55 }}>
          {children}
        </p>
      </div>
    </div>
  )
}

/* ───────── Schema caption ───────── */

export function SchemaCaption({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs mt-2 text-center"
      style={{ color: 'var(--muted-foreground)', lineHeight: 1.5 }}
    >
      {children}
    </p>
  )
}

/** Neutral framed container for an inline SVG schema. */
export function SchemaFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mt-3 rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--border)', background: 'var(--muted)' }}
    >
      <div className="px-3 py-4">{children}</div>
    </div>
  )
}

/* ───────── FAQ accordion ───────── */

export function FaqItem({
  q,
  children,
  first,
}: {
  q: string
  children: React.ReactNode
  first?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderTop: first ? 'none' : '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left py-3"
        aria-expanded={open}
        style={{ minHeight: 44 }}
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--foreground)', lineHeight: 1.4 }}>
          {q}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={prefersReduced ? { duration: 0 } : { duration: 0.18 }}
          className="flex-shrink-0"
        >
          <ChevronDown size={18} strokeWidth={1.5} style={{ color: 'var(--muted-foreground)' }} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <p
              className="text-sm pb-3"
              style={{ color: 'var(--muted-foreground)', lineHeight: 1.6 }}
            >
              {children}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
