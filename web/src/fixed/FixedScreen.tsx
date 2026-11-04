import { ChevronLeftIcon, ChevronRightIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/Toast'
import { Input } from '@/components/ui/input'
import { InfoTip } from '@/components/ui/tooltip'
import { buenosAiresDay } from '@/lib/dates'
import { formatMoney } from '@/lib/format'
import { parseAmount } from '@/money/entries'
import { strings } from '@/strings'
import { addMonths, isRent, rentCounter, type FixedApi, type FixedData, type FixedEntry, type FixedType } from './fixedApi'

const s = strings.fixed

function TypeRow({ type, api, onError }: { type: FixedType; api: FixedApi; onError: () => void }) {
  const [name, setName] = useState(type.name)
  const [disabling, setDisabling] = useState(false)
  useEffect(() => setName(type.name), [type.name])

  function commit() {
    const clean = name.trim()
    if (!clean) return setName(type.name)
    if (clean !== type.name) void api.renameType(type.id, clean).catch(onError)
  }

  // A disabled type stays in the list (at the end), greyed out, with a button to enable it again.
  if (type.disabled) {
    return (
      <li className="flex items-center gap-2 rounded-md border border-dashed bg-muted/40 p-2 opacity-60">
        <span className="min-w-0 flex-1 truncate">{type.name}</span>
        <span className="rounded-full border px-2 text-xs">{s.disabledBadge}</span>
        <Button variant="outline" size="sm" className="opacity-100" aria-label={s.enableAria(type.name)} onClick={() => void api.setTypeDisabled(type.id, false).catch(onError)}>
          {s.enable}
        </Button>
      </li>
    )
  }

  return (
    <li className="flex items-center gap-2 rounded-md border p-2">
      <Input
        value={name}
        maxLength={40}
        aria-label={s.typeNameAria(type.name)}
        className="min-w-0 flex-1"
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <Button variant="outline" size="icon-sm" aria-label={s.disableTypeAria(type.name)} title={s.disable} onClick={() => setDisabling(true)}>
        <Trash2Icon />
      </Button>
      <AlertDialog open={disabling} onOpenChange={setDisabling}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{s.disableTypeTitle(type.name)}</AlertDialogTitle>
            <AlertDialogDescription>{s.disableTypeText}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{s.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void api.setTypeDisabled(type.id, true).catch(onError)}>{s.disable}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}

function TypesCard({ types, api, onError }: { types: FixedType[]; api: FixedApi; onError: () => void }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const clean = name.trim()
    if (!clean || pending) return
    setPending(true)
    try {
      await api.addType(clean)
      toast(strings.saved)
      setName('')
      setOpen(false)
    } catch {
      onError()
    } finally {
      setPending(false)
    }
  }

  return (
    <section aria-label={s.typesTitle} className="grid min-w-0 gap-3 [&>*]:min-w-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1 font-semibold">
          {s.typesTitle}
          <InfoTip text={s.typesIntro} label={strings.moreInfo} />
        </h3>
        <Button
          type="button"
          size="icon"
          aria-label={s.addType}
          aria-expanded={open}
          className="bg-green-600 text-white hover:bg-green-700"
          onClick={() => setOpen((o) => !o)}
        >
          <PlusIcon className={`transition-transform ${open ? 'rotate-45' : ''}`} />
        </Button>
      </div>
      <div className="grid gap-3">
        {open && (
          <form onSubmit={submit} aria-label={s.addType} className="flex items-center gap-2 sm:max-w-md">
            <Input value={name} maxLength={40} placeholder={s.typePlaceholder} aria-label={s.newTypeAria} className="min-w-0 flex-1" onChange={(e) => setName(e.target.value)} />
            <Button type="submit" disabled={pending}>
              {s.add}
            </Button>
          </form>
        )}
        {types.length === 0 ? (
          <p className="text-sm text-muted-foreground">{s.noTypes}</p>
        ) : (
          <ul className="grid gap-2">
            {[...types.filter((t) => !t.disabled), ...types.filter((t) => t.disabled)].map((t) => (
              <TypeRow key={t.id} type={t} api={api} onError={onError} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

// One type in the chosen month: an amount to fill in, or what was already loaded (editable).
function MonthRow({ type, month, entry, api, onError }: { type: FixedType; month: string; entry?: FixedEntry; api: FixedApi; onError: () => void }) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [pending, setPending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const showForm = !type.disabled && (!entry || editing)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (pending) return
    const amount = parseAmount(text)
    if (amount === null) return setInvalid(true)
    setInvalid(false)
    setPending(true)
    try {
      await api.save(type.id, month, amount)
      toast(strings.saved)
      setText('')
      setEditing(false)
    } catch {
      onError()
    } finally {
      setPending(false)
    }
  }

  return (
    <li className={`flex flex-wrap items-center gap-2 rounded-md border p-2 ${type.disabled ? 'border-dashed bg-muted/40 opacity-60' : ''} ${!type.disabled && !entry ? 'border-amber-500/50' : ''}`}>
      <span className="min-w-0 flex-1 font-medium max-sm:basis-full">
        {type.name}
        {isRent(type.name) && (
          <span className="ml-2 inline-flex items-center gap-1 align-middle">
            <span title={s.rentCounterHint} className="rounded-full border bg-muted px-2 py-0.5 text-xs font-medium">
              {s.rentCounter(rentCounter(month))}
            </span>
          </span>
        )}
      </span>
      {type.disabled && <span className="rounded-full border px-2 text-xs">{s.disabledBadge}</span>}
      {!type.disabled && !entry && (
        <span className="rounded-full border border-amber-500/50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">{s.missingBadge}</span>
      )}
      {showForm ? (
        <form onSubmit={submit} aria-label={s.loadAria(type.name)} className="flex items-center gap-2 max-sm:w-full">
          <Input
            inputMode="decimal"
            placeholder="0,00"
            value={text}
            aria-label={s.amountAria(type.name)}
            aria-invalid={invalid}
            className="w-32 max-sm:w-auto max-sm:flex-1"
            onChange={(e) => setText(e.target.value)}
          />
          <Button type="submit" size="sm" disabled={pending}>
            {entry ? s.save : s.load}
          </Button>
          {editing && (
            <Button type="button" size="sm" variant="outline" onClick={() => { setEditing(false); setInvalid(false) }}>
              {s.cancel}
            </Button>
          )}
          {invalid && (
            <span role="alert" className="basis-full text-sm text-destructive">
              {s.invalidAmount}
            </span>
          )}
        </form>
      ) : (
        <>
          <span className="font-medium tabular-nums max-sm:flex-1">{formatMoney(entry!.amount, 'ARS')}</span>
          {!type.disabled && (
            <>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={s.editAria(type.name)}
            title={s.edit}
            onClick={() => { setText(String(entry!.amount).replace('.', ',')); setEditing(true) }}
          >
            <PencilIcon />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label={s.clearAria(type.name)} title={s.clear} onClick={() => setDeleting(true)}>
            <Trash2Icon />
          </Button>
          <AlertDialog open={deleting} onOpenChange={setDeleting}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{s.clearTitle(type.name, strings.gastos.monthLabel(month))}</AlertDialogTitle>
                <AlertDialogDescription>{s.clearText}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{s.cancel}</AlertDialogCancel>
                <AlertDialogAction onClick={() => void api.clear(type.id, month).then(() => toast(strings.deleted)).catch(onError)}>{s.clear}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
            </>
          )}
        </>
      )}
    </li>
  )
}

function MonthCard({ data, api, onError }: { data: FixedData; api: FixedApi; onError: () => void }) {
  const [month, setMonth] = useState(() => buenosAiresDay(new Date()).slice(0, 7))
  const entries = data.entries.filter((e) => e.month === month && data.types.some((t) => t.id === e.typeId))
  const total = Math.round(entries.reduce((sum, e) => sum + e.amount, 0) * 100) / 100
  // Disabled types only show up where they already have an amount; nothing new can be loaded for them.
  const rows = data.types.filter((t) => !t.disabled || entries.some((e) => e.typeId === t.id))
  // Rows keep their place when they are saved; what is still missing is marked and counted instead.
  const pendingCount = rows.filter((t) => !t.disabled && !entries.some((e) => e.typeId === t.id)).length

  return (
    <section aria-label={s.monthTitle} className="grid min-w-0 gap-3 [&>*]:min-w-0">
      <div className="grid gap-2">
        <h3 className="font-semibold">{s.monthTitle}</h3>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" aria-label={s.nextMonth} onClick={() => setMonth((m) => addMonths(m, 1))}>
              <ChevronLeftIcon />
            </Button>
            <span className="min-w-36 text-center font-medium" aria-live="polite">
              {strings.gastos.monthLabel(month)}
            </span>
            <Button variant="outline" size="icon-sm" aria-label={s.previousMonth} onClick={() => setMonth((m) => addMonths(m, -1))}>
              <ChevronRightIcon />
            </Button>
          </div>
          {rows.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {s.total}: <span className="font-medium tabular-nums text-foreground">{formatMoney(total, 'ARS')}</span>
            </span>
          )}
        </div>
      </div>
      <div className="grid gap-2">
        {pendingCount > 0 && <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{s.pendingCount(pendingCount)}</p>}
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{s.loadTypesFirst}</p>
        ) : (
          <ul className="grid gap-2 [&>*]:min-w-0">
            {rows.map((t) => (
              <MonthRow key={`${t.id}_${month}_${entries.some((e) => e.typeId === t.id) ? 'loaded' : 'empty'}`} type={t} month={month} entry={entries.find((e) => e.typeId === t.id)} api={api} onError={onError} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

// "Gastos fijos": the kinds of fixed expenses, and what was paid for each of them every month.
export function FixedScreen({ data, api }: { data: FixedData; api: FixedApi }) {
  const [failed, setFailed] = useState(false)
  const onError = () => setFailed(true)
  return (
    <div className="grid min-w-0 gap-8 [&>*]:min-w-0">
      {failed && (
        <p role="alert" className="rounded-md border border-destructive p-3 text-destructive">
          {s.apiError}
        </p>
      )}
      <MonthCard data={data} api={api} onError={onError} />
      <TypesCard types={data.types} api={api} onError={onError} />
    </div>
  )
}
