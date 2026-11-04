import { CategoryPicker } from '@/categories/CategoryPicker'
import type { Category } from '@/categories/types'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatMoney } from '@/lib/format'
import type { Expense } from '@/lib/expense'
import { strings } from '@/strings'

// Date / merchant / amount rows. A rejected purchase is greyed and badged.
export function PurchasesTable({
  expenses,
  categories,
  onCategoryChange,
}: {
  expenses: Expense[]
  // When given, each purchase shows its category tag (click it to change it).
  categories?: Category[]
  onCategoryChange?: (expenseId: string, categoryId: string | null) => void
}) {
  return (
    <Table className="max-sm:block">
      {/* On a phone each purchase is a small card (merchant and amount, the date under it), so the header goes. */}
      <TableHeader className="max-sm:hidden">
        <TableRow>
          <TableHead>{strings.expenses.columns.date}</TableHead>
          <TableHead>{strings.expenses.columns.merchant}</TableHead>
          <TableHead className="text-right">{strings.expenses.columns.amount}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="max-sm:block">
        {expenses.map((expense) => {
          const rejected = expense.status === 'rejected'
          return (
            <TableRow
              key={expense.id}
              className={`max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:items-center max-sm:gap-x-3 max-sm:py-1 ${rejected ? 'text-muted-foreground' : ''}`}
            >
              <TableCell className="max-sm:col-start-1 max-sm:row-start-2 max-sm:py-1 max-sm:text-xs max-sm:text-muted-foreground">{formatDate(expense.purchaseDate)}</TableCell>
              <TableCell className="max-sm:col-start-1 max-sm:row-start-1 max-sm:py-1">
                {/* The name and its tags share a line; they wrap only when the screen is too narrow. */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>{expense.merchant}</span>
                  {rejected && <Badge variant="destructive">{strings.expenses.rejected}</Badge>}
                  {categories && (
                    <CategoryPicker
                      categories={categories}
                      categoryId={expense.categoryId}
                      merchant={expense.merchant}
                      onChange={(categoryId) => onCategoryChange?.(expense.id, categoryId)}
                    />
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums max-sm:col-start-2 max-sm:row-span-2 max-sm:row-start-1 max-sm:text-base max-sm:font-medium">
                {formatMoney(expense.amount, expense.currency)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
