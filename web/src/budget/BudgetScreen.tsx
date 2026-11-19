import type { ReactNode } from 'react'
import { CollapsibleCard } from '@/components/CollapsibleCard'
import { strings } from '@/strings'

export type BudgetSection = 'fixed' | 'money' | 'caps'

// "Presupuesto": the data that is loaded by hand every month, each part in its own card that opens and closes:
// the fixed expenses, the incomes and savings, and the spending cap. A card's content mounts (and reads) only when open.
export function BudgetScreen({
  fixed,
  money,
  caps,
  initialOpen,
}: {
  fixed: ReactNode
  money: ReactNode
  caps: ReactNode
  // The card to open on arrival (the alerts of the home view point to one of them).
  initialOpen?: BudgetSection | null
}) {
  return (
    <div className="grid gap-4">
      <CollapsibleCard title={strings.budget.fixed} defaultOpen={initialOpen === 'fixed'}>
        {fixed}
      </CollapsibleCard>
      <CollapsibleCard title={strings.budget.money} defaultOpen={initialOpen === 'money'}>
        {money}
      </CollapsibleCard>
      <CollapsibleCard title={strings.budget.caps} tooltip={strings.caps.intro} defaultOpen={initialOpen === 'caps'}>
        {caps}
      </CollapsibleCard>
    </div>
  )
}
