import { useMemo, useState } from 'react'
import { ClosedCardsSkeleton, ListSkeleton } from '@/components/LoadingSkeletons'
import { ScreenError } from '@/components/ScreenError'
import { useConfig, useDataStore, useMonths } from '@/data/DataProvider'
import { entriesOf, fixedOf } from '@/data/monthDoc'
import { inheritSource } from '@/data/months'
import type { MonthId } from '@/data/types'
import { FixedScreen } from '@/fixed/FixedScreen'
import type { FixedType } from '@/fixed/fixedApi'
import { CapsScreen, type MonthCap } from '@/home/CapsScreen'
import { buenosAiresDay } from '@/lib/dates'
import { MoneyScreen } from '@/money/MoneyScreen'
import { BudgetScreen, type BudgetSection } from './BudgetScreen'

const currentMonth = () => buenosAiresDay(new Date()).slice(0, 7)

function FixedCard({ types }: { types: FixedType[] }) {
  const store = useDataStore()
  const [month, setMonth] = useState(currentMonth)
  const months = useMonths([month])
  const data = useMemo(() => fixedOf(types, months.data ?? []), [types, months.data])
  if (months.status === 'error') return <ScreenError>{months.error}</ScreenError>
  return <FixedScreen data={data} api={store.fixedApi} isMonthLoaded={(m) => m === month && months.status === 'ready'} onMonthChange={setMonth} />
}

function MoneyCard() {
  const store = useDataStore()
  const months = useMonths('all')
  const data = useMemo(() => (months.data ? { incomes: entriesOf('incomes', months.data), savings: entriesOf('savings', months.data) } : null), [months.data])
  if (months.status === 'error') return <ScreenError>{months.error}</ScreenError>
  if (!data) return <ListSkeleton rows={4} />
  return <MoneyScreen incomes={data.incomes} savings={data.savings} incomesApi={store.entriesApi('incomes')} savingsApi={store.entriesApi('savings')} />
}

function CapsCard({ existing }: { existing: MonthId[] }) {
  const store = useDataStore()
  const [month, setMonth] = useState(currentMonth)
  // A month without a document shows what it would inherit when created, read from the month it would copy.
  const source = existing.includes(month) ? month : inheritSource(existing, month)
  const months = useMonths(source ? [source] : [])
  if (months.status === 'error') return <ScreenError>{months.error}</ScreenError>
  let cap: MonthCap | null = null
  if (months.data) {
    const read = months.data.find((m) => m.id === source)
    const amount = read?.cap ?? null
    cap = { amount, inherited: source === month ? (read?.capInherited ?? false) : amount !== null }
  }
  return <CapsScreen month={month} onMonthChange={setMonth} cap={cap} api={store.capsApi} />
}

export function BudgetTab({ initialOpen }: { initialOpen?: BudgetSection | null }) {
  const config = useConfig()
  if (config.status === 'error') return <ScreenError>{config.error}</ScreenError>
  if (!config.data) return <ClosedCardsSkeleton count={3} />
  return (
    <BudgetScreen
      fixed={<FixedCard types={config.data.fixedTypes} />}
      money={<MoneyCard />}
      caps={<CapsCard existing={config.data.months} />}
      initialOpen={initialOpen}
    />
  )
}
