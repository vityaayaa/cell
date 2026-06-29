import { describe, it, expect } from 'vitest'
import { matchGroupByName, accordionDuration } from './utils'

const groups = [
  { id: 'g1', name: 'Трубы' },
  { id: 'g2', name: 'Наличник' },
  { id: 'g3', name: 'Брус' },
]

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
