import type { Category } from '@/categories/types'
import type { Expense } from '@/lib/expense'
import { PurchasesTable } from '@/expenses/PurchasesTable'
import { strings } from '@/strings'

// A purchase needs a category when it has none, or when its category no longer exists.
export function needsCategory(expense: Expense, categories: Category[]): boolean {
  return expense.status !== 'rejected' && !(expense.categoryId && categories.some((c) => c.id === expense.categoryId))
}

// "Compras a categorizar": the purchases without a category, newest first. Choosing a category here
// is also remembered for the merchant (the caller saves it in the dictionary).
export function ToCategorize({
  expenses,
  categories,
  onCategorize,
}: {
  expenses: Expense[]
  categories: Category[]
  onCategorize: (expenseId: string, categoryId: string | null) => void
}) {
  const pending = expenses.filter((e) => needsCategory(e, categories)).sort((a, b) => b.purchaseDate.getTime() - a.purchaseDate.getTime())
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
