import { CollapsibleCard } from '@/components/CollapsibleCard'
import { ListSkeleton } from '@/components/LoadingSkeletons'
import { FixedScreen } from '@/fixed/FixedScreen'
import type { FixedApi, FixedData } from '@/fixed/fixedApi'
import { CapsScreen } from '@/home/CapsScreen'
import type { CapsApi, CapsSource } from '@/home/capsApi'
import type { EntriesApi, EntriesSource } from '@/money/entries'
import { MoneyScreen } from '@/money/MoneyScreen'
import { strings } from '@/strings'

export type BudgetSection = 'fixed' | 'money' | 'caps'

// "Presupuesto": the data that is loaded by hand every month, each part in its own card that opens and closes:
// the fixed expenses, the incomes and savings, and the spending cap.
export function BudgetScreen({
  fixed,
  fixedApi,
  incomesSource,
  incomesApi,
  savingsSource,
  savingsApi,
  capsSource,
  capsApi,
  initialOpen,
}: {
  fixed: { status: 'loading' | 'ready' | 'error'; data: FixedData; error: string | null }
  fixedApi: FixedApi
  incomesSource: EntriesSource
  incomesApi: EntriesApi
  savingsSource: EntriesSource
  savingsApi: EntriesApi
  capsSource: CapsSource
  capsApi: CapsApi
  // The card to open on arrival (the alerts of the home view point to one of them).
  initialOpen?: BudgetSection | null
}) {
  return (
    <div className="grid gap-4">
      <CollapsibleCard title={strings.budget.fixed} defaultOpen={initialOpen === 'fixed'}>
        {fixed.status === 'loading' ? (
          <ListSkeleton rows={4} />
        ) : fixed.status === 'error' ? (
          <p role="alert" className="text-center text-destructive">
            {fixed.error}
          </p>
        ) : (
          <FixedScreen data={fixed.data} api={fixedApi} />
        )}
      </CollapsibleCard>
      <CollapsibleCard title={strings.budget.money} defaultOpen={initialOpen === 'money'}>
        <MoneyScreen incomesSource={incomesSource} incomesApi={incomesApi} savingsSource={savingsSource} savingsApi={savingsApi} />
      </CollapsibleCard>
      <CollapsibleCard title={strings.budget.caps} tooltip={strings.caps.intro} defaultOpen={initialOpen === 'caps'}>
        <CapsScreen source={capsSource} api={capsApi} />
      </CollapsibleCard>
    </div>
  )
}
