import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { strings } from '@/strings'
import { CategoryDot, categoryTagStyle } from './CategoryTag'
import type { Category } from './types'

const NONE = 'none'

// The tag of a purchase; clicking it opens the list to change it.
export function CategoryPicker({
  categories,
  categoryId,
  merchant,
  allowNone = true,
  ariaLabel,
  onChange,
}: {
  categories: Category[]
  categoryId: string | null | undefined
  merchant: string
  // The dictionary has no "uncategorized" option: a merchant always maps to a category.
  allowNone?: boolean
  ariaLabel?: string
  onChange: (categoryId: string | null) => void
}) {
  const current = categories.find((c) => c.id === categoryId) ?? null
  const items = [{ value: NONE, label: strings.categories.uncategorized }, ...categories.map((c) => ({ value: c.id, label: c.name }))]
  return (
    <Select items={items} value={current?.id ?? NONE} onValueChange={(v) => onChange(v === NONE || v === null ? null : v)}>
      <SelectTrigger
        aria-label={ariaLabel ?? strings.categories.changeAria(merchant)}
        className={
          current
            ? 'h-5! w-fit gap-1.5 rounded-full px-2 py-0 text-xs max-sm:h-9! max-sm:px-3 max-sm:text-sm max-sm:relative max-sm:before:absolute max-sm:before:-inset-y-1 max-sm:before:inset-x-0 max-sm:before:content-[""]'
            : 'h-5! w-fit gap-1.5 rounded-full border-destructive/30 bg-destructive/10 px-2 py-0 text-xs text-destructive max-sm:h-9! max-sm:px-3 max-sm:text-sm max-sm:relative max-sm:before:absolute max-sm:before:-inset-y-1 max-sm:before:inset-x-0 max-sm:before:content-[""]'
        }
        style={current ? categoryTagStyle(current.color) : undefined}
      >
        {current ? (
          <>
            <CategoryDot color={current.color} />
            {current.name}
          </>
        ) : (
          strings.categories.uncategorized
        )}
      </SelectTrigger>
      <SelectContent>
        {items.filter((item) => allowNone || item.value !== NONE).map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {/* The dot and the name share one line, centred on each other. */}
            <span className="flex items-center gap-2">
              {item.value !== NONE && <CategoryDot color={categories.find((c) => c.id === item.value)!.color} />}
              {item.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
