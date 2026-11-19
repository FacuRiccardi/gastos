import { useMemo } from 'react'
import type { Rates } from '@/balance/ratesApi'
import type { CardsData } from '@/cards/cardsApi'
import type { Category } from '@/categories/types'
import { PeriodSkeleton } from '@/components/LoadingSkeletons'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { MonthId } from '@/data/types'
import type { Caps } from '@/home/capsApi'
import { groupForMonth, previousMonthTotal } from '@/home/homePeriods'
import { PeriodCard } from '@/home/PeriodCard'
import { buenosAiresDay } from '@/lib/dates'
import type { Expense } from '@/lib/expense'
import { strings } from '@/strings'
import { buildAccountViews } from './statements'

// "Gastos": the same card as the home view (total to pay, cap, more data, movements) for the month you pick.
export function MonthExpenses({
  months,
  month,
  onMonthChange,
  expenses,
  cards,
  categories,
  caps,
  rates,
  loading,
  onCategoryChange,
}: {
  months: MonthId[]
  month: MonthId
  onMonthChange: (month: MonthId) => void
  expenses: Expense[]
  cards: CardsData
  categories: Category[]
  caps: Caps
  rates: Rates
  loading: boolean
  onCategoryChange: (expense: Expense, categoryId: string | null) => void
}) {
  const views = useMemo(() => buildAccountViews(expenses, cards), [expenses, cards])
  const today = buenosAiresDay(new Date())
  const group = useMemo(() => groupForMonth(views, cards.cycles, month, today, rates), [views, cards.cycles, month, today, rates])

  if (views.length === 0) return <p className="py-8 text-center text-muted-foreground">{strings.gastos.noAccounts}</p>

  const items = months.map((m) => ({ label: strings.gastos.monthLabel(m), value: m }))
  const selector = (
    <Select items={items} value={month} onValueChange={(v) => v !== null && onMonthChange(v)}>
      <SelectTrigger aria-label={strings.gastos.monthSelectAria} className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  if (loading) {
    return (
      <div className="grid gap-4">
        <div className="flex justify-end">{selector}</div>
        <PeriodSkeleton />
      </div>
    )
  }
  if (!group || group.expenses.length === 0) {
    return (
      <div className="grid gap-4">
        <div className="flex justify-end">{selector}</div>
        <p className="py-8 text-center text-muted-foreground">{strings.gastos.emptyMonth}</p>
      </div>
    )
  }

  return (
    <PeriodCard
      group={group}
      caps={caps}
      categories={categories}
      onCategoryChange={onCategoryChange}
      title={strings.gastos.periodOf(strings.gastos.monthLabel(month))}
      showBadge={false}
      alwaysShowMovements
      previous={previousMonthTotal(views, cards.cycles, month, today, rates)}
      headerAction={selector}
    />
  )
}
