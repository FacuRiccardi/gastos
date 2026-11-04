import type { CardsData } from '@/cards/cardsApi'
import type { Account } from '@/cards/types'
import { dueDateOf } from '@/balance/balance'
import type { AccountView, TabView } from '@/expenses/statements'
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
  // The month the period is counted in: the month of its latest closing date.
  month: string
  // The latest due date among the accounts of the group.
  latestDue: string | null
  expenses: Expense[]
}

function makeGroup(kind: PeriodGroup['kind'], pending: PendingAccount[], today: string, rates: Rates): PeriodGroup | null {
  if (pending.length === 0) return null
  const ends = pending.map((i) => i.tab.period?.end).filter((e): e is string => !!e)
  const dues = pending.map((i) => i.due).filter((d): d is string => !!d)
  const month = (ends.sort().pop() ?? today).slice(0, 7)
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
 * The periods the home view shows, across both accounts:
 * - current: the period each account is in today (or its "open" tab when it has no dates after the last closing);
 * - closed: the latest period each account has already closed, shown only while it has not fallen due. It is
 *   considered due once the LATEST due date among the accounts has passed (the last statement to be paid) (a due date is still "not due" on its day).
 * Usually there is one group; right after a closing and before the due date there are two.
 */
export function buildHomePeriods(
  views: AccountView[],
  cycles: CardsData['cycles'],
  today: string,
  rates: Rates = {},
): { current: PeriodGroup | null; closed: PeriodGroup | null } {
  const dueOf = (accountId: string, closing: string) => dueDateOf(closing, cycles.find((c) => c.accountId === accountId && c.closingDate === closing)?.dueDate ?? null)
  const current: PendingAccount[] = []
  const closed: PendingAccount[] = []
  for (const view of views) {
    const periods = view.tabs.filter((t) => t.period)
    const now = periods.find((t) => t.period!.start <= today && today <= t.period!.end) ?? view.tabs.find((t) => t.kind === 'open')
    if (now) current.push({ account: view.account, tab: now, due: now.period ? dueOf(view.account.id, now.period.end) : null })
    // tabs are newest first, so the first one that ended before today is the latest closed period
    const last = periods.find((t) => t.period!.end < today)
    if (last) closed.push({ account: view.account, tab: last, due: dueOf(view.account.id, last.period!.end) })
  }

  const closedGroup = makeGroup('closed', closed, today, rates)
  return {
    current: makeGroup('current', current, today, rates),
    // already due: the old period is no longer shown
    closed: closedGroup && closedGroup.latestDue !== null && closedGroup.latestDue >= today ? closedGroup : null,
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
  const items: PendingAccount[] = []
  for (const view of views) {
    const tab = view.tabs.find((t) => t.period && t.period.end.startsWith(month))
    if (!tab?.period) continue
    const due = dueDateOf(tab.period.end, cycles.find((c) => c.accountId === view.account.id && c.closingDate === tab.period!.end)?.dueDate ?? null)
    items.push({ account: view.account, tab, due })
  }
  const closed = items.length > 0 && items.every((i) => i.tab.period!.end < today)
  return makeGroup(closed ? 'closed' : 'current', items, today, rates)
}
