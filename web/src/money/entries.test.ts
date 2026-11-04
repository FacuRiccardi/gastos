import { describe, expect, it } from 'vitest'
import { parseAmount, sumByCurrency, type Entry } from './entries'

describe('parseAmount', () => {
  it.each([
    ['1.500,50', 1500.5],
    ['1500,5', 1500.5],
    ['1500.50', 1500.5],
    ['$ 1.500', 1500],
    ['USD 20', 20],
    ['ARS 2.500.000', 2500000],
    ['1500', 1500],
    ['  300  ', 300],
    ['0,01', 0.01],
    ['1.234.567,89', 1234567.89],
  ])('reads %j as %d', (text, value) => {
    expect(parseAmount(text)).toBe(value)
  })

  it.each([[''], ['   '], ['$'], ['0'], ['0,00'], ['-5'], ['-1.500,50'], ['abc'], ['12abc'], ['1,2,3'], ['1500,555'], ['1.5.5']])('rejects %j', (text) => {
    expect(parseAmount(text)).toBeNull()
  })
})

describe('sumByCurrency', () => {
  const e = (amount: number, currency: 'ARS' | 'USD'): Entry => ({ id: `${amount}${currency}`, amount, currency, date: '2026-11-01' })

  it('is empty for no entries', () => {
    expect(sumByCurrency([])).toEqual({})
  })

  it('adds each currency apart and rounds to cents', () => {
    expect(sumByCurrency([e(0.1, 'USD'), e(0.2, 'USD'), e(1000, 'ARS'), e(50.555, 'ARS')])).toEqual({ USD: 0.3, ARS: 1050.56 })
  })

  it('omits a currency with no entries', () => {
    expect(sumByCurrency([e(5, 'ARS')])).toEqual({ ARS: 5 })
  })
})
