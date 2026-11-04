import type { Category } from '@/categories/types'
import type { Expense } from '@/lib/expense'

// `top` are the merchants that weigh the most inside the slice (what it is made of).
export type Slice = { id: string; name: string; color: string; amount: number; percent: number; top: { merchant: string; amount: number }[] }
export type Breakdown = { slices: Slice[]; total: number; hasForeign: boolean }

export const UNCATEGORIZED_COLOR = '#ef4444'
export const MINOR_COLOR = '#78716c'
// Categories under this share are merged into one virtual "minor" slice.
export const MINOR_LIMIT = 1
const TOP_MERCHANTS = 5

const topOf = (merchants: Map<string, number>) =>
  [...merchants.entries()]
    .map(([merchant, amount]) => ({ merchant, amount: Math.round(amount * 100) / 100 }))
    .filter((m) => m.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, TOP_MERCHANTS)

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
  const totals = new Map<string, { name: string; color: string; amount: number; merchants: Map<string, number> }>()
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
      merchants: new Map<string, number>(),
    }
    entry.amount += e.amount
    entry.merchants.set(e.merchant, (entry.merchants.get(e.merchant) ?? 0) + e.amount)
    totals.set(id, entry)
  }

  const positive = [...totals.entries()].map(([id, t]) => ({ id, ...t, amount: Math.round(t.amount * 100) / 100 })).filter((t) => t.amount > 0)
  const merchantsOf = new Map(positive.map((t) => [t.id, t.merchants]))
  const total = positive.reduce((sum, t) => sum + t.amount, 0)
  if (total === 0) return { slices: [], total: 0, hasForeign }

  const withPercent = positive
    .map((t): Slice => ({ id: t.id, name: t.name, color: t.color, amount: t.amount, percent: (t.amount / total) * 100, top: topOf(t.merchants) }))
    .sort((a, b) => b.amount - a.amount)
  const big = withPercent.filter((s) => s.percent >= MINOR_LIMIT)
  const small = withPercent.filter((s) => s.percent < MINOR_LIMIT)
  if (small.length < 2) return { slices: [...big, ...small], total, hasForeign }

  const amount = small.reduce((sum, s) => sum + s.amount, 0)
  const merged = new Map<string, number>()
  for (const s of small) for (const [merchant, value] of merchantsOf.get(s.id) ?? []) merged.set(merchant, (merged.get(merchant) ?? 0) + value)
  const minor: Slice = { id: 'minor', name: labels.minor, color: MINOR_COLOR, amount, percent: (amount / total) * 100, top: topOf(merged) }
  return { slices: [...big, minor], total, hasForeign }
}

export const formatPercent = (percent: number): string => `${percent.toFixed(1).replace('.', ',')}%`
