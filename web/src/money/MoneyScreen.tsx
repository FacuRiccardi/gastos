import { ListSkeleton } from '@/components/LoadingSkeletons'
import { strings } from '@/strings'
import type { EntriesApi, EntriesSource } from './entries'
import { EntrySection } from './EntrySection'
import { useEntries } from './useEntries'

// "Ingresos y ahorro": the money that comes in, and what is put into the savings box.
export function MoneyScreen({
  incomesSource,
  incomesApi,
  savingsSource,
  savingsApi,
}: {
  incomesSource: EntriesSource
  incomesApi: EntriesApi
  savingsSource: EntriesSource
  savingsApi: EntriesApi
}) {
  const incomes = useEntries(incomesSource)
  const savings = useEntries(savingsSource)
  if (incomes.status === 'error' || savings.status === 'error')
    return (
      <p role="alert" className="text-center text-destructive">
        {incomes.error ?? savings.error}
      </p>
    )
  if (incomes.status === 'loading' || savings.status === 'loading') return <ListSkeleton rows={4} />
  return (
    <div className="grid gap-8">
      <EntrySection labels={strings.money.incomes} entries={incomes.entries} api={incomesApi} withOwner />
      <EntrySection labels={strings.money.savings} entries={savings.entries} api={savingsApi} />
    </div>
  )
}
