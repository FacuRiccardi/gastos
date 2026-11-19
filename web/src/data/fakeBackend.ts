// In-memory Backend for tests. It keeps the raw documents and reads them with the same conversions as Firestore.
import type { CardsApi } from '../cards/cardsApi'
import { cardKey, cycleKey } from '../cards/types'
import { merchantKey } from '../merchants/merchantKey'
import type { Entry } from '../money/entries'
import type { Backend } from './backend'
import { toAppConfig, toMonthData, toUncategorized } from './monthDoc'
import { inheritSource, monthOfDay } from './months'
import type { AppConfig, MonthData, MonthId, UncategorizedItem } from './types'

type Patch = { [key: string]: unknown }
const DELETE = Symbol('delete')

// Stands in for a Firestore Timestamp.
class Stamp {
  date: Date
  constructor(date: Date) {
    this.date = date
  }
  toDate() {
    return this.date
  }
}

const isMap = (value: unknown): value is Patch => typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype

function mergeInto(target: Patch, patch: Patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (value === DELETE) delete target[key]
    else if (isMap(value)) {
      if (!isMap(target[key])) target[key] = {}
      mergeInto(target[key] as Patch, value)
    } else target[key] = value
  }
}

const entryDoc = ({ amount, currency, date, owner }: Omit<Entry, 'id'>) => ({ amount, currency, date, ...(owner ? { owner } : {}) })

const uncategorizedDoc = ({ month, merchant, amount, currency, purchaseDate, cardLast4, cardType, cardHolder }: UncategorizedItem) => ({
  month,
  merchant,
  amount,
  currency,
  purchaseDate: new Stamp(purchaseDate),
  cardLast4,
  cardType,
  cardHolder,
})

function monthDoc(m: MonthData): Patch {
  return {
    purchases: Object.fromEntries(
      m.expenses.map((e) => [
        e.id,
        {
          purchaseDate: new Stamp(e.purchaseDate),
          receivedAt: new Stamp(e.receivedAt),
          merchant: e.merchant,
          amount: e.amount,
          currency: e.currency,
          cardLast4: e.cardLast4,
          cardType: e.cardType,
          cardHolder: e.cardHolder,
          status: e.status,
        },
      ]),
    ),
    edits: Object.fromEntries(m.expenses.filter((e) => e.categoryId).map((e) => [e.id, { category: e.categoryId }])),
    incomes: Object.fromEntries(m.incomes.map((e) => [e.id, entryDoc(e)])),
    savings: Object.fromEntries(m.savings.map((e) => [e.id, entryDoc(e)])),
    fixed: { ...m.fixed },
    rate: m.rate,
    rateInherited: m.rateInherited,
    cap: m.cap,
    capInherited: m.capInherited,
  }
}

function configDocs(config: Partial<AppConfig>, months: MonthData[]): Record<string, Patch> {
  const cards = config.cards ?? { accounts: [], cards: [], cycles: [] }
  return {
    'config/cards': {
      accounts: Object.fromEntries(cards.accounts.map((a) => [a.id, { name: a.name, owner: a.owner }])),
      cards: Object.fromEntries(cards.cards.map((c) => [cardKey(c), { ...c }])),
      cycles: Object.fromEntries(cards.cycles.map((c) => [cycleKey(c.accountId, c.closingDate), { ...c }])),
      seenCards: Object.fromEntries((config.seenCards ?? []).map((c) => [cardKey(c), { ...c }])),
    },
    'config/categories': { items: Object.fromEntries((config.categories ?? []).map(({ id, ...c }) => [id, c])) },
    'config/fixedTypes': { items: Object.fromEntries((config.fixedTypes ?? []).map(({ id, ...t }) => [id, t])) },
    'config/merchants': { items: Object.fromEntries((config.merchants ?? []).map(({ key, ...m }) => [key, m])) },
    'config/months': { list: [...(config.months ?? months.map((m) => m.id))] },
  }
}

export function createFakeBackend(
  seed: { config?: Partial<AppConfig>; months?: MonthData[]; uncategorized?: UncategorizedItem[] } = {},
): Backend & { reads: string[] } {
  const reads: string[] = []
  const docs = new Map<string, Patch>(Object.entries(configDocs(seed.config ?? {}, seed.months ?? [])))
  for (const m of seed.months ?? []) docs.set(`months/${m.id}`, monthDoc(m))
  docs.set('meta/uncategorized', { items: Object.fromEntries((seed.uncategorized ?? []).map((i) => [i.id, uncategorizedDoc(i)])) })

  const merge = (path: string, patch: Patch) => {
    if (!docs.has(path)) docs.set(path, {})
    mergeInto(docs.get(path) as Patch, patch)
  }
  // Like Firestore's update: the document must exist.
  const update = (path: string, patch: Patch) => {
    if (!docs.has(path)) throw new Error(`No document to update: ${path}`)
    merge(path, patch)
  }
  const writeMonth = async (month: MonthId, patch: Patch) => {
    const path = `months/${month}`
    if (!docs.has(path)) {
      const list = (docs.get('config/months')?.list as MonthId[] | undefined) ?? []
      const source = inheritSource(list, month)
      const from = source ? docs.get(`months/${source}`) : undefined
      const rate = (from?.rate as number | null | undefined) ?? null
      const cap = (from?.cap as number | null | undefined) ?? null
      docs.set(path, { purchases: {}, edits: {}, incomes: {}, savings: {}, fixed: {}, rate, rateInherited: rate !== null, cap, capInherited: cap !== null })
      merge('config/months', { list: list.includes(month) ? list : [...list, month] })
    }
    merge(path, patch)
  }

  const cards: CardsApi = {
    async createAccount(input) {
      const id = crypto.randomUUID()
      merge('config/cards', { accounts: { [id]: { name: input.name, owner: input.owner } } })
      return id
    },
    async updateAccount(id, input) {
      merge('config/cards', { accounts: { [id]: { name: input.name, owner: input.owner } } })
    },
    async deleteAccount(id) {
      const data = docs.get('config/cards') ?? {}
      const ofAccount = (map: unknown) =>
        Object.fromEntries(
          Object.entries((map as Record<string, Patch> | undefined) ?? {})
            .filter(([, d]) => d.accountId === id)
            .map(([key]) => [key, DELETE]),
        )
      merge('config/cards', { accounts: { [id]: DELETE }, cards: ofAccount(data.cards), cycles: ofAccount(data.cycles) })
    },
    async saveCard(card) {
      const { last4, type, holder, accountId } = card
      merge('config/cards', { cards: { [cardKey(card)]: { last4, type, holder, accountId } } })
    },
    async removeCard(card) {
      merge('config/cards', { cards: { [cardKey(card)]: DELETE } })
    },
    async addCycles(accountId, cycles) {
      const entries = cycles.map((c) => [cycleKey(accountId, c.closingDate), { accountId, closingDate: c.closingDate, dueDate: c.dueDate }])
      merge('config/cards', { cycles: Object.fromEntries(entries) })
    },
    async deleteCycle(accountId, closingDate) {
      merge('config/cards', { cycles: { [cycleKey(accountId, closingDate)]: DELETE } })
    },
  }

  return {
    reads,
    async readConfig() {
      reads.push('config', 'config', 'config', 'config', 'config')
      return toAppConfig({
        cards: docs.get('config/cards') ?? null,
        categories: docs.get('config/categories') ?? null,
        fixedTypes: docs.get('config/fixedTypes') ?? null,
        merchants: docs.get('config/merchants') ?? null,
        months: docs.get('config/months') ?? null,
      })
    },
    async readMonth(id) {
      reads.push(`month:${id}`)
      const raw = docs.get(`months/${id}`)
      return raw ? toMonthData(id, raw) : null
    },
    async readUncategorized() {
      reads.push('uncategorized')
      return toUncategorized(docs.get('meta/uncategorized') ?? null)
    },
    cards,
    async createCategory(input) {
      const id = crypto.randomUUID()
      merge('config/categories', { items: { [id]: { name: input.name, color: input.color, archived: false } } })
      return id
    },
    async updateCategory(id, input) {
      merge('config/categories', { items: { [id]: { name: input.name, color: input.color } } })
    },
    async setCategoryArchived(id, archived, dropMerchantKeys) {
      merge('config/categories', { items: { [id]: { archived } } })
      merge('config/merchants', { items: Object.fromEntries(dropMerchantKeys.map((key) => [key, DELETE])) })
    },
    async rememberMerchant(merchant, categoryId) {
      const key = merchantKey(merchant)
      if (key) merge('config/merchants', { items: { [key]: { merchant, categoryId } } })
    },
    async setExpenseCategory(ref, categoryId, listAsUncategorized) {
      update(`months/${ref.month}`, { edits: { [ref.id]: { category: categoryId ?? DELETE } } })
      if (categoryId) merge('meta/uncategorized', { items: { [ref.id]: DELETE } })
      else if (listAsUncategorized) merge('meta/uncategorized', { items: { [ref.id]: uncategorizedDoc(listAsUncategorized) } })
    },
    async categorizeMerchant(merchant, categoryId, refs) {
      for (const ref of refs) if (!docs.has(`months/${ref.month}`)) throw new Error(`No document to update: months/${ref.month}`)
      const key = merchantKey(merchant)
      if (key) merge('config/merchants', { items: { [key]: { merchant, categoryId } } })
      for (const ref of refs) update(`months/${ref.month}`, { edits: { [ref.id]: { category: categoryId } } })
      merge('meta/uncategorized', { items: Object.fromEntries(refs.map((r) => [r.id, DELETE])) })
    },
    async addFixedType(name) {
      const id = crypto.randomUUID()
      merge('config/fixedTypes', { items: { [id]: { name, disabled: false } } })
      return id
    },
    async renameFixedType(id, name) {
      merge('config/fixedTypes', { items: { [id]: { name } } })
    },
    async setFixedTypeDisabled(id, disabled) {
      merge('config/fixedTypes', { items: { [id]: { disabled } } })
    },
    async setFixed(month, typeId, amount) {
      await writeMonth(month, { fixed: { [typeId]: amount ?? DELETE } })
    },
    async addEntry(kind, entry) {
      const id = crypto.randomUUID()
      await writeMonth(monthOfDay(entry.date), { [kind]: { [id]: entryDoc(entry) } })
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
