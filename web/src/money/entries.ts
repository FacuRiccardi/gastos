// Incomes and savings share one shape: an amount in pesos or dollars on a day.
export type Currency = 'ARS' | 'USD'
export type EntryKind = 'incomes' | 'savings'
// Whose income it is. Only incomes have it; savings go to a single box.
// The names of the people are configuration, not code: VITE_OWNERS in web/.env, separated by commas
// (for example "Ana,Beto"). The incomes keep the name as it was written when they were loaded.
export type Owner = string
export const OWNERS: Owner[] = ((import.meta.env.VITE_OWNERS as string | undefined) ?? 'Persona 1,Persona 2')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean)
export type Entry = { id: string; amount: number; currency: Currency; date: string; owner?: Owner }
export type NewEntry = Omit<Entry, 'id'>

export interface EntriesSource {
  subscribe(onData: (entries: Entry[]) => void, onError: (error: Error) => void): () => void
}

export interface EntriesApi {
  add(entry: NewEntry): Promise<string>
  remove(id: string): Promise<void>
}

/**
 * Reads an amount typed the Argentine way ("1.500,50", "1500,5") or plainly ("1500.50").
 * Returns null when it is not a positive number.
 */
export function parseAmount(text: string): number | null {
  const clean = text.replace(/[\s$]|USD|ARS/gi, '')
  if (!clean) return null
  let normalized = clean
  if (clean.includes(',')) normalized = clean.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(clean)) normalized = clean.replace(/\./g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const value = Number(normalized)
  return value > 0 ? value : null
}

/** Sum per currency, rounded to cents. */
export function sumByCurrency(entries: Entry[]): Partial<Record<Currency, number>> {
  const totals: Partial<Record<Currency, number>> = {}
  for (const e of entries) totals[e.currency] = Math.round(((totals[e.currency] ?? 0) + e.amount) * 100) / 100
  return totals
}
