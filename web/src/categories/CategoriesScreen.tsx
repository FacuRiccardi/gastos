import { Trash2Icon } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
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
import { CollapsibleCard } from '@/components/CollapsibleCard'
import { useToast } from '@/components/Toast'
import { Input } from '@/components/ui/input'
import type { Expense } from '@/lib/expense'
import { MerchantDictionary } from '@/merchants/MerchantDictionary'
import type { MerchantEntry, MerchantsApi } from '@/merchants/merchantsApi'
import { needsCategory, ToCategorize } from '@/merchants/ToCategorize'
import { strings } from '@/strings'
import type { CategoriesApi } from './categoriesApi'
import { CategoryTag } from './CategoryTag'
import type { Category } from './types'

const s = strings.categories
const DEFAULT_COLOR = '#3b82f6'

export type CategoriesSection = 'toCategorize'

function ColorInput({ value, onCommit, label }: { value: string; onCommit: (color: string) => void; label: string }) {
  const [local, setLocal] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => setLocal(value), [value])
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <input
      type="color"
      aria-label={label}
      value={local}
      className="size-8 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5 max-sm:size-11"
      onChange={(e) => {
        setLocal(e.target.value)
        // The picker fires continuously while dragging: save once it settles.
        clearTimeout(timer.current)
        const color = e.target.value
        timer.current = setTimeout(() => onCommit(color), 400)
      }}
    />
  )
}

function CategoryRow({ category, api, onError }: { category: Category; api: CategoriesApi; onError: () => void }) {
  const toast = useToast()
  const [name, setName] = useState(category.name)
  const [deleting, setDeleting] = useState(false)
  useEffect(() => setName(category.name), [category.name])
  // The colour picker saves while you drag it, so only a rename confirms with a toast.
  const save = (patch: Partial<{ name: string; color: string }>, notify = false) =>
    api
      .update(category.id, { name: category.name, color: category.color, ...patch })
      .then(() => notify && toast(strings.saved))
      .catch(onError)

  function commitName() {
    const clean = name.trim()
    if (!clean) return setName(category.name)
    if (clean !== category.name) void save({ name: clean }, true)
  }

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border p-2">
      <ColorInput value={category.color} label={s.colorAria(category.name)} onCommit={(color) => void save({ color })} />
      <Input
        value={name}
        maxLength={40}
        aria-label={s.nameAria(category.name)}
        className="min-w-0 flex-1"
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <CategoryTag category={category} />
      <Button variant="outline" size="icon-sm" aria-label={s.deleteAria(category.name)} title={s.delete} onClick={() => setDeleting(true)}>
        <Trash2Icon />
      </Button>
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{s.deleteTitle(category.name)}</AlertDialogTitle>
            <AlertDialogDescription>{s.deleteText}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{s.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void api.remove(category.id).then(() => toast(strings.deleted)).catch(onError)}>{s.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}

function NewCategory({ api, onError }: { api: CategoriesApi; onError: () => void }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [pending, setPending] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const clean = name.trim()
    if (!clean || pending) return
    setPending(true)
    try {
      await api.create({ name: clean, color })
      toast(strings.saved)
      setName('')
    } catch {
      onError()
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} aria-label={s.addHeading} className="flex flex-wrap items-center gap-2 sm:max-w-md">
      <ColorInput value={color} label={s.newColorAria} onCommit={setColor} />
      <Input value={name} maxLength={40} placeholder={s.namePlaceholder} aria-label={s.newNameAria} className="min-w-0 flex-1" onChange={(e) => setName(e.target.value)} />
      <Button type="submit" disabled={pending}>
        {s.add}
      </Button>
    </form>
  )
}

// "Categorías": the purchases that still need one, the categories themselves (add, rename, recolour, delete)
// and the merchant -> category dictionary. Each part is a card that opens and closes.
export function CategoriesScreen({
  expenses,
  categories,
  api,
  merchants,
  merchantsApi,
  onCategorize,
  initialOpen,
}: {
  expenses: Expense[]
  categories: Category[]
  api: CategoriesApi
  merchants: { status: 'loading' | 'ready' | 'error'; merchants: MerchantEntry[]; error: string | null }
  merchantsApi: MerchantsApi
  onCategorize: (expenseId: string, categoryId: string | null) => void
  // The card to open on arrival (the alert of the home view points to the purchases to categorize).
  initialOpen?: CategoriesSection | null
}) {
  const [failed, setFailed] = useState(false)
  const onError = () => setFailed(true)
  const pending = expenses.filter((e) => needsCategory(e, categories)).length
  return (
    <div className="grid gap-4">
      {failed && (
        <p role="alert" className="rounded-md border border-destructive p-3 text-destructive">
          {s.apiError}
        </p>
      )}
      <CollapsibleCard
        title={`${strings.tabs.toCategorize}${pending > 0 ? ` (${pending})` : ''}`}
        tooltip={strings.toCategorize.intro}
        defaultOpen={initialOpen === 'toCategorize'}
      >
        <ToCategorize expenses={expenses} categories={categories} onCategorize={onCategorize} />
      </CollapsibleCard>
      <CollapsibleCard title={s.cardTitle} tooltip={s.intro}>
        <NewCategory api={api} onError={onError} />
        {categories.length === 0 ? (
          <p className="text-muted-foreground">{s.empty}</p>
        ) : (
          <ul className="grid gap-2">
            {categories.map((c) => (
              <CategoryRow key={c.id} category={c} api={api} onError={onError} />
            ))}
          </ul>
        )}
      </CollapsibleCard>
      <CollapsibleCard
        title={`${s.dictionary.title}${merchants.status === 'ready' ? ` (${merchants.merchants.length})` : ''}`}
        tooltip={s.dictionary.intro}
      >
        <MerchantDictionary
          merchants={merchants.merchants}
          status={merchants.status}
          error={merchants.error}
          categories={categories}
          api={merchantsApi}
          onError={onError}
        />
      </CollapsibleCard>
    </div>
  )
}
