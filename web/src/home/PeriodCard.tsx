import type { ReactNode } from 'react'
import { Disclosure } from '@/cards/Disclosure'
import type { Category } from '@/categories/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InfoTip } from '@/components/ui/tooltip'
import { buildBreakdown } from '@/expenses/categoryBreakdown'
import { CardsAccordion } from '@/expenses/CardsAccordion'
import { CategoryCharts } from '@/expenses/CategoryCharts'
import { formatCalendarDate } from '@/lib/dates'
import { formatMoney } from '@/lib/format'
import { strings } from '@/strings'
import { capFor, capLevel, type CapLevel, type PeriodGroup } from './homePeriods'

const s = strings.home

// A thin line at the top of a row, inset from both sides.
const separator = 'relative after:absolute after:inset-x-3 after:top-0 after:h-px after:bg-border'

// ---- Spending cap: the bar fills with the total to pay
const barColor: Record<CapLevel, string> = { green: 'bg-green-500', yellow: 'bg-yellow-400', orange: 'bg-orange-500', red: 'bg-red-600' }

function CapBar({ total, cap }: { total: number; cap: number }) {
  const percent = (total / cap) * 100
  const level = capLevel(percent)
  const excess = total - cap
  return (
    <div className="grid gap-2">
      <div
        role="progressbar"
        aria-label={s.capProgressAria}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(Math.round(percent), 100)}
        data-level={level}
        className="h-3 overflow-hidden rounded-full bg-muted"
      >
        <div className={`h-full rounded-full ${barColor[level]}`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <div className="flex justify-between gap-3 text-sm text-muted-foreground">
        <span>
          {formatMoney(total, 'ARS')} {s.of} {formatMoney(cap, 'ARS')}
        </span>
        <span className="tabular-nums">{Math.round(percent)}%</span>
      </div>
      {percent >= 100 && (
        <div className="grid gap-1">
          <p className="font-bold text-red-600 dark:text-red-400" aria-label={s.exceededBy}>
            <span className="text-3xl tabular-nums">+{formatMoney(excess, 'ARS')}</span>{' '}
            <span className="text-base tabular-nums">(+{Math.round((excess / cap) * 100)}%)</span>
          </p>
          <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
            {s.capExceeded}
          </p>
        </div>
      )}
    </div>
  )
}

// ---- One group of periods (the current one, or the one that closed and has not fallen due yet)
export function PeriodCard({
  group,
  caps,
  categories,
  onCategoryChange,
  title,
  showBadge,
  headerAction,
  alwaysShowMovements,
}: {
  group: PeriodGroup
  caps: Record<string, number>
  categories: Category[]
  onCategoryChange: (expenseId: string, categoryId: string | null) => void
  // A custom title (Gastos names the card after the month); by default "Período actual" / "Período cerrado".
  title?: string
  // Whether to mark a closed period with the "Cerrado" label (defaults to yes for closed ones).
  showBadge?: boolean
  // Something to show next to the title, like the month selector of Gastos.
  headerAction?: ReactNode
  // Show the list of movements always open, without its toggle (Gastos); Inicio keeps it collapsible.
  alwaysShowMovements?: boolean
}) {
  const closed = group.kind === 'closed'
  const cap = capFor(group.month, caps)
  const heading = title ?? (closed ? s.closedTitle : s.currentTitle)
  const breakdown = buildBreakdown(group.expenses, categories, { uncategorized: strings.categories.uncategorized, minor: strings.gastos.minorCategories })
  const movements =
    group.expenses.length === 0 ? (
      <p className="text-sm text-muted-foreground">{strings.gastos.noPurchases}</p>
    ) : (
      <div className="grid gap-4">
        {group.accounts.map(({ account, tab }) => (
          <section key={account.id} aria-label={strings.cards.accountTitle(account.name)}>
            <h3 className="mb-1 text-base font-semibold">{strings.cards.accountTitle(account.name)}</h3>
            <CardsAccordion tab={tab} categories={categories} onCategoryChange={onCategoryChange} />
          </section>
        ))}
      </div>
    )
  return (
    <Card role="region" aria-label={heading}>
      <CardHeader className="grid gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{heading}</CardTitle>
            {(showBadge ?? closed) && closed && <span className="rounded-full border bg-muted px-2 py-0.5 text-xs font-medium">{s.closedBadge}</span>}
          </div>
          {headerAction}
        </div>
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          {s.totalToPay}
          {group.foreign && <InfoTip text={s.foreignNote} label={strings.moreInfo} />}
        </p>
        <p className="text-3xl font-semibold tabular-nums" data-testid="home-total">
          {formatMoney(group.total, 'ARS')}
        </p>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ul className="grid gap-1 text-sm text-muted-foreground">
          {group.accounts.map(({ account, tab, due }) => (
            <li key={account.id} className="flex flex-wrap justify-between gap-x-3">
              <span>
                {account.name} · {tab.period ? strings.gastos.periodLabel(tab.period.start, tab.period.end) : strings.gastos.tabs.open}
                {closed && due ? ` · ${s.dueOn(formatCalendarDate(due))}` : ''}
              </span>
              <span className="tabular-nums">{formatMoney(tab.totals.ARS ?? 0, 'ARS')}</span>
            </li>
          ))}
        </ul>

        {cap ? (
          <CapBar total={group.total} cap={cap.amount} />
        ) : (
          <p className="text-sm text-muted-foreground">{s.noCap(strings.gastos.monthLabel(group.month))}</p>
        )}

        {/* The toggles form one block with a line above each. The lines are drawn inset, so they stay inside
            the rounded corners of the hover of each row. */}
        <div className="-mx-2">
          <div className={separator}>
            <Disclosure title={strings.gastos.moreData}>
              <CategoryCharts slices={breakdown.slices} hasForeign={breakdown.hasForeign} />
            </Disclosure>
          </div>
          {!alwaysShowMovements && (
            <div className={separator}>
              <Disclosure title={s.movements(group.expenses.length)}>{movements}</Disclosure>
            </div>
          )}
        </div>
        {alwaysShowMovements && movements}
      </CardContent>
    </Card>
  )
}

