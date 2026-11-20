// Which month documents each screen needs so the period calculations give the same result as with every purchase.
import { dueDateOf } from '../balance/balance'
import type { CardsData } from '../cards/cardsApi'
import { buildPeriods, currentGroupMonth, type Period } from '../expenses/statements'
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

// The same choice as `buildHomePeriods`: per account, the period closing in the current group month, else the open
// one after its last closing when that closing is before the month.
function currentGroup(accounts: AccountPeriods[], today: string): { ranges: Range[]; month: MonthId } {
  const month = currentGroupMonth(
    accounts.map((a) => a.closings),
    today,
  )
  const ranges: Range[] = []
  for (const { closings, periods } of accounts) {
    const period = periods.find((p) => p.end.startsWith(month))
    const last = closings[closings.length - 1]
    if (period) ranges.push(period)
    else if (last && monthOfDay(last) < month && today > last) ranges.push({ start: addDays(last, 1), end: today })
  }
  return { ranges, month }
}

/** Per account, the latest period that closes in `month` (as `groupForMonth` picks it). */
const periodsClosingIn = (accounts: AccountPeriods[], month: MonthId): Period[] =>
  accounts.flatMap(({ periods }) => periods.find((p) => p.end.startsWith(month)) ?? [])

// The months whose purchases fall in `ranges`, plus the months (or the earlier month they inherit from)
// whose rate and cap the groups use. The newest month is always read: `rateFor` falls back to the latest rate at all.
function collect(existing: MonthId[], ranges: Range[], rateMonths: MonthId[]): MonthId[] {
  const have = new Set(existing)
  const newest = [...existing].sort().pop()
  const months = new Set<MonthId>(newest ? [newest] : [])
  for (const range of ranges) for (const m of monthsOfRange(range)) if (have.has(m)) months.add(m)
  for (const m of rateMonths) {
    const source = have.has(m) ? m : inheritSource(existing, m)
    if (source) months.add(source)
  }
  return [...months].sort()
}

// Home reads the current group, the closed group while shown, and the group before each (the comparison).
// 'all' when an account has no closings (it takes the whole history).
export function homeMonths(cards: CardsData, existing: MonthId[], today: string): MonthId[] | 'all' {
  const accounts = accountsOf(cards)
  if (accounts.some((a) => a.closings.length === 0)) return 'all'

  const current = currentGroup(accounts, today)
  const ranges: Range[] = [...current.ranges]
  const shown: MonthId[] = [current.month]

  // The closed group is the month before, while it has not fallen due.
  const closedMonth = addMonths(current.month, -1)
  const closed = accounts.flatMap(({ id, periods }) => {
    const period = periods.find((p) => p.end.startsWith(closedMonth))
    return period ? [{ period, due: dueDateOf(period.end, cards.cycles.find((c) => c.accountId === id && c.closingDate === period.end)?.dueDate ?? null) }] : []
  })
  if (closed.length > 0 && closed.every((c) => c.period.end < today) && closed.map((c) => c.due).sort().pop()! >= today) {
    ranges.push(...closed.map((c) => c.period))
    shown.push(closedMonth)
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
