import { AlertTriangleIcon } from 'lucide-react'
import { ScreenError } from '@/components/ScreenError'
import { useMemo, type ReactNode } from 'react'
import type { CardsData } from '@/cards/cardsApi'
import { findUnassignedCards } from '@/cards/cardLogic'
import type { Category } from '@/categories/types'
import { HomeSkeleton } from '@/components/LoadingSkeletons'
import { Button } from '@/components/ui/button'
import { buildAccountViews } from '@/expenses/statements'
import type { FixedData } from '@/fixed/fixedApi'
import { buenosAiresDay } from '@/lib/dates'
import type { Expense } from '@/lib/expense'
import { needsCategory } from '@/merchants/ToCategorize'
import { OWNERS, type EntriesSource } from '@/money/entries'
import { useEntries } from '@/money/useEntries'
import { strings } from '@/strings'
import type { CapsSource } from './capsApi'
import { buildHomePeriods, previousMonthTotal, type PeriodGroup } from './homePeriods'
import { PeriodCard } from './PeriodCard'
import { useCaps } from './useCaps'

const s = strings.home

// ---- Alerts: high = red, medium = orange, low = yellow
type AlertLevel = 'high' | 'medium' | 'low'
const alertClass: Record<AlertLevel, string> = {
  high: 'border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
  medium: 'border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-200',
  low: 'border-yellow-300 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200',
}

function AlertBanner({ level, message, action, onAction }: { level: AlertLevel; message: ReactNode; action: string; onAction: () => void }) {
  return (
    <div role="alert" data-level={level} className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm ${alertClass[level]}`}>
      <AlertTriangleIcon className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{message}</span>
      <Button variant="outline" size="sm" className="bg-background text-foreground" onClick={onAction}>
        {action}
      </Button>
    </div>
  )
}

// "Inicio": what to pay now, how it compares with the spending cap, and what data is missing.
export function HomeScreen({
  expenses,
  cards,
  fixed,
  categories,
  incomesSource,
  capsSource,
  onCategoryChange,
  onNavigate,
}: {
  expenses: Expense[]
  cards: CardsData
  fixed: FixedData
  categories: Category[]
  incomesSource: EntriesSource
  capsSource: CapsSource
  onCategoryChange: (expenseId: string, categoryId: string | null) => void
  onNavigate: (tab: 'toCategorize' | 'fixed' | 'money' | 'cards') => void
}) {
  const incomes = useEntries(incomesSource)
  const caps = useCaps(capsSource)
  const today = buenosAiresDay(new Date())
  const month = today.slice(0, 7)
  const views = useMemo(() => buildAccountViews(expenses, cards), [expenses, cards])
  const periods = useMemo(() => buildHomePeriods(views, cards.cycles, today), [views, cards.cycles, today])

  const error = incomes.status === 'error' ? incomes : caps.status === 'error' ? caps : null
  if (error) {
    return (
      <ScreenError>{error.error}</ScreenError>
    )
  }
  if (incomes.status === 'loading' || caps.status === 'loading') return <HomeSkeleton />

  // ---- what is missing
  const missingFixed = fixed.types.filter((t) => !t.disabled && !fixed.entries.some((e) => e.typeId === t.id && e.month === month))
  const missingIncome = OWNERS.filter((owner) => !incomes.entries.some((i) => i.owner === owner && i.date.startsWith(month)))
  const uncategorized = expenses.filter((e) => needsCategory(e, categories)).length
  const newCards = findUnassignedCards(expenses, cards.cards, cards.accounts)
  const list = (names: string[]) => (names.length > 3 ? `${names.slice(0, 3).join(', ')} ${s.andMore(names.length - 3)}` : names.join(', '))

  const alerts: { id: string; level: AlertLevel; message: ReactNode; action: string; go: () => void }[] = []
  if (missingFixed.length > 0)
    alerts.push({ id: 'fixed', level: 'high', message: s.missingFixed(strings.gastos.monthLabel(month), list(missingFixed.map((t) => t.name))), action: s.goFixed, go: () => onNavigate('fixed') })
  if (missingIncome.length > 0)
    alerts.push({ id: 'income', level: 'high', message: s.missingIncome(strings.gastos.monthLabel(month), list(missingIncome)), action: s.goIncome, go: () => onNavigate('money') })
  if (uncategorized > 0)
    alerts.push({ id: 'categorize', level: 'medium', message: s.uncategorized(uncategorized), action: s.goCategorize, go: () => onNavigate('toCategorize') })
  if (newCards.length > 0)
    alerts.push({ id: 'cards', level: 'low', message: s.newCards(newCards.length, list(newCards.map((c) => `····${c.last4}`))), action: s.goCards, go: () => onNavigate('cards') })

  const groups = [periods.current, periods.closed].filter((g): g is PeriodGroup => g !== null)

  return (
    <div className="grid gap-4">
      {alerts.length > 0 && (
        <div className="grid gap-2" aria-label={s.alertsAria}>
          {alerts.map((a) => (
            <AlertBanner key={a.id} level={a.level} message={a.message} action={a.action} onAction={a.go} />
          ))}
        </div>
      )}
      {groups.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">{s.noPeriods}</p>
      ) : (
        groups.map((g) => (
          <PeriodCard
            key={g.kind}
            group={g}
            caps={caps.caps}
            categories={categories}
            onCategoryChange={onCategoryChange}
            previous={previousMonthTotal(views, cards.cycles, g.month, today)}
          />
        ))
      )}
    </div>
  )
}
