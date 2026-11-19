// The app's data access: one-shot reads and field-level writes. No `@/` imports: the root emulator tests import this file.
import type { CardsApi } from '../cards/cardsApi'
import type { Entry, EntryKind, NewEntry } from '../money/entries'
import type { AppConfig, MonthData, MonthId, UncategorizedItem } from './types'

export type PurchaseRef = { month: MonthId; id: string }

export interface Backend {
  readConfig(): Promise<AppConfig>
  readMonth(id: MonthId): Promise<MonthData | null>
  readUncategorized(): Promise<UncategorizedItem[]>
  cards: CardsApi
  createCategory(input: { name: string; color: string }): Promise<string>
  updateCategory(id: string, input: { name: string; color: string }): Promise<void>
  // Archiving also drops the given merchant keys from the dictionary, in the same batch.
  setCategoryArchived(id: string, archived: boolean, dropMerchantKeys: string[]): Promise<void>
  rememberMerchant(merchant: string, categoryId: string): Promise<void>
  setExpenseCategory(ref: PurchaseRef, categoryId: string | null, listAsUncategorized: UncategorizedItem | null): Promise<void>
  categorizeMerchant(merchant: string, categoryId: string, refs: PurchaseRef[]): Promise<void>
  addFixedType(name: string): Promise<string>
  renameFixedType(id: string, name: string): Promise<void>
  setFixedTypeDisabled(id: string, disabled: boolean): Promise<void>
  // The month writes below create the month when it does not exist yet, inheriting rate and cap.
  setFixed(month: MonthId, typeId: string, amount: number | null): Promise<void>
  addEntry(kind: EntryKind, entry: NewEntry): Promise<string>
  removeEntry(kind: EntryKind, entry: Entry): Promise<void>
  setRate(month: MonthId, rate: number): Promise<void>
  setCap(month: MonthId, amount: number | null): Promise<void>
}
