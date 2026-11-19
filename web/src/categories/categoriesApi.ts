// Interfaces of the Categories data layer. Components receive them through props so tests can use fakes.
import type { Expense } from '../lib/expense'
import type { Category } from './types'

export interface CategoriesSource {
  subscribe(onData: (categories: Category[]) => void, onError: (error: Error) => void): () => void
}

export interface CategoriesApi {
  create(input: { name: string; color: string }): Promise<string>
  update(id: string, input: { name: string; color: string }): Promise<void>
  // Categories are never deleted: they are archived.
  setArchived(id: string, archived: boolean): Promise<void>
  // null = uncategorized
  setExpenseCategory(expense: Expense, categoryId: string | null): Promise<void>
}
