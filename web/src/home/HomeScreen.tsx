import { AlertTriangleIcon, ChevronDownIcon } from 'lucide-react'
import { ScreenError } from '@/components/ScreenError'
import { useMemo, useState, type ReactNode } from 'react'
import type { CardsData } from '@/cards/cardsApi'
import type { RatesSource } from '@/balance/ratesApi'
import { useRates } from '@/balance/useRates'
import { findUnassignedCards } from '@/cards/cardLogic'
import type { Category } from '@/categories/types'
import { HomeSkeleton } from '@/components/LoadingSkeletons'
import { Button } from '@/components/ui/button'
import { buildAccountViews } from '@/expenses/statements'
import type { FixedData } from '@/fixed/fixedApi'
import { buenosAiresDay } from '@/lib/dates'
import { useIsPhone } from '@/lib/useMediaQuery'
import type { Expense } from '@/lib/expense'
import { needsCategory } from '@/merchants/ToCategorize'
import { OWNERS, type EntriesSource } from '@/money/entries'
import { useEntries } from '@/money/useEntries'
import { strings } from '@/strings'
import type { CapAlertApi, CapAlertSource } from './capAlertApi'
import { CapAlertBanner } from './CapAlertBanner'
import type { CapsSource } from './capsApi'
import { buildHomePeriods, previousMonthTotal, type PeriodGroup } from './homePeriods'
import { PeriodCard } from './PeriodCard'
import { useCapAlert } from './useCapAlert'
import { useCaps } from './useCaps'

const s = strings.home

// ---- Alerts: high = red, medium = orange, low = yellow
type AlertLevel = 'high' | 'medium' | 'low'
// A thick bar on the left and a stronger tint tell the levels apart at a glance; the label says it in words too.
const alertClass: Record<AlertLevel, string> = {
  high: 'border-red-400 border-l-8 border-l-red-600 bg-red-100 text-red-950 dark:border-red-800 dark:border-l-red-500 dark:bg-red-950/70 dark:text-red-100',
  medium: 'border-orange-400 border-l-8 border-l-orange-500 bg-orange-100 text-orange-950 dark:border-orange-800 dark:border-l-orange-500 dark:bg-orange-950/70 dark:text-orange-100',
  low: 'border-yellow-400 border-l-8 border-l-yellow-500 bg-yellow-100 text-yellow-950 dark:border-yellow-700 dark:border-l-yellow-400 dark:bg-yellow-950/60 dark:text-yellow-100',
}
const iconClass: Record<AlertLevel, string> = {
  high: 'text-red-600 dark:text-red-400',
  medium: 'text-orange-600 dark:text-orange-400',
  low: 'text-yellow-600 dark:text-yellow-400',
}

function AlertBanner({ level, message, action, onAction }: { level: AlertLevel; message: ReactNode; action: string; onAction: () => void }) {
  return (
    <div role="alert" data-level={level} className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm ${alertClass[level]}`}>
      <AlertTriangleIcon className={`size-5 shrink-0 ${iconClass[level]}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold uppercase tracking-wide">{s.levelLabel[level]}</span>
        {message}
      </span>
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
  ratesSource,
  capAlertSource,
  capAlertApi,
  onCategoryChange,
  onNavigate,
}: {
  expenses: Expense[]
  cards: CardsData
  fixed: FixedData
  categories: Category[]
  incomesSource: EntriesSource
  capsSource: CapsSource
  ratesSource: RatesSource
  capAlertSource: CapAlertSource
  capAlertApi: CapAlertApi
  onCategoryChange: (expenseId: string, categoryId: string | null) => void
  onNavigate: (tab: 'toCategorize' | 'fixed' | 'money' | 'cards') => void
}) {
  const incomes = useEntries(incomesSource)
  const caps = useCaps(capsSource)
  const rates = useRates(ratesSource)
  const phone = useIsPhone()
  const [alertsOpen, setAlertsOpen] = useState(false)
  const today = buenosAiresDay(new Date())
  const month = today.slice(0, 7)
  const views = useMemo(() => buildAccountViews(expenses, cards), [expenses, cards])
  const periods = useMemo(() => buildHomePeriods(views, cards.cycles, today, rates.rates), [views, cards.cycles, today, rates.rates])

  const capMonth = periods.current?.month ?? null
  const capAlert = useCapAlert(capAlertSource, capMonth).alert

  const error = incomes.status === 'error' ? incomes : caps.status === 'error' ? caps : rates.status === 'error' ? rates : null
  if (error) {
    return (
      <ScreenError>{error.error}</ScreenError>
    )
  }
  if (incomes.status === 'loading' || caps.status === 'loading' || rates.status === 'loading') return <HomeSkeleton />

  // ---- what is missing
  const missingFixed = fixed.types.filter((t) => !t.disabled && !fixed.entries.some((e) => e.typeId === t.id && e.month === month))
  const missingIncome = OWNERS.filter((owner) => !incomes.entries.some((i) => i.owner === owner && i.date.startsWith(month)))
  const uncategorized = expenses.filter((e) => needsCategory(e, categories)).length
  const newCards = findUnassignedCards(expenses, cards.cards, cards.accounts)
  const list = (names: string[]) => (names.length > 3 ? `${names.slice(0, 3).join(', ')} ${s.andMore(names.length - 3)}` : names.join(', '))

  const alerts: { id: string; level: AlertLevel; short: string; message: ReactNode; action: string; go: () => void }[] = []
  if (missingFixed.length > 0)
    alerts.push({ id: 'fixed', level: 'high', short: s.shortFixed, message: s.missingFixed(strings.gastos.monthLabel(month), list(missingFixed.map((t) => t.name))), action: s.goFixed, go: () => onNavigate('fixed') })
  if (missingIncome.length > 0)
    alerts.push({ id: 'income', level: 'high', short: s.shortIncome, message: s.missingIncome(strings.gastos.monthLabel(month), list(missingIncome)), action: s.goIncome, go: () => onNavigate('money') })
  if (uncategorized > 0)
    alerts.push({ id: 'categorize', level: 'medium', short: s.shortCategorize(uncategorized), message: s.uncategorized(uncategorized), action: s.goCategorize, go: () => onNavigate('toCategorize') })
  if (newCards.length > 0)
    alerts.push({ id: 'cards', level: 'low', short: s.shortCards, message: s.newCards(newCards.length, list(newCards.map((c) => `····${c.last4}`))), action: s.goCards, go: () => onNavigate('cards') })

  const groups = [periods.current, periods.closed].filter((g): g is PeriodGroup => g !== null)

  return (
    <div className="grid gap-4">
      {capAlert && capAlert.month === capMonth && (
        <CapAlertBanner alert={capAlert} onDismiss={() => capAlertApi.dismiss(capAlert.month, capAlert.lastLevel).catch(() => {})} />
      )}
      {alerts.length > 0 && (
        <div className="grid gap-2" aria-label={s.alertsAria}>
          {/* On a phone several alerts would push the total to pay off the first screen: they fold into one line. */}
          {phone && alerts.length > 1 && (
            <button
              type="button"
              aria-expanded={alertsOpen}
              onClick={() => setAlertsOpen((o) => !o)}
              className={`flex min-h-11 items-center gap-3 rounded-lg border p-3 text-left text-sm ${alertClass[alerts[0].level]}`}
            >
              <AlertTriangleIcon className={`size-5 shrink-0 ${iconClass[alerts[0].level]}`} aria-hidden />
              <span className="min-w-0 flex-1">{s.pendingSummary(alerts.length, alerts.map((a) => a.short).join(', '))}</span>
              <ChevronDownIcon className={`size-4 shrink-0 transition-transform ${alertsOpen ? 'rotate-180' : ''}`} aria-hidden />
            </button>
          )}
          {(!phone || alerts.length === 1 || alertsOpen) &&
            alerts.map((a) => <AlertBanner key={a.id} level={a.level} message={a.message} action={a.action} onAction={a.go} />)}
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
            previous={previousMonthTotal(views, cards.cycles, g.month, today, rates.rates)}
          />
        ))
      )}
    </div>
  )
}
