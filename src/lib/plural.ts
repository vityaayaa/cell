// Russian plural forms. forms = [one, few, many]
// 1 пачка · 2 пачки · 5 пачек
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}

/** "3 пачки", "1 пачка", "5 пачек" */
export const packs = (n: number) => `${n} ${plural(n, ['пачка', 'пачки', 'пачек'])}`

/** just the declined word without the number */
export const packsWord = (n: number) => plural(n, ['пачка', 'пачки', 'пачек'])
