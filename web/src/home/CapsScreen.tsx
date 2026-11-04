import { ChevronLeftIcon, ChevronRightIcon, Trash2Icon } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ListSkeleton } from '@/components/LoadingSkeletons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addMonths } from '@/fixed/fixedApi'
import { buenosAiresDay } from '@/lib/dates'
import { formatMoney } from '@/lib/format'
import { parseAmount } from '@/money/entries'
import { strings } from '@/strings'
import type { CapsApi, CapsSource } from './capsApi'
import { capFor } from './homePeriods'
import { useCaps } from './useCaps'

const s = strings.caps
const monthLabel = strings.gastos.monthLabel

function CapRow({ month, amount, api, onError }: { month: string; amount: number; api: CapsApi; onError: () => void }) {
  const [deleting, setDeleting] = useState(false)
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border p-2">
      <span className="font-medium">{monthLabel(month)}</span>
      <span className="flex items-center gap-2">
        <span className="tabular-nums">{formatMoney(amount, 'ARS')}</span>
        <Button variant="outline" size="icon-sm" aria-label={s.deleteAria(monthLabel(month))} title={s.delete} onClick={() => setDeleting(true)}>
          <Trash2Icon />
        </Button>
      </span>
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{s.deleteTitle(monthLabel(month))}</AlertDialogTitle>
            <AlertDialogDescription>{s.deleteText}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{s.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void api.remove(month).catch(onError)}>{s.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}

// "Tope de gasto": where the monthly spending cap is set. The home view only shows the progress.
export function CapsScreen({ source, api }: { source: CapsSource; api: CapsApi }) {
  const state = useCaps(source)
  const [month, setMonth] = useState(() => buenosAiresDay(new Date()).slice(0, 7))
  const [text, setText] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [failed, setFailed] = useState(false)
  const [pending, setPending] = useState(false)
  const current = buenosAiresDay(new Date()).slice(0, 7)
  const own = state.caps[month]
  // The field shows the cap of the chosen month, if it has one.
  useEffect(() => {
    setText(own ? String(own).replace('.', ',') : '')
    setInvalid(false)
  }, [own, month])

  if (state.status === 'error') {
    return (
      <p role="alert" className="py-8 text-center text-destructive">
        {state.error}
      </p>
    )
  }
  if (state.status === 'loading') return <ListSkeleton rows={3} />

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (pending) return
    const value = parseAmount(text)
    if (value === null) return setInvalid(true)
    setInvalid(false)
    setPending(true)
    setFailed(false)
    try {
      await api.save(month, value)
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  const inForce = capFor(current, state.caps)
  const defined = Object.keys(state.caps).sort().reverse()

  return (
    <div className="grid gap-8">
      {failed && (
        <p role="alert" className="rounded-md border border-destructive p-3 text-destructive">
          {s.apiError}
        </p>
      )}
      <section aria-label={s.setTitle} className="grid gap-3">
        <div className="grid gap-2">
          <h3 className="font-semibold">{s.setTitle}</h3>
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
        </div>
        <div>
          <form onSubmit={submit} aria-label={s.setTitle} className="grid gap-3 sm:max-w-md">
            <div className="grid gap-2">
              <label htmlFor="cap-amount" className="text-sm font-medium">
                {s.amountLabel}
              </label>
              <Input id="cap-amount" inputMode="decimal" placeholder="0,00" value={text} aria-invalid={invalid} onChange={(e) => setText(e.target.value)} />
            </div>
            {invalid && (
              <p role="alert" className="text-sm text-destructive">
                {s.invalidAmount}
              </p>
            )}
            <Button type="submit" className="justify-self-start" disabled={pending}>
              {s.save}
            </Button>
          </form>
        </div>
      </section>

      <section aria-label={s.definedTitle} className="grid gap-3">
        <div className="grid gap-1">
          <h3 className="font-semibold">{s.definedTitle}</h3>
          <p className="text-sm text-muted-foreground">
            {inForce ? s.inForce(monthLabel(current), formatMoney(inForce.amount, 'ARS'), inForce.from === current ? null : monthLabel(inForce.from)) : s.noneInForce(monthLabel(current))}
          </p>
        </div>
        <div>
          {defined.length === 0 ? (
            <p className="text-sm text-muted-foreground">{s.empty}</p>
          ) : (
            <ul className="grid gap-2">
              {defined.map((m) => (
                <CapRow key={m} month={m} amount={state.caps[m]} api={api} onError={() => setFailed(true)} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
