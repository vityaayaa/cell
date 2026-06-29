import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
