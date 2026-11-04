import { describe, expect, it } from 'vitest'
import { formatDate, formatMoney } from './format'

describe('formatMoney', () => {
  it('formats pesos with thousands separator and cents', () => {
    expect(formatMoney(12500, 'ARS')).toContain('12.500,00')
  })

  it('formats zero', () => {
    expect(formatMoney(0, 'ARS')).toContain('0,00')
  })

  it('formats a large amount with cents', () => {
    expect(formatMoney(1234567.89, 'ARS')).toContain('1.234.567,89')
  })

  it('formats another currency using its own symbol or code', () => {
    const text = formatMoney(25.5, 'USD')
    expect(text).toContain('25,50')
    expect(text).toMatch(/US\$|USD/)
  })
})

describe('formatDate', () => {
  it('runs in UTC (see src/test/setup.ts), so the explicit time zone is what these tests prove', () => {
    expect(new Date('2026-03-15T03:00:00Z').getHours()).toBe(3)
  })

  it('shows the Buenos Aires day for a midnight-Buenos-Aires timestamp', () => {
    expect(formatDate(new Date('2026-03-15T03:00:00Z'))).toBe('15/03/2026')
  })

  it('does not move to the next day late in the evening, and shows the previous day just before midnight', () => {
    expect(formatDate(new Date('2026-03-16T02:59:00Z'))).toBe('15/03/2026')
    expect(formatDate(new Date('2026-03-15T02:59:00Z'))).toBe('14/03/2026')
  })
})
