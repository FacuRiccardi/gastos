import { strings } from '@/strings'
import type { EntriesApi, Entry } from './entries'
import { EntrySection } from './EntrySection'

// "Ingresos y ahorro": the money that comes in, and what is put into the savings box.
export function MoneyScreen({
  incomes,
  savings,
  incomesApi,
  savingsApi,
}: {
  incomes: Entry[]
  savings: Entry[]
  incomesApi: EntriesApi
  savingsApi: EntriesApi
}) {
  return (
    <div className="grid gap-8">
      <EntrySection labels={strings.money.incomes} entries={incomes} api={incomesApi} withOwner />
      <EntrySection labels={strings.money.savings} entries={savings} api={savingsApi} />
    </div>
  )
}
