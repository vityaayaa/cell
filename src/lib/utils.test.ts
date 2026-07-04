import { describe, it, expect } from 'vitest'
import { matchGroupByName, accordionDuration } from './utils'

const groups = [
  { id: 'g1', name: 'Трубы' },
  { id: 'g2', name: 'Наличник' },
  { id: 'g3', name: 'Брус' },
]

describe('matchGroupByName — explicit match_word', () => {
  const withWord = [
    { id: 'g1', name: 'Бруски', match_word: 'брусок' },
    { id: 'g2', name: 'Доски' },
  ]
  it('matches the group whose match_word equals the first word', () => {
    expect(matchGroupByName('Брусок 40×50', withWord)).toBe('g1')
  })
  it('match_word takes priority over stem matching', () => {
    // «доска» would stem-match «Доски», but «брусок» explicitly points to g1.
    expect(matchGroupByName('брусок сухой', withWord)).toBe('g1')
  })

  it('match_word may list several forms via comma — any of them matches', () => {
    // Group name «Профиль» won't stem-match either product, so this isolates
    // the explicit comma-list behaviour.
    const multi = [{ id: 'g1', name: 'Профиль', match_word: 'уголок, угол' }]
    expect(matchGroupByName('Уголок 40×40', multi)).toBe('g1')
    expect(matchGroupByName('Угол 50', multi)).toBe('g1')
    // «Уголь» matches neither «уголок» nor «угол» as a whole word (and doesn't
    // stem-match «Профиль» either), so it stays unassigned.
    expect(matchGroupByName('Уголь древесный', multi)).toBeNull()
  })
})

describe('matchGroupByName', () => {
  it('matches singular name to plural group (труба → Трубы)', () => {
    expect(matchGroupByName('труба ПВХ 110', groups)).toBe('g1')
  })
  it('matches exact first word case-insensitively', () => {
    expect(matchGroupByName('Наличник фигурный', groups)).toBe('g2')
  })
  it('matches plural input to singular-ish group via shared stem', () => {
    expect(matchGroupByName('наличники резные', groups)).toBe('g2')
  })
  it('returns null when no group shares a 4+ letter stem', () => {
    expect(matchGroupByName('Вагонка', groups)).toBeNull()
  })
  it('ignores words shorter than 4 letters', () => {
    expect(matchGroupByName('бра', groups)).toBeNull()
  })
  it('returns null for empty name', () => {
    expect(matchGroupByName('', groups)).toBeNull()
  })
  it('does NOT falsely match on a 4-letter prefix of a much longer group', () => {
    // «налив…» shares «нали» with «Наличник» but they're too different.
    expect(matchGroupByName('наливной пол', [{ id: 'g', name: 'Наличник' }])).toBeNull()
    // «брус» vs «Брусника» — 4-letter prefix but 4-letter difference.
    expect(matchGroupByName('брусника', [{ id: 'g', name: 'Брус' }])).toBeNull()
  })
})

describe('accordionDuration', () => {
  it('scales with item count', () => {
    expect(accordionDuration(4)).toBeCloseTo(0.18)
    expect(accordionDuration(1)).toBeCloseTo(0.09)
  })
  it('caps so large groups never drag', () => {
    expect(accordionDuration(100)).toBe(0.4)
  })
})
