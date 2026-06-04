import { describe, it, expect, beforeEach } from 'vitest';
import { clearTables } from '../helpers/testDb.js';
import { makeRepos } from '../helpers/repositories.js';
import { CreateBudgetLimit } from '../../../src/application/budget/CreateBudgetLimit.js';
import { EditBudgetLimit } from '../../../src/application/budget/EditBudgetLimit.js';
import { DeleteBudgetLimit } from '../../../src/application/budget/DeleteBudgetLimit.js';
import { ListBudgetLimits } from '../../../src/application/budget/ListBudgetLimits.js';
import { GetBudgetLimitBalance } from '../../../src/application/budget/GetBudgetLimitBalance.js';
import { LogExpense } from '../../../src/application/expense/LogExpense.js';
import { CreateGroup } from '../../../src/application/catalogue/CreateGroup.js';
import { CreateCategory } from '../../../src/application/catalogue/CreateCategory.js';
import { BudgetPeriod } from '../../../src/domain/budget/BudgetPeriod.js';
import { BudgetLimitId } from '../../../src/domain/budget/BudgetLimitId.js';
import { Money } from '../../../src/domain/shared/Money.js';
import { Currency } from '../../../src/domain/shared/Currency.js';
import { ExpenseDate } from '../../../src/domain/expense/ExpenseDate.js';
import { HouseholdId } from '../../../src/domain/identity/household/HouseholdId.js';
import { UserId } from '../../../src/domain/identity/user/UserId.js';

describe('Budget use cases (integration)', () => {
  const householdId = HouseholdId.generate();
  const userId = UserId.generate();
  let repos: ReturnType<typeof makeRepos>;

  beforeEach(async () => {
    await clearTables();
    repos = makeRepos();
  });

  async function seedCategory() {
    const { id: groupId } = await new CreateGroup(repos.groups).execute({ householdId, name: 'G' });
    const { id: categoryId } = await new CreateCategory(repos.categories, repos.groups).execute({ householdId, groupId, name: 'C' });
    return { groupId, categoryId };
  }

  async function logExpense(categoryId: Parameters<typeof repos.categories.findById>[0], amount: number) {
    await new LogExpense(repos.expenses, repos.categories, repos.paymentInstruments).execute({
      householdId,
      userId,
      categoryId,
      money: new Money(amount, Currency.ARS),
      paymentMethod: { kind: 'Cash' },
      date: new ExpenseDate(new Date()),
    });
  }

  describe('CreateBudgetLimit', () => {
    it('persists a category-scoped limit retrievable by id', async () => {
      const { categoryId } = await seedCategory();

      const { id } = await new CreateBudgetLimit(repos.budgetLimits).execute({
        householdId,
        money: new Money(5000, Currency.ARS),
        period: BudgetPeriod.monthly(),
        categoryId,
      });

      const found = await repos.budgetLimits.findById(id);
      expect(found).not.toBeNull();
      expect(found!.money.amount).toBe(5000);
      expect(found!.categoryId).toBe(categoryId);
    });

    it('persists a group-scoped limit', async () => {
      const { groupId } = await seedCategory();

      const { id } = await new CreateBudgetLimit(repos.budgetLimits).execute({
        householdId,
        money: new Money(10000, Currency.ARS),
        period: BudgetPeriod.rolling30Days(),
        groupId,
      });

      const found = await repos.budgetLimits.findById(id);
      expect(found!.groupId).toBe(groupId);
    });
  });

  describe('EditBudgetLimit', () => {
    it('persists the updated amount and period', async () => {
      const { categoryId } = await seedCategory();
      const { id } = await new CreateBudgetLimit(repos.budgetLimits).execute({
        householdId, money: new Money(5000, Currency.ARS), period: BudgetPeriod.monthly(), categoryId,
      });

      await new EditBudgetLimit(repos.budgetLimits).execute({
        id,
        money: new Money(8000, Currency.ARS),
        period: BudgetPeriod.rolling30Days(),
      });

      const found = await repos.budgetLimits.findById(id);
      expect(found!.money.amount).toBe(8000);
      expect(found!.period.kind).toBe('Rolling30Days');
    });

    it('throws when budget limit does not exist', async () => {
      await expect(
        new EditBudgetLimit(repos.budgetLimits).execute({
          id: BudgetLimitId.generate(),
          money: new Money(1000, Currency.ARS),
          period: BudgetPeriod.monthly(),
        }),
      ).rejects.toMatchObject({ type: 'Application', message: 'BudgetLimit not found' });
    });
  });

  describe('DeleteBudgetLimit', () => {
    it('removes the limit so it no longer appears in ListBudgetLimits', async () => {
      const { categoryId } = await seedCategory();
      const { id } = await new CreateBudgetLimit(repos.budgetLimits).execute({
        householdId, money: new Money(5000, Currency.ARS), period: BudgetPeriod.monthly(), categoryId,
      });

      await new DeleteBudgetLimit(repos.budgetLimits).execute({ id });

      const { limits } = await new ListBudgetLimits(repos.budgetLimits).execute({ householdId });
      expect(limits).toHaveLength(0);
    });
  });

  describe('ListBudgetLimits', () => {
    it('returns all limits for the household', async () => {
      const { categoryId } = await seedCategory();
      const otherHousehold = HouseholdId.generate();
      await new CreateBudgetLimit(repos.budgetLimits).execute({ householdId, money: new Money(1000, Currency.ARS), period: BudgetPeriod.monthly(), categoryId });
      await new CreateBudgetLimit(repos.budgetLimits).execute({ householdId, money: new Money(2000, Currency.ARS), period: BudgetPeriod.monthly(), categoryId });
      await new CreateBudgetLimit(repos.budgetLimits).execute({ householdId: otherHousehold, money: new Money(999, Currency.ARS), period: BudgetPeriod.monthly(), categoryId });

      const { limits } = await new ListBudgetLimits(repos.budgetLimits).execute({ householdId });

      expect(limits).toHaveLength(2);
    });
  });

  describe('GetBudgetLimitBalance', () => {
    it('returns the full cap when no expenses have been logged', async () => {
      const { categoryId } = await seedCategory();
      const { id } = await new CreateBudgetLimit(repos.budgetLimits).execute({
        householdId, money: new Money(5000, Currency.ARS), period: BudgetPeriod.monthly(), categoryId,
      });

      const { remaining } = await new GetBudgetLimitBalance(repos.budgetLimits, repos.expenses, repos.categories).execute({ id, asOf: new Date() });

      expect(remaining.amount).toBe(5000);
    });

    it('deducts logged expenses in the period from the remaining balance', async () => {
      const { categoryId } = await seedCategory();
      const { id } = await new CreateBudgetLimit(repos.budgetLimits).execute({
        householdId, money: new Money(5000, Currency.ARS), period: BudgetPeriod.monthly(), categoryId,
      });
      await logExpense(categoryId, 1500);
      await logExpense(categoryId, 500);

      const { remaining } = await new GetBudgetLimitBalance(repos.budgetLimits, repos.expenses, repos.categories).execute({ id, asOf: new Date() });

      expect(remaining.amount).toBe(3000);
    });

    it('calculates balance correctly for a group-scoped limit (aggregates all categories in the group)', async () => {
      const { groupId, categoryId: cat1 } = await seedCategory();
      const { id: cat2 } = await new CreateCategory(repos.categories, repos.groups).execute({ householdId, groupId, name: 'C2' });
      const { categoryId: otherCat } = await seedCategory();
      const { id } = await new CreateBudgetLimit(repos.budgetLimits).execute({
        householdId, money: new Money(10000, Currency.ARS), period: BudgetPeriod.monthly(), groupId,
      });
      await logExpense(cat1, 2000);
      await logExpense(cat2, 3000);
      await logExpense(otherCat, 9999);

      const { remaining } = await new GetBudgetLimitBalance(repos.budgetLimits, repos.expenses, repos.categories).execute({ id, asOf: new Date() });

      expect(remaining.amount).toBe(5000);
      expect(remaining.isOverBudget()).toBe(false);
    });

    it('returns a negative remaining when expenses exceed the cap', async () => {
      const { categoryId } = await seedCategory();
      const { id } = await new CreateBudgetLimit(repos.budgetLimits).execute({
        householdId, money: new Money(1000, Currency.ARS), period: BudgetPeriod.monthly(), categoryId,
      });
      await logExpense(categoryId, 1500);

      const { remaining } = await new GetBudgetLimitBalance(repos.budgetLimits, repos.expenses, repos.categories).execute({ id, asOf: new Date() });

      expect(remaining.amount).toBe(-500);
      expect(remaining.isOverBudget()).toBe(true);
    });
  });
});
