import { Expense } from '../../domain/expense/Expense.js';
import { ExpenseFilters } from '../../domain/expense/ExpenseFilters.js';
import { ExpenseRepository } from '../../domain/expense/ExpenseRepository.js';
import { CategoryRepository } from '../../domain/catalogue/category/CategoryRepository.js';
import { GroupId } from '../../domain/catalogue/group/GroupId.js';
import { HouseholdId } from '../../domain/identity/household/HouseholdId.js';
import { Page } from '../../domain/shared/Page.js';
import { Pagination } from '../../domain/shared/Pagination.js';
import { ApplicationError } from '../ApplicationError.js';

export interface ListExpensesInput {
  householdId: HouseholdId;
  filters: ExpenseFilters;
  groupId?: GroupId;
  pagination: Pagination;
}

export type ListExpensesOutput = { page: Page<Expense> };

export class ListExpenses {
  constructor(
    private readonly expenses: ExpenseRepository,
    private readonly categories: CategoryRepository,
  ) {}

  async execute(input: ListExpensesInput): Promise<ListExpensesOutput> {
    if (input.groupId !== undefined && input.filters.categoryIds !== undefined && input.filters.categoryIds.length > 0) {
      throw new ApplicationError('Cannot filter by both groupId and categoryIds simultaneously');
    }

    let filters = input.filters;

    if (input.groupId !== undefined) {
      const groupCategories = await this.categories.findAllByGroup(input.groupId);
      const categoryIds = groupCategories.map((c) => c.id);
      filters = new ExpenseFilters(
        filters.from,
        filters.to,
        categoryIds,
        filters.paymentInstrumentId,
      );
    }

    const page = await this.expenses.findByHousehold(input.householdId, filters, input.pagination);
    return { page };
  }
}
