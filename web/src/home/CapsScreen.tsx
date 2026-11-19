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
import { useToast } from '@/components/Toast'
import { Input } from '@/components/ui/input'
import type { MonthId } from '@/data/types'
import { addMonths } from '@/fixed/fixedApi'
import { parseAmount } from '@/money/entries'
import { strings } from '@/strings'
import type { CapsApi } from './capsApi'

const s = strings.caps
const monthLabel = strings.gastos.monthLabel

export type MonthCap = { amount: number | null; inherited: boolean }

// "Tope de gasto": where the spending cap of each month is set. The home view only shows the progress.
export function CapsScreen({
  month,
  onMonthChange,
  cap,
  api,
}: {
  month: MonthId
  onMonthChange: (month: MonthId) => void
  // null while the month is loading.
  cap: MonthCap | null
  api: CapsApi
}) {
  const [text, setText] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [failed, setFailed] = useState(false)
  const [pending, setPending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()
  const amount = cap?.amount ?? null
  useEffect(() => {
    setText(amount !== null ? String(amount).replace('.', ',') : '')
    setInvalid(false)
  }, [amount, month])

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
      toast(strings.saved)
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  function remove() {
    setFailed(false)
    void api
      .remove(month)
      .then(() => toast(strings.deleted))
      .catch(() => setFailed(true))
  }

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
            <Button variant="outline" size="icon-sm" aria-label={strings.fixed.nextMonth} onClick={() => onMonthChange(addMonths(month, 1))}>
              <ChevronLeftIcon />
            </Button>
            <span className="min-w-36 text-center font-medium" aria-live="polite">
              {monthLabel(month)}
            </span>
            <Button variant="outline" size="icon-sm" aria-label={strings.fixed.previousMonth} onClick={() => onMonthChange(addMonths(month, -1))}>
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
        {cap === null ? (
          <ListSkeleton rows={1} />
        ) : (
          <form onSubmit={submit} aria-label={s.setTitle} className="grid gap-3 sm:max-w-md">
            <div className="grid gap-2">
              <label htmlFor="cap-amount" className="text-sm font-medium">
                {s.amountLabel}
              </label>
              <Input id="cap-amount" inputMode="decimal" placeholder="0,00" value={text} aria-invalid={invalid} onChange={(e) => setText(e.target.value)} />
              {cap.inherited && <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{s.inherited}</p>}
            </div>
            {invalid && (
              <p role="alert" className="text-sm text-destructive">
                {s.invalidAmount}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={pending}>
                {s.save}
              </Button>
              {cap.amount !== null && (
                <Button type="button" variant="outline" size="icon" aria-label={s.deleteAria(monthLabel(month))} title={s.delete} onClick={() => setDeleting(true)}>
                  <Trash2Icon />
                </Button>
              )}
            </div>
          </form>
        )}
      </section>
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{s.deleteTitle(monthLabel(month))}</AlertDialogTitle>
            <AlertDialogDescription>{s.deleteText}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{s.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>{s.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
