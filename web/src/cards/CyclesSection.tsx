import { Trash2Icon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
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
import { Label } from '@/components/ui/label'
import { InfoTip } from '@/components/ui/tooltip'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCalendarDate } from '@/lib/dates'
import { strings } from '@/strings'
import type { CardsApi } from './cardsApi'
import { Disclosure } from './Disclosure'
import { parseCyclesText, type CycleLineError } from './cardLogic'
import { usePending, type Run } from './usePending'
import type { Account, Cycle } from './types'

const s = strings.cards

const PAGE_SIZE = 12 // closing dates loaded at a time, newest first

type Problem = { kind: 'lines'; errors: CycleLineError[]; bulk: boolean } | { kind: 'api' } | null

export function CyclesSection({
  account,
  cycles,
  api,
}: {
  account: Account
  cycles: Cycle[]
  api: Pick<CardsApi, 'addCycles' | 'deleteCycle'>
}) {
  const [bulk, setBulk] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [problem, setProblem] = useState<Problem>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)

  const own = cycles
    .filter((c) => c.accountId === account.id)
    .sort((a, b) => b.closingDate.localeCompare(a.closingDate))
  const storedDates = own.map((c) => c.closingDate)
  const shown = own.slice(0, visible)
  // Only dates that still exist count as selected (live updates can remove some).
  const chosen = selected.filter((d) => storedDates.includes(d))
  const allShownChosen = shown.length > 0 && shown.every((c) => chosen.includes(c.closingDate))
  const toggle = (date: string) =>
    setSelected(chosen.includes(date) ? chosen.filter((d) => d !== date) : [...chosen, date])
  const toggleAllShown = () => setSelected(allShownChosen ? [] : shown.map((c) => c.closingDate))

  const run: Run = async (action) => {
    try {
      await action()
      return true
    } catch {
      setProblem({ kind: 'api' })
      return false
    }
  }
  const [pendingBulk, guardedBulk] = usePending(run)
  const [pendingDelete, guardedDelete] = usePending(run)

  async function submitBulk(e: FormEvent) {
    e.preventDefault()
    setProblem(null)
    const { cycles: parsed, errors } = parseCyclesText(bulk, storedDates)
    if (errors.length > 0) {
      setProblem({ kind: 'lines', errors, bulk: true })
      return
    }
    if (parsed.length === 0) return
    if (await guardedBulk(() => api.addCycles(account.id, parsed))) setBulk('')
  }

  const id = (name: string) => `${name}-${account.id}`

  return (
    <div className="grid gap-4">
      {own.length === 0 ? (
        <>
          <h3 className="text-sm font-medium">{s.cyclesHeading}</h3>
          <p className="text-sm text-muted-foreground">{s.noCycles}</p>
        </>
      ) : (
        <Disclosure title={s.cyclesHeading}>
        <Button
          variant="destructive"
          size="sm"
          className="mb-2"
          disabled={chosen.length === 0 || pendingDelete}
          onClick={() => setConfirming(true)}
        >
          <Trash2Icon />
          {s.deleteSelected(chosen.length)}
        </Button>
        <div className="max-h-[19rem] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  aria-label={s.selectAllCycles}
                  checked={allShownChosen}
                  onChange={toggleAllShown}
                />
              </TableHead>
              <TableHead>{s.closingColumn}</TableHead>
              <TableHead>{s.dueColumn}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((c) => (
              <TableRow key={c.closingDate}>
                <TableCell>
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    aria-label={s.selectCycleAria(formatCalendarDate(c.closingDate))}
                    checked={chosen.includes(c.closingDate)}
                    onChange={() => toggle(c.closingDate)}
                  />
                </TableCell>
                <TableCell>{formatCalendarDate(c.closingDate)}</TableCell>
                <TableCell>{c.dueDate ? formatCalendarDate(c.dueDate) : s.noDueDate}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
        {own.length > visible && (
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            {s.loadPrevious}
          </Button>
        )}
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{s.deleteCyclesTitle(chosen.length)}</AlertDialogTitle>
              <AlertDialogDescription>{s.deleteCyclesText}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{s.cancel}</AlertDialogCancel>
              <AlertDialogAction
                disabled={pendingDelete}
                onClick={async () => {
                  setProblem(null)
                  const ok = await guardedDelete(async () => {
                    await Promise.all(chosen.map((d) => api.deleteCycle(account.id, d)))
                  })
                  if (ok) setSelected([])
                  setConfirming(false)
                }}
              >
                {s.delete}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </Disclosure>
      )}

      {problem && (
        <div role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">
          {problem.kind === 'api' ? (
            s.apiError
          ) : (
            <>
              {problem.bulk && <p>{s.bulkFailed}</p>}
              <ul className="grid gap-1">
                {problem.errors.map((err) => (
                  <li key={err.line}>
                    {problem.bulk ? `${s.lineLabel(err.line)} ` : ''}
                    {s.cycleErrors[err.code]}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <Disclosure title={s.loadSeveralHeading}>
      <form onSubmit={submitBulk} className="grid gap-3 sm:max-w-md" aria-label={s.loadSeveralHeading}>
        <div className="grid gap-2">
          <div className="flex items-center gap-1">
            <Label htmlFor={id('bulk')}>{s.bulkLabel}</Label>
            <InfoTip text={s.bulkHint} label={strings.moreInfo} />
          </div>
          <Textarea
            id={id('bulk')}
            value={bulk}
            placeholder="05/03/2026 15/03/2026"
            onChange={(e) => setBulk(e.target.value)}
          />
        </div>
        <Button type="submit" className="justify-self-start" disabled={pendingBulk}>
          {s.loadSeveral}
        </Button>
      </form>
      </Disclosure>
    </div>
  )
}
