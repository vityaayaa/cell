import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { FocusEvent } from 'react'

/** On focus, move the caret to the END of existing text (iOS sometimes puts it
 *  at the start). Use as onFocus on text/number inputs. */
export function caretToEnd(e: FocusEvent<HTMLInputElement>) {
  const el = e.target
  // Only for inputs that support selection (text/search/url/tel/password).
  requestAnimationFrame(() => {
    try { const len = el.value.length; el.setSelectionRange(len, len) } catch { /* type may not support selection */ }
  })
}

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
  groups: { id: string; name: string; match_word?: string | null }[],
): string | null {
  const word = name.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  if (!word) return null
  // 1) Explicit match word wins: group «Бруски» with match_word «брусок» claims
  //    a product whose first word is exactly «брусок».
  for (const g of groups) {
    const mw = g.match_word?.trim().toLowerCase()
    if (mw && mw === word) return g.id
  }
  // 2) Otherwise a shared stem with the group NAME (RU plural quirks).
  if (word.length < 4) return null
  for (const g of groups) {
    const gname = g.name.trim().toLowerCase()
    if (gname.length < 4) continue
    let i = 0
    while (i < word.length && i < gname.length && word[i] === gname[i]) i++
    // Treat as the same word only if they share a 4+ letter stem AND differ by
    // no more than 2 letters overall (a plural/singular ending). This matches
    // «труба»/«трубы», «наличник»/«наличники», «брус»/«брусок», but NOT
    // «налив»/«наличник» or «брус»/«брусника» (too different — use match_word
    // for those). The stem must also reach into the longer word, not just the
    // short one, i.e. i must be close to the longer length.
    const longer = Math.max(word.length, gname.length)
    if (i >= 4 && longer - i <= 2) return g.id
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
