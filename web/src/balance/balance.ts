import type { CardsData } from '@/cards/cardsApi'
import type { Account } from '@/cards/types'
import type { AccountView } from '@/expenses/statements'
import type { FixedData } from '@/fixed/fixedApi'
import { addDays } from '@/lib/dates'
import type { Currency, Entry, Owner } from '@/money/entries'
import type { Rates } from './ratesApi'

// Used only when a closing date has no due date loaded.
const DEFAULT_DUE_DELAY_DAYS = 14

const r2 = (n: number) => Math.round(n * 100) / 100

export type IncomeLine = { owner: Owner | null; currency: Currency; amount: number }
export type Balance = {
  month: string
  incomeLines: IncomeLine[]
  rate: number | null
  usdIncome: number
  // Pesos income plus the dollar income at the month's rate. Without a rate the dollars are left out.
  incomeTotal: number
  missingRate: boolean
  fixed: { typeId: string; name: string; amount: number }[]
  fixedTotal: number
  cards: { account: Account; closing: string; amount: number }[]
  cardsTotal: number
  cardsForeign: boolean
  expensesTotal: number
  balance: number
  savedThisMonth: Partial<Record<Currency, number>>
  savedUntilNow: Partial<Record<Currency, number>>
}

/** The due date of the statement that closed on `closing` (an estimate when none was loaded). */
export function dueDateOf(closing: string, dueDate: string | null): string {
  return dueDate ?? addDays(closing, DEFAULT_DUE_DELAY_DAYS)
}

/** The month ('YYYY-MM') in which the statement that closed on `closing` is paid. */
export function dueMonthOf(closing: string, dueDate: string | null): string {
  return dueDateOf(closing, dueDate).slice(0, 7)
}

/**
 * The balance of a month: income of the month, minus the fixed expenses of the month, minus the card
 * statements that fall due in the month (the card spending of the previous month).
 */
export function buildBalance({
  month,
  incomes,
  savings,
  fixed,
  rates,
  views,
  cycles,
}: {
  month: string
  incomes: Entry[]
  savings: Entry[]
  fixed: FixedData
  rates: Rates
  views: AccountView[]
  cycles: CardsData['cycles']
}): Balance {
  // ---- incomes
  const lines = new Map<string, IncomeLine>()
  for (const e of incomes.filter((i) => i.date.startsWith(month))) {
    const key = `${e.owner ?? ''}|${e.currency}`
    const line = lines.get(key) ?? { owner: e.owner ?? null, currency: e.currency, amount: 0 }
    line.amount = r2(line.amount + e.amount)
    lines.set(key, line)
  }
  const incomeLines = [...lines.values()].sort((a, b) => (a.owner ?? '').localeCompare(b.owner ?? '') || a.currency.localeCompare(b.currency))
  const arsIncome = incomeLines.filter((l) => l.currency === 'ARS').reduce((s, l) => s + l.amount, 0)
  const usdIncome = r2(incomeLines.filter((l) => l.currency === 'USD').reduce((s, l) => s + l.amount, 0))
  const rate = rates[month] ?? null
  const missingRate = usdIncome > 0 && !rate
  const incomeTotal = r2(arsIncome + (rate ? usdIncome * rate : 0))

  // ---- fixed expenses of the month
  const fixedLines = fixed.entries
    .filter((e) => e.month === month)
    .map((e) => ({ typeId: e.typeId, name: fixed.types.find((t) => t.id === e.typeId)?.name ?? '', amount: e.amount }))
    .filter((l) => l.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'es-AR'))
  const fixedTotal = r2(fixedLines.reduce((s, l) => s + l.amount, 0))

  // ---- card statements due in the month
  const dueOf = (accountId: string, closing: string) => cycles.find((c) => c.accountId === accountId && c.closingDate === closing)?.dueDate ?? null
  const cards: Balance['cards'] = []
  let cardsForeign = false
  for (const view of views) {
    for (const tab of view.tabs) {
      if (!tab.period || dueMonthOf(tab.period.end, dueOf(view.account.id, tab.period.end)) !== month) continue
      if (Object.keys(tab.totals).some((c) => c !== 'ARS')) cardsForeign = true
      cards.push({ account: view.account, closing: tab.period.end, amount: tab.totals.ARS ?? 0 })
    }
  }
  const cardsTotal = r2(cards.reduce((s, c) => s + c.amount, 0))

  // ---- savings (shown, not part of the balance)
  const sum = (list: Entry[]) => {
    const totals: Partial<Record<Currency, number>> = {}
    for (const e of list) totals[e.currency] = r2((totals[e.currency] ?? 0) + e.amount)
    return totals
  }

  const expensesTotal = r2(fixedTotal + cardsTotal)
  return {
    month,
    incomeLines,
    rate,
    usdIncome,
    incomeTotal,
    missingRate,
    fixed: fixedLines,
    fixedTotal,
    cards,
    cardsTotal,
    cardsForeign,
    expensesTotal,
    balance: r2(incomeTotal - expensesTotal),
    savedThisMonth: sum(savings.filter((s) => s.date.startsWith(month))),
    savedUntilNow: sum(savings.filter((s) => s.date.slice(0, 7) <= month)),
  }
}
