// Turns the raw month, config and meta documents into the shapes the app computes with.
import type { Rates } from '../balance/ratesApi'
import type { CardsData } from '../cards/cardsApi'
import type { Card } from '../cards/types'
import type { Category } from '../categories/types'
import type { FixedData, FixedType } from '../fixed/fixedApi'
import type { Caps } from '../home/capsApi'
import type { Expense } from '../lib/expense'
import type { MerchantEntry } from '../merchants/merchantsApi'
import type { Entry, EntryKind } from '../money/entries'
import type { AppConfig, MonthData, MonthId, SeenCard, UncategorizedItem } from './types'

type Raw = Record<string, unknown>
type TimestampLike = { toDate(): Date }

const mapOf = (value: unknown): Record<string, Raw> => (value && typeof value === 'object' ? (value as Record<string, Raw>) : {})
const byKey = (map: Record<string, Raw>) => Object.entries(map).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
const dateOf = (value: unknown) => (value as TimestampLike).toDate()
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es-AR')
const newestExpenseFirst = (a: Expense, b: Expense) => b.purchaseDate.getTime() - a.purchaseDate.getTime()
const newestEntryFirst = (a: Entry, b: Entry) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)

function toEntry(id: string, d: Raw): Entry {
  return { id, amount: d.amount as number, currency: d.currency as Entry['currency'], date: d.date as string, ...(d.owner ? { owner: d.owner as string } : {}) }
}

export function toMonthData(id: MonthId, raw: Raw): MonthData {
  const edits = mapOf(raw.edits)
  const expenses = Object.entries(mapOf(raw.purchases)).map(
    ([purchaseId, p]): Expense => ({
      id: purchaseId,
      month: id,
      purchaseDate: dateOf(p.purchaseDate),
      receivedAt: dateOf(p.receivedAt),
      merchant: p.merchant as string,
      amount: p.amount as number,
      currency: p.currency as string,
      cardLast4: p.cardLast4 as string,
      cardType: p.cardType as Expense['cardType'],
      cardHolder: p.cardHolder as string,
      status: p.status as Expense['status'],
      categoryId: (edits[purchaseId]?.category as string | undefined) ?? null,
    }),
  )
  return {
    id,
    expenses: expenses.sort(newestExpenseFirst),
    incomes: Object.entries(mapOf(raw.incomes)).map(([entryId, d]) => toEntry(entryId, d)).sort(newestEntryFirst),
    savings: Object.entries(mapOf(raw.savings)).map(([entryId, d]) => toEntry(entryId, d)).sort(newestEntryFirst),
    fixed: { ...(raw.fixed as Record<string, number> | undefined) },
    rate: (raw.rate as number | null | undefined) ?? null,
    rateInherited: raw.rateInherited === true,
    cap: (raw.cap as number | null | undefined) ?? null,
    capInherited: raw.capInherited === true,
  }
}

type RawConfig = { cards?: Raw | null; categories?: Raw | null; fixedTypes?: Raw | null; merchants?: Raw | null; months?: Raw | null }

export function toAppConfig(raw: RawConfig): AppConfig {
  const cards = raw.cards ?? {}
  const cardsData: CardsData = {
    accounts: byKey(mapOf(cards.accounts)).map(([id, d]) => ({ id, name: d.name as string, owner: d.owner as string })),
    cards: byKey(mapOf(cards.cards)).map(([, d]) => ({
      last4: d.last4 as string,
      type: d.type as Card['type'],
      holder: d.holder as string,
      accountId: d.accountId as string,
    })),
    cycles: byKey(mapOf(cards.cycles)).map(([, d]) => ({
      accountId: d.accountId as string,
      closingDate: d.closingDate as string,
      dueDate: (d.dueDate as string | null | undefined) ?? null,
    })),
  }
  const seenCards = byKey(mapOf(cards.seenCards)).map(
    ([, d]): SeenCard => ({ last4: d.last4 as string, type: d.type as SeenCard['type'], holder: d.holder as string, lastSeen: d.lastSeen as string }),
  )
  const categories = byKey(mapOf(raw.categories?.items))
    .map(([id, d]): Category => ({ id, name: d.name as string, color: d.color as string, archived: d.archived === true }))
    .sort(byName)
  const fixedTypes = byKey(mapOf(raw.fixedTypes?.items))
    .map(([id, d]): FixedType => ({ id, name: d.name as string, disabled: d.disabled === true }))
    .sort(byName)
  const merchants = byKey(mapOf(raw.merchants?.items))
    .map(([key, d]): MerchantEntry => ({ key, merchant: d.merchant as string, categoryId: d.categoryId as string }))
    .sort((a, b) => a.merchant.localeCompare(b.merchant, 'es-AR'))
  const months = [...((raw.months?.list as MonthId[] | undefined) ?? [])].sort()
  return { cards: cardsData, seenCards, categories, fixedTypes, merchants, months }
}

/** The `meta/uncategorized` document, newest purchase first. */
export function toUncategorized(raw: Raw | null | undefined): UncategorizedItem[] {
  return Object.entries(mapOf(raw?.items))
    .map(
      ([id, d]): UncategorizedItem => ({
        id,
        month: d.month as MonthId,
        merchant: d.merchant as string,
        amount: d.amount as number,
        currency: d.currency as string,
        purchaseDate: dateOf(d.purchaseDate),
        cardLast4: d.cardLast4 as string,
        cardType: d.cardType as UncategorizedItem['cardType'],
        cardHolder: d.cardHolder as string,
      }),
    )
    .sort((a, b) => b.purchaseDate.getTime() - a.purchaseDate.getTime())
}

export function uncategorizedToExpense(item: UncategorizedItem): Expense {
  return { ...item, receivedAt: item.purchaseDate, status: 'approved', categoryId: null }
}

export function expenseToUncategorized(e: Expense): UncategorizedItem {
  return {
    id: e.id,
    month: e.month,
    merchant: e.merchant,
    amount: e.amount,
    currency: e.currency,
    purchaseDate: e.purchaseDate,
    cardLast4: e.cardLast4,
    cardType: e.cardType,
    cardHolder: e.cardHolder,
  }
}

export function expensesOf(months: MonthData[]): Expense[] {
  return months.flatMap((m) => m.expenses).sort(newestExpenseFirst)
}

export function ratesOf(months: MonthData[]): Rates {
  return Object.fromEntries(months.filter((m) => m.rate !== null).map((m) => [m.id, m.rate as number]))
}

export function capsOf(months: MonthData[]): Caps {
  return Object.fromEntries(months.filter((m) => m.cap !== null).map((m) => [m.id, m.cap as number]))
}

export function fixedOf(types: FixedType[], months: MonthData[]): FixedData {
  return { types, entries: months.flatMap((m) => Object.entries(m.fixed).map(([typeId, amount]) => ({ typeId, month: m.id, amount }))) }
}

export function entriesOf(kind: EntryKind, months: MonthData[]): Entry[] {
  return months.flatMap((m) => m[kind]).sort(newestEntryFirst)
}
