import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import type { CardsData } from '@/cards/cardsApi'
import { Button } from '@/components/ui/button'
import { BalanceSkeleton } from '@/components/LoadingSkeletons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { InfoTip } from '@/components/ui/tooltip'
import { buildAccountViews } from '@/expenses/statements'
import { addMonths, type FixedData } from '@/fixed/fixedApi'
import { buenosAiresDay } from '@/lib/dates'
import type { Expense } from '@/lib/expense'
import { formatMoney } from '@/lib/format'
import { parseAmount, type Currency, type EntriesSource } from '@/money/entries'
import { useEntries } from '@/money/useEntries'
import { strings } from '@/strings'
import { buildBalance, type Balance } from './balance'
import type { RatesApi, RatesSource } from './ratesApi'
import { useRates } from './useRates'

const s = strings.balance
const monthLabel = strings.gastos.monthLabel

// The numbers carry the colour: green for income, blue for savings, red for expenses.
type Tone = 'income' | 'savings' | 'expense'
const toneClass: Record<Tone, string> = {
  income: 'text-green-600 dark:text-green-400',
  savings: 'text-blue-600 dark:text-blue-400',
  expense: 'text-red-600 dark:text-red-400',
}

// A block of the balance: a titled section inside the balance card.
function Block({ title, subtitle, tip, children }: { title: string; subtitle?: string; tip?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="grid content-start gap-2 rounded-lg border p-4">
      <div>
        <h3 className="flex items-center gap-1 font-semibold">
          {title}
          {tip && <InfoTip text={tip} label={strings.moreInfo} />}
        </h3>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="grid gap-2 text-sm">{children}</div>
    </section>
  )
}

const Row = ({ label, tone, children }: { label: ReactNode; tone?: Tone; children: ReactNode }) => (
  <div className="flex items-baseline justify-between gap-3">
    <span>{label}</span>
    <span className={`font-medium tabular-nums ${tone ? toneClass[tone] : ''}`}>{children}</span>
  </div>
)

const Total = ({ label, tone, children }: { label: string; tone: Tone; children: ReactNode }) => (
  <div className="mt-1 flex items-baseline justify-between gap-3 border-t pt-2 text-base font-semibold">
    <span>{label}</span>
    <span className={`tabular-nums ${toneClass[tone]}`}>{children}</span>
  </div>
)

const moneyByCurrency = (totals: Partial<Record<Currency, number>>) => {
  const entries = Object.entries(totals) as [Currency, number][]
  return entries.length === 0 ? '—' : entries.map(([currency, amount]) => formatMoney(amount, currency)).join(' · ')
}

// The month's dollar-to-peso rate ("TC día de cobro"), editable here because the dollar incomes need it.
function RateField({ month, rate, api, onError }: { month: string; rate: number | null; api: RatesApi; onError: () => void }) {
  const [text, setText] = useState(rate ? String(rate).replace('.', ',') : '')
  const [invalid, setInvalid] = useState(false)
  useEffect(() => setText(rate ? String(rate).replace('.', ',') : ''), [rate, month])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = parseAmount(text)
    if (value === null) return setInvalid(true)
    setInvalid(false)
    try {
      await api.save(month, value)
    } catch {
      onError()
    }
  }

  return (
    <form onSubmit={submit} aria-label={s.rateLabel} className="flex flex-wrap items-center justify-between gap-2">
      <label htmlFor={`rate-${month}`} className="text-muted-foreground">
        {s.rateLabel}
      </label>
      <span className="flex items-center gap-2">
        <Input id={`rate-${month}`} inputMode="decimal" placeholder="0,00" value={text} aria-invalid={invalid} className="h-8 w-28 text-right" onChange={(e) => setText(e.target.value)} />
        <Button type="submit" size="sm" variant="outline">
          {s.saveRate}
        </Button>
      </span>
      {invalid && (
        <span role="alert" className="basis-full text-right text-destructive">
          {s.invalidRate}
        </span>
      )}
    </form>
  )
}

function Incomes({ b, api, onError }: { b: Balance; api: RatesApi; onError: () => void }) {
  return (
    <Block title={s.incomes}>
      {b.incomeLines.length === 0 && <p className="text-muted-foreground">{s.noIncomes}</p>}
      {b.incomeLines.map((l) => (
        <Row key={`${l.owner}|${l.currency}`} label={`${s.incomeOf} ${l.owner ?? '—'}`} tone="income">
          {formatMoney(l.amount, l.currency)}
        </Row>
      ))}
      {b.usdIncome > 0 && (
        <>
          <RateField month={b.month} rate={b.rate} api={api} onError={onError} />
          {b.rate ? (
            <Row label={s.equivalentArs} tone="income">
              {formatMoney(b.usdIncome * b.rate, 'ARS')}
            </Row>
          ) : (
            <p role="status" className="text-amber-700 dark:text-amber-400">
              {s.missingRate}
            </p>
          )}
        </>
      )}
      <Total label={s.totalIncomes} tone="income">
        {formatMoney(b.incomeTotal, 'ARS')}
      </Total>
    </Block>
  )
}

function Savings({ b }: { b: Balance }) {
  return (
    <Block title={s.savings} tip={s.savingsNote}>
      <Row label={s.savedThisMonth} tone="savings">
        {moneyByCurrency(b.savedThisMonth)}
      </Row>
      <Row label={s.savedUntilNow} tone="savings">
        {moneyByCurrency(b.savedUntilNow)}
      </Row>
    </Block>
  )
}

function FixedExpenses({ b }: { b: Balance }) {
  return (
    <Block title={s.fixed} subtitle={monthLabel(b.month)}>
      {b.fixed.length === 0 && <p className="text-muted-foreground">{s.noFixed}</p>}
      {b.fixed.map((f) => (
        <Row key={f.typeId} label={f.name} tone="expense">
          {formatMoney(f.amount, 'ARS')}
        </Row>
      ))}
      <Total label={s.totalFixed} tone="expense">
        {formatMoney(b.fixedTotal, 'ARS')}
      </Total>
    </Block>
  )
}

function Cards({ b }: { b: Balance }) {
  return (
    <Block title={s.cards} subtitle={s.cardsOf(monthLabel(addMonths(b.month, -1)))} tip={b.cardsForeign ? s.cardsForeign : undefined}>
      {b.cards.length === 0 && <p className="text-muted-foreground">{s.noCards}</p>}
      {b.cards.map((c) => (
        <Row key={`${c.account.id}|${c.closing}`} label={c.account.name} tone="expense">
          {formatMoney(c.amount, 'ARS')}
        </Row>
      ))}
      <Total label={s.totalCards} tone="expense">
        {formatMoney(b.cardsTotal, 'ARS')}
      </Total>
    </Block>
  )
}

// "Balance": the month's income minus its fixed expenses and the card statements that fall due in it.
export function BalanceScreen({
  expenses,
  cards,
  fixed,
  incomesSource,
  savingsSource,
  ratesSource,
  ratesApi,
}: {
  expenses: Expense[]
  cards: CardsData
  fixed: FixedData
  incomesSource: EntriesSource
  savingsSource: EntriesSource
  ratesSource: RatesSource
  ratesApi: RatesApi
}) {
  const incomes = useEntries(incomesSource)
  const savings = useEntries(savingsSource)
  const rates = useRates(ratesSource)
  const [month, setMonth] = useState(() => buenosAiresDay(new Date()).slice(0, 7))
  const [failed, setFailed] = useState(false)
  const views = useMemo(() => buildAccountViews(expenses, cards), [expenses, cards])
  const balance = useMemo(
    () => buildBalance({ month, incomes: incomes.entries, savings: savings.entries, fixed, rates: rates.rates, views, cycles: cards.cycles }),
    [month, incomes.entries, savings.entries, fixed, rates.rates, views, cards.cycles],
  )

  const error = [incomes, savings, rates].find((x) => x.status === 'error')
  if (error) {
    return (
      <p role="alert" className="py-8 text-center text-destructive">
        {error.error}
      </p>
    )
  }
  if (incomes.status === 'loading' || savings.status === 'loading' || rates.status === 'loading') {
    return <BalanceSkeleton withHistory={false} />
  }

  return (
    <Card role="region" aria-label={s.title}>
      <CardHeader className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <CardTitle className="text-xl">{s.title}</CardTitle>
            <InfoTip text={s.formula} label={strings.moreInfo} />
          </div>
          <span className={`text-2xl font-bold tabular-nums ${balance.balance < 0 ? toneClass.expense : toneClass.income}`} aria-label={s.balanceAria}>
            {formatMoney(balance.balance, 'ARS')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" aria-label={strings.fixed.nextMonth} onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronLeftIcon />
          </Button>
          <span className="min-w-36 text-center font-medium" aria-live="polite">
            {monthLabel(month)}
          </span>
          <Button variant="outline" size="icon-sm" aria-label={strings.fixed.previousMonth} onClick={() => setMonth((m) => addMonths(m, -1))}>
            <ChevronRightIcon />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {failed && (
          <p role="alert" className="rounded-md border border-destructive p-3 text-destructive">
            {s.apiError}
          </p>
        )}
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <div className="grid gap-4">
            <Incomes b={balance} api={ratesApi} onError={() => setFailed(true)} />
            <Savings b={balance} />
          </div>
          <div className="grid gap-4">
            <FixedExpenses b={balance} />
            <Cards b={balance} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
