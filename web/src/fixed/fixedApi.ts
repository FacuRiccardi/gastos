// Interfaces of the fixed monthly expenses data layer. Components receive them through props so tests can use fakes.

// A kind of fixed expense ("Alquiler", "Expensas", ...). A disabled type is never deleted: it keeps its
// history but no new amounts can be loaded for it, until it is enabled again.
export type FixedType = { id: string; name: string; disabled: boolean }
// What was paid for a type in a month ('YYYY-MM'), in pesos. There is at most one per type and month.
export type FixedEntry = { typeId: string; month: string; amount: number }
export type FixedData = { types: FixedType[]; entries: FixedEntry[] }

export interface FixedSource {
  subscribe(onData: (data: FixedData) => void, onError: (error: Error) => void): () => void
}

export interface FixedApi {
  addType(name: string): Promise<string>
  renameType(id: string, name: string): Promise<void>
  // Soft delete: a disabled type keeps its entries but accepts no new ones.
  setTypeDisabled(id: string, disabled: boolean): Promise<void>
  // Creates the entry of the month, or replaces its amount.
  save(typeId: string, month: string, amount: number): Promise<void>
  clear(typeId: string, month: string): Promise<void>
}

// The id of an entry, which is what makes "once a month per type" a guarantee.
export const entryKey = (typeId: string, month: string) => `${typeId}_${month}`

/** Adds (or subtracts) whole months to a 'YYYY-MM' month. */
export function addMonths(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number)
  const index = year * 12 + (m - 1) + delta
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

// ---- Rent counter ----
// The rent is updated every 3 months, so its row shows which month of the cycle it is: 1, 2, 3 and,
// on the fourth month, back to 1. Only the type called "Alquiler" has it.
export const RENT_CYCLE = 3
// The month that is month 1 of the cycle (Oct 2026, as in the spreadsheet).
export const DEFAULT_COUNTER_START = '2026-10'

export const isRent = (typeName: string) =>
  typeName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase() === 'alquiler'

const monthIndex = (month: string) => {
  const [year, m] = month.split('-').map(Number)
  return year * 12 + (m - 1)
}

/** 1, 2 or 3: the position of `month` in the cycle that has month 1 at `start` (works before and after it). */
export function rentCounter(month: string, start: string = DEFAULT_COUNTER_START): number {
  const diff = monthIndex(month) - monthIndex(start)
  return (((diff % RENT_CYCLE) + RENT_CYCLE) % RENT_CYCLE) + 1
}
