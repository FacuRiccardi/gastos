import { useMemo, useState } from 'react'
import type { CardsData } from '@/cards/cardsApi'
import type { Category } from '@/categories/types'
import { PeriodSkeleton } from '@/components/LoadingSkeletons'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CapsSource } from '@/home/capsApi'
import { groupForMonth } from '@/home/homePeriods'
import { PeriodCard } from '@/home/PeriodCard'
import { useCaps } from '@/home/useCaps'
import { buenosAiresDay } from '@/lib/dates'
import type { Expense } from '@/lib/expense'
import { strings } from '@/strings'
import { availableMonths, buildAccountViews, defaultMonth } from './statements'

// "Gastos": the same card as the home view (total to pay, cap, more data, movements) for the month you pick.
export function MonthExpenses({
  expenses,
  cards,
  categories,
  onCategoryChange,
  capsSource,
}: {
  expenses: Expense[]
  cards: CardsData
  categories: Category[]
  onCategoryChange: (expenseId: string, categoryId: string | null) => void
  capsSource: CapsSource
}) {
  const caps = useCaps(capsSource)
  const views = useMemo(() => buildAccountViews(expenses, cards), [expenses, cards])
  const months = useMemo(() => availableMonths(views), [views])
  const [picked, setPicked] = useState<string | null>(null)
  const today = buenosAiresDay(new Date())
  // The current month by default; a choice survives live updates while its month still exists.
  const month = picked && months.includes(picked) ? picked : defaultMonth(months, today)
  const group = useMemo(() => (month ? groupForMonth(views, cards.cycles, month, today) : null), [views, cards.cycles, month, today])

  if (views.length === 0) return <p className="py-8 text-center text-muted-foreground">{strings.gastos.noAccounts}</p>
  if (caps.status === 'error') {
    return (
      <p role="alert" className="py-8 text-center text-destructive">
        {caps.error}
      </p>
    )
  }
  if (caps.status === 'loading') return <PeriodSkeleton />
  if (!month || !group) return <p className="py-8 text-center text-muted-foreground">{strings.home.noPeriods}</p>

  const items = months.map((m) => ({ label: strings.gastos.monthLabel(m), value: m }))
  return (
    <PeriodCard
      group={group}
      caps={caps.caps}
      categories={categories}
      onCategoryChange={onCategoryChange}
      title={strings.gastos.periodOf(strings.gastos.monthLabel(month))}
      showBadge={false}
      alwaysShowMovements
      headerAction={
        <Select items={items} value={month} onValueChange={(v) => v !== null && setPicked(v)}>
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
      }
    />
  )
}
