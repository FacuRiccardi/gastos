import { describe, expect, it } from 'vitest'
import { rateFor } from './rateFor'

describe('rateFor', () => {
  const rates = { '2026-08': 1400, '2026-10': 1500 }

  it('uses the rate of the month itself', () => {
    expect(rateFor(rates, '2026-10')).toEqual({ rate: 1500, month: '2026-10', exact: true })
  })

  it('falls back to the latest rate loaded before the month', () => {
    expect(rateFor(rates, '2026-09')).toEqual({ rate: 1400, month: '2026-08', exact: false })
    expect(rateFor(rates, '2026-12')).toEqual({ rate: 1500, month: '2026-10', exact: false })
  })

  it('when nothing is earlier, uses the latest one loaded', () => {
    expect(rateFor(rates, '2026-01')).toEqual({ rate: 1500, month: '2026-10', exact: false })
  })

  it('is null when no rate was ever loaded, and ignores empty or zero rates', () => {
    expect(rateFor({}, '2026-10')).toBeNull()
    expect(rateFor({ '2026-10': 0 }, '2026-10')).toBeNull()
  })
})
