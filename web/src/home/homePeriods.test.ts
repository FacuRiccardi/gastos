import { describe, expect, it } from 'vitest'
import type { CardsData } from '@/cards/cardsApi'
import { buildAccountViews } from '@/expenses/statements'
import type { Expense } from '@/lib/expense'
import { buildHomePeriods, capFor, capLevel, groupForMonth } from './homePeriods'

let n = 0
const expense = (over: Partial<Expense> = {}): Expense => ({
  id: `e${++n}`,
  purchaseDate: new Date('2026-10-08T15:00:00Z'),
  receivedAt: new Date('2026-10-08T15:30:00Z'),
  merchant: `COMERCIO ${n}`,
  amount: 100,
  currency: 'ARS',
  cardLast4: '1234',
  cardType: 'credit',
  cardHolder: 'JUAN',
  status: 'approved',
  ...over,
})

const accounts = [
  { id: 'a1', name: 'Cuenta de ejemplo', owner: 'JUAN' },
  { id: 'a2', name: 'Cuenta Beto', owner: 'BETO' },
]
const cards = [
  { last4: '1234', type: 'credit' as const, holder: 'JUAN', accountId: 'a1' },
  { last4: '5678', type: 'credit' as const, holder: 'BETO', accountId: 'a2' },
]
const cycles: CardsData['cycles'] = [
  { accountId: 'a1', closingDate: '2026-09-05', dueDate: '2026-09-15' },
  { accountId: 'a1', closingDate: '2026-10-05', dueDate: '2026-10-15' },
  { accountId: 'a1', closingDate: '2026-11-05', dueDate: '2026-11-16' },
  { accountId: 'a2', closingDate: '2026-09-10', dueDate: '2026-09-20' },
  { accountId: 'a2', closingDate: '2026-10-10', dueDate: '2026-10-20' },
  { accountId: 'a2', closingDate: '2026-11-10', dueDate: '2026-11-20' },
]
const data = (over: Partial<CardsData> = {}): CardsData => ({ accounts, cards, cycles, ...over })

// a1: 100 in the closed period (Sep 6 - Oct 5) and 300 in the current one; a2: 50 closed, 70 current.
const purchases = [
  expense({ amount: 100, purchaseDate: new Date('2026-09-20T15:00:00Z') }),
  expense({ amount: 300, purchaseDate: new Date('2026-10-20T15:00:00Z') }),
  expense({ amount: 50, cardLast4: '5678', purchaseDate: new Date('2026-09-20T15:00:00Z') }),
  expense({ amount: 70, cardLast4: '5678', purchaseDate: new Date('2026-10-20T15:00:00Z') }),
]
const build = (today: string, d = data(), list = purchases) => buildHomePeriods(buildAccountViews(list, d), d.cycles, today)

describe('buildHomePeriods', () => {
  it('current group holds the period each account is in today, with the pesos total', () => {
    const { current } = build('2026-10-12')
    expect(current?.kind).toBe('current')
    expect(current?.accounts.map((a) => a.tab.period)).toEqual([
      { start: '2026-10-11', end: '2026-11-10' },
      { start: '2026-10-06', end: '2026-11-05' },
    ])
    expect(current?.total).toBe(370)
  })

  it('closed group holds the latest closed period of each account, with the due dates', () => {
    const { closed } = build('2026-10-12')
    expect(closed?.kind).toBe('closed')
    expect(closed?.total).toBe(150)
    expect(closed?.accounts.map((a) => a.due).sort()).toEqual(['2026-10-15', '2026-10-20'])
    expect(closed?.latestDue).toBe('2026-10-20')
  })

  it('shows the closed period on the day of the latest due date and hides it the day after', () => {
    expect(build('2026-10-20').closed).not.toBeNull()
    expect(build('2026-10-21').closed).toBeNull()
  })

  it('keeps the closed period while only the newest due date is still ahead (older account already due)', () => {
    // a1 fell due on Oct 15, a2 on Oct 20: on Oct 17 the closed group is still shown
    expect(build('2026-10-17').closed?.accounts).toHaveLength(2)
  })

  it('uses the month of the latest closing date as the month of the group', () => {
    expect(build('2026-10-12').current?.month).toBe('2026-11')
    expect(build('2026-10-12').closed?.month).toBe('2026-10')
  })

  it('estimates the due date 14 days after closing when none was loaded', () => {
    const d = data({ cycles: cycles.map((c) => (c.accountId === 'a1' ? { ...c, dueDate: null } : c)) })
    const { closed } = build('2026-10-12', d)
    expect(closed?.accounts.find((a) => a.account.id === 'a1')?.due).toBe('2026-10-19')
  })

  it('an account without closing dates contributes its open tab and no closed period', () => {
    const d = data({ cycles: cycles.filter((c) => c.accountId === 'a1') })
    const { current, closed } = build('2026-10-12', d)
    const a2 = current?.accounts.find((a) => a.account.id === 'a2')
    expect(a2?.tab.kind).toBe('open')
    expect(a2?.due).toBeNull()
    expect(a2?.tab.totals.ARS).toBe(120)
    expect(closed?.accounts.map((a) => a.account.id)).toEqual(['a1'])
  })

  it('returns no group when there are no accounts', () => {
    expect(buildHomePeriods([], [], '2026-10-12')).toEqual({ current: null, closed: null })
  })

  it('counts only pesos and flags the group as foreign when there are other currencies', () => {
    const withUsd = [...purchases, expense({ amount: 20, currency: 'USD', purchaseDate: new Date('2026-10-20T15:00:00Z') })]
    const { current, closed } = build('2026-10-12', data(), withUsd)
    expect(current?.total).toBe(370)
    expect(current?.foreign).toBe(true)
    expect(closed?.foreign).toBe(false)
  })

  it('ignores rejected purchases in the total', () => {
    const list = [...purchases, expense({ amount: 999, status: 'rejected', purchaseDate: new Date('2026-10-20T15:00:00Z') })]
    expect(build('2026-10-12', data(), list).current?.total).toBe(370)
  })

  it('lists the expenses of the group newest first', () => {
    const dates = build('2026-10-12').current!.expenses.map((e) => e.purchaseDate.getTime())
    expect(dates).toEqual([...dates].sort((a, b) => b - a))
    expect(dates).toHaveLength(2)
  })

  it('a day after every closing date there is no current group unless purchases opened a tab', () => {
    expect(build('2026-12-01').current).toBeNull()
    const open = [expense({ amount: 40, purchaseDate: new Date('2026-11-25T15:00:00Z') })]
    expect(build('2026-12-01', data(), open).current?.total).toBe(40)
  })
})

describe('groupForMonth', () => {
  const views = buildAccountViews(purchases, data())

  it('picks, per account, the period whose closing date falls in the month', () => {
    const g = groupForMonth(views, cycles, '2026-10', '2026-10-12')
    expect(g?.accounts.map((a) => a.tab.period?.end).sort()).toEqual(['2026-10-05', '2026-10-10'])
    expect(g?.total).toBe(150)
    expect(g?.month).toBe('2026-10')
  })

  it('is closed when every period ended before today, current otherwise', () => {
    expect(groupForMonth(views, cycles, '2026-10', '2026-10-12')?.kind).toBe('closed')
    expect(groupForMonth(views, cycles, '2026-11', '2026-10-12')?.kind).toBe('current')
    // a1 closed on Oct 5 but a2 closes on Oct 10: not closed yet on Oct 7
    expect(groupForMonth(views, cycles, '2026-10', '2026-10-07')?.kind).toBe('current')
  })

  it('returns null for a month without closing dates', () => {
    expect(groupForMonth(views, cycles, '2026-07', '2026-10-12')).toBeNull()
  })
})

describe('capFor', () => {
  const caps = { '2026-08': 1000, '2026-10': 2000 }

  it('uses the cap of the month itself', () => {
    expect(capFor('2026-10', caps)).toEqual({ amount: 2000, from: '2026-10' })
  })

  it('falls back to the latest cap defined before the month', () => {
    expect(capFor('2026-09', caps)).toEqual({ amount: 1000, from: '2026-08' })
    expect(capFor('2027-02', caps)).toEqual({ amount: 2000, from: '2026-10' })
  })

  it('returns null when there is no cap in the month nor before it', () => {
    expect(capFor('2026-07', caps)).toBeNull()
    expect(capFor('2026-07', {})).toBeNull()
  })

  it('does not use a later cap, and skips earlier caps that are zero', () => {
    expect(capFor('2026-09', { '2026-10': 500 })).toBeNull()
    expect(capFor('2026-11', { '2026-08': 900, '2026-10': 0 })).toEqual({ amount: 900, from: '2026-08' })
  })
})

describe('capLevel', () => {
  it.each([
    [0, 'green'],
    [49.99, 'green'],
    [50, 'yellow'],
    [74.99, 'yellow'],
    [75, 'orange'],
    [99.99, 'orange'],
    [100, 'red'],
    [250, 'red'],
  ])('%s%% is %s', (percent, level) => {
    expect(capLevel(percent)).toBe(level)
  })
})
