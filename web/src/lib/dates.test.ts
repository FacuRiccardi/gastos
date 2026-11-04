import { describe, expect, it } from 'vitest'
import { addDays, buenosAiresDay, formatCalendarDate, isValidDateString, parseDisplayDate } from './dates'

describe('parseDisplayDate', () => {
  it('parses a valid date', () => {
    expect(parseDisplayDate('15/03/2026')).toBe('2026-03-15')
    expect(parseDisplayDate('5/3/2026')).toBe('2026-03-05')
    expect(parseDisplayDate(' 15/03/2026 ')).toBe('2026-03-15')
  })

  it('accepts a leap day', () => {
    expect(parseDisplayDate('29/02/2028')).toBe('2028-02-29')
  })

  it('rejects impossible dates', () => {
    for (const text of ['31/02/2026', '29/02/2027', '15/13/2026', '00/01/2026', '32/01/2026']) {
      expect(parseDisplayDate(text)).toBeNull()
    }
  })

  it('rejects other formats', () => {
    for (const text of ['15-03-2026', '2026-03-15', '15/03/26', '']) {
      expect(parseDisplayDate(text)).toBeNull()
    }
  })
})

describe('isValidDateString', () => {
  it('accepts only real calendar dates written YYYY-MM-DD', () => {
    expect(isValidDateString('2026-03-15')).toBe(true)
    expect(isValidDateString('2026-02-31')).toBe(false)
    expect(isValidDateString('2026-3-5')).toBe(false)
    expect(isValidDateString('abc')).toBe(false)
  })
})

describe('formatCalendarDate', () => {
  it('formats YYYY-MM-DD as dd/mm/yyyy', () => {
    expect(formatCalendarDate('2026-03-05')).toBe('05/03/2026')
  })
})

describe('addDays', () => {
  it('crosses month and year ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('buenosAiresDay', () => {
  it('uses the Buenos Aires day, not UTC', () => {
    expect(buenosAiresDay(new Date('2026-11-16T02:30:00Z'))).toBe('2026-11-15')
    expect(buenosAiresDay(new Date('2026-11-15T03:00:00Z'))).toBe('2026-11-15')
    expect(buenosAiresDay(new Date('2026-11-15T02:59:00Z'))).toBe('2026-11-14')
  })
})
