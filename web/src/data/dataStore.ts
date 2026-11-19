// What the app has read, kept in memory for the life of the page. Writes go to the Backend and then update this copy: nothing is read again.
import type { RatesApi } from '../balance/ratesApi'
import type { CardsApi, CardsData } from '../cards/cardsApi'
import { cardKey, cycleKey, type Cycle } from '../cards/types'
import type { CategoriesApi } from '../categories/categoriesApi'
import type { FixedApi } from '../fixed/fixedApi'
import type { CapsApi } from '../home/capsApi'
import type { Expense } from '../lib/expense'
import { merchantKey } from '../merchants/merchantKey'
import type { MerchantsApi } from '../merchants/merchantsApi'
import type { EntriesApi, Entry, EntryKind } from '../money/entries'
import { strings } from '../strings'
import type { Backend, PurchaseRef } from './backend'
import { expenseToUncategorized, newestEntryFirst, newestFirst } from './monthDoc'
import { monthOfDay } from './months'
import type { AppConfig, MonthData, MonthId, UncategorizedItem } from './types'

export type Load<T> = { status: 'loading' | 'ready' | 'error'; data: T | null; error: string | null }
export type StoreState = {
  config: Load<AppConfig>
  uncategorized: Load<UncategorizedItem[]>
  // null data = the month does not exist
  months: ReadonlyMap<MonthId, Load<MonthData | null>>
}

type MonthPatch = (m: MonthData) => MonthData

const pending = <T>(): Load<T> => ({ status: 'loading', data: null, error: null })
const ready = <T>(data: T): Load<T> => ({ status: 'ready', data, error: null })
const failed = <T>(): Load<T> => ({ status: 'error', data: null, error: strings.loadError })

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es-AR')
const byKey =
  <T>(key: (x: T) => string) =>
  (a: T, b: T) =>
    key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0
const ofCycle = (c: Cycle) => cycleKey(c.accountId, c.closingDate)

export class DataStore {
  readonly cardsApi: CardsApi
  readonly categoriesApi: CategoriesApi
  readonly merchantsApi: MerchantsApi
  readonly fixedApi: FixedApi
  readonly ratesApi: RatesApi
  readonly capsApi: CapsApi

  private readonly backend: Backend
  private state: StoreState = { config: pending(), uncategorized: pending(), months: new Map() }
  private readonly listeners = new Set<() => void>()
  private readonly loads: { config?: Promise<void>; uncategorized?: Promise<void> } = {}
  private readonly monthLoads = new Map<MonthId, Promise<void>>()
  // Writes made while a month is being read, applied to what the read returns.
  private readonly queued = new Map<MonthId, MonthPatch[]>()
  private readonly entriesApis = new Map<EntryKind, EntriesApi>()

  constructor(backend: Backend) {
    this.backend = backend
    const cards = backend.cards
    this.cardsApi = {
      createAccount: async (input) => {
        const id = await cards.createAccount(input)
        this.patchCards((c) => ({ ...c, accounts: [...c.accounts, { id, name: input.name, owner: input.owner }].sort(byKey((a) => a.id)) }))
        return id
      },
      updateAccount: async (id, input) => {
        await cards.updateAccount(id, input)
        this.patchCards((c) => ({ ...c, accounts: c.accounts.map((a) => (a.id === id ? { id, name: input.name, owner: input.owner } : a)) }))
      },
      deleteAccount: async (id) => {
        await cards.deleteAccount(id)
        this.patchCards((c) => ({
          accounts: c.accounts.filter((a) => a.id !== id),
          cards: c.cards.filter((x) => x.accountId !== id),
          cycles: c.cycles.filter((x) => x.accountId !== id),
        }))
      },
      saveCard: async (card) => {
        await cards.saveCard(card)
        const saved = { last4: card.last4, type: card.type, holder: card.holder, accountId: card.accountId }
        this.patchCards((c) => ({ ...c, cards: [...c.cards.filter((x) => cardKey(x) !== cardKey(card)), saved].sort(byKey(cardKey)) }))
      },
      removeCard: async (card) => {
        await cards.removeCard(card)
        this.patchCards((c) => ({ ...c, cards: c.cards.filter((x) => cardKey(x) !== cardKey(card)) }))
      },
      addCycles: async (accountId, cycles) => {
        await cards.addCycles(accountId, cycles)
        const added = cycles.map((x) => ({ accountId, closingDate: x.closingDate, dueDate: x.dueDate }))
        const keys = new Set(added.map(ofCycle))
        this.patchCards((c) => ({ ...c, cycles: [...c.cycles.filter((x) => !keys.has(ofCycle(x))), ...added].sort(byKey(ofCycle)) }))
      },
      deleteCycle: async (accountId, closingDate) => {
        await cards.deleteCycle(accountId, closingDate)
        this.patchCards((c) => ({ ...c, cycles: c.cycles.filter((x) => ofCycle(x) !== cycleKey(accountId, closingDate)) }))
      },
    }

    this.categoriesApi = {
      create: async (input) => {
        const id = await backend.createCategory(input)
        const category = { id, name: input.name, color: input.color, archived: false }
        this.patchConfig((c) => ({ ...c, categories: [...c.categories, category].sort(byName) }))
        return id
      },
      update: async (id, input) => {
        await backend.updateCategory(id, input)
        const categories = (c: AppConfig) => c.categories.map((x) => (x.id === id ? { ...x, name: input.name, color: input.color } : x)).sort(byName)
        this.patchConfig((c) => ({ ...c, categories: categories(c) }))
      },
      setArchived: async (id, archived) => {
        const drop = archived ? (this.state.config.data?.merchants ?? []).filter((m) => m.categoryId === id).map((m) => m.key) : []
        await backend.setCategoryArchived(id, archived, drop)
        this.patchConfig((c) => ({
          ...c,
          categories: c.categories.map((x) => (x.id === id ? { ...x, archived } : x)),
          merchants: c.merchants.filter((m) => !drop.includes(m.key)),
        }))
      },
      setExpenseCategory: (expense, categoryId) => this.setCategory(expense, categoryId),
    }

    this.merchantsApi = {
      remember: async (merchant, categoryId) => {
        await backend.rememberMerchant(merchant, categoryId)
        this.rememberLocally(merchant, categoryId)
      },
    }

    this.fixedApi = {
      addType: async (name) => {
        const id = await backend.addFixedType(name)
        this.patchConfig((c) => ({ ...c, fixedTypes: [...c.fixedTypes, { id, name, disabled: false }].sort(byName) }))
        return id
      },
      renameType: async (id, name) => {
        await backend.renameFixedType(id, name)
        this.patchConfig((c) => ({ ...c, fixedTypes: c.fixedTypes.map((t) => (t.id === id ? { ...t, name } : t)).sort(byName) }))
      },
      setTypeDisabled: async (id, disabled) => {
        await backend.setFixedTypeDisabled(id, disabled)
        this.patchConfig((c) => ({ ...c, fixedTypes: c.fixedTypes.map((t) => (t.id === id ? { ...t, disabled } : t)) }))
      },
      save: async (typeId, month, amount) => {
        await backend.setFixed(month, typeId, amount)
        this.patchMonth(month, (m) => ({ ...m, fixed: { ...m.fixed, [typeId]: amount } }))
      },
      clear: async (typeId, month) => {
        await backend.setFixed(month, typeId, null)
        this.patchMonth(month, (m) => ({ ...m, fixed: Object.fromEntries(Object.entries(m.fixed).filter(([id]) => id !== typeId)) }))
      },
    }

    this.ratesApi = {
      save: async (month, rate) => {
        await backend.setRate(month, rate)
        this.patchMonth(month, (m) => ({ ...m, rate, rateInherited: false }))
      },
    }

    this.capsApi = {
      save: async (month, amount) => {
        await backend.setCap(month, amount)
        this.patchMonth(month, (m) => ({ ...m, cap: amount, capInherited: false }))
      },
      remove: async (month) => {
        await backend.setCap(month, null)
        this.patchMonth(month, (m) => ({ ...m, cap: null, capInherited: false }))
      },
    }
  }

  getState = (): StoreState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  loadConfig(): Promise<void> {
    return this.loadOnce('config', () => this.backend.readConfig())
  }

  loadUncategorized(): Promise<void> {
    return this.loadOnce('uncategorized', () => this.backend.readUncategorized())
  }

  async ensureMonths(ids: MonthId[] | 'all'): Promise<void> {
    if (ids === 'all') {
      await this.loadConfig()
      ids = this.state.config.data?.months ?? []
    }
    const fresh = [...new Set(ids)].filter((id) => !this.monthLoads.has(id))
    if (fresh.length) {
      const months = new Map(this.state.months)
      for (const id of fresh) {
        months.set(id, pending())
        this.queued.set(id, [])
        this.monthLoads.set(id, this.readMonth(id))
      }
      this.set({ months })
    }
    await Promise.all(ids.map((id) => this.monthLoads.get(id)))
  }

  entriesApi(kind: EntryKind): EntriesApi {
    let api = this.entriesApis.get(kind)
    if (!api) {
      api = {
        add: async (entry) => {
          const id = await this.backend.addEntry(kind, entry)
          const saved: Entry = { id, ...entry }
          this.patchMonth(monthOfDay(entry.date), (m) => ({ ...m, [kind]: [...m[kind].filter((e) => e.id !== id), saved].sort(newestEntryFirst) }))
          return id
        },
        remove: async (entry) => {
          await this.backend.removeEntry(kind, entry)
          this.patchMonth(monthOfDay(entry.date), (m) => ({ ...m, [kind]: m[kind].filter((e) => e.id !== entry.id) }))
        },
      }
      this.entriesApis.set(kind, api)
    }
    return api
  }

  async categorize(expense: Expense, categoryId: string | null): Promise<void> {
    const key = merchantKey(expense.merchant)
    if (!categoryId || !key) return this.setCategory(expense, categoryId)
    const sameMerchant = (this.state.uncategorized.data ?? []).filter((i) => i.id !== expense.id && merchantKey(i.merchant) === key)
    const refs: PurchaseRef[] = [{ month: expense.month, id: expense.id }, ...sameMerchant.map((i) => ({ month: i.month, id: i.id }))]
    await this.backend.categorizeMerchant(expense.merchant, categoryId, refs)
    this.rememberLocally(expense.merchant, categoryId)
    this.applyCategory(refs, categoryId)
  }

  private async setCategory(expense: Expense, categoryId: string | null) {
    const ref = { month: expense.month, id: expense.id }
    const listed = categoryId === null && expense.status !== 'rejected' ? expenseToUncategorized(expense) : null
    await this.backend.setExpenseCategory(ref, categoryId, listed)
    this.applyCategory([ref], categoryId)
    if (listed) this.patchUncategorized((list) => [...list.filter((i) => i.id !== listed.id), listed].sort(newestFirst))
  }

  private applyCategory(refs: PurchaseRef[], categoryId: string | null) {
    for (const ref of refs) {
      this.patchMonth(ref.month, (m) => ({ ...m, expenses: m.expenses.map((e) => (e.id === ref.id ? { ...e, categoryId } : e)) }))
    }
    if (categoryId) {
      const ids = new Set(refs.map((r) => r.id))
      this.patchUncategorized((list) => list.filter((i) => !ids.has(i.id)))
    }
  }

  private rememberLocally(merchant: string, categoryId: string) {
    const key = merchantKey(merchant)
    if (!key) return
    this.patchConfig((c) => ({
      ...c,
      merchants: [...c.merchants.filter((m) => m.key !== key), { key, merchant, categoryId }].sort((a, b) => a.merchant.localeCompare(b.merchant, 'es-AR')),
    }))
  }

  private loadOnce<K extends 'config' | 'uncategorized'>(key: K, read: () => Promise<NonNullable<StoreState[K]['data']>>): Promise<void> {
    let load = this.loads[key]
    if (!load) {
      if (this.state[key].status !== 'loading') this.set({ [key]: pending() })
      load = read().then(
        (data) => this.set({ [key]: ready(data) }),
        () => {
          delete this.loads[key]
          this.set({ [key]: failed() })
        },
      )
      this.loads[key] = load
    }
    return load
  }

  private async readMonth(id: MonthId): Promise<void> {
    let data: MonthData | null
    try {
      data = await this.backend.readMonth(id)
    } catch {
      this.queued.delete(id)
      this.monthLoads.delete(id)
      this.setMonth(id, failed())
      return
    }
    const patches = this.queued.get(id) ?? []
    this.queued.delete(id)
    if (data === null && patches.length) {
      // A write created the month during the read: drop it so it is read again.
      this.monthLoads.delete(id)
      this.setMonth(id, undefined)
    } else this.setMonth(id, ready(data && patches.reduce((m, patch) => patch(m), data)))
  }

  // Month writes may create the month: then it joins config.months and a cached "does not exist" is dropped.
  private patchMonth(id: MonthId, patch: MonthPatch) {
    const next: Partial<StoreState> = {}
    const entry = this.state.months.get(id)
    if (entry?.status === 'loading') this.queued.get(id)?.push(patch)
    else if (entry?.status === 'ready') {
      const months = new Map(this.state.months)
      if (entry.data) months.set(id, ready(patch(entry.data)))
      else {
        months.delete(id)
        this.monthLoads.delete(id)
      }
      next.months = months
    }
    const config = this.state.config.data
    if (config && !config.months.includes(id)) next.config = ready({ ...config, months: [...config.months, id].sort() })
    if (next.months || next.config) this.set(next)
  }

  private setMonth(id: MonthId, load: Load<MonthData | null> | undefined) {
    const months = new Map(this.state.months)
    if (load) months.set(id, load)
    else months.delete(id)
    this.set({ months })
  }

  private patchConfig(patch: (c: AppConfig) => AppConfig) {
    const config = this.state.config.data
    if (config) this.set({ config: ready(patch(config)) })
  }

  private patchCards(patch: (c: CardsData) => CardsData) {
    this.patchConfig((c) => ({ ...c, cards: patch(c.cards) }))
  }

  private patchUncategorized(patch: (list: UncategorizedItem[]) => UncategorizedItem[]) {
    const list = this.state.uncategorized.data
    if (list) this.set({ uncategorized: ready(patch(list)) })
  }

  private set(next: Partial<StoreState>) {
    this.state = { ...this.state, ...next }
    for (const listener of this.listeners) listener()
  }
}
