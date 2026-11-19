import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, Timestamp, type Firestore } from 'firebase/firestore'
import { createFirestoreBackend } from '../web/src/data/firestoreBackend'
import type { Backend } from '../web/src/data/backend'
import type { UncategorizedItem } from '../web/src/data/types'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run with `npm run test:rules` (Firestore emulator)')
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-expenses',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

const householdDb = () =>
  testEnv
    .authenticatedContext('user1', { email: 'user@example.com', email_verified: true, household: true })
    .firestore() as unknown as Firestore

const day = (month: string) => new Date(`${month}-10T03:00:00Z`)

const purchase = (month: string, merchant: string) => ({
  purchaseDate: Timestamp.fromDate(day(month)),
  receivedAt: Timestamp.fromDate(day(month)),
  merchant,
  amount: 100,
  currency: 'ARS',
  cardLast4: '1234',
  cardType: 'credit',
  cardHolder: 'ANA',
  status: 'approved',
})

const listed = (month: string, merchant: string) => ({
  month,
  merchant,
  amount: 100,
  currency: 'ARS',
  purchaseDate: Timestamp.fromDate(day(month)),
  cardLast4: '1234',
  cardType: 'credit',
  cardHolder: 'ANA',
})

const item = (id: string, month: string, merchant: string): UncategorizedItem => ({
  id,
  month,
  merchant,
  amount: 100,
  currency: 'ARS',
  purchaseDate: day(month),
  cardLast4: '1234',
  cardType: 'credit',
  cardHolder: 'ANA',
})

const emptyMonth = { purchases: {}, edits: {}, incomes: {}, savings: {}, fixed: {}, rate: null, rateInherited: false, cap: null, capInherited: false }

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore
    await setDoc(doc(db, 'months/2026-09'), { ...emptyMonth, purchases: { p0: purchase('2026-09', 'SHOP 1') }, rate: 900, cap: 400 })
    await setDoc(doc(db, 'months/2026-10'), {
      ...emptyMonth,
      purchases: { p1: purchase('2026-10', 'SHOP 1'), p2: purchase('2026-10', 'CAFE') },
      edits: { p2: { category: 'c1' } },
      fixed: { t1: 50 },
      rate: 1000,
      rateInherited: true,
      cap: 500,
    })
    await setDoc(doc(db, 'config/months'), { list: ['2026-10', '2026-09'] })
    await setDoc(doc(db, 'config/categories'), {
      items: { c1: { name: 'Comida', color: '#111111', archived: false }, c2: { name: 'Super', color: '#222222', archived: false } },
    })
    await setDoc(doc(db, 'config/merchants'), {
      items: {
        cafe: { merchant: 'CAFE', categoryId: 'c1' },
        kiosco: { merchant: 'KIOSCO', categoryId: 'c1' },
        mercado: { merchant: 'MERCADO', categoryId: 'c2' },
      },
    })
    await setDoc(doc(db, 'meta/uncategorized'), { items: { p0: listed('2026-09', 'SHOP 1'), p1: listed('2026-10', 'SHOP 1') } })
  })
}

let backend: Backend
beforeEach(async () => {
  await testEnv.clearFirestore()
  backend = createFirestoreBackend(householdDb())
})

const categoryOf = async (monthId: string, id: string) => (await backend.readMonth(monthId))?.expenses.find((e) => e.id === id)?.categoryId

describe('firestore backend on an empty database', () => {
  it('readConfig returns empty lists, and there is no month nor uncategorized purchase', async () => {
    expect(await backend.readConfig()).toEqual({
      cards: { accounts: [], cards: [], cycles: [] },
      seenCards: [],
      categories: [],
      fixedTypes: [],
      merchants: [],
      months: [],
    })
    expect(await backend.readMonth('2026-10')).toBeNull()
    expect(await backend.readUncategorized()).toEqual([])
  })

  it('cards: accounts, cards and cycles, and deleting an account takes its cards and cycles', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore() as unknown as Firestore, 'config/cards'), {
        seenCards: { '9999_debit': { last4: '9999', type: 'debit', holder: 'ANA', lastSeen: '2026-10-01' } },
      })
    })
    const a1 = await backend.cards.createAccount({ name: 'Visa', owner: 'ANA' })
    const a2 = await backend.cards.createAccount({ name: 'Master', owner: 'BETO' })
    await backend.cards.updateAccount(a1, { name: 'Visa Oro', owner: 'ANA' })
    await backend.cards.saveCard({ last4: '1234', type: 'credit', holder: 'ANA', accountId: a1 })
    await backend.cards.saveCard({ last4: '5678', type: 'credit', holder: 'BETO', accountId: a2 })
    await backend.cards.saveCard({ last4: '4321', type: 'debit', holder: 'ANA', accountId: a2 })
    await backend.cards.addCycles(a1, [{ closingDate: '2026-10-23', dueDate: '2026-11-03' }])
    await backend.cards.addCycles(a2, [
      { closingDate: '2026-10-20', dueDate: null },
      { closingDate: '2026-11-20', dueDate: null },
    ])
    await backend.cards.removeCard({ last4: '4321', type: 'debit' })
    await backend.cards.deleteCycle(a2, '2026-11-20')
    await backend.cards.deleteAccount(a1)
    const config = await backend.readConfig()
    expect(config.cards).toEqual({
      accounts: [{ id: a2, name: 'Master', owner: 'BETO' }],
      cards: [{ last4: '5678', type: 'credit', holder: 'BETO', accountId: a2 }],
      cycles: [{ accountId: a2, closingDate: '2026-10-20', dueDate: null }],
    })
    expect(config.seenCards).toEqual([{ last4: '9999', type: 'debit', holder: 'ANA', lastSeen: '2026-10-01' }])
  })

  it('cards work before config/cards exists', async () => {
    const id = await backend.cards.createAccount({ name: 'Visa', owner: 'ANA' })
    expect((await backend.readConfig()).cards.accounts).toEqual([{ id, name: 'Visa', owner: 'ANA' }])
  })

  it('a month write with no earlier month creates it with no rate nor cap', async () => {
    await backend.setFixed('2026-08', 't1', 1)
    expect(await backend.readMonth('2026-08')).toMatchObject({ rate: null, rateInherited: false, cap: null, capInherited: false, fixed: { t1: 1 } })
    expect((await backend.readConfig()).months).toEqual(['2026-08'])
  })
})

describe('firestore backend on a seeded database', () => {
  beforeEach(seed)

  it('reads back what was seeded', async () => {
    const config = await backend.readConfig()
    expect(config.months).toEqual(['2026-09', '2026-10'])
    expect(config.categories.map((c) => c.id)).toEqual(['c1', 'c2'])
    const october = await backend.readMonth('2026-10')
    expect(october?.expenses.map((e) => [e.id, e.categoryId])).toEqual([
      ['p2', 'c1'],
      ['p1', null],
    ])
    expect(october).toMatchObject({ fixed: { t1: 50 }, rate: 1000, rateInherited: true, cap: 500, capInherited: false })
    expect((await backend.readUncategorized()).map((i) => i.id)).toEqual(['p1', 'p0'])
  })

  it('setExpenseCategory with a category writes the edit, takes the purchase off the list and leaves purchases alone', async () => {
    const db = householdDb()
    const before = (await getDoc(doc(db, 'months/2026-10'))).data()?.purchases
    await backend.setExpenseCategory({ month: '2026-10', id: 'p1' }, 'c2', null)
    expect(await categoryOf('2026-10', 'p1')).toBe('c2')
    expect((await backend.readUncategorized()).map((i) => i.id)).toEqual(['p0'])
    expect((await getDoc(doc(db, 'months/2026-10'))).data()?.purchases).toEqual(before)
  })

  it('setExpenseCategory with null clears the edit and lists the purchase when asked', async () => {
    await backend.setExpenseCategory({ month: '2026-10', id: 'p2' }, null, item('p2', '2026-10', 'CAFE'))
    expect(await categoryOf('2026-10', 'p2')).toBeNull()
    expect(await backend.readUncategorized()).toEqual([item('p2', '2026-10', 'CAFE'), item('p1', '2026-10', 'SHOP 1'), item('p0', '2026-09', 'SHOP 1')])
  })

  it('setExpenseCategory with null and nothing to list leaves the list alone', async () => {
    await backend.setExpenseCategory({ month: '2026-10', id: 'p2' }, null, null)
    expect(await categoryOf('2026-10', 'p2')).toBeNull()
    expect((await backend.readUncategorized()).map((i) => i.id)).toEqual(['p1', 'p0'])
  })

  it('categorizeMerchant remembers the merchant and categorizes every purchase across months', async () => {
    await backend.categorizeMerchant('Shop 1', 'c2', [
      { month: '2026-09', id: 'p0' },
      { month: '2026-10', id: 'p1' },
    ])
    expect(await categoryOf('2026-09', 'p0')).toBe('c2')
    expect(await categoryOf('2026-10', 'p1')).toBe('c2')
    expect(await backend.readUncategorized()).toEqual([])
    expect((await backend.readConfig()).merchants).toContainEqual({ key: 'shop', merchant: 'Shop 1', categoryId: 'c2' })
  })

  it('setCategoryArchived archives and drops the given merchant keys', async () => {
    await backend.setCategoryArchived('c1', true, ['cafe', 'kiosco'])
    const config = await backend.readConfig()
    expect(config.categories.find((c) => c.id === 'c1')?.archived).toBe(true)
    expect(config.merchants.map((m) => m.key)).toEqual(['mercado'])
    await backend.setCategoryArchived('c1', false, [])
    expect((await backend.readConfig()).categories.find((c) => c.id === 'c1')).toEqual({ id: 'c1', name: 'Comida', color: '#111111', archived: false })
  })

  it('creates and updates categories, keeping the others', async () => {
    const id = await backend.createCategory({ name: 'Auto', color: '#333333' })
    await backend.updateCategory('c2', { name: 'Supermercado', color: '#444444' })
    expect((await backend.readConfig()).categories).toEqual([
      { id, name: 'Auto', color: '#333333', archived: false },
      { id: 'c1', name: 'Comida', color: '#111111', archived: false },
      { id: 'c2', name: 'Supermercado', color: '#444444', archived: false },
    ])
  })

  it('rememberMerchant stores by merchant key and ignores names with no key', async () => {
    await backend.rememberMerchant('Café', 'c2')
    await backend.rememberMerchant('P47A11', 'c2')
    expect((await backend.readConfig()).merchants).toEqual([
      { key: 'cafe', merchant: 'Café', categoryId: 'c2' },
      { key: 'kiosco', merchant: 'KIOSCO', categoryId: 'c1' },
      { key: 'mercado', merchant: 'MERCADO', categoryId: 'c2' },
    ])
  })

  it('adds, renames and disables fixed types', async () => {
    const id = await backend.addFixedType('Luz')
    await backend.renameFixedType(id, 'Electricidad')
    await backend.setFixedTypeDisabled(id, true)
    expect((await backend.readConfig()).fixedTypes).toEqual([{ id, name: 'Electricidad', disabled: true }])
  })

  it('setFixed writes and clears one amount of an existing month', async () => {
    await backend.setFixed('2026-10', 't2', 70)
    expect((await backend.readMonth('2026-10'))?.fixed).toEqual({ t1: 50, t2: 70 })
    await backend.setFixed('2026-10', 't1', null)
    expect((await backend.readMonth('2026-10'))?.fixed).toEqual({ t2: 70 })
  })

  it('addEntry and removeEntry write into the month of the entry', async () => {
    const id = await backend.addEntry('incomes', { amount: 10, currency: 'USD', date: '2026-10-05', owner: 'ANA' })
    const saved = { id, amount: 10, currency: 'USD' as const, date: '2026-10-05', owner: 'ANA' }
    expect((await backend.readMonth('2026-10'))?.incomes).toEqual([saved])
    await backend.addEntry('savings', { amount: 5, currency: 'ARS', date: '2026-10-06' })
    await backend.removeEntry('incomes', saved)
    const october = await backend.readMonth('2026-10')
    expect(october?.incomes).toEqual([])
    expect(october?.savings).toEqual([expect.objectContaining({ amount: 5, currency: 'ARS', date: '2026-10-06' })])
  })

  it('addEntry in a missing month creates it inheriting from the latest earlier month', async () => {
    await backend.addEntry('savings', { amount: 5, currency: 'ARS', date: '2026-12-01' })
    const december = await backend.readMonth('2026-12')
    expect(december).toMatchObject({ rate: 1000, rateInherited: true, cap: 500, capInherited: true, fixed: {}, incomes: [], expenses: [] })
    expect(december?.savings).toHaveLength(1)
    expect((await backend.readConfig()).months).toEqual(['2026-09', '2026-10', '2026-12'])
    expect((await getDoc(doc(householdDb(), 'months/2026-12'))).data()).toMatchObject({ purchases: {}, edits: {} })
  })

  it('setRate and setCap clear their inherited mark, and setCap(null) leaves no cap', async () => {
    await backend.setRate('2026-11', 1200)
    expect(await backend.readMonth('2026-11')).toMatchObject({ rate: 1200, rateInherited: false, cap: 500, capInherited: true })
    await backend.setCap('2026-11', null)
    expect(await backend.readMonth('2026-11')).toMatchObject({ rate: 1200, rateInherited: false, cap: null, capInherited: false })
    await backend.setCap('2026-10', 800)
    expect(await backend.readMonth('2026-10')).toMatchObject({ rate: 1000, rateInherited: true, cap: 800, capInherited: false })
  })
})
