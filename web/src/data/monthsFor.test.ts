import { describe, expect, it } from 'vitest'
import type { CardsData } from '../cards/cardsApi'
import { groupMonths, homeMonths, offeredMonths } from './monthsFor'

const cardsWith = (closings: Record<string, string[]>): CardsData => ({
  accounts: Object.keys(closings).map((id) => ({ id, name: id, owner: 'Ana' })),
  cards: Object.keys(closings).map((id, i) => ({ last4: String(1000 + i), type: 'credit' as const, holder: 'ANA', accountId: id })),
  cycles: Object.entries(closings).flatMap(([accountId, dates]) => dates.map((closingDate) => ({ accountId, closingDate, dueDate: null }))),
})

const base = { A: ['2026-09-23', '2026-10-23'], B: ['2026-09-25', '2026-10-25'] }

describe('monthsFor', () => {
  it('homeMonths on 2026-11-06 returns 2026-09, 2026-10 and 2026-11 when all exist', () => {
    const existing = ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11']
    expect(homeMonths(cardsWith(base), existing, '2026-11-06')).toEqual(['2026-09', '2026-10', '2026-11'])
  })

  it('homeMonths across the new year', () => {
    const existing = ['2026-10', '2026-11', '2026-12', '2027-01']
    const months = homeMonths(cardsWith({ A: ['2026-11-23', '2026-12-23'] }), existing, '2027-01-05')
    expect(months).toContain('2026-12')
    expect(months).toContain('2027-01')
    expect(months).not.toContain('2026-10')
  })

  it('homeMonths adds the inherit source when the group month does not exist yet', () => {
    const existing = ['2026-08', '2026-09', '2026-10', '2026-11']
    const months = homeMonths(cardsWith({ A: ['2026-09-23', '2026-10-23', '2026-11-23', '2026-12-23'] }), existing, '2026-11-25')
    expect(months).toContain('2026-11')
    expect(months).not.toContain('2026-12')
    expect(months).not.toContain('2026-08')
  })

  it('homeMonths returns all for an account without closings', () => {
    expect(homeMonths(cardsWith({ ...base, C: [] }), ['2026-10', '2026-11'], '2026-11-06')).toBe('all')
  })

  it('groupMonths for 2026-10 returns 2026-08, 2026-09 and 2026-10', () => {
    const cards = cardsWith({ A: ['2026-08-23', ...base.A], B: ['2026-08-25', ...base.B] })
    const existing = ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11']
    expect(groupMonths(cards, '2026-10', existing)).toEqual(['2026-08', '2026-09', '2026-10'])
  })

  it('offeredMonths keeps the current period even if its closing month does not exist and skips a future closing that touches no existing month', () => {
    const cards = cardsWith({ A: ['2026-09-30', '2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31'] })
    expect(offeredMonths(cards, ['2026-09', '2026-10', '2026-11'], '2026-12-05')).toEqual(['2026-12', '2026-11', '2026-10'])
  })
})
