import type { CardsData } from '@/cards/cardsApi'
import type { Account } from '@/cards/types'
import { dueDateOf } from '@/balance/balance'
import { currentGroupMonth, type AccountView, type TabView } from '@/expenses/statements'
import { addMonths } from '@/fixed/fixedApi'
import { rateFor, type AppliedRate } from '@/balance/rateFor'
import type { Rates } from '@/balance/ratesApi'
import type { Expense } from '@/lib/expense'
import type { Caps } from './capsApi'

const r2 = (n: number) => Math.round(n * 100) / 100

// `total` is what the account owes in pesos: its pesos plus its dollars at the rate of the group's month.
export type GroupAccount = { account: Account; tab: TabView; due: string | null; total: number }
type PendingAccount = Omit<GroupAccount, 'total'>
export type PeriodGroup = {
  kind: 'current' | 'closed'
  accounts: GroupAccount[]
  // Total to pay in pesos. The dollars are turned into pesos with `rate` (the month's TC, or the latest loaded one);
  // without any rate they are left out. Other currencies are always left out. `foreign` says something was left out.
  total: number
  foreign: boolean
  // The dollars that were included in the total, and the rate they were multiplied by.
  usd: number
  rate: AppliedRate | null
  // The month the group is counted in: the month its periods close in.
  month: string
  // The latest due date among the accounts of the group.
  latestDue: string | null
  expenses: Expense[]
}

function makeGroup(kind: PeriodGroup['kind'], pending: PendingAccount[], month: string, rates: Rates): PeriodGroup | null {
  if (pending.length === 0) return null
  const dues = pending.map((i) => i.due).filter((d): d is string => !!d)
  const rate = rateFor(rates, month)
  const items = pending.map((i): GroupAccount => ({ ...i, total: r2((i.tab.totals.ARS ?? 0) + (rate ? (i.tab.totals.USD ?? 0) * rate.rate : 0)) }))
  const usd = r2(items.reduce((sum, i) => sum + (rate ? (i.tab.totals.USD ?? 0) : 0), 0))
  return {
    kind,
    accounts: items,
    total: r2(items.reduce((sum, i) => sum + i.total, 0)),
    // something is left out: a currency other than pesos and dollars, or dollars when there is no rate to convert them
    foreign: items.some((i) => Object.keys(i.tab.totals).some((c) => c !== 'ARS' && (c !== 'USD' || !rate))),
    usd,
    rate,
    month,
    latestDue: dues.sort().pop() ?? null,
    expenses: items.flatMap((i) => i.tab.cards.flatMap((c) => c.expenses)).sort((a, b) => b.purchaseDate.getTime() - a.purchaseDate.getTime()),
  }
}

/**
 * The periods the home view shows, grouped by the month they close in (the same rule as the month selector of Gastos):
 * - current: the month of `currentGroupMonth`. Per account, its period closing in that month, or its "open" tab when
 *   that closing is not loaded yet (the open tab holds the purchases after its last closing). An account that already
 *   closed the month stays in it with its closed period until every account has closed it.
 * - closed: the month before, shown only while it has not fallen due. It is considered due once the LATEST due date
 *   among the accounts has passed (the last statement to be paid) (a due date is still "not due" on its day).
 * Usually there is one group; right after every account closed the month and before the due date there are two.
 */
export function buildHomePeriods(
  views: AccountView[],
  cycles: CardsData['cycles'],
  today: string,
  rates: Rates = {},
): { current: PeriodGroup | null; closed: PeriodGroup | null } {
  const closingsOf = (accountId: string) => cycles.filter((c) => c.accountId === accountId).map((c) => c.closingDate)
  const month = currentGroupMonth(
    views.map((v) => closingsOf(v.account.id)),
    today,
  )
  const current: PendingAccount[] = []
  for (const view of views) {
    const item = itemForMonth(view, cycles, month)
    const open = view.tabs.find((t) => t.kind === 'open')
    const last = closingsOf(view.account.id).sort().pop()
    if (item) current.push(item)
    else if (open && (!last || last.slice(0, 7) < month)) current.push({ account: view.account, tab: open, due: null })
  }

  const closedGroup = groupForMonth(views, cycles, addMonths(month, -1), today, rates)
  return {
    current: makeGroup('current', current, month, rates),
    // already due: the old period is no longer shown
    closed: closedGroup?.kind === 'closed' && closedGroup.latestDue !== null && closedGroup.latestDue >= today ? closedGroup : null,
  }
}

/** What the calendar month before `month` came to (same rule as `groupForMonth`), or null when there is nothing to compare with. */
export function previousMonthTotal(
  views: AccountView[],
  cycles: CardsData['cycles'],
  month: string,
  today: string,
  rates: Rates = {},
): { month: string; total: number } | null {
  const previous = addMonths(month, -1)
  const group = groupForMonth(views, cycles, previous, today, rates)
  return group && group.total > 0 ? { month: previous, total: group.total } : null
}

/** The cap of a month: its own, or else the latest one defined before it. */
export function capFor(month: string, caps: Caps): { amount: number; from: string } | null {
  if (caps[month]) return { amount: caps[month], from: month }
  const earlier = Object.keys(caps)
    .filter((m) => m < month && caps[m] > 0)
    .sort()
    .pop()
  return earlier ? { amount: caps[earlier], from: earlier } : null
}

export type CapLevel = 'green' | 'yellow' | 'orange' | 'red'

/** Green below 50%, yellow up to 75%, orange up to 100%, and red from 100% on. */
export function capLevel(percent: number): CapLevel {
  if (percent < 50) return 'green'
  if (percent < 75) return 'yellow'
  if (percent < 100) return 'orange'
  return 'red'
}

/**
 * The group of periods of a chosen month: for each account, the period whose closing date falls in `month`
 * (the same rule as the month selector of Gastos). It is "closed" when all of them ended before today.
 */
export function groupForMonth(views: AccountView[], cycles: CardsData['cycles'], month: string, today: string, rates: Rates = {}): PeriodGroup | null {
  const items = views.flatMap((view) => itemForMonth(view, cycles, month) ?? [])
  const closed = items.length > 0 && items.every((i) => i.tab.period!.end < today)
  return makeGroup(closed ? 'closed' : 'current', items, month, rates)
}

// The latest period of the account that closes in `month`, with its due date.
function itemForMonth(view: AccountView, cycles: CardsData['cycles'], month: string): PendingAccount | null {
  const tab = view.tabs.find((t) => t.period && t.period.end.startsWith(month))
  if (!tab?.period) return null
  const end = tab.period.end
  const due = dueDateOf(end, cycles.find((c) => c.accountId === view.account.id && c.closingDate === end)?.dueDate ?? null)
  return { account: view.account, tab, due }
}
