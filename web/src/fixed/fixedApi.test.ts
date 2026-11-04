import { describe, expect, it } from 'vitest'
import { addMonths, DEFAULT_COUNTER_START, entryKey, isRent, rentCounter } from './fixedApi'

describe('addMonths', () => {
  it('moves forward and backward inside a year', () => {
    expect(addMonths('2026-03', 1)).toBe('2026-04')
    expect(addMonths('2026-03', -2)).toBe('2026-01')
    expect(addMonths('2026-03', 0)).toBe('2026-03')
  })

  it('crosses the end of the year forward', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-11', 14)).toBe('2028-01')
  })

  it('crosses the start of the year backward', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-02', -14)).toBe('2024-12')
  })
})

describe('entryKey', () => {
  it('joins type and month, so there is one entry per type and month', () => {
    expect(entryKey('abc', '2026-11')).toBe('abc_2026-11')
    expect(entryKey('abc', '2026-11')).not.toBe(entryKey('abc', '2026-12'))
  })
})

describe('isRent', () => {
  it.each(['Alquiler', 'alquiler', 'ALQUILER', '  Alquiler  ', 'Álquiler', 'ALQUILÉR'])('%j is the rent', (name) => {
    expect(isRent(name)).toBe(true)
  })

  it.each(['Expensas', 'Alquiler de cochera', 'Alquileres', ''])('%j is not the rent', (name) => {
    expect(isRent(name)).toBe(false)
  })
})

describe('rentCounter', () => {
  it('starts at 1 on the base month', () => {
    expect(DEFAULT_COUNTER_START).toBe('2026-10')
    expect(rentCounter('2026-10')).toBe(1)
  })

  it('cycles 1, 2, 3 and returns to 1 on the fourth month, across the year end', () => {
    expect(['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04'].map((m) => rentCounter(m))).toEqual([1, 2, 3, 1, 2, 3, 1])
  })

  it('works before the base month', () => {
    expect(['2026-09', '2026-08', '2026-07', '2026-06'].map((m) => rentCounter(m))).toEqual([3, 2, 1, 3])
    expect(rentCounter('2025-12')).toBe(3)
  })

  it('accepts another starting month', () => {
    expect(rentCounter('2026-05', '2026-05')).toBe(1)
    expect(rentCounter('2026-07', '2026-05')).toBe(3)
    expect(rentCounter('2026-08', '2026-05')).toBe(1)
  })
})
