import { describe, expect, it } from 'vitest'
import type { Expense } from '../lib/expense'
import { DataStore } from './dataStore'
import { createFakeBackend } from './fakeBackend'
import { uncategorizedToExpense } from './monthDoc'
import type { MonthData, UncategorizedItem } from './types'

const expense = (id: string, month: string, merchant: string, categoryId: string | null = null): Expense => ({
  id,
  month,
  purchaseDate: new Date(`${month}-10T03:00:00Z`),
  receivedAt: new Date(`${month}-10T03:00:00Z`),
  merchant,
  amount: 100,
  currency: 'ARS',
  cardLast4: '1234',
  cardType: 'credit',
  cardHolder: 'ANA',
  status: 'approved',
  categoryId,
})

const month = (id: string, over: Partial<MonthData> = {}): MonthData => ({
  id,
  expenses: [],
  incomes: [],
  savings: [],
  fixed: {},
  rate: null,
  rateInherited: false,
  cap: null,
  capInherited: false,
  ...over,
})

const item = (id: string, monthId: string, merchant: string): UncategorizedItem => ({
  id,
  month: monthId,
  merchant,
  amount: 100,
  currency: 'ARS',
  purchaseDate: new Date(`${monthId}-10T03:00:00Z`),
  cardLast4: '1234',
  cardType: 'credit',
  cardHolder: 'ANA',
})

const seeded = () =>
  createFakeBackend({
    config: {
      categories: [
        { id: 'c1', name: 'Comida', color: '#111111', archived: false },
        { id: 'c2', name: 'Super', color: '#222222', archived: false },
      ],
      merchants: [
        { key: 'cafe', merchant: 'CAFE', categoryId: 'c1' },
        { key: 'kiosco', merchant: 'KIOSCO', categoryId: 'c1' },
        { key: 'mercado', merchant: 'MERCADO', categoryId: 'c2' },
      ],
    },
    months: [
      month('2026-09', { expenses: [expense('p0', '2026-09', 'SHOP 1')], rate: 900, cap: 400 }),
      month('2026-10', {
        expenses: [expense('p1', '2026-10', 'SHOP 1'), expense('p2', '2026-10', 'CAFE', 'c1'), expense('p3', '2026-10', 'OTRO')],
        rate: 1000,
        cap: 500,
      }),
    ],
    uncategorized: [item('p0', '2026-09', 'SHOP 1'), item('p1', '2026-10', 'SHOP 1'), item('p3', '2026-10', 'OTRO')],
  })

const monthOf = (store: DataStore, id: string) => store.getState().months.get(id)?.data ?? null
const categoryIn = (store: DataStore, monthId: string, id: string) => monthOf(store, monthId)?.expenses.find((e) => e.id === id)?.categoryId
const listed = (store: DataStore) => store.getState().uncategorized.data?.map((i) => i.id)

describe('DataStore', () => {
  it('ensureMonths reads each month once, even when asked twice or concurrently', async () => {
    const backend = seeded()
    const store = new DataStore(backend)
    await Promise.all([store.ensureMonths(['2026-09', '2026-10']), store.ensureMonths(['2026-10'])])
    await store.ensureMonths(['2026-09', '2026-10'])
    expect(backend.reads).toEqual(['month:2026-09', 'month:2026-10'])
    expect(monthOf(store, '2026-10')?.rate).toBe(1000)
    expect(store.getState().months.get('2026-09')?.status).toBe('ready')
  })

  it("ensureMonths('all') reads every month of config.months", async () => {
    const backend = seeded()
    const store = new DataStore(backend)
    await store.ensureMonths('all')
    expect(backend.reads.filter((r) => r.startsWith('month:'))).toEqual(['month:2026-09', 'month:2026-10'])
    expect([...store.getState().months.keys()]).toEqual(['2026-09', '2026-10'])
    await store.loadConfig()
    expect(backend.reads.filter((r) => r === 'config')).toHaveLength(5)
  })

  it('a missing month is cached as null and not read again', async () => {
    const backend = seeded()
    const store = new DataStore(backend)
    await store.ensureMonths(['2030-01'])
    await store.ensureMonths(['2030-01'])
    expect(backend.reads).toEqual(['month:2030-01'])
    expect(store.getState().months.get('2030-01')).toEqual({ status: 'ready', data: null, error: null })
  })

  it('setExpenseCategory updates the loaded month and the uncategorized list without reading', async () => {
    const backend = seeded()
    const store = new DataStore(backend)
    await store.loadUncategorized()
    await store.ensureMonths(['2026-10'])
    const before = store.getState()
    const reads = backend.reads.length
    const p1 = monthOf(store, '2026-10')?.expenses.find((e) => e.id === 'p1') as Expense

    await store.categoriesApi.setExpenseCategory(p1, 'c2')
    expect(categoryIn(store, '2026-10', 'p1')).toBe('c2')
    expect(listed(store)).toEqual(['p3', 'p0'])
    expect(store.getState()).not.toBe(before)

    const p2 = monthOf(store, '2026-10')?.expenses.find((e) => e.id === 'p2') as Expense
    await store.categoriesApi.setExpenseCategory(p2, null)
    expect(categoryIn(store, '2026-10', 'p2')).toBeNull()
    expect(listed(store)).toContain('p2')

    await store.categoriesApi.setExpenseCategory({ ...p1, status: 'rejected' }, null)
    expect(listed(store)).not.toContain('p1')
    expect(backend.reads).toHaveLength(reads)
  })

  it('categorizing a purchase of a month that was never loaded works and the month later shows the category', async () => {
    const backend = seeded()
    const store = new DataStore(backend)
    await store.loadUncategorized()
    const p0 = store.getState().uncategorized.data?.find((i) => i.id === 'p0') as UncategorizedItem

    await store.categorize(uncategorizedToExpense(p0), 'c1')
    expect(listed(store)).not.toContain('p0')
    expect(store.getState().months.has('2026-09')).toBe(false)

    await store.ensureMonths(['2026-09'])
    expect(categoryIn(store, '2026-09', 'p0')).toBe('c1')
  })

  it('categorize applies the category to every listed purchase of the same merchant', async () => {
    const backend = seeded()
    const store = new DataStore(backend)
    await store.loadConfig()
    await store.loadUncategorized()
    await store.ensureMonths(['2026-10'])
    const p1 = monthOf(store, '2026-10')?.expenses.find((e) => e.id === 'p1') as Expense

    await store.categorize(p1, 'c2')
    expect(listed(store)).toEqual(['p3'])
    expect(categoryIn(store, '2026-10', 'p1')).toBe('c2')
    expect(store.getState().config.data?.merchants).toContainEqual({ key: 'shop', merchant: 'SHOP 1', categoryId: 'c2' })
    expect((await backend.readMonth('2026-09'))?.expenses[0].categoryId).toBe('c2')
  })

  it('setArchived drops the dictionary entries of the category', async () => {
    const backend = seeded()
    const store = new DataStore(backend)
    await store.loadConfig()

    await store.categoriesApi.setArchived('c1', true)
    const config = store.getState().config.data
    expect(config?.categories.find((c) => c.id === 'c1')?.archived).toBe(true)
    expect(config?.merchants.map((m) => m.key)).toEqual(['mercado'])
    expect((await backend.readConfig()).merchants.map((m) => m.key)).toEqual(['mercado'])
  })

  it('writing to a month that does not exist adds it to config.months and the next ensureMonths reads it with the inherited values', async () => {
    const backend = seeded()
    const store = new DataStore(backend)
    await store.loadConfig()
    await store.ensureMonths(['2026-11'])
    expect(monthOf(store, '2026-11')).toBeNull()

    await store.fixedApi.save('t1', '2026-11', 70)
    expect(store.getState().config.data?.months).toEqual(['2026-09', '2026-10', '2026-11'])
    expect(store.getState().months.has('2026-11')).toBe(false)

    await store.ensureMonths(['2026-11'])
    expect(monthOf(store, '2026-11')).toEqual(month('2026-11', { fixed: { t1: 70 }, rate: 1000, rateInherited: true, cap: 500, capInherited: true }))
  })

  it('mirrors entry, rate and cap writes in the loaded month', async () => {
    const backend = seeded()
    const store = new DataStore(backend)
    await store.ensureMonths(['2026-10'])
    const reads = backend.reads.length

    const id = await store.entriesApi('incomes').add({ amount: 5, currency: 'USD', date: '2026-10-05', owner: 'Ana' })
    await store.entriesApi('incomes').add({ amount: 7, currency: 'ARS', date: '2026-10-20' })
    await store.ratesApi.save('2026-10', 1200)
    await store.capsApi.remove('2026-10')
    const october = monthOf(store, '2026-10')
    expect(october?.incomes.map((e) => e.date)).toEqual(['2026-10-20', '2026-10-05'])
    expect(october?.incomes[1]).toEqual({ id, amount: 5, currency: 'USD', date: '2026-10-05', owner: 'Ana' })
    expect(october).toMatchObject({ rate: 1200, rateInherited: false, cap: null, capInherited: false })

    await store.entriesApi('incomes').remove(october!.incomes[1])
    expect(monthOf(store, '2026-10')?.incomes).toHaveLength(1)
    expect(backend.reads).toHaveLength(reads)
  })

  it('a failed backend write leaves the state unchanged and rejects', async () => {
    const backend = seeded()
    backend.setRate = async () => {
      throw new Error('offline')
    }
    const store = new DataStore(backend)
    await store.ensureMonths(['2026-10'])
    const before = store.getState()

    await expect(store.ratesApi.save('2026-10', 1)).rejects.toThrow('offline')
    expect(store.getState()).toBe(before)
  })

  it('a failed read marks only that month as an error', async () => {
    const backend = seeded()
    backend.readMonth = async () => {
      throw new Error('offline')
    }
    const store = new DataStore(backend)
    await store.ensureMonths(['2026-10'])
    expect(store.getState().months.get('2026-10')).toMatchObject({ status: 'error', data: null })
    expect(store.getState().months.get('2026-10')?.error).toBeTruthy()
  })
})
