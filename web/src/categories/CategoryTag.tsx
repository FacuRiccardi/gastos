import { Badge } from '@/components/ui/badge'
import { strings } from '@/strings'
import type { Category } from './types'

// A colored pill with the category name. A purchase without a (valid) category gets the red tag.
export function CategoryDot({ color }: { color: string }) {
  return <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
}

export function categoryTagStyle(color: string) {
  return { backgroundColor: `${color}26`, borderColor: `${color}66` }
}

export function CategoryTag({ category }: { category: Category }) {
  return (
    <span
      className="inline-flex h-5 w-fit items-center gap-1.5 rounded-full border px-2 text-xs font-medium whitespace-nowrap"
      style={categoryTagStyle(category.color)}
    >
      <CategoryDot color={category.color} />
      {category.name}
    </span>
  )
}

export function UncategorizedTag() {
  return <Badge variant="destructive">{strings.categories.uncategorized}</Badge>
}
