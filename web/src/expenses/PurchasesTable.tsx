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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{strings.expenses.columns.date}</TableHead>
          <TableHead>{strings.expenses.columns.merchant}</TableHead>
          <TableHead className="text-right">{strings.expenses.columns.amount}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {expenses.map((expense) => {
          const rejected = expense.status === 'rejected'
          return (
            <TableRow key={expense.id} className={rejected ? 'text-muted-foreground' : undefined}>
              <TableCell>{formatDate(expense.purchaseDate)}</TableCell>
              <TableCell>
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
              <TableCell className="text-right tabular-nums">{formatMoney(expense.amount, expense.currency)}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
