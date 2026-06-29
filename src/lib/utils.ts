import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { FocusEvent } from 'react'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Scroll a just-focused field into the centre of the view. Put on a form's
 * scroll container via onFocusCapture: when an input/select/textarea gains
 * focus, iOS doesn't reliably scroll it above the on-screen keyboard (the
 * dialog is position:fixed), so we do it ourselves after the keyboard has had
 * a moment to push the layout up.
 */
export function scrollFieldIntoView(e: FocusEvent<HTMLElement>) {
  const target = e.target as HTMLElement
  if (!target.matches('input, select, textarea')) return
  setTimeout(() => {
    target.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, 300)
}

/** Parse a user-typed millimetre value that may use a comma or dot decimal
 *  separator («12,5» → 12.5). Returns null for empty / non-positive / invalid. */
export function parseDecimalMm(s: string): number | null {
  const n = parseFloat(s.replace(',', '.'))
  return isNaN(n) || n <= 0 ? null : n
}

/** Keep only digits and a single decimal separator while typing.
 *  Allows comma or dot; collapses to the first separator. */
export function sanitizeDecimalInput(s: string): string {
  // remove anything that isn't a digit, comma or dot
  let cleaned = s.replace(/[^0-9.,]/g, '')
  // keep only the first separator, drop the rest
  const firstSep = cleaned.search(/[.,]/)
  if (firstSep !== -1) {
    const head = cleaned.slice(0, firstSep + 1)
    const tail = cleaned.slice(firstSep + 1).replace(/[.,]/g, '')
    cleaned = head + tail
  }
  return cleaned
}
