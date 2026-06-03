import { BudgetLimitId } from '../../domain/budget/BudgetLimitId.js';
import { BudgetLimitRepository } from '../../domain/budget/BudgetLimitRepository.js';
import { CategoryRepository } from '../../domain/catalogue/category/CategoryRepository.js';
import { ExpenseFilters } from '../../domain/expense/ExpenseFilters.js';
import { ExpenseRepository } from '../../domain/expense/ExpenseRepository.js';
import { Money } from '../../domain/shared/Money.js';
import { Pagination } from '../../domain/shared/Pagination.js';

export interface GetBudgetLimitBalanceInput {
  id: BudgetLimitId;
  asOf?: Date;
}

export type GetBudgetLimitBalanceOutput = { remaining: Money };

const ALL_EXPENSES_PAGINATION = new Pagination(100_000, 0);

export class GetBudgetLimitBalance {
  constructor(
    private readonly limits: BudgetLimitRepository,
    private readonly expenses: ExpenseRepository,
    private readonly categories: CategoryRepository,
  ) {}

  async execute(input: GetBudgetLimitBalanceInput): Promise<GetBudgetLimitBalanceOutput> {
    const limit = await this.limits.findById(input.id);
    if (!limit) throw new Error('BudgetLimit not found');

    const asOf = input.asOf ?? new Date();
    const { from, to } = limit.period.getDateRange(asOf);

    let categoryIds = limit.categoryId !== undefined ? [limit.categoryId] : undefined;

    if (limit.groupId !== undefined) {
      const groupCategories = await this.categories.findAllByGroup(limit.groupId);
      categoryIds = groupCategories.map((c) => c.id);
    }

    const filters = new ExpenseFilters(from, to, categoryIds);
    const page = await this.expenses.findByHousehold(limit.householdId, filters, ALL_EXPENSES_PAGINATION);

    const spent = page.items.reduce((sum, e) => sum + e.money.amount, 0);
    const remaining = new Money(limit.money.amount - spent, limit.money.currency);

    return { remaining };
  }
}
