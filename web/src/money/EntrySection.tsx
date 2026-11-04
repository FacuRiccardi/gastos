import { PlusIcon, Trash2Icon } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/Toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buenosAiresDay, formatCalendarDate, formatLongDate, isValidDateString } from '@/lib/dates'
import { formatMoney } from '@/lib/format'
import { strings } from '@/strings'
import { OWNERS, parseAmount, type Currency, type EntriesApi, type Owner } from './entries'
import type { Entry } from './entries'

const s = strings.money
const PAGE_SIZE = 12 // rows loaded at a time, newest first
const CURRENCIES = [
  { value: 'ARS', label: s.currencies.ARS },
  { value: 'USD', label: s.currencies.USD },
]

export type EntryLabels = {
  title: string
  add: string
  empty: string
}

function NewEntryForm({
  labels,
  api,
  withOwner,
  onError,
  onDone,
}: {
  labels: EntryLabels
  api: EntriesApi
  withOwner: boolean
  onError: () => void
  onDone: () => void
}) {
  const id = useId()
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>('ARS')
  const [date, setDate] = useState(() => buenosAiresDay(new Date()))
  const [owner, setOwner] = useState<Owner | null>(null)
  const [problem, setProblem] = useState<'amount' | 'date' | 'owner' | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (pending) return
    const value = parseAmount(amount)
    if (value === null) return setProblem('amount')
    if (!isValidDateString(date)) return setProblem('date')
    if (withOwner && !owner) return setProblem('owner')
    setProblem(null)
    setPending(true)
    try {
      await api.add({ amount: value, currency, date, ...(withOwner && owner ? { owner } : {}) })
      setAmount('')
      toast(strings.saved)
      onDone()
    } catch {
      onError()
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} aria-label={labels.add} className="grid gap-3 sm:max-w-md">
      {withOwner && (
        <div className="grid gap-2">
          <span className="text-sm font-medium">{s.ownerLabel}</span>
          <Select items={OWNERS.map((o) => ({ value: o, label: o }))} value={owner} onValueChange={(v) => v !== null && setOwner(v as Owner)}>
            <SelectTrigger aria-label={s.ownerLabel} className="w-full sm:w-56">
              <SelectValue placeholder={s.ownerPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {OWNERS.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor={`${id}-amount`}>{s.amountLabel}</Label>
        <Input id={`${id}-amount`} inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <span className="text-sm font-medium">{s.currencyLabel}</span>
        {/* Two options: a switch is one tap, a dropdown is two. */}
        <div role="radiogroup" aria-label={s.currencyLabel} className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:w-56">
          {CURRENCIES.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={currency === c.value}
              onClick={() => setCurrency(c.value as Currency)}
              className="h-8 rounded-md text-sm font-medium text-foreground/60 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-checked:bg-background aria-checked:text-foreground aria-checked:shadow-sm max-sm:h-10"
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-date`}>{s.dateLabel}</Label>
        <Input id={`${id}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        {/* The browser shows the date as dd/mm or mm/dd depending on its language; in words there is no doubt. */}
        <p className="min-h-5 text-sm text-muted-foreground" aria-live="polite">
          {formatLongDate(date)}
        </p>
      </div>
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem === 'amount' ? s.invalidAmount : problem === 'date' ? s.invalidDate : s.invalidOwner}
        </p>
      )}
      <Button type="submit" className="justify-self-start" disabled={pending}>
        {s.save}
      </Button>
    </form>
  )
}

// One list (incomes or savings): a green "+" that opens the form, and a table
// like the one of the closing dates (select rows, delete the selected ones after confirming, scroll, load more).
export function EntrySection({ labels, entries, api, withOwner = false }: { labels: EntryLabels; entries: Entry[]; api: EntriesApi; withOwner?: boolean }) {
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [selected, setSelected] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const toast = useToast()
  const onError = () => setFailed(true)

  const shown = entries.slice(0, visible)
  // Only entries that still exist count as selected (live updates can remove some).
  const chosen = selected.filter((id) => entries.some((e) => e.id === id))
  const allShownChosen = shown.length > 0 && shown.every((e) => chosen.includes(e.id))
  const toggle = (id: string) => setSelected(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id])
  const toggleAllShown = () => setSelected(allShownChosen ? [] : shown.map((e) => e.id))

  async function deleteSelected() {
    setFailed(false)
    setPending(true)
    try {
      await Promise.all(chosen.map((id) => api.remove(id)))
      setSelected([])
      toast(strings.deleted)
    } catch {
      onError()
    } finally {
      setPending(false)
      setConfirming(false)
    }
  }

  return (
    <section aria-label={labels.title} className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{labels.title}</h3>
        <Button
          type="button"
          size="icon"
          aria-label={labels.add}
          aria-expanded={open}
          className="bg-green-600 text-white hover:bg-green-700"
          onClick={() => setOpen((o) => !o)}
        >
          <PlusIcon className={`transition-transform ${open ? 'rotate-45' : ''}`} />
        </Button>
      </div>
      {failed && (
        <p role="alert" className="rounded-md border border-destructive p-3 text-destructive">
          {s.apiError}
        </p>
      )}
      {open && <NewEntryForm labels={labels} api={api} withOwner={withOwner} onError={onError} onDone={() => { setFailed(false); setOpen(false) }} />}
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <>
          <Button variant="destructive" size="sm" className="justify-self-start" disabled={chosen.length === 0 || pending} onClick={() => setConfirming(true)}>
            <Trash2Icon />
            {s.deleteSelected(chosen.length)}
          </Button>
          {/* The list scrolls inside its own box only on wide screens; on a phone a second scroll would trap the finger. */}
          <div className="sm:max-h-[19rem] sm:overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 max-sm:w-12">
                    <input type="checkbox" className="size-4 accent-primary max-sm:size-6" aria-label={s.selectAll} checked={allShownChosen} onChange={toggleAllShown} />
                  </TableHead>
                  <TableHead>{s.columns.date}</TableHead>
                  <TableHead className="text-right">{s.columns.amount}</TableHead>
                  {withOwner && <TableHead>{s.columns.owner}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((e) => {
                  const date = formatCalendarDate(e.date)
                  const amount = formatMoney(e.amount, e.currency)
                  return (
                    <TableRow key={e.id} className="cursor-pointer" onClick={() => toggle(e.id)}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="size-4 accent-primary max-sm:size-6"
                          onClick={(ev) => ev.stopPropagation()}
                          aria-label={s.selectAria(date, amount)}
                          checked={chosen.includes(e.id)}
                          onChange={() => toggle(e.id)}
                        />
                      </TableCell>
                      <TableCell>{date}</TableCell>
                      <TableCell className="text-right tabular-nums">{amount}</TableCell>
                      {withOwner && <TableCell>{e.owner ?? '—'}</TableCell>}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          {entries.length > visible && (
            <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
              {s.loadPrevious}
            </Button>
          )}
          <AlertDialog open={confirming} onOpenChange={setConfirming}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{s.deleteManyTitle(chosen.length)}</AlertDialogTitle>
                <AlertDialogDescription>{s.deleteText}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{s.cancel}</AlertDialogCancel>
                <AlertDialogAction disabled={pending} onClick={() => void deleteSelected()}>
                  {s.delete}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </section>
  )
}
