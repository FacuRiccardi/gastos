import { describe, it, expect, beforeEach } from 'vitest';
import { GetBudgetLimitBalance } from '../../../../src/application/budget/GetBudgetLimitBalance.js';
import { InMemoryBudgetLimitRepository } from '../../../helpers/InMemoryBudgetLimitRepository.js';
import { InMemoryExpenseRepository } from '../../../helpers/InMemoryExpenseRepository.js';
import { InMemoryCategoryRepository } from '../../../helpers/InMemoryCategoryRepository.js';
import { BudgetLimit } from '../../../../src/domain/budget/BudgetLimit.js';
import { BudgetLimitId } from '../../../../src/domain/budget/BudgetLimitId.js';
import { BudgetPeriod } from '../../../../src/domain/budget/BudgetPeriod.js';
import { Expense } from '../../../../src/domain/expense/Expense.js';
import { ExpenseId } from '../../../../src/domain/expense/ExpenseId.js';
import { ExpenseDate } from '../../../../src/domain/expense/ExpenseDate.js';
import { Category } from '../../../../src/domain/catalogue/category/Category.js';
import { CategoryId } from '../../../../src/domain/catalogue/category/CategoryId.js';
import { GroupId } from '../../../../src/domain/catalogue/group/GroupId.js';
import { HouseholdId } from '../../../../src/domain/identity/household/HouseholdId.js';
import { UserId } from '../../../../src/domain/identity/user/UserId.js';
import { Money } from '../../../../src/domain/shared/Money.js';
import { Currency } from '../../../../src/domain/shared/Currency.js';

const householdId = HouseholdId.generate();
const userId = UserId.generate();
const groupId = GroupId.generate();
const period = BudgetPeriod.custom(new Date(2024, 0, 1), new Date(2024, 0, 31));
const cap = new Money(1000, Currency.ARS);

function makeExpense(categoryId: CategoryId, amount: number, year: number, month: number, day: number): Expense {
  return new Expense(
    ExpenseId.generate(),
    householdId,
    userId,
    categoryId,
    new Money(amount, Currency.ARS),
    { kind: 'Cash' },
    new ExpenseDate(new Date(year, month - 1, day)),
  );
}

describe('Budget / GetBudgetLimitBalance', () => {
  let limits: InMemoryBudgetLimitRepository;
  let expenses: InMemoryExpenseRepository;
  let categories: InMemoryCategoryRepository;
  let useCase: GetBudgetLimitBalance;

  beforeEach(() => {
    limits = new InMemoryBudgetLimitRepository();
    expenses = new InMemoryExpenseRepository();
    categories = new InMemoryCategoryRepository();
    useCase = new GetBudgetLimitBalance(limits, expenses, categories);
  });

  it('returns the full cap as remaining when there are no expenses in the period', async () => {
    const id = BudgetLimitId.generate();
    const categoryId = CategoryId.generate();
    await limits.save(BudgetLimit.forCategory(id, householdId, cap, period, categoryId));

    const result = await useCase.execute({ id, householdId });

    expect(result.remaining.amount).toBe(1000);
  });

  it('returns remaining balance after subtracting expenses matching the category-scoped limit', async () => {
    const id = BudgetLimitId.generate();
    const categoryId = CategoryId.generate();
    await limits.save(BudgetLimit.forCategory(id, householdId, cap, period, categoryId));
    await expenses.save(makeExpense(categoryId, 300, 2024, 1, 10));
    await expenses.save(makeExpense(categoryId, 200, 2024, 1, 20));

    const result = await useCase.execute({ id, householdId });

    expect(result.remaining.amount).toBe(500);
  });

  it('returns remaining balance after subtracting expenses matching the group-scoped limit', async () => {
    const id = BudgetLimitId.generate();
    const catA = CategoryId.generate();
    const catB = CategoryId.generate();
    await categories.save(new Category(catA, householdId, groupId, 'CatA'));
    await categories.save(new Category(catB, householdId, groupId, 'CatB'));
    await limits.save(BudgetLimit.forGroup(id, householdId, cap, period, groupId));
    await expenses.save(makeExpense(catA, 100, 2024, 1, 5));
    await expenses.save(makeExpense(catB, 150, 2024, 1, 12));

    const result = await useCase.execute({ id, householdId });

    expect(result.remaining.amount).toBe(750);
  });

  it('returns a negative remaining balance when expenses exceed the cap', async () => {
    const id = BudgetLimitId.generate();
    const categoryId = CategoryId.generate();
    await limits.save(BudgetLimit.forCategory(id, householdId, cap, period, categoryId));
    await expenses.save(makeExpense(categoryId, 1200, 2024, 1, 10));

    const result = await useCase.execute({ id, householdId });

    expect(result.remaining.amount).toBe(-200);
    expect(result.remaining.isOverBudget()).toBe(true);
  });

  it('throws when the budget limit does not exist', async () => {
    await expect(
      useCase.execute({ id: BudgetLimitId.generate(), householdId }),
    ).rejects.toMatchObject({ type: 'Application', message: 'BudgetLimit not found' });
  });

  it('throws when the budget limit belongs to a different household', async () => {
    const id = BudgetLimitId.generate();
    const categoryId = CategoryId.generate();
    const otherHouseholdId = HouseholdId.generate();
    await limits.save(BudgetLimit.forCategory(id, otherHouseholdId, cap, period, categoryId));

    await expect(
      useCase.execute({ id, householdId }),
    ).rejects.toMatchObject({ type: 'Application', message: 'BudgetLimit not found' });
  });
});
