import { describe, expect, it } from 'vitest'
import type { Account, Card, Cycle } from '@/cards/types'
import type { Expense } from '@/lib/expense'
import { buildAccountViews, buildPeriods, computeTotalToPay, periodTabId, tabIdFor } from './statements'

const CLOSINGS = ['2026-09-15', '2026-10-15', '2026-11-15']

describe('buildPeriods', () => {
  it('builds consecutive periods newest first', () => {
    expect(buildPeriods(CLOSINGS)).toEqual([
      { start: '2026-10-16', end: '2026-11-15' },
      { start: '2026-09-16', end: '2026-10-15' },
    ])
  })

  it('sorts unsorted input and ignores repeats', () => {
    expect(buildPeriods(['2026-11-15', '2026-09-15', '2026-10-15', '2026-10-15'])).toEqual(buildPeriods(CLOSINGS))
  })

  it('returns no periods with fewer than two dates', () => {
    expect(buildPeriods([])).toEqual([])
    expect(buildPeriods(['2026-10-15'])).toEqual([])
    expect(buildPeriods(['2026-10-15', '2026-10-15'])).toEqual([])
  })

  it('a period crosses the year end', () => {
    expect(buildPeriods(['2025-12-15', '2026-01-15'])).toEqual([{ start: '2025-12-16', end: '2026-01-15' }])
  })
})

describe('periodTabId', () => {
  it('is derived from the closing day', () => {
    expect(periodTabId({ start: '2026-10-16', end: '2026-11-15' })).toBe('period:2026-11-15')
  })
})

describe('tabIdFor', () => {
  it('the closing day belongs to the period that ends on it', () => {
    expect(tabIdFor('2026-11-15', CLOSINGS)).toBe('period:2026-11-15')
    expect(tabIdFor('2026-10-15', CLOSINGS)).toBe('period:2026-10-15')
  })

  it('the day after a closing is in the next period', () => {
    expect(tabIdFor('2026-10-16', CLOSINGS)).toBe('period:2026-11-15')
  })

  it('the first day after the oldest closing is in the first period', () => {
    expect(tabIdFor('2026-09-16', CLOSINGS)).toBe('period:2026-10-15')
  })

  it('on or before the oldest closing is old', () => {
    expect(tabIdFor('2026-09-15', CLOSINGS)).toBe('old')
    expect(tabIdFor('2020-01-01', CLOSINGS)).toBe('old')
  })

  it('after the latest closing is open', () => {
    expect(tabIdFor('2026-11-16', CLOSINGS)).toBe('open')
  })

  it('no dates means open', () => {
    expect(tabIdFor('2026-11-16', [])).toBe('open')
  })

  it('a single date: before or on it is old, after it is open', () => {
    expect(tabIdFor('2026-10-15', ['2026-10-15'])).toBe('old')
    expect(tabIdFor('2026-10-01', ['2026-10-15'])).toBe('old')
    expect(tabIdFor('2026-10-16', ['2026-10-15'])).toBe('open')
  })

  it('works with unsorted closing dates', () => {
    expect(tabIdFor('2026-10-16', ['2026-11-15', '2026-09-15', '2026-10-15'])).toBe('period:2026-11-15')
  })
})

// ---- buildAccountViews ----

const acc = (id: string, name: string): Account => ({ id, name, owner: 'JUAN' })
const card = (last4: string, accountId: string, over: Partial<Card> = {}): Card => ({
  last4,
  type: 'credit',
  holder: 'JUAN',
  accountId,
  ...over,
})
const cycles = (accountId: string, dates: string[]): Cycle[] =>
  dates.map((closingDate) => ({ accountId, closingDate, dueDate: null }))
let seq = 0
const exp = (iso: string, amount: number, over: Partial<Expense> = {}): Expense => ({
  id: `e${++seq}`,
  purchaseDate: new Date(iso),
  receivedAt: new Date(iso),
  merchant: 'COMERCIO EJEMPLO',
  amount,
  currency: 'ARS',
  cardLast4: '1234',
  cardType: 'credit',
  cardHolder: 'JUAN',
  ...over,
})
// A stored purchaseDate is midnight Buenos Aires = 03:00Z.
const at = (day: string, amount: number, over: Partial<Expense> = {}) => exp(`${day}T03:00:00Z`, amount, over)

const baseData = (over: { accounts?: Account[]; cards?: Card[]; cycles?: Cycle[] } = {}) => ({
  accounts: [acc('a1', 'Cuenta A')],
  cards: [card('1234', 'a1')],
  cycles: cycles('a1', CLOSINGS),
  ...over,
})
const tab = (view: ReturnType<typeof buildAccountViews>[number], id: string) => view.tabs.find((t) => t.id === id)

describe('buildAccountViews', () => {
  it('groups purchases by account, tab and card', () => {
    const [view] = buildAccountViews([at('2026-11-10', 100), at('2026-10-20', 50), at('2026-11-20', 7)], baseData())
    expect(view.account.id).toBe('a1')
    expect(view.tabs.map((t) => t.id)).toEqual(['open', 'period:2026-11-15', 'period:2026-10-15'])
    expect(tab(view, 'period:2026-11-15')!.cards[0].totals).toEqual({ ARS: 150 })
    expect(tab(view, 'open')!.cards[0].totals).toEqual({ ARS: 7 })
    expect(view.latestPeriod).toEqual({ start: '2026-10-16', end: '2026-11-15' })
  })

  it('a purchase at 23:30 Buenos Aires on the closing day is in that period', () => {
    const late = exp('2026-11-16T02:30:00Z', 10)
    const [view] = buildAccountViews([late], baseData())
    expect(tab(view, 'period:2026-11-15')!.count).toBe(1)
    expect(tab(view, 'open')).toBeUndefined()
  })

  it('every purchase lands in exactly one tab', () => {
    const days = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-10-15', '2026-10-16', '2026-11-15', '2026-11-16', '2027-01-01']
    const [view] = buildAccountViews(days.map((d) => at(d, 1)), baseData())
    expect(view.tabs.reduce((n, t) => n + t.count, 0)).toBe(days.length)
    expect(tab(view, 'old')!.count).toBe(2)
    expect(tab(view, 'open')!.count).toBe(2)
  })

  it('lists every credit card of the account even without purchases', () => {
    const data = baseData({ cards: [card('1234', 'a1'), card('5678', 'a1', { holder: 'ANA' })] })
    const [view] = buildAccountViews([at('2026-11-10', 10)], data)
    const t = tab(view, 'period:2026-11-15')!
    expect(t.cards.map((c) => c.card.last4)).toEqual(['5678', '1234'])
    expect(t.cards[0].count).toBe(0)
    expect(t.cards[0].totals).toEqual({})
    expect(view.creditCardCount).toBe(2)
  })

  it('matches by last 4 and type, not by holder', () => {
    const [view] = buildAccountViews([at('2026-11-10', 10, { cardHolder: 'OTRO' })], baseData())
    expect(tab(view, 'period:2026-11-15')!.cards[0].count).toBe(1)
  })

  it('a credit and a debit card with the same last 4 are different', () => {
    const data = baseData({ cards: [card('1234', 'a1'), card('1234', 'a1', { type: 'debit' })] })
    const [view] = buildAccountViews([at('2026-11-10', 10), at('2026-11-10', 99, { cardType: 'debit' })], data)
    const t = tab(view, 'period:2026-11-15')!
    expect(t.cards).toHaveLength(1)
    expect(t.totals).toEqual({ ARS: 10 })
  })

  it('debit cards, unassigned cards and cards of a missing account are left out', () => {
    const data = baseData({ cards: [card('1234', 'a1'), card('9999', 'gone'), card('4321', 'a1', { type: 'debit' })] })
    const [view] = buildAccountViews(
      [
        at('2026-11-10', 1),
        at('2026-11-10', 2, { cardLast4: '9999' }),
        at('2026-11-10', 4, { cardLast4: '4321', cardType: 'debit' }),
        at('2026-11-10', 8, { cardLast4: '0000' }),
      ],
      data,
    )
    expect(tab(view, 'period:2026-11-15')!.totals).toEqual({ ARS: 1 })
    expect(view.tabs.reduce((n, t) => n + t.count, 0)).toBe(1)
  })

  it('rejected purchases are listed and counted but not added to totals', () => {
    const [view] = buildAccountViews([at('2026-11-10', 100), at('2026-11-11', 40, { status: 'rejected' })], baseData())
    const c = tab(view, 'period:2026-11-15')!.cards[0]
    expect(c.count).toBe(2)
    expect(c.expenses).toHaveLength(2)
    expect(c.totals).toEqual({ ARS: 100 })
  })

  it('totals are kept per currency and rounded to cents', () => {
    const [view] = buildAccountViews(
      [at('2026-11-10', 0.1), at('2026-11-10', 0.2), at('2026-11-10', 5, { currency: 'USD' })],
      baseData(),
    )
    expect(tab(view, 'period:2026-11-15')!.totals).toEqual({ ARS: 0.3, USD: 5 })
  })

  it('purchases inside a card are ordered newest first', () => {
    const [view] = buildAccountViews([at('2026-11-01', 1), at('2026-11-09', 2), at('2026-11-05', 3)], baseData())
    expect(tab(view, 'period:2026-11-15')!.cards[0].expenses.map((e) => e.amount)).toEqual([2, 3, 1])
  })

  it('an account with no closing dates has only the open tab with everything', () => {
    const [view] = buildAccountViews([at('2026-11-10', 1), at('2020-01-01', 2)], baseData({ cycles: [] }))
    expect(view.tabs.map((t) => t.id)).toEqual(['open'])
    expect(view.tabs[0].count).toBe(2)
    expect(view.latestPeriod).toBeNull()
  })

  it('an account with no dates and no purchases still has the open tab', () => {
    const [view] = buildAccountViews([], baseData({ cycles: [] }))
    expect(view.tabs.map((t) => t.id)).toEqual(['open'])
  })

  it('an account with one closing date has open and old tabs and no periods', () => {
    const [view] = buildAccountViews(
      [at('2026-10-15', 1), at('2026-10-16', 2)],
      baseData({ cycles: cycles('a1', ['2026-10-15']) }),
    )
    expect(view.tabs.map((t) => t.id)).toEqual(['open', 'old'])
    expect(view.latestPeriod).toBeNull()
  })

  it('open and old tabs are hidden when empty', () => {
    const [view] = buildAccountViews([at('2026-11-10', 1)], baseData())
    expect(view.tabs.map((t) => t.id)).toEqual(['period:2026-11-15', 'period:2026-10-15'])
  })

  it('cycles of a missing account are ignored', () => {
    const data = baseData({ cycles: [...cycles('a1', CLOSINGS), ...cycles('gone', ['2020-01-01', '2020-02-01'])] })
    const views = buildAccountViews([], data)
    expect(views).toHaveLength(1)
    expect(views[0].tabs.map((t) => t.id)).toEqual(['period:2026-11-15', 'period:2026-10-15'])
  })

  it('accounts are ordered by name and cards by holder then last 4', () => {
    const data = baseData({
      accounts: [acc('a2', 'Zeta'), acc('a1', 'Alfa')],
      cards: [card('9999', 'a1', { holder: 'ANA' }), card('1111', 'a1', { holder: 'ANA' }), card('5555', 'a1', { holder: 'JUAN' })],
    })
    const views = buildAccountViews([], data)
    expect(views.map((v) => v.account.name)).toEqual(['Alfa', 'Zeta'])
    expect(views[0].tabs[0].cards.map((c) => c.card.last4)).toEqual(['1111', '9999', '5555'])
  })

  it('an account without credit cards has tabs and zero totals', () => {
    const [view] = buildAccountViews([at('2026-11-10', 5)], baseData({ cards: [] }))
    expect(view.creditCardCount).toBe(0)
    expect(view.tabs.length).toBeGreaterThan(0)
    expect(view.tabs.every((t) => t.count === 0 && Object.keys(t.totals).length === 0)).toBe(true)
  })
})

// ---- computeTotalToPay ----

describe('computeTotalToPay', () => {
  const twoAccounts = () =>
    baseData({
      accounts: [acc('a1', 'Alfa'), acc('a2', 'Beta')],
      cards: [card('1234', 'a1'), card('5678', 'a2')],
      cycles: [...cycles('a1', CLOSINGS), ...cycles('a2', ['2026-09-20', '2026-10-20', '2026-11-20'])],
    })

  it('sums the latest period of every account and lists the period used', () => {
    const views = buildAccountViews(
      [at('2026-11-10', 100), at('2026-11-18', 40, { cardLast4: '5678' }), at('2026-10-10', 999)],
      twoAccounts(),
    )
    const result = computeTotalToPay(views)
    expect(result.totals).toEqual({ ARS: 140 })
    expect(result.included.map((i) => [i.account.name, i.period, i.totals])).toEqual([
      ['Alfa', { start: '2026-10-16', end: '2026-11-15' }, { ARS: 100 }],
      ['Beta', { start: '2026-10-21', end: '2026-11-20' }, { ARS: 40 }],
    ])
    expect(result.excluded).toEqual([])
  })

  it('never uses the open tab', () => {
    const base = computeTotalToPay(buildAccountViews([at('2026-11-10', 100)], baseData()))
    const withOpen = computeTotalToPay(buildAccountViews([at('2026-11-10', 100), at('2026-11-30', 5000)], baseData()))
    expect(withOpen.totals).toEqual(base.totals)
    expect(withOpen.totals).toEqual({ ARS: 100 })
  })

  it('rejected, debit and unassigned purchases are not counted', () => {
    const data = baseData({ cards: [card('1234', 'a1'), card('4321', 'a1', { type: 'debit' })] })
    const result = computeTotalToPay(
      buildAccountViews(
        [
          at('2026-11-10', 100),
          at('2026-11-10', 30, { status: 'rejected' }),
          at('2026-11-10', 20, { cardLast4: '4321', cardType: 'debit' }),
          at('2026-11-10', 10, { cardLast4: '0000' }),
        ],
        data,
      ),
    )
    expect(result.totals).toEqual({ ARS: 100 })
  })

  it('accounts with fewer than two closing dates are excluded and reported', () => {
    const data = baseData({
      accounts: [acc('a1', 'Alfa'), acc('a2', 'Beta'), acc('a3', 'Gama')],
      cards: [card('1234', 'a1'), card('5678', 'a2'), card('9012', 'a3')],
      cycles: [...cycles('a1', CLOSINGS), ...cycles('a2', ['2026-10-20'])],
    })
    const result = computeTotalToPay(
      buildAccountViews([at('2026-11-10', 100), at('2026-11-10', 7, { cardLast4: '5678' }), at('2026-11-10', 9, { cardLast4: '9012' })], data),
    )
    expect(result.totals).toEqual({ ARS: 100 })
    expect(result.included.map((i) => i.account.name)).toEqual(['Alfa'])
    expect(result.excluded.map((a) => a.name)).toEqual(['Beta', 'Gama'])
  })

  it('currencies are not mixed', () => {
    const result = computeTotalToPay(
      buildAccountViews([at('2026-11-10', 100), at('2026-11-10', 5, { currency: 'USD' })], baseData()),
    )
    expect(result.totals).toEqual({ ARS: 100, USD: 5 })
  })

  it('an account whose latest period has no purchases contributes nothing but is listed as included', () => {
    const result = computeTotalToPay(buildAccountViews([], baseData()))
    expect(result.totals).toEqual({})
    expect(result.included).toHaveLength(1)
    expect(result.included[0].totals).toEqual({})
  })
})
