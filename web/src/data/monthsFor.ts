// Which month documents each screen needs so the period calculations give the same result as with every purchase.
import { dueDateOf } from '../balance/balance'
import type { CardsData } from '../cards/cardsApi'
import { buildPeriods, type Period } from '../expenses/statements'
import { addMonths } from '../fixed/fixedApi'
import { addDays } from '../lib/dates'
import { inheritSource, monthOfDay } from './months'
import type { MonthId } from './types'

type AccountPeriods = { id: string; closings: string[]; periods: Period[] }
type Range = { start: string; end: string }

function accountsOf(cards: CardsData): AccountPeriods[] {
  return cards.accounts.map((account) => {
    const closings = [...new Set(cards.cycles.filter((c) => c.accountId === account.id).map((c) => c.closingDate))].sort()
    return { id: account.id, closings, periods: buildPeriods(closings) }
  })
}

/** Every month from the month of `start` to the month of `end`. */
function monthsOfRange({ start, end }: Range): MonthId[] {
  const months: MonthId[] = []
  for (let m = monthOfDay(start); m <= monthOfDay(end); m = addMonths(m, 1)) months.push(m)
  return months
}

const latestMonth = (ends: string[], fallback: string) => ([...ends].sort().pop() ?? fallback).slice(0, 7)

// The same choice as `buildHomePeriods`: the period that contains today, else the open one after the last closing.
function currentGroup(accounts: AccountPeriods[], today: string): { ranges: Range[]; month: MonthId } {
  const ranges: Range[] = []
  const ends: string[] = []
  for (const { closings, periods } of accounts) {
    const now = periods.find((p) => p.start <= today && today <= p.end)
    if (now) {
      ranges.push(now)
      ends.push(now.end)
    } else if (closings.length > 0 && today > closings[closings.length - 1]) {
      ranges.push({ start: addDays(closings[closings.length - 1], 1), end: today })
    }
  }
  return { ranges, month: latestMonth(ends, today) }
}

/** Per account, the latest period that closes in `month` (as `groupForMonth` picks it). */
const periodsClosingIn = (accounts: AccountPeriods[], month: MonthId): Period[] =>
  accounts.flatMap(({ periods }) => periods.find((p) => p.end.startsWith(month)) ?? [])

// The months whose purchases fall in `ranges`, plus the months (or the earlier month they inherit from)
// whose rate and cap the groups of `groupMonths` use.
function collect(existing: MonthId[], ranges: Range[], groupMonths: MonthId[]): MonthId[] {
  const have = new Set(existing)
  const months = new Set<MonthId>()
  for (const range of ranges) for (const m of monthsOfRange(range)) if (have.has(m)) months.add(m)
  for (const m of groupMonths) {
    const source = have.has(m) ? m : inheritSource(existing, m)
    if (source) months.add(source)
  }
  return [...months].sort()
}

/**
 * Months the home view reads: the current group, the closed group while it is shown, and for each of them the
 * group of the month before (the comparison). 'all' when an account has no closings (it takes the whole history).
 */
export function homeMonths(cards: CardsData, existing: MonthId[], today: string): MonthId[] | 'all' {
  const accounts = accountsOf(cards)
  if (accounts.some((a) => a.closings.length === 0)) return 'all'

  const current = currentGroup(accounts, today)
  const ranges: Range[] = [...current.ranges]
  const shown: MonthId[] = [current.month]

  const closed = accounts.flatMap(({ id, periods }) => {
    const last = periods.find((p) => p.end < today)
    return last ? [{ period: last, due: dueDateOf(last.end, cards.cycles.find((c) => c.accountId === id && c.closingDate === last.end)?.dueDate ?? null) }] : []
  })
  if (closed.length > 0 && closed.map((c) => c.due).sort().pop()! >= today) {
    ranges.push(...closed.map((c) => c.period))
    shown.push(latestMonth(closed.map((c) => c.period.end), today))
  }

  const previous = shown.map((month) => addMonths(month, -1))
  for (const month of previous) ranges.push(...periodsClosingIn(accounts, month))
  // Today's month too: the fixed and income alerts look at it.
  ranges.push({ start: today, end: today })
  return collect(existing, ranges, [...shown, ...previous])
}

/** Months the Gastos view reads for the group of `month`: its periods, those of the month before, and their rate and cap. */
export function groupMonths(cards: CardsData, month: MonthId, existing: MonthId[]): MonthId[] | 'all' {
  const accounts = accountsOf(cards)
  const previous = addMonths(month, -1)
  return collect(existing, [...periodsClosingIn(accounts, month), ...periodsClosingIn(accounts, previous)], [month, previous])
}

/** Closing months whose period touches an existing month, plus the month of the current home group; newest first. */
export function offeredMonths(cards: CardsData, existing: MonthId[], today: string): MonthId[] {
  const accounts = accountsOf(cards)
  const have = new Set(existing)
  const months = new Set<MonthId>([currentGroup(accounts, today).month])
  for (const { periods } of accounts) {
    for (const period of periods) if (monthsOfRange(period).some((m) => have.has(m))) months.add(monthOfDay(period.end))
  }
  return [...months].sort().reverse()
}
