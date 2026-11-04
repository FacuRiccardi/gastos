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
import { ChevronDownIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/Toast'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Expense } from '@/lib/expense'
import { strings } from '@/strings'
import type { CardsApi, CardsData } from './cardsApi'
import { findUnassignedCards, normalizeOwner } from './cardLogic'
import { CyclesSection } from './CyclesSection'
import { Disclosure } from './Disclosure'
import { usePending, type Run } from './usePending'
import { cardKey } from './types'
import type { Account, Card as StoredCard, Cycle } from './types'

const s = strings.cards

function AccountSelect({
  accounts,
  value,
  onChange,
  ariaLabel,
  placeholder,
}: {
  accounts: Account[]
  value: string | null
  onChange: (accountId: string) => void
  ariaLabel: string
  placeholder?: string
}) {
  const items = accounts.map((a) => ({ label: a.name, value: a.id }))
  return (
    <Select items={items} value={value} onValueChange={(v) => v !== null && onChange(v)}>
      <SelectTrigger aria-label={ariaLabel} className="w-full sm:w-56">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function AccountFormDialog({
  open,
  onOpenChange,
  account,
  run,
  api,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: Account
  run: Run
  api: CardsApi
}) {
  const [name, setName] = useState(account.name)
  const [owner, setOwner] = useState(account.owner)
  const [pending, guarded] = usePending(run)
  const [failed, setFailed] = useState(false)
  const [incomplete, setIncomplete] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const cleanName = name.trim()
    const cleanOwner = normalizeOwner(owner)
    if (!cleanName || !cleanOwner) return setIncomplete(true)
    setIncomplete(false)
    setFailed(false)
    const ok = await guarded(() =>
      api.updateAccount(account.id, { name: cleanName, owner: cleanOwner }),
    )
    if (!ok) setFailed(true)
    if (ok) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{s.editAccountTitle}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`edit-name-${account.id}`}>{s.nameLabel}</Label>
            <Input
              id={`edit-name-${account.id}`}
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`edit-owner-${account.id}`}>{s.ownerInputLabel}</Label>
            <Input
              id={`edit-owner-${account.id}`}
              value={owner}
              maxLength={40}
              onChange={(e) => setOwner(e.target.value)}
            />
          </div>
          {incomplete && (
            <p role="alert" className="text-sm text-destructive">
              {s.accountIncomplete}
            </p>
          )}
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {s.apiError}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {s.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ChangeCardDialog({
  open,
  onOpenChange,
  card,
  accounts,
  run,
  api,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  card: StoredCard
  accounts: Account[]
  run: Run
  api: CardsApi
}) {
  const [holder, setHolder] = useState(card.holder)
  const [accountId, setAccountId] = useState(card.accountId)
  const [pending, guarded] = usePending(run)
  const [failed, setFailed] = useState(false)
  const [incomplete, setIncomplete] = useState(false)
  const id = `holder-${cardKey(card)}`

  async function submit(e: FormEvent) {
    e.preventDefault()
    const cleanHolder = normalizeOwner(holder)
    if (!cleanHolder) return setIncomplete(true)
    setIncomplete(false)
    setFailed(false)
    const ok = await guarded(() => api.saveCard({ ...card, holder: cleanHolder, accountId }))
    if (!ok) setFailed(true)
    if (ok) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{s.changeCardTitle(card.last4)}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={id}>{s.holderLabel}</Label>
            <Input id={id} value={holder} maxLength={40} onChange={(e) => setHolder(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <span className="text-sm font-medium">{s.accountLabel}</span>
            <AccountSelect
              accounts={accounts}
              value={accountId}
              onChange={setAccountId}
              ariaLabel={s.accountLabel}
            />
          </div>
          {incomplete && (
            <p role="alert" className="text-sm text-destructive">
              {s.cardIncomplete}
            </p>
          )}
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {s.apiError}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {s.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CardRow({
  card,
  accounts,
  run,
  api,
}: {
  card: StoredCard
  accounts: Account[]
  run: Run
  api: CardsApi
}) {
  const [changing, setChanging] = useState(false)
  return (
    <li
      aria-label={`····${card.last4}`}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border p-2"
    >
      <span className="font-mono">····{card.last4}</span>
      <Badge variant="secondary">{strings.expenses.cardType[card.type]}</Badge>
      <span className="text-sm text-muted-foreground">{s.assignedTo(card.holder)}</span>
      <span className="ml-auto flex gap-2">
        <Button variant="outline" size="icon-sm" aria-label={s.change} title={s.change} onClick={() => setChanging(true)}>
          <PencilIcon />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={s.remove}
          title={s.remove}
          onClick={() => void run(() => api.removeCard({ last4: card.last4, type: card.type }))}
        >
          <Trash2Icon />
        </Button>
      </span>
      {changing && (
        <ChangeCardDialog
          open
          onOpenChange={setChanging}
          card={card}
          accounts={accounts}
          run={run}
          api={api}
        />
      )}
    </li>
  )
}

function AccountSection({
  account,
  cards,
  cycles,
  accounts,
  run,
  api,
}: {
  account: Account
  cards: StoredCard[]
  cycles: Cycle[]
  accounts: Account[]
  run: Run
  api: CardsApi
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deletePending, guardedDelete] = usePending(run)
  const [deleteFailed, setDeleteFailed] = useState(false)
  const titleId = `account-${account.id}`

  return (
    <Card role="region" aria-labelledby={titleId}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${titleId}-content`}
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left outline-none max-sm:min-h-11 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronDownIcon className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
          <span>
            <CardTitle id={titleId}>{s.accountTitle(account.name)}</CardTitle>
            <span className="block text-sm text-muted-foreground">{s.ownerLabel(account.owner)}</span>
          </span>
        </button>
        <div className="flex gap-2 max-sm:gap-4">
          <Button variant="outline" size="icon-sm" aria-label={s.edit} title={s.edit} onClick={() => setEditing(true)}>
            <PencilIcon />
          </Button>
          <Button variant="destructive" size="icon-sm" aria-label={s.delete} title={s.delete} onClick={() => setDeleting(true)}>
            <Trash2Icon />
          </Button>
        </div>
      </CardHeader>
      {open && (
      <CardContent id={`${titleId}-content`} className="grid gap-4">
        <Disclosure title={s.cardsHeading}>
          {cards.length === 0 ? (
            <p className="text-sm text-muted-foreground">{s.noCards}</p>
          ) : (
            <ul className="grid gap-2">
              {cards.map((c) => (
                <CardRow key={cardKey(c)} card={c} accounts={accounts} run={run} api={api} />
              ))}
            </ul>
          )}
        </Disclosure>
        <CyclesSection
          account={account}
          cycles={cycles.filter((c) => c.accountId === account.id)}
          api={api}
        />
      </CardContent>
      )}
      {editing && (
        <AccountFormDialog
          open
          onOpenChange={setEditing}
          account={account}
          run={run}
          api={api}
        />
      )}
      <AlertDialog
        open={deleting}
        onOpenChange={(open) => {
          setDeleting(open)
          if (open) setDeleteFailed(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{s.deleteAccountTitle(account.name)}</AlertDialogTitle>
            <AlertDialogDescription>{s.deleteAccountText}</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteFailed && (
            <p role="alert" className="text-sm text-destructive">
              {s.apiError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{s.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletePending}
              onClick={async () => {
                setDeleteFailed(false)
                const ok = await guardedDelete(() => api.deleteAccount(account.id))
                if (!ok) setDeleteFailed(true)
              }}
            >
              {s.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function NewAccountForm({ run, api }: { run: Run; api: CardsApi }) {
  const [name, setName] = useState('')
  const [owner, setOwner] = useState('')
  const [open, setOpen] = useState(false)
  const [incomplete, setIncomplete] = useState(false)
  const [pending, guarded] = usePending(run)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const cleanName = name.trim()
    const cleanOwner = normalizeOwner(owner)
    if (!cleanName || !cleanOwner) return setIncomplete(true)
    setIncomplete(false)
    if (await guarded(() => api.createAccount({ name: cleanName, owner: cleanOwner }))) {
      setName('')
      setOwner('')
      setOpen(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{s.newAccountHeading}</CardTitle>
        <Button
          type="button"
          size="icon"
          aria-label={s.newAccountHeading}
          aria-expanded={open}
          className="bg-green-600 text-white hover:bg-green-700"
          onClick={() => setOpen((o) => !o)}
        >
          <PlusIcon className={`transition-transform ${open ? 'rotate-45' : ''}`} />
        </Button>
      </CardHeader>
      {open && (
      <CardContent>
    <form onSubmit={submit} className="grid gap-3 sm:max-w-md" aria-label={s.newAccountHeading}>
      <div className="grid gap-2">
        <Label htmlFor="new-account-name">{s.nameLabel}</Label>
        <Input
          id="new-account-name"
          value={name}
          maxLength={40}
          placeholder={s.namePlaceholder}
          aria-invalid={incomplete && !name.trim()}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="new-account-owner">{s.ownerInputLabel}</Label>
        <Input
          id="new-account-owner"
          value={owner}
          maxLength={40}
          placeholder={s.ownerPlaceholder}
          aria-invalid={incomplete && !normalizeOwner(owner)}
          onChange={(e) => setOwner(e.target.value)}
        />
      </div>
      {incomplete && (
        <p role="alert" className="text-sm text-destructive">
          {s.accountIncomplete}
        </p>
      )}
      <Button type="submit" className="justify-self-start" disabled={pending}>
        {s.createAccount}
      </Button>
    </form>
      </CardContent>
      )}
    </Card>
  )
}

export function CardsScreen({
  expenses,
  expensesStatus = 'ready',
  data,
  api,
}: {
  expenses: Expense[]
  // Unassigned cards are detected from the expenses, so they are only known once those are ready.
  expensesStatus?: 'loading' | 'ready' | 'error'
  data: CardsData
  api: CardsApi
}) {
  const toast = useToast()
  const [failed, setFailed] = useState(false)

  const run: Run = async (action) => {
    setFailed(false)
    try {
      await action()
      toast(strings.saved)
      return true
    } catch {
      setFailed(true)
      return false
    }
  }

  const accountIds = new Set(data.accounts.map((a) => a.id))
  const unassigned = findUnassignedCards(expenses, data.cards, data.accounts)

  return (
    <div className="grid gap-6">
      {failed && (
        <p role="alert" className="rounded-md border border-destructive p-3 text-destructive">
          {s.apiError}
        </p>
      )}

      {data.accounts.length === 0 && (
        <p className="text-muted-foreground">{s.noAccounts}</p>
      )}
      {data.accounts.map((account) => (
        <AccountSection
          key={account.id}
          account={account}
          cards={data.cards.filter((c) => c.accountId === account.id && accountIds.has(c.accountId))}
          cycles={data.cycles}
          accounts={data.accounts}
          run={run}
          api={api}
        />
      ))}

      {expensesStatus === 'ready' && unassigned.length > 0 && (
        <Card role="region" aria-labelledby="unassigned-heading">
          <CardHeader>
            <CardTitle id="unassigned-heading">{s.unassignedHeading}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2">
              {unassigned.map((c) => (
                <li
                  key={cardKey(c)}
                  aria-label={`····${c.last4}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border p-2"
                >
                  <span className="font-mono">····{c.last4}</span>
                  <Badge variant="secondary">{strings.expenses.cardType[c.type]}</Badge>
                  <span className="text-sm">{c.holder}</span>
                  {data.accounts.length > 0 && (
                    <span className="ml-auto">
                      <AccountSelect
                        accounts={data.accounts}
                        value={null}
                        ariaLabel={s.assignAria(c.last4)}
                        placeholder={s.assignPlaceholder}
                        onChange={(accountId) =>
                          void run(() =>
                            api.saveCard({ last4: c.last4, type: c.type, holder: c.holder, accountId }),
                          )
                        }
                      />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <NewAccountForm run={run} api={api} />
    </div>
  )
}
