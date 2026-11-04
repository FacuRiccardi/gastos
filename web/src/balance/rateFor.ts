import type { Rates } from './ratesApi'

// The rate that applies to a month, and which month it comes from.
export type AppliedRate = { rate: number; month: string; exact: boolean }

/**
 * The exchange rate ("TC") to turn dollars into pesos in `month`: the month's own rate; else the latest one
 * loaded before it; else (nothing earlier) the latest one loaded at all. Null when no rate was ever loaded.
 */
export function rateFor(rates: Rates, month: string): AppliedRate | null {
  const months = Object.keys(rates)
    .filter((m) => rates[m] > 0)
    .sort()
  if (months.length === 0) return null
  if (rates[month] > 0) return { rate: rates[month], month, exact: true }
  const chosen = months.filter((m) => m < month).pop() ?? months[months.length - 1]
  return { rate: rates[chosen], month: chosen, exact: false }
}
