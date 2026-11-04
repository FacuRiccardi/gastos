import type { CardsData } from '@/cards/cardsApi'
import { cardKey, type Account, type Card } from '@/cards/types'
import { addDays, buenosAiresDay } from '@/lib/dates'
import type { Expense } from '@/lib/expense'

// Statement periods of an account. Closing dates are `YYYY-MM-DD` strings; a period is
// (previous closing, closing]: the closing day belongs to the period that ends on it.

export type MoneyTotals = Record<string, number>

export type Period = { start: string; end: string }

const sortedUnique = (closingDates: string[]) => [...new Set(closingDates)].sort()

/** Periods between consecutive closings, newest first. Fewer than two distinct dates: none. */
export function buildPeriods(closingDates: string[]): Period[] {
  const dates = sortedUnique(closingDates)
  const periods: Period[] = []
  for (let i = 1; i < dates.length; i++) {
    periods.push({ start: addDays(dates[i - 1], 1), end: dates[i] })
  }
  return periods.reverse()
}

export function periodTabId(period: Period): string {
  return `period:${period.end}`
}

/**
 * The tab a purchase day belongs to: 'open' (after the latest closing, or no dates at all),
 * 'old' (on or before the oldest closing) or the id of the period containing the day.
 */
export function tabIdFor(day: string, closingDates: string[]): string {
  const dates = sortedUnique(closingDates)
  if (dates.length === 0 || day > dates[dates.length - 1]) return 'open'
  if (day <= dates[0]) return 'old'
  const end = dates.find((closing) => day <= closing)!
  return `period:${end}`
}

// ---- Account views ----

export type CardView = { card: Card; expenses: Expense[]; count: number; totals: MoneyTotals }

export type TabView = {
  id: string
  kind: 'open' | 'period' | 'old'
  period: Period | null
  cards: CardView[]
  totals: MoneyTotals
  count: number
}

export type AccountView = {
  account: Account
  tabs: TabView[]
  latestPeriod: Period | null
  creditCardCount: number
}

const addMoney = (totals: MoneyTotals, currency: string, amount: number) => {
  totals[currency] = Math.round(((totals[currency] ?? 0) + amount) * 100) / 100
}

/**
 * Account → period tabs → credit cards. Only purchases of a stored credit card (matched by last 4
 * digits + type, never by holder) of an existing account are used. Every period is a tab; "open"
 * and "old" tabs exist only when they have purchases (an account without dates always has "open").
 */
export function buildAccountViews(expenses: Expense[], data: CardsData): AccountView[] {
  return [...data.accounts]
    .sort((a, b) => a.name.localeCompare(b.name, 'es-AR'))
    .map((account) => {
      const closingDates = data.cycles.filter((c) => c.accountId === account.id).map((c) => c.closingDate)
      const periods = buildPeriods(closingDates)
      const creditCards = data.cards
        .filter((c) => c.accountId === account.id && c.type === 'credit')
        .sort((a, b) => a.holder.localeCompare(b.holder, 'es-AR') || a.last4.localeCompare(b.last4))

      // tab id -> card key -> purchases
      const byTab = new Map<string, Map<string, Expense[]>>()
      const byKey = new Set(creditCards.map(cardKey))
      for (const expense of expenses) {
        const key = cardKey({ last4: expense.cardLast4, type: expense.cardType })
        if (!byKey.has(key)) continue
        const tabId = tabIdFor(buenosAiresDay(expense.purchaseDate), closingDates)
        const cards = byTab.get(tabId) ?? new Map<string, Expense[]>()
        cards.set(key, [...(cards.get(key) ?? []), expense])
        byTab.set(tabId, cards)
      }

      const makeTab = (id: string, kind: TabView['kind'], period: Period | null): TabView => {
        const cards = creditCards.map((card): CardView => {
          const list = [...(byTab.get(id)?.get(cardKey(card)) ?? [])].sort(
            (a, b) => b.purchaseDate.getTime() - a.purchaseDate.getTime(),
          )
          const totals: MoneyTotals = {}
          for (const e of list) if (e.status !== 'rejected') addMoney(totals, e.currency, e.amount)
          return { card, expenses: list, count: list.length, totals }
        })
        const totals: MoneyTotals = {}
        for (const c of cards) for (const [currency, amount] of Object.entries(c.totals)) addMoney(totals, currency, amount)
        return { id, kind, period, cards, totals, count: cards.reduce((n, c) => n + c.count, 0) }
      }

      const tabs: TabView[] = []
      const open = makeTab('open', 'open', null)
      if (open.count > 0 || closingDates.length === 0) tabs.push(open)
      for (const period of periods) tabs.push(makeTab(periodTabId(period), 'period', period))
      const old = makeTab('old', 'old', null)
      if (old.count > 0) tabs.push(old)

      return { account, tabs, latestPeriod: periods[0] ?? null, creditCardCount: creditCards.length }
    })
}

// ---- Total to pay ----

export type TotalToPayResult = {
  totals: MoneyTotals
  included: { account: Account; period: Period; totals: MoneyTotals; expenses: Expense[] }[]
  excluded: Account[]
}

/** Months ('YYYY-MM') in which at least one account has a closing date with a period, newest first. */
export function availableMonths(views: AccountView[]): string[] {
  const months = new Set<string>()
  for (const view of views) for (const tab of view.tabs) if (tab.period) months.add(tab.period.end.slice(0, 7))
  return [...months].sort().reverse()
}

/** The month shown by default: the current one when it has periods, else the newest. */
export function defaultMonth(months: string[], today: string): string | null {
  const current = today.slice(0, 7)
  return months.includes(current) ? current : (months[0] ?? null)
}

/**
 * Sum, over every account, of the period whose closing date falls in `month` ('YYYY-MM'). Without
 * a month, the latest period of each account is used. It never uses the "open" tab. Accounts with
 * no such period do not contribute and are reported.
 */
export function computeTotalToPay(views: AccountView[], month?: string | null): TotalToPayResult {
  const result: TotalToPayResult = { totals: {}, included: [], excluded: [] }
  for (const view of views) {
    const tab = month
      ? view.tabs.find((t) => t.period && t.period.end.startsWith(month))
      : view.tabs.find((t) => view.latestPeriod && t.id === periodTabId(view.latestPeriod))
    if (!tab?.period) {
      result.excluded.push(view.account)
      continue
    }
    result.included.push({ account: view.account, period: tab.period, totals: tab.totals, expenses: tab.cards.flatMap((c) => c.expenses) })
    for (const [currency, amount] of Object.entries(tab.totals)) addMoney(result.totals, currency, amount)
  }
  return result
}
