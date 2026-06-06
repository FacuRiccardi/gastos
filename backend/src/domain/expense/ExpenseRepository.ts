import { Expense } from './Expense.js';
import { ExpenseId } from './ExpenseId.js';
import { ExpenseFilters } from './ExpenseFilters.js';
import { HouseholdId } from '../identity/household/HouseholdId.js';
import { Pagination } from '../shared/Pagination.js';
import { Page } from '../shared/Page.js';

export interface ExpenseRepository {
  findById(id: ExpenseId): Promise<Expense | null>;
  findByHousehold(householdId: HouseholdId, filters: ExpenseFilters, pagination: Pagination): Promise<Page<Expense>>;
  sumAmountByHousehold(householdId: HouseholdId, filters: ExpenseFilters): Promise<number>;
  save(expense: Expense): Promise<void>;
  delete(id: ExpenseId): Promise<void>;
}
