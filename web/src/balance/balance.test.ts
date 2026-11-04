import { describe, expect, it } from 'vitest'
import type { CardsData } from '@/cards/cardsApi'
import { buildAccountViews } from '@/expenses/statements'
import type { FixedData } from '@/fixed/fixedApi'
import type { Expense } from '@/lib/expense'
import type { Entry } from '@/money/entries'
import { buildBalance, dueDateOf, dueMonthOf } from './balance'

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
const entry = (over: Partial<Entry>): Entry => ({ id: `n${++n}`, amount: 0, currency: 'ARS', date: '2026-11-01', ...over })

const accounts = [{ id: 'a1', name: 'Cuenta de ejemplo', owner: 'Ana' }]
const cards = [{ last4: '1234', type: 'credit' as const, holder: 'ANA', accountId: 'a1' }]
const fixed: FixedData = {
  types: [
    { id: 't1', name: 'Alquiler', disabled: false },
    { id: 't2', name: 'Expensas', disabled: false },
  ],
  entries: [
    { typeId: 't1', month: '2026-11', amount: 500000 },
    { typeId: 't2', month: '2026-11', amount: 80000.5 },
    { typeId: 't1', month: '2026-10', amount: 400000 },
    { typeId: 'gone', month: '2026-11', amount: 999 },
  ],
}
const noFixed: FixedData = { types: [], entries: [] }

type Args = Partial<Parameters<typeof buildBalance>[0]>
function run(over: Args = {}, list: Expense[] = [], cyc: CardsData['cycles'] = []) {
  const data: CardsData = { accounts, cards, cycles: cyc }
  return buildBalance({
    month: '2026-11',
    incomes: [],
    savings: [],
    fixed: noFixed,
    rates: {},
    views: buildAccountViews(list, data),
    cycles: cyc,
    ...over,
  })
}

describe('dueDateOf / dueMonthOf', () => {
  it('uses the loaded due date', () => {
    expect(dueDateOf('2026-10-05', '2026-10-16')).toBe('2026-10-16')
    expect(dueMonthOf('2026-10-28', '2026-11-08')).toBe('2026-11')
  })

  it('falls back to 14 days after closing, also across month and year ends', () => {
    expect(dueDateOf('2026-10-05', null)).toBe('2026-10-19')
    expect(dueMonthOf('2026-10-20', null)).toBe('2026-11')
    expect(dueMonthOf('2026-12-28', null)).toBe('2027-01')
  })
})

describe('buildBalance incomes', () => {
  it('adds incomes of the month by owner and currency, sorted by owner then currency', () => {
    const b = run({
      incomes: [
        entry({ owner: 'Beto', amount: 100 }),
        entry({ owner: 'Ana', amount: 1000.1 }),
        entry({ owner: 'Ana', amount: 200.2, date: '2026-11-20' }),
        entry({ owner: 'Ana', amount: 50, currency: 'USD' }),
        entry({ owner: 'Ana', amount: 999, date: '2026-10-31' }),
      ],
      rates: { '2026-11': 1000 },
    })
    expect(b.incomeLines).toEqual([
      { owner: 'Ana', currency: 'ARS', amount: 1200.3 },
      { owner: 'Ana', currency: 'USD', amount: 50 },
      { owner: 'Beto', currency: 'ARS', amount: 100 },
    ])
  })

  it('converts dollars with the rate of the month', () => {
    const b = run({ incomes: [entry({ owner: 'Ana', amount: 1000 }), entry({ owner: 'Ana', amount: 10, currency: 'USD' })], rates: { '2026-11': 1200, '2026-10': 1 } })
    expect(b.rate).toBe(1200)
    expect(b.usdIncome).toBe(10)
    expect(b.incomeTotal).toBe(13000)
    expect(b.missingRate).toBe(false)
  })

  it('leaves dollars out and reports missingRate when the month has no rate', () => {
    const b = run({ incomes: [entry({ owner: 'Ana', amount: 1000 }), entry({ owner: 'Ana', amount: 10, currency: 'USD' })], rates: { '2026-10': 1200 } })
    expect(b.rate).toBeNull()
    expect(b.incomeTotal).toBe(1000)
    expect(b.missingRate).toBe(true)
  })

  it('does not report missingRate when there are no dollar incomes', () => {
    expect(run({ incomes: [entry({ owner: 'Ana', amount: 1 })] }).missingRate).toBe(false)
  })

  it('a month without data is all zeros', () => {
    const b = run()
    expect(b).toMatchObject({ incomeTotal: 0, fixedTotal: 0, cardsTotal: 0, expensesTotal: 0, balance: 0, incomeLines: [], cards: [], fixed: [] })
    expect(b.savedThisMonth).toEqual({})
  })
})

describe('buildBalance fixed expenses', () => {
  it('takes only the entries of the month with an existing type, sorted by name', () => {
    const b = run({ fixed })
    expect(b.fixed.map((f) => f.name)).toEqual(['Alquiler', 'Expensas'])
    expect(b.fixedTotal).toBe(580000.5)
  })
})

describe('buildBalance cards', () => {
  const cyc: CardsData['cycles'] = [
    { accountId: 'a1', closingDate: '2026-09-05', dueDate: '2026-09-15' },
    { accountId: 'a1', closingDate: '2026-10-05', dueDate: '2026-11-03' },
    { accountId: 'a1', closingDate: '2026-11-05', dueDate: '2026-12-03' },
  ]
  const list = [
    expense({ amount: 1000, purchaseDate: new Date('2026-09-20T15:00:00Z') }), // period closing Oct 5
    expense({ amount: 2000, purchaseDate: new Date('2026-10-20T15:00:00Z') }), // period closing Nov 5
  ]

  it('counts the statements that fall due in the month, not the ones that close in it', () => {
    const b = run({}, list, cyc)
    expect(b.cards).toEqual([{ account: accounts[0], closing: '2026-10-05', amount: 1000 }])
    expect(b.cardsTotal).toBe(1000)
    expect(run({ month: '2026-12' }, list, cyc).cardsTotal).toBe(2000)
  })

  it('uses the 14 day estimate when the due date is missing', () => {
    const noDue = [
      { accountId: 'a1', closingDate: '2026-09-05', dueDate: null },
      { accountId: 'a1', closingDate: '2026-10-20', dueDate: null },
    ]
    const b = run({}, [expense({ amount: 700, purchaseDate: new Date('2026-10-10T15:00:00Z') })], noDue)
    expect(b.cardsTotal).toBe(700) // Oct 20 + 14 days = Nov 3
  })

  it('a statement that closes in December and falls due in January belongs to January', () => {
    const c = [
      { accountId: 'a1', closingDate: '2026-11-28', dueDate: null },
      { accountId: 'a1', closingDate: '2026-12-28', dueDate: null },
    ]
    const l = [expense({ amount: 300, purchaseDate: new Date('2026-12-10T15:00:00Z') })]
    expect(run({ month: '2027-01' }, l, c).cardsTotal).toBe(300)
    expect(run({ month: '2026-12' }, l, c).cardsTotal).toBe(0)
  })

  it('counts pesos only and flags foreign currency', () => {
    const l = [...list, expense({ amount: 15, currency: 'USD', purchaseDate: new Date('2026-09-21T15:00:00Z') })]
    const b = run({}, l, cyc)
    expect(b.cardsTotal).toBe(1000)
    expect(b.cardsForeign).toBe(true)
  })

  it('balance is income minus fixed expenses minus cards', () => {
    const b = run({ incomes: [entry({ owner: 'Ana', amount: 2000000 })], fixed }, list, cyc)
    expect(b.expensesTotal).toBe(581000.5)
    expect(b.balance).toBe(1418999.5)
  })

  it('balance can be negative', () => {
    expect(run({ incomes: [entry({ owner: 'Ana', amount: 100 })], fixed }).balance).toBe(-579900.5)
  })
})

describe('buildBalance savings', () => {
  const savings = [
    entry({ amount: 100, currency: 'USD', date: '2026-09-10' }),
    entry({ amount: 50.5, currency: 'USD', date: '2026-11-02' }),
    entry({ amount: 20.25, currency: 'USD', date: '2026-11-25' }),
    entry({ amount: 5000, currency: 'ARS', date: '2026-11-25' }),
    entry({ amount: 70, currency: 'USD', date: '2026-12-01' }),
  ]

  it('splits what was saved in the month from the accumulated until the month, per currency', () => {
    const b = run({ savings })
    expect(b.savedThisMonth).toEqual({ USD: 70.75, ARS: 5000 })
    expect(b.savedUntilNow).toEqual({ USD: 170.75, ARS: 5000 })
  })

  it('savings do not change the balance', () => {
    expect(run({ savings }).balance).toBe(0)
  })
})
