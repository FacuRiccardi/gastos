import { Expense } from '../../src/domain/expense/Expense.js';
import { ExpenseId } from '../../src/domain/expense/ExpenseId.js';
import { ExpenseFilters } from '../../src/domain/expense/ExpenseFilters.js';
import { HouseholdId } from '../../src/domain/identity/household/HouseholdId.js';
import { Pagination } from '../../src/domain/shared/Pagination.js';
import { Page } from '../../src/domain/shared/Page.js';
import { ExpenseRepository } from '../../src/domain/expense/ExpenseRepository.js';

export class InMemoryExpenseRepository implements ExpenseRepository {
  private store = new Map<string, Expense>();

  async findById(id: ExpenseId): Promise<Expense | null> {
    return this.store.get(id) ?? null;
  }

  async findByHousehold(
    householdId: HouseholdId,
    filters: ExpenseFilters,
    pagination: Pagination,
  ): Promise<Page<Expense>> {
    let items = [...this.store.values()].filter((e) => e.householdId === householdId);

    if (filters.from !== undefined) {
      const from = filters.from.toDate();
      items = items.filter((e) => e.date.toDate() >= from);
    }
    if (filters.to !== undefined) {
      const to = filters.to.toDate();
      items = items.filter((e) => e.date.toDate() <= to);
    }
    if (filters.categoryIds !== undefined && filters.categoryIds.length > 0) {
      const ids = new Set(filters.categoryIds as string[]);
      items = items.filter((e) => ids.has(e.categoryId));
    }
    if (filters.paymentInstrumentId !== undefined) {
      const pid = filters.paymentInstrumentId;
      items = items.filter(
        (e) =>
          e.paymentMethod.kind !== 'Cash' &&
          e.paymentMethod.instrumentId === pid,
      );
    }

    const total = items.length;
    const paged = items.slice(pagination.offset, pagination.offset + pagination.limit);
    return new Page(paged, total);
  }

  async save(expense: Expense): Promise<void> {
    this.store.set(expense.id, expense);
  }

  async delete(id: ExpenseId): Promise<void> {
    this.store.delete(id);
  }
}
