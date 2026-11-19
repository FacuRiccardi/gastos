import { describe, expect, it } from 'vitest'
import {
  entriesOf,
  expenseToUncategorized,
  expensesOf,
  fixedOf,
  ratesOf,
  toAppConfig,
  toMonthData,
  toUncategorized,
  uncategorizedToExpense,
} from './monthDoc'

const ts = (iso: string) => ({ toDate: () => new Date(iso) })

const purchase = (purchaseDate: string, merchant = 'SHOP') => ({
  purchaseDate: ts(purchaseDate),
  receivedAt: ts(purchaseDate),
  merchant,
  amount: 100,
  currency: 'ARS',
  cardLast4: '1234',
  cardType: 'credit',
  cardHolder: 'ANA',
  status: 'approved',
})

const emptyMonth = { purchases: {}, edits: {}, incomes: {}, savings: {}, fixed: {}, rate: null, rateInherited: false, cap: null, capInherited: false }

describe('monthDoc', () => {
  it('joins edits into expenses and sorts newest first', () => {
    const month = toMonthData('2026-10', {
      ...emptyMonth,
      purchases: { a: purchase('2026-10-02T03:00:00Z', 'OLD'), b: purchase('2026-10-20T03:00:00Z', 'NEW') },
      edits: { a: { category: 'Super', note: 'x' } },
    })
    expect(month.expenses.map((e) => e.id)).toEqual(['b', 'a'])
    expect(month.expenses[1]).toEqual({
      id: 'a',
      month: '2026-10',
      purchaseDate: new Date('2026-10-02T03:00:00Z'),
      receivedAt: new Date('2026-10-02T03:00:00Z'),
      merchant: 'OLD',
      amount: 100,
      currency: 'ARS',
      cardLast4: '1234',
      cardType: 'credit',
      cardHolder: 'ANA',
      status: 'approved',
      categoryId: 'Super',
    })
  })

  it('sorts same-day purchases by id descending', () => {
    const day = '2026-10-02T03:00:00Z'
    const month = toMonthData('2026-10', { ...emptyMonth, purchases: { a: purchase(day), c: purchase(day), b: purchase(day) } })
    expect(month.expenses.map((e) => e.id)).toEqual(['c', 'b', 'a'])
    expect(expensesOf([month, toMonthData('2026-10', { ...emptyMonth, purchases: { d: purchase(day) } })]).map((e) => e.id)).toEqual(['d', 'c', 'b', 'a'])
    const item = { month: '2026-10', merchant: 'SHOP', amount: 1, currency: 'ARS', purchaseDate: ts(day), cardLast4: '1234', cardType: 'credit', cardHolder: 'ANA' }
    expect(toUncategorized({ items: { a: item, c: item, b: item } }).map((i) => i.id)).toEqual(['c', 'b', 'a'])
  })

  it('a purchase without edits has categoryId null', () => {
    const month = toMonthData('2026-10', { ...emptyMonth, purchases: { a: purchase('2026-10-02T03:00:00Z') }, edits: { a: { note: 'x' } } })
    expect(month.expenses[0].categoryId).toBeNull()
  })

  it('ratesOf skips null rates', () => {
    const months = [
      toMonthData('2026-09', { ...emptyMonth, rate: 1400, cap: 500 }),
      toMonthData('2026-10', { ...emptyMonth, rate: null, cap: null }),
    ]
    expect(ratesOf(months)).toEqual({ '2026-09': 1400 })
  })

  it('fixedOf flattens fixed into entries with their month', () => {
    const months = [toMonthData('2026-09', { ...emptyMonth, fixed: { rent: 1000 } }), toMonthData('2026-10', { ...emptyMonth, fixed: { rent: 1100, gym: 50 } })]
    const types = [{ id: 'rent', name: 'Alquiler', disabled: false }]
    const data = fixedOf(types, months)
    expect(data.types).toBe(types)
    expect(data.entries).toEqual(
      expect.arrayContaining([
        { typeId: 'rent', month: '2026-09', amount: 1000 },
        { typeId: 'rent', month: '2026-10', amount: 1100 },
        { typeId: 'gym', month: '2026-10', amount: 50 },
      ]),
    )
    expect(data.entries).toHaveLength(3)
  })

  it('entriesOf sorts newest first', () => {
    const months = [
      toMonthData('2026-09', { ...emptyMonth, incomes: { i1: { amount: 10, currency: 'ARS', date: '2026-09-05', owner: 'Ana' } }, savings: { s1: { amount: 1, currency: 'USD', date: '2026-09-01' } } }),
      toMonthData('2026-10', { ...emptyMonth, incomes: { i2: { amount: 20, currency: 'USD', date: '2026-10-05', owner: 'Beto' }, i3: { amount: 30, currency: 'ARS', date: '2026-10-01', owner: 'Ana' } } }),
    ]
    expect(entriesOf('incomes', months).map((e) => e.id)).toEqual(['i2', 'i3', 'i1'])
    expect(entriesOf('incomes', months)[0]).toEqual({ id: 'i2', amount: 20, currency: 'USD', date: '2026-10-05', owner: 'Beto' })
    expect(entriesOf('savings', months)).toEqual([{ id: 's1', amount: 1, currency: 'USD', date: '2026-09-01' }])
  })

  it('toAppConfig sorts months and tolerates missing documents', () => {
    const config = toAppConfig({ cards: undefined, categories: undefined, fixedTypes: undefined, merchants: undefined, months: { list: ['2026-10', '2026-08', '2026-09'] } })
    expect(config).toEqual({
      cards: { accounts: [], cards: [], cycles: [] },
      seenCards: [],
      categories: [],
      fixedTypes: [],
      merchants: [],
      months: ['2026-08', '2026-09', '2026-10'],
    })
    const full = toAppConfig({
      cards: {
        accounts: { a1: { name: 'Visa', owner: 'Ana' } },
        cards: { '1234_credit': { last4: '1234', type: 'credit', holder: 'ANA', accountId: 'a1' } },
        cycles: { 'a1_2026-10-23': { accountId: 'a1', closingDate: '2026-10-23', dueDate: null } },
        seenCards: { '1234_credit': { last4: '1234', type: 'credit', holder: 'ANA', lastSeen: '2026-10-30' } },
      },
      categories: { items: { c1: { name: 'Super', color: '#fff', archived: false } } },
      fixedTypes: { items: { f1: { name: 'Alquiler', disabled: true } } },
      merchants: { items: { shop: { merchant: 'SHOP', categoryId: 'c1' } } },
      months: undefined,
    })
    expect(full).toEqual({
      cards: {
        accounts: [{ id: 'a1', name: 'Visa', owner: 'Ana' }],
        cards: [{ last4: '1234', type: 'credit', holder: 'ANA', accountId: 'a1' }],
        cycles: [{ accountId: 'a1', closingDate: '2026-10-23', dueDate: null }],
      },
      seenCards: [{ last4: '1234', type: 'credit', holder: 'ANA', lastSeen: '2026-10-30' }],
      categories: [{ id: 'c1', name: 'Super', color: '#fff', archived: false }],
      fixedTypes: [{ id: 'f1', name: 'Alquiler', disabled: true }],
      merchants: [{ key: 'shop', merchant: 'SHOP', categoryId: 'c1' }],
      months: [],
    })
  })

  it('toAppConfig gives a nameless category or fixed type an empty name', () => {
    const config = toAppConfig({
      categories: { items: { c1: { color: '#fff' }, c2: { name: 'Super', color: '#000' } } },
      fixedTypes: { items: { f1: {}, f2: { name: 'Alquiler' } } },
    })
    expect(config.categories.map((c) => c.name)).toEqual(['', 'Super'])
    expect(config.fixedTypes.map((t) => t.name)).toEqual(['', 'Alquiler'])
  })

  it('uncategorizedToExpense and expenseToUncategorized round-trip the shared fields', () => {
    const item = {
      id: 'p1',
      month: '2026-10',
      merchant: 'SHOP',
      amount: 100,
      currency: 'USD',
      purchaseDate: new Date('2026-10-02T03:00:00Z'),
      cardLast4: '1234',
      cardType: 'credit' as const,
      cardHolder: 'ANA',
    }
    const expense = uncategorizedToExpense(item)
    expect(expense).toEqual({ ...item, receivedAt: item.purchaseDate, status: 'approved', categoryId: null })
    expect(expenseToUncategorized(expense)).toEqual(item)
    expect(expensesOf([toMonthData('2026-10', emptyMonth)])).toEqual([])
  })
})
