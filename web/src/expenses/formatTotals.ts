import { formatMoney } from '@/lib/format'
import type { MoneyTotals } from './statements'

export const formatTotals = (totals: MoneyTotals): string => {
  const entries = Object.entries(totals)
  return (entries.length === 0 ? [formatMoney(0, 'ARS')] : entries.map(([currency, amount]) => formatMoney(amount, currency))).join(' · ')
}
