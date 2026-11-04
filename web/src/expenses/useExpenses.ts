import { useEffect, useState } from 'react'
import type { Expense } from '@/lib/expense'
import { strings } from '@/strings'
import type { ExpensesSource } from './expensesSource'

type ExpensesState = { status: 'loading' | 'ready' | 'error'; expenses: Expense[]; error: string | null }

// Subscribes to the source while the component is mounted. If the source fails later (for example
// because the access was revoked), the data is dropped and an error is shown.
export function useExpenses(source: ExpensesSource): ExpensesState {
  const [state, setState] = useState<ExpensesState>({ status: 'loading', expenses: [], error: null })

  useEffect(() => {
    return source.subscribe(
      (expenses) => setState({ status: 'ready', expenses, error: null }),
      () => setState({ status: 'error', expenses: [], error: strings.expenses.error }),
    )
  }, [source])

  return state
}
