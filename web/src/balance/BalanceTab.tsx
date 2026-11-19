import { useMemo } from 'react'
import { BalanceSkeleton } from '@/components/LoadingSkeletons'
import { ScreenError } from '@/components/ScreenError'
import { useConfig, useDataStore, useMonths } from '@/data/DataProvider'
import { entriesOf, expensesOf, fixedOf, ratesOf } from '@/data/monthDoc'
import { HistoryScreen } from '@/history/HistoryScreen'
import { BalanceScreen } from './BalanceScreen'

export function BalanceTab() {
  const store = useDataStore()
  const config = useConfig()
  const months = useMonths('all')

  const data = useMemo(() => {
    if (!config.data || !months.data) return null
    const m = months.data
    return {
      expenses: expensesOf(m),
      fixed: fixedOf(config.data.fixedTypes, m),
      incomes: entriesOf('incomes', m),
      savings: entriesOf('savings', m),
      rates: ratesOf(m),
      inheritedRates: new Set(m.filter((month) => month.rateInherited).map((month) => month.id)),
    }
  }, [config.data, months.data])

  const error = [config, months].find((l) => l.status === 'error')
  if (error) return <ScreenError>{error.error}</ScreenError>
  if (!config.data || !data) return <BalanceSkeleton />

  const props = { ...data, cards: config.data.cards }
  return (
    <div className="grid gap-4">
      <BalanceScreen {...props} ratesApi={store.ratesApi} />
      <HistoryScreen {...props} />
    </div>
  )
}
