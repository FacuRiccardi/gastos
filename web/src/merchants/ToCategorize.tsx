import type { Category } from '@/categories/types'
import { newestFirst, uncategorizedToExpense } from '@/data/monthDoc'
import type { UncategorizedItem } from '@/data/types'
import type { Expense } from '@/lib/expense'
import { PurchasesTable } from '@/expenses/PurchasesTable'
import { strings } from '@/strings'

// "Compras a categorizar": every purchase of `meta/uncategorized`, of any month, newest first. Choosing a
// category here is also remembered for the merchant (the caller saves it in the dictionary).
export function ToCategorize({
  items,
  categories,
  onCategorize,
}: {
  items: UncategorizedItem[]
  categories: Category[]
  onCategorize: (expense: Expense, categoryId: string | null) => void
}) {
  const pending = [...items].sort(newestFirst).map(uncategorizedToExpense)
  return (
    <div className="grid gap-3">
      {pending.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground">{strings.toCategorize.empty}</p>
      ) : (
        <PurchasesTable expenses={pending} categories={categories} onCategoryChange={onCategorize} />
      )}
    </div>
  )
}
