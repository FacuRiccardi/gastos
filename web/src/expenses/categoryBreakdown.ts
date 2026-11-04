import type { Category } from '@/categories/types'
import type { Expense } from '@/lib/expense'

export type Slice = { id: string; name: string; color: string; amount: number; percent: number }
export type Breakdown = { slices: Slice[]; total: number; hasForeign: boolean }

export const UNCATEGORIZED_COLOR = '#ef4444'
export const MINOR_COLOR = '#9ca3af'
// Categories under this share are merged into one virtual "minor" slice.
export const MINOR_LIMIT = 1

/**
 * Share of each category in the pesos spent. Rejected purchases and other currencies are left out
 * (`hasForeign` reports the latter). Credits are netted inside their category; a category whose net
 * is not positive is not shown. Purchases without a (valid) category go to "uncategorized". Shares
 * under 1% are merged into one virtual slice (kept as is when there is only one of them).
 * Slices are sorted from the largest to the smallest, the merged one last.
 */
export function buildBreakdown(
  expenses: Expense[],
  categories: Category[],
  labels: { uncategorized: string; minor: string },
): Breakdown {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const totals = new Map<string, { name: string; color: string; amount: number }>()
  let hasForeign = false
  for (const e of expenses) {
    if (e.status === 'rejected') continue
    if (e.currency !== 'ARS') {
      hasForeign = true
      continue
    }
    const category = e.categoryId ? byId.get(e.categoryId) : undefined
    const id = category?.id ?? 'none'
    const entry = totals.get(id) ?? {
      name: category?.name ?? labels.uncategorized,
      color: category?.color ?? UNCATEGORIZED_COLOR,
      amount: 0,
    }
    entry.amount += e.amount
    totals.set(id, entry)
  }

  const positive = [...totals.entries()].map(([id, t]) => ({ id, ...t, amount: Math.round(t.amount * 100) / 100 })).filter((t) => t.amount > 0)
  const total = positive.reduce((sum, t) => sum + t.amount, 0)
  if (total === 0) return { slices: [], total: 0, hasForeign }

  const withPercent = positive.map((t): Slice => ({ ...t, percent: (t.amount / total) * 100 })).sort((a, b) => b.amount - a.amount)
  const big = withPercent.filter((s) => s.percent >= MINOR_LIMIT)
  const small = withPercent.filter((s) => s.percent < MINOR_LIMIT)
  if (small.length < 2) return { slices: [...big, ...small], total, hasForeign }

  const amount = small.reduce((sum, s) => sum + s.amount, 0)
  const minor: Slice = { id: 'minor', name: labels.minor, color: MINOR_COLOR, amount, percent: (amount / total) * 100 }
  return { slices: [...big, minor], total, hasForeign }
}

export const formatPercent = (percent: number): string => `${percent.toFixed(1).replace('.', ',')}%`
