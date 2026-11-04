import { useMemo, type CSSProperties } from 'react'
import type { CardsData } from '@/cards/cardsApi'
import { CollapsibleCard } from '@/components/CollapsibleCard'
import { ListSkeleton } from '@/components/LoadingSkeletons'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildBalance, dueMonthOf, type Balance } from '@/balance/balance'
import { useRates } from '@/balance/useRates'
import type { RatesSource } from '@/balance/ratesApi'
import { buildAccountViews } from '@/expenses/statements'
import { addMonths, type FixedData } from '@/fixed/fixedApi'
import { buenosAiresDay } from '@/lib/dates'
import type { Expense } from '@/lib/expense'
import { formatMoney } from '@/lib/format'
import { OWNERS, type EntriesSource, type Owner } from '@/money/entries'
import { useEntries } from '@/money/useEntries'
import { strings } from '@/strings'

const s = strings.history
// The balance is the only coloured number. Its colour depends on how much of the month's income it is:
// the normal text colour at 0%, fully green at +100% (everything earned was saved) and fully red at -100%
// (the expenses were twice the income). In between, the colour is mixed in proportion.
const greenMix = 'text-[color:color-mix(in_srgb,#16a34a_var(--mix),var(--foreground))] dark:text-[color:color-mix(in_srgb,#4ade80_var(--mix),var(--foreground))]'
const redMix = 'text-[color:color-mix(in_srgb,#dc2626_var(--mix),var(--foreground))] dark:text-[color:color-mix(in_srgb,#f87171_var(--mix),var(--foreground))]'

/** The balance as a share of the income, from -1 to 1. With no income, any deficit counts as -100%. */
export function balanceRatio(balance: number, income: number): number {
  if (income <= 0) return balance < 0 ? -1 : 0
  return Math.max(-1, Math.min(1, balance / income))
}

const balanceColor = (balance: number, income: number): { className: string; style: CSSProperties; title: string } => {
  const ratio = balanceRatio(balance, income)
  return {
    className: ratio < 0 ? redMix : greenMix,
    style: { '--mix': `${Math.round(Math.abs(ratio) * 100)}%` } as CSSProperties,
    title: `${Math.round(ratio * 100)}% ${s.ofIncome}`,
  }
}

// Pesos income of one person in the month, with the dollars at the month's rate (without a rate they are left out).
const incomeOf = (b: Balance, owner: Owner) =>
  b.incomeLines.filter((l) => l.owner === owner).reduce((sum, l) => sum + (l.currency === 'ARS' ? l.amount : b.rate ? l.amount * b.rate : 0), 0)

const money = (amount: number, currency: 'ARS' | 'USD' = 'ARS') => (amount === 0 ? '—' : formatMoney(amount, currency))

const balanceCell = (b: Balance) => {
  const color = balanceColor(b.balance, b.incomeTotal)
  return { className: `text-right font-semibold tabular-nums ${color.className}`, style: color.style, title: color.title }
}

// "Histórico": one row per month with the same columns as the spreadsheet, but all the fixed
// expenses in a single column. Each row is the balance of that month (see BalanceScreen).
export function HistoryScreen({
  expenses,
  cards,
  fixed,
  incomesSource,
  savingsSource,
  ratesSource,
}: {
  expenses: Expense[]
  cards: CardsData
  fixed: FixedData
  incomesSource: EntriesSource
  savingsSource: EntriesSource
  ratesSource: RatesSource
}) {
  const incomes = useEntries(incomesSource)
  const savings = useEntries(savingsSource)
  const rates = useRates(ratesSource)
  const views = useMemo(() => buildAccountViews(expenses, cards), [expenses, cards])

  const rows = useMemo(() => {
    const current = buenosAiresDay(new Date()).slice(0, 7)
    const found = new Set<string>()
    for (const i of incomes.entries) found.add(i.date.slice(0, 7))
    for (const e of savings.entries) found.add(e.date.slice(0, 7))
    for (const e of fixed.entries) found.add(e.month)
    for (const view of views) {
      for (const tab of view.tabs) {
        if (!tab.period) continue
        const end = tab.period.end
        const due = cards.cycles.find((c) => c.accountId === view.account.id && c.closingDate === end)?.dueDate ?? null
        found.add(dueMonthOf(end, due))
      }
    }
    const months = [...found].filter((m) => m <= current).sort()
    if (months.length === 0) return []
    // Every month from the first one with data up to the current one, newest first.
    const all: string[] = []
    for (let m = months[0]; m <= current; m = addMonths(m, 1)) all.push(m)
    return all
      .reverse()
      .map((month) =>
        buildBalance({ month, incomes: incomes.entries, savings: savings.entries, fixed, rates: rates.rates, views, cycles: cards.cycles }),
      )
  }, [incomes.entries, savings.entries, fixed, rates.rates, views, cards.cycles])

  const failed = [incomes, savings, rates].find((x) => x.status === 'error')
  const loading = incomes.status === 'loading' || savings.status === 'loading' || rates.status === 'loading'

  return (
    <CollapsibleCard title={s.title} tooltip={`${s.intro} ${s.note}`}>
      {failed ? (
        <p role="alert" className="text-center text-destructive">
          {failed.error}
        </p>
      ) : loading ? (
        <ListSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <p className="text-center text-muted-foreground">{s.empty}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{s.month}</TableHead>
              <TableHead className="text-right">{s.balance}</TableHead>
              {OWNERS.map((owner) => (
                <TableHead key={owner} className="text-right">
                  {s.incomeOf(owner)}
                </TableHead>
              ))}
              <TableHead className="text-right">{s.incomeTotal}</TableHead>
              <TableHead className="text-right">{s.fixed}</TableHead>
              <TableHead className="text-right">{s.cards}</TableHead>
              <TableHead className="text-right">{s.savings}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((b) => (
              <TableRow key={b.month}>
                <TableCell className="whitespace-nowrap font-medium">{strings.gastos.monthLabel(b.month)}</TableCell>
                <TableCell {...balanceCell(b)}>{formatMoney(b.balance, 'ARS')}</TableCell>
                {OWNERS.map((owner) => (
                  <TableCell key={owner} className="text-right tabular-nums">
                    {money(incomeOf(b, owner))}
                  </TableCell>
                ))}
                <TableCell className="text-right tabular-nums">
                  {money(b.incomeTotal)}
                  {b.missingRate && <span className="block text-xs text-amber-700 dark:text-amber-400">{s.noRate}</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{money(b.fixedTotal)}</TableCell>
                <TableCell className="text-right tabular-nums">{money(b.cardsTotal)}</TableCell>
                <TableCell className="text-right tabular-nums">{money(b.savedThisMonth.USD ?? 0, 'USD')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </CollapsibleCard>
  )
}
