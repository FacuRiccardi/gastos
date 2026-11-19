import { useMemo } from 'react'
import { findUnassignedCards } from '@/cards/cardLogic'
import { HomeSkeleton } from '@/components/LoadingSkeletons'
import { ScreenError } from '@/components/ScreenError'
import { useConfig, useMonths, useUncategorized } from '@/data/DataProvider'
import { capsOf, entriesOf, expensesOf, fixedOf, ratesOf } from '@/data/monthDoc'
import { homeMonths } from '@/data/monthsFor'
import { buenosAiresDay } from '@/lib/dates'
import type { Expense } from '@/lib/expense'
import { HomeScreen } from './HomeScreen'

export function HomeTab({
  onCategoryChange,
  onNavigate,
}: {
  onCategoryChange: (expense: Expense, categoryId: string | null) => void
  onNavigate: (tab: 'toCategorize' | 'fixed' | 'money' | 'cards') => void
}) {
  const config = useConfig()
  const uncategorized = useUncategorized()
  const today = buenosAiresDay(new Date())
  const ids = config.data ? homeMonths(config.data.cards, config.data.months, today) : null
  const months = useMonths(ids)

  const data = useMemo(() => {
    if (!config.data || !months.data) return null
    const m = months.data
    return {
      expenses: expensesOf(m),
      fixed: fixedOf(config.data.fixedTypes, m),
      incomes: entriesOf('incomes', m),
      caps: capsOf(m),
      rates: ratesOf(m),
      newCards: findUnassignedCards(config.data.seenCards, config.data.cards.cards, config.data.cards.accounts),
    }
  }, [config.data, months.data])

  const error = [config, uncategorized, months].find((l) => l.status === 'error')
  if (error) return <ScreenError>{error.error}</ScreenError>
  if (!config.data || !uncategorized.data || !data) return <HomeSkeleton />

  return (
    <HomeScreen
      expenses={data.expenses}
      cards={config.data.cards}
      fixed={data.fixed}
      categories={config.data.categories}
      incomes={data.incomes}
      caps={data.caps}
      rates={data.rates}
      uncategorizedCount={uncategorized.data.length}
      newCards={data.newCards}
      onCategoryChange={onCategoryChange}
      onNavigate={onNavigate}
    />
  )
}
