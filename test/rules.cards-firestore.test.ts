import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, getDocs, setDoc, collection, type Firestore } from 'firebase/firestore'
import { createFirestoreCardsApi, createFirestoreCardsSource } from '../web/src/cards/firestoreCards'
import type { CardsApi, CardsData } from '../web/src/cards/cardsApi'

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

beforeEach(async () => {
  await testEnv.clearFirestore()
})

const householdDb = () =>
  testEnv
    .authenticatedContext('user1', { email: 'user@example.com', email_verified: true, household: true })
    .firestore() as unknown as Firestore

let db: Firestore
let api: CardsApi
beforeEach(() => {
  db = householdDb()
  api = createFirestoreCardsApi(db)
})

function nextData(database: Firestore, predicate: (d: CardsData) => boolean = () => true): Promise<CardsData> {
  return new Promise((resolve, reject) => {
    const unsubscribe = createFirestoreCardsSource(database).subscribe(
      (data) => {
        if (predicate(data)) {
          unsubscribe()
          resolve(data)
        }
      },
      (error) => reject(error),
    )
  })
}

const ids = async (path: string) => (await getDocs(collection(db, path))).docs.map((d) => d.id).sort()

describe('cards data layer', () => {
  it('createAccount returns an id and the account arrives through the source', async () => {
    const id = await api.createAccount({ name: 'Cuenta de ejemplo', owner: 'PERSONA' })
    expect(id).toBeTruthy()
    const data = await nextData(db, (d) => d.accounts.length === 1)
    expect(data.accounts).toEqual([{ id, name: 'Cuenta de ejemplo', owner: 'PERSONA' }])
    expect(data.cards).toEqual([])
    expect(data.cycles).toEqual([])
  })

  it('saveCard creates last4_type and a second save changes holder and account', async () => {
    const a1 = await api.createAccount({ name: 'Uno', owner: 'PERSONA' })
    const a2 = await api.createAccount({ name: 'Dos', owner: 'OTRA' })
    await api.saveCard({ last4: '1234', type: 'credit', holder: 'PERSONA', accountId: a1 })
    expect(await ids('cards')).toEqual(['1234_credit'])
    await api.saveCard({ last4: '1234', type: 'credit', holder: 'OTRA', accountId: a2 })
    expect(await ids('cards')).toEqual(['1234_credit'])
    expect((await getDoc(doc(db, 'cards/1234_credit'))).data()).toEqual({
      last4: '1234',
      type: 'credit',
      holder: 'OTRA',
      accountId: a2,
    })
  })

  it('removeCard deletes the card', async () => {
    const a1 = await api.createAccount({ name: 'Uno', owner: 'PERSONA' })
    await api.saveCard({ last4: '1234', type: 'credit', holder: 'PERSONA', accountId: a1 })
    await api.removeCard({ last4: '1234', type: 'credit' })
    expect(await ids('cards')).toEqual([])
  })

  it('addCycles creates all cycles', async () => {
    const a1 = await api.createAccount({ name: 'Uno', owner: 'PERSONA' })
    await api.addCycles(a1, [
      { closingDate: '2026-11-15', dueDate: '2026-11-25' },
      { closingDate: '2026-12-15', dueDate: null },
    ])
    expect(await ids('cycles')).toEqual([`${a1}_2026-11-15`, `${a1}_2026-12-15`])
    const data = await nextData(db, (d) => d.cycles.length === 2)
    expect(data.cycles.find((c) => c.closingDate === '2026-12-15')).toEqual({
      accountId: a1,
      closingDate: '2026-12-15',
      dueDate: null,
    })
  })

  it('addCycles writes nothing when one cycle is rejected by the rules', async () => {
    const a1 = await api.createAccount({ name: 'Uno', owner: 'PERSONA' })
    await expect(
      api.addCycles(a1, [
        { closingDate: '2026-11-15', dueDate: '2026-11-25' },
        { closingDate: '2026-12-15', dueDate: '2026-12-01' }, // due before closing
      ]),
    ).rejects.toThrow()
    expect(await ids('cycles')).toEqual([])
  })

  it('addCycles rejects a closing date that already exists and keeps the stored due date', async () => {
    const a1 = await api.createAccount({ name: 'Uno', owner: 'PERSONA' })
    await api.addCycles(a1, [{ closingDate: '2026-11-15', dueDate: '2026-11-25' }])
    await expect(
      api.addCycles(a1, [
        { closingDate: '2026-12-15', dueDate: '2026-12-26' },
        { closingDate: '2026-11-15', dueDate: '2026-11-30' },
      ]),
    ).rejects.toThrow()
    expect(await ids('cycles')).toEqual([`${a1}_2026-11-15`])
    expect((await getDoc(doc(db, `cycles/${a1}_2026-11-15`))).data()?.dueDate).toBe('2026-11-25')
  })

  it('deleteCycle removes it', async () => {
    const a1 = await api.createAccount({ name: 'Uno', owner: 'PERSONA' })
    await api.addCycles(a1, [{ closingDate: '2026-11-15', dueDate: null }])
    await api.deleteCycle(a1, '2026-11-15')
    expect(await ids('cycles')).toEqual([])
  })

  it('deleteAccount removes its cycles and cards in one batch and leaves another account untouched', async () => {
    const a1 = await api.createAccount({ name: 'Uno', owner: 'PERSONA' })
    const a2 = await api.createAccount({ name: 'Dos', owner: 'OTRA' })
    await api.addCycles(a1, [
      { closingDate: '2026-11-15', dueDate: null },
      { closingDate: '2026-12-15', dueDate: null },
    ])
    await api.addCycles(a2, [{ closingDate: '2026-11-15', dueDate: null }])
    await api.saveCard({ last4: '1111', type: 'credit', holder: 'PERSONA', accountId: a1 })
    await api.saveCard({ last4: '2222', type: 'debit', holder: 'PERSONA', accountId: a1 })
    await api.saveCard({ last4: '3333', type: 'credit', holder: 'OTRA', accountId: a2 })

    await api.deleteAccount(a1)

    expect(await ids('accounts')).toEqual([a2])
    expect(await ids('cycles')).toEqual([`${a2}_2026-11-15`])
    expect(await ids('cards')).toEqual(['3333_credit'])
  })

  it('a person without the claim gets a permission error from the source', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore() as unknown as Firestore, 'accounts/a1'), { name: 'Uno', owner: 'X' })
    })
    const outsider = testEnv.authenticatedContext('u2', { email_verified: true }).firestore() as unknown as Firestore
    await expect(nextData(outsider)).rejects.toMatchObject({ code: 'permission-denied' })
  })
})

describe('cards source behaviour', () => {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  it('emits a fresh object on every snapshot that reflects the new data', async () => {
    const emissions: CardsData[] = []
    const unsubscribe = createFirestoreCardsSource(db).subscribe((d) => emissions.push(d), () => {})
    const waitFor = async (n: number) => {
      for (let i = 0; i < 100 && !emissions.some((d) => d.accounts.length === n); i++) await sleep(50)
    }
    await api.createAccount({ name: 'Uno', owner: 'PERSONA' })
    await waitFor(1)
    await api.createAccount({ name: 'Dos', owner: 'OTRA' })
    await waitFor(2)
    unsubscribe()
    expect(emissions.length).toBeGreaterThanOrEqual(2)
    for (let i = 1; i < emissions.length; i++) expect(emissions[i]).not.toBe(emissions[i - 1])
    expect(emissions[emissions.length - 1].accounts).toHaveLength(2)
  })

  it('calls onError exactly once and never onData when all three collections are denied', async () => {
    const outsider = testEnv.authenticatedContext('u2', { email_verified: true }).firestore() as unknown as Firestore
    const errors: Error[] = []
    let dataCalls = 0
    const unsubscribe = createFirestoreCardsSource(outsider).subscribe(
      () => dataCalls++,
      (e) => errors.push(e),
    )
    await sleep(800)
    unsubscribe()
    expect(errors).toHaveLength(1)
    expect(dataCalls).toBe(0)
  })

  it('the returned function unsubscribes all three listeners', async () => {
    let calls = 0
    const unsubscribe = createFirestoreCardsSource(db).subscribe(() => calls++, () => {})
    await nextData(db)
    unsubscribe()
    const before = calls
    const id = await api.createAccount({ name: 'Uno', owner: 'PERSONA' })
    await api.saveCard({ last4: '1234', type: 'credit', holder: 'PERSONA', accountId: id })
    await api.addCycles(id, [{ closingDate: '2026-11-15', dueDate: null }])
    await sleep(500)
    expect(calls).toBe(before)
  })
})
