import { describe, it, expect, beforeEach } from 'vitest';
import { CreateBudgetLimit } from '../../../../src/application/budget/CreateBudgetLimit.js';
import { EditBudgetLimit } from '../../../../src/application/budget/EditBudgetLimit.js';
import { DeleteBudgetLimit } from '../../../../src/application/budget/DeleteBudgetLimit.js';
import { ListBudgetLimits } from '../../../../src/application/budget/ListBudgetLimits.js';
import { InMemoryBudgetLimitRepository } from '../../../helpers/InMemoryBudgetLimitRepository.js';
import { BudgetLimit } from '../../../../src/domain/budget/BudgetLimit.js';
import { BudgetLimitId } from '../../../../src/domain/budget/BudgetLimitId.js';
import { BudgetPeriod } from '../../../../src/domain/budget/BudgetPeriod.js';
import { CategoryId } from '../../../../src/domain/catalogue/category/CategoryId.js';
import { GroupId } from '../../../../src/domain/catalogue/group/GroupId.js';
import { HouseholdId } from '../../../../src/domain/identity/household/HouseholdId.js';
import { Money } from '../../../../src/domain/shared/Money.js';
import { Currency } from '../../../../src/domain/shared/Currency.js';

describe('Budget / CRUD', () => {
  let limits: InMemoryBudgetLimitRepository;
  const householdId = HouseholdId.generate();
  const money = new Money(500, Currency.ARS);
  const period = BudgetPeriod.monthly();

  beforeEach(() => {
    limits = new InMemoryBudgetLimitRepository();
  });

  describe('CreateBudgetLimit', () => {
    it('persists a category-scoped budget limit and returns its id', async () => {
      const useCase = new CreateBudgetLimit(limits);
      const categoryId = CategoryId.generate();

      const result = await useCase.execute({ householdId, money, period, categoryId });

      const saved = await limits.findById(result.id);
      expect(saved).not.toBeNull();
      expect(saved!.categoryId).toBe(categoryId);
      expect(saved!.groupId).toBeUndefined();
    });

    it('persists a group-scoped budget limit and returns its id', async () => {
      const useCase = new CreateBudgetLimit(limits);
      const groupId = GroupId.generate();

      const result = await useCase.execute({ householdId, money, period, groupId });

      const saved = await limits.findById(result.id);
      expect(saved).not.toBeNull();
      expect(saved!.groupId).toBe(groupId);
      expect(saved!.categoryId).toBeUndefined();
    });

    it('throws a clear error when neither categoryId nor groupId is provided', async () => {
      const useCase = new CreateBudgetLimit(limits);

      await expect(
        useCase.execute({ householdId, money, period }),
      ).rejects.toMatchObject({ type: 'Application', message: 'Either categoryId or groupId must be provided' });
    });
  });

  describe('EditBudgetLimit', () => {
    it('updates the money and period of the limit and persists the updated aggregate', async () => {
      const useCase = new EditBudgetLimit(limits);
      const id = BudgetLimitId.generate();
      const categoryId = CategoryId.generate();
      await limits.save(BudgetLimit.forCategory(id, householdId, money, period, categoryId));

      const newMoney = new Money(1000, Currency.ARS);
      const newPeriod = BudgetPeriod.rolling30Days();
      await useCase.execute({ id, money: newMoney, period: newPeriod, householdId });

      const saved = await limits.findById(id);
      expect(saved!.money).toEqual(newMoney);
      expect(saved!.period.kind).toBe('Rolling30Days');
    });

    it('throws when the budget limit does not exist', async () => {
      const useCase = new EditBudgetLimit(limits);

      await expect(
        useCase.execute({ id: BudgetLimitId.generate(), money, period, householdId }),
      ).rejects.toMatchObject({ type: 'Application', message: 'BudgetLimit not found' });
    });

    it('throws when the budget limit belongs to a different household', async () => {
      const useCase = new EditBudgetLimit(limits);
      const id = BudgetLimitId.generate();
      const categoryId = CategoryId.generate();
      const otherHouseholdId = HouseholdId.generate();
      await limits.save(BudgetLimit.forCategory(id, otherHouseholdId, money, period, categoryId));

      await expect(
        useCase.execute({ id, money: new Money(1000, Currency.ARS), period, householdId }),
      ).rejects.toMatchObject({ type: 'Application', message: 'BudgetLimit not found' });
    });
  });

  describe('DeleteBudgetLimit', () => {
    it('deletes the budget limit from the repository', async () => {
      const useCase = new DeleteBudgetLimit(limits);
      const id = BudgetLimitId.generate();
      const categoryId = CategoryId.generate();
      await limits.save(BudgetLimit.forCategory(id, householdId, money, period, categoryId));

      await useCase.execute({ id, householdId });

      const found = await limits.findById(id);
      expect(found).toBeNull();
    });

    it('throws when the budget limit does not exist', async () => {
      const useCase = new DeleteBudgetLimit(limits);

      await expect(useCase.execute({ id: BudgetLimitId.generate(), householdId })).rejects.toMatchObject({ type: 'Application', message: 'BudgetLimit not found' });
    });

    it('throws when the budget limit belongs to a different household', async () => {
      const useCase = new DeleteBudgetLimit(limits);
      const id = BudgetLimitId.generate();
      const categoryId = CategoryId.generate();
      const otherHouseholdId = HouseholdId.generate();
      await limits.save(BudgetLimit.forCategory(id, otherHouseholdId, money, period, categoryId));

      await expect(
        useCase.execute({ id, householdId }),
      ).rejects.toMatchObject({ type: 'Application', message: 'BudgetLimit not found' });
    });
  });

  describe('ListBudgetLimits', () => {
    it('returns all budget limits for the household', async () => {
      const useCase = new ListBudgetLimits(limits);
      const id1 = BudgetLimitId.generate();
      const id2 = BudgetLimitId.generate();
      await limits.save(BudgetLimit.forCategory(id1, householdId, money, period, CategoryId.generate()));
      await limits.save(BudgetLimit.forGroup(id2, householdId, money, period, GroupId.generate()));

      const result = await useCase.execute({ householdId });

      expect(result.limits).toHaveLength(2);
    });
  });
});
