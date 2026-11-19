// Firestore implementation of the Backend. Access is enforced by the Firestore rules, not by this code.
import {
  arrayUnion,
  deleteField,
  doc,
  FieldPath,
  getDoc,
  runTransaction,
  setDoc,
  Timestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import type { CardsApi } from '../cards/cardsApi'
import { cardKey, cycleKey } from '../cards/types'
import { merchantKey } from '../merchants/merchantKey'
import type { Backend, PurchaseRef } from './backend'
import { toAppConfig, toMonthData, toUncategorized } from './monthDoc'
import { inheritSource, monthOfDay } from './months'
import type { MonthId, UncategorizedItem } from './types'

type Raw = Record<string, unknown>
// A nested set of field changes. DELETE removes the field; it becomes deleteField() when written.
type Patch = { [key: string]: unknown }
const DELETE = Symbol('delete')

const isMap = (value: unknown): value is Patch => typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype

// Empty maps are dropped: in a merge they would replace the whole map instead of changing nothing.
function toFirestore(patch: Patch): Patch {
  return Object.fromEntries(
    Object.entries(patch)
      .filter(([, value]) => !isMap(value) || Object.keys(value).length > 0)
      .map(([key, value]) => [key, value === DELETE ? deleteField() : isMap(value) ? toFirestore(value) : value]),
  )
}

/** `base` with `patch` applied, as a merge would leave it. */
function applied(base: Patch, patch: Patch): Patch {
  const result = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (value === DELETE) delete result[key]
    else if (isMap(value)) result[key] = applied(isMap(result[key]) ? result[key] : {}, value)
    else result[key] = value
  }
  return result
}

const emptyMonth = { purchases: {}, edits: {}, incomes: {}, savings: {}, fixed: {} }

function uncategorizedDoc(item: UncategorizedItem): Raw {
  const { month, merchant, amount, currency, purchaseDate, cardLast4, cardType, cardHolder } = item
  return { month, merchant, amount, currency, purchaseDate: Timestamp.fromDate(purchaseDate), cardLast4, cardType, cardHolder }
}

export function createFirestoreBackend(db: Firestore): Backend {
  const configRef = (name: string) => doc(db, 'config', name)
  const monthRef = (id: MonthId) => doc(db, 'months', id)
  const uncategorizedRef = doc(db, 'meta', 'uncategorized')
  const merge = (name: string, patch: Patch) => setDoc(configRef(name), toFirestore(patch), { merge: true })

  // Creates the month when missing, as the ingestion does (src/store.js), and applies the patch in one write.
  async function writeMonth(month: MonthId, patch: Patch) {
    await runTransaction(db, async (tx) => {
      const ref = monthRef(month)
      const snap = await tx.get(ref)
      if (snap.exists()) {
        tx.set(ref, toFirestore(patch), { merge: true })
        return
      }
      const monthsRef = configRef('months')
      const list = ((await tx.get(monthsRef)).data()?.list as MonthId[] | undefined) ?? []
      const source = inheritSource(list, month)
      const from = source ? (await tx.get(monthRef(source))).data() : undefined
      const rate = (from?.rate as number | null | undefined) ?? null
      const cap = (from?.cap as number | null | undefined) ?? null
      tx.set(ref, applied({ ...emptyMonth, rate, rateInherited: rate !== null, cap, capInherited: cap !== null }, patch))
      tx.set(monthsRef, { list: arrayUnion(month) }, { merge: true })
    })
  }

  const cards: CardsApi = {
    async createAccount(input) {
      const id = crypto.randomUUID()
      await merge('cards', { accounts: { [id]: { name: input.name, owner: input.owner } } })
      return id
    },
    async updateAccount(id, input) {
      await merge('cards', { accounts: { [id]: { name: input.name, owner: input.owner } } })
    },
    async deleteAccount(id) {
      // The cards and cycles of the account go with it, in the same write.
      await runTransaction(db, async (tx) => {
        const data = (await tx.get(configRef('cards'))).data() ?? {}
        const ofAccount = (map: unknown) =>
          Object.fromEntries(
            Object.entries((map as Record<string, Raw> | undefined) ?? {})
              .filter(([, d]) => d.accountId === id)
              .map(([key]) => [key, DELETE]),
          )
        const patch = { accounts: { [id]: DELETE }, cards: ofAccount(data.cards), cycles: ofAccount(data.cycles) }
        tx.set(configRef('cards'), toFirestore(patch), { merge: true })
      })
    },
    async saveCard(card) {
      const { last4, type, holder, accountId } = card
      await merge('cards', { cards: { [cardKey(card)]: { last4, type, holder, accountId } } })
    },
    async removeCard(card) {
      await merge('cards', { cards: { [cardKey(card)]: DELETE } })
    },
    async addCycles(accountId, cycles) {
      if (cycles.length === 0) return
      const entries = cycles.map((c) => [cycleKey(accountId, c.closingDate), { accountId, closingDate: c.closingDate, dueDate: c.dueDate }])
      await merge('cards', { cycles: Object.fromEntries(entries) })
    },
    async deleteCycle(accountId, closingDate) {
      await merge('cards', { cycles: { [cycleKey(accountId, closingDate)]: DELETE } })
    },
  }

  return {
    async readConfig() {
      const [cardsSnap, categories, fixedTypes, merchants, months] = await Promise.all(
        ['cards', 'categories', 'fixedTypes', 'merchants', 'months'].map((name) => getDoc(configRef(name))),
      )
      return toAppConfig({
        cards: cardsSnap.data() ?? null,
        categories: categories.data() ?? null,
        fixedTypes: fixedTypes.data() ?? null,
        merchants: merchants.data() ?? null,
        months: months.data() ?? null,
      })
    },
    async readMonth(id) {
      const snap = await getDoc(monthRef(id))
      return snap.exists() ? toMonthData(id, snap.data()) : null
    },
    async readUncategorized() {
      return toUncategorized((await getDoc(uncategorizedRef)).data() ?? null)
    },
    cards,
    async createCategory(input) {
      const id = crypto.randomUUID()
      await merge('categories', { items: { [id]: { name: input.name, color: input.color, archived: false } } })
      return id
    },
    async updateCategory(id, input) {
      await merge('categories', { items: { [id]: { name: input.name, color: input.color } } })
    },
    async setCategoryArchived(id, archived, dropMerchantKeys) {
      const batch = writeBatch(db)
      batch.set(configRef('categories'), toFirestore({ items: { [id]: { archived } } }), { merge: true })
      if (dropMerchantKeys.length > 0) {
        const items = Object.fromEntries(dropMerchantKeys.map((key) => [key, DELETE]))
        batch.set(configRef('merchants'), toFirestore({ items }), { merge: true })
      }
      await batch.commit()
    },
    async rememberMerchant(merchant, categoryId) {
      const key = merchantKey(merchant)
      if (!key) return
      await merge('merchants', { items: { [key]: { merchant, categoryId } } })
    },
    async setExpenseCategory(ref, categoryId, listAsUncategorized) {
      const batch = writeBatch(db)
      batch.update(monthRef(ref.month), new FieldPath('edits', ref.id, 'category'), categoryId ?? deleteField())
      if (categoryId) batch.set(uncategorizedRef, toFirestore({ items: { [ref.id]: DELETE } }), { merge: true })
      else if (listAsUncategorized) batch.set(uncategorizedRef, { items: { [ref.id]: uncategorizedDoc(listAsUncategorized) } }, { merge: true })
      await batch.commit()
    },
    async categorizeMerchant(merchant, categoryId, refs) {
      const batch = writeBatch(db)
      const key = merchantKey(merchant)
      if (key) batch.set(configRef('merchants'), { items: { [key]: { merchant, categoryId } } }, { merge: true })
      const byMonth = new Map<MonthId, PurchaseRef[]>()
      for (const ref of refs) byMonth.set(ref.month, [...(byMonth.get(ref.month) ?? []), ref])
      for (const [month, ofMonth] of byMonth) {
        const [first, ...rest] = ofMonth.map((r) => new FieldPath('edits', r.id, 'category'))
        batch.update(monthRef(month), first, categoryId, ...rest.flatMap((field) => [field, categoryId]))
      }
      if (refs.length > 0) {
        const items = Object.fromEntries(refs.map((r) => [r.id, DELETE]))
        batch.set(uncategorizedRef, toFirestore({ items }), { merge: true })
      }
      await batch.commit()
    },
    async addFixedType(name) {
      const id = crypto.randomUUID()
      await merge('fixedTypes', { items: { [id]: { name, disabled: false } } })
      return id
    },
    async renameFixedType(id, name) {
      await merge('fixedTypes', { items: { [id]: { name } } })
    },
    async setFixedTypeDisabled(id, disabled) {
      await merge('fixedTypes', { items: { [id]: { disabled } } })
    },
    async setFixed(month, typeId, amount) {
      await writeMonth(month, { fixed: { [typeId]: amount ?? DELETE } })
    },
    async addEntry(kind, entry) {
      const id = crypto.randomUUID()
      const { amount, currency, date, owner } = entry
      await writeMonth(monthOfDay(date), { [kind]: { [id]: { amount, currency, date, ...(owner ? { owner } : {}) } } })
      return id
    },
    async removeEntry(kind, entry) {
      await writeMonth(monthOfDay(entry.date), { [kind]: { [entry.id]: DELETE } })
    },
    async setRate(month, rate) {
      await writeMonth(month, { rate, rateInherited: false })
    },
    async setCap(month, amount) {
      await writeMonth(month, { cap: amount, capInherited: false })
    },
  }
}
