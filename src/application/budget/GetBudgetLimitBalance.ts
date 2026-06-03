import { BudgetLimitId } from '../../domain/budget/BudgetLimitId.js';
import { BudgetLimitRepository } from '../../domain/budget/BudgetLimitRepository.js';
import { CategoryRepository } from '../../domain/catalogue/category/CategoryRepository.js';
import { ExpenseFilters } from '../../domain/expense/ExpenseFilters.js';
import { ExpenseRepository } from '../../domain/expense/ExpenseRepository.js';
import { Balance } from '../../domain/shared/Balance.js';

export interface GetBudgetLimitBalanceInput {
  id: BudgetLimitId;
  asOf?: Date;
}

export type GetBudgetLimitBalanceOutput = { remaining: Balance };

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
    const spent = await this.expenses.sumAmountByHousehold(limit.householdId, filters);
    const remaining = new Balance(limit.money.amount - spent, limit.money.currency);

    return { remaining };
  }
}
