import { useMemo, useState } from 'react'
import { PeriodSkeleton } from '@/components/LoadingSkeletons'
import { ScreenError } from '@/components/ScreenError'
import { useConfig, useMonths } from '@/data/DataProvider'
import { capsOf, expensesOf, ratesOf } from '@/data/monthDoc'
import { groupMonths, offeredMonths } from '@/data/monthsFor'
import { buenosAiresDay } from '@/lib/dates'
import type { Expense } from '@/lib/expense'
import { MonthExpenses } from './MonthExpenses'
import { defaultMonth } from './statements'

export function ExpensesTab({ onCategoryChange }: { onCategoryChange: (expense: Expense, categoryId: string | null) => void }) {
  const config = useConfig()
  const today = buenosAiresDay(new Date())
  const [picked, setPicked] = useState<string | null>(null)

  const offered = useMemo(() => (config.data ? offeredMonths(config.data.cards, config.data.months, today) : []), [config.data, today])
  const month = picked && offered.includes(picked) ? picked : (defaultMonth(offered, today) ?? today.slice(0, 7))
  const ids = config.data ? groupMonths(config.data.cards, month, config.data.months) : null
  const months = useMonths(ids)

  const data = useMemo(() => (months.data ? { expenses: expensesOf(months.data), caps: capsOf(months.data), rates: ratesOf(months.data) } : null), [months.data])

  const error = [config, months].find((l) => l.status === 'error')
  if (error) return <ScreenError>{error.error}</ScreenError>
  if (!config.data) return <PeriodSkeleton />

  return (
    <MonthExpenses
      months={offered}
      month={month}
      onMonthChange={setPicked}
      expenses={data?.expenses ?? []}
      cards={config.data.cards}
      categories={config.data.categories}
      caps={data?.caps ?? {}}
      rates={data?.rates ?? {}}
      loading={!data}
      onCategoryChange={onCategoryChange}
    />
  )
}
