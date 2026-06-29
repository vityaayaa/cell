import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Accordion open/close duration (s) scaled by item count, so a 10-item group
 *  unrolls at the same per-item pace as a 4-item one (which felt right) instead
 *  of all groups taking a fixed time. Clamped so it never drags. */
export function accordionDuration(itemCount: number): number {
  return Math.min(0.06 + itemCount * 0.03, 0.4)
}

/**
 * Match a product name's first word to an existing group id, tolerant of
 * Russian number endings: «труба» finds group «Трубы», «наличник» finds
 * «Наличник». We compare by a shared stem — the shorter of the two words must
 * be a prefix of the other, and the overlap must be at least 4 letters (so
 * short unrelated words don't collide). Case-insensitive. Returns the group id
 * or null. `groups` order decides ties (first match wins).
 */
export function matchGroupByName(
  name: string,
  groups: { id: string; name: string }[],
): string | null {
  const word = name.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  if (word.length < 4) return null
  for (const g of groups) {
    const gname = g.name.trim().toLowerCase()
    if (gname.length < 4) continue
    // Length of the common leading run of letters.
    let i = 0
    while (i < word.length && i < gname.length && word[i] === gname[i]) i++
    // Match when the shared stem is long enough AND covers most of the shorter
    // word — so «труба»/«трубы», «наличник»/«наличники», «брус»/«брусок» match,
    // but a 4-letter coincidence with a long unrelated word doesn't.
    const shorter = Math.min(word.length, gname.length)
    if (i >= 4 && i >= shorter - 2) return g.id
  }
  return null
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
