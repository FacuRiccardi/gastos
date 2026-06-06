import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, clearTables } from '../../helpers/testDb.js';
import { DrizzleBudgetLimitRepository } from '../../../../src/infrastructure/budget/DrizzleBudgetLimitRepository.js';
import { BudgetLimit } from '../../../../src/domain/budget/BudgetLimit.js';
import { BudgetLimitId } from '../../../../src/domain/budget/BudgetLimitId.js';
import { BudgetPeriod } from '../../../../src/domain/budget/BudgetPeriod.js';
import { Money } from '../../../../src/domain/shared/Money.js';
import { Currency } from '../../../../src/domain/shared/Currency.js';
import { HouseholdId } from '../../../../src/domain/identity/household/HouseholdId.js';
import { CategoryId } from '../../../../src/domain/catalogue/category/CategoryId.js';
import { GroupId } from '../../../../src/domain/catalogue/group/GroupId.js';

describe('DrizzleBudgetLimitRepository', () => {
  let repo: DrizzleBudgetLimitRepository;
  const householdId = HouseholdId.generate();
  const categoryId = CategoryId.generate();
  const groupId = GroupId.generate();
  const money = new Money(5000, Currency.ARS);

  beforeEach(async () => {
    await clearTables();
    repo = new DrizzleBudgetLimitRepository(testDb);
  });

  it('saves and retrieves a BudgetLimit targeting a Category (Monthly period)', async () => {
    const id = BudgetLimitId.generate();
    const limit = BudgetLimit.forCategory(id, householdId, money, BudgetPeriod.monthly(), categoryId);

    await repo.save(limit);
    const found = await repo.findById(id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(id);
    expect(found!.householdId).toBe(householdId);
    expect(found!.money.amount).toBe(5000);
    expect(found!.money.currency.code).toBe('ARS');
    expect(found!.period.kind).toBe('Monthly');
    expect(found!.categoryId).toBe(categoryId);
    expect(found!.groupId).toBeUndefined();
  });

  it('saves and retrieves a BudgetLimit targeting a Group (Rolling30Days period)', async () => {
    const id = BudgetLimitId.generate();
    const limit = BudgetLimit.forGroup(id, householdId, money, BudgetPeriod.rolling30Days(), groupId);

    await repo.save(limit);
    const found = await repo.findById(id);

    expect(found!.period.kind).toBe('Rolling30Days');
    expect(found!.groupId).toBe(groupId);
    expect(found!.categoryId).toBeUndefined();
  });

  it('saves and retrieves a BudgetLimit with a Custom period (start and end dates)', async () => {
    const id = BudgetLimitId.generate();
    const start = new Date(2025, 0, 1);
    const end = new Date(2025, 5, 30);
    const limit = BudgetLimit.forCategory(id, householdId, money, BudgetPeriod.custom(start, end), categoryId);

    await repo.save(limit);
    const found = await repo.findById(id);

    expect(found!.period.kind).toBe('Custom');
    const range = found!.period.getDateRange(new Date(2025, 2, 1));
    expect(range.from.toDate().getFullYear()).toBe(2025);
    expect(range.from.toDate().getMonth()).toBe(0);
    expect(range.to.toDate().getMonth()).toBe(5);
  });

  it('returns null for an unknown BudgetLimitId', async () => {
    const found = await repo.findById(BudgetLimitId.generate());
    expect(found).toBeNull();
  });

  it('delete() removes the BudgetLimit; findById() returns null afterwards', async () => {
    const id = BudgetLimitId.generate();
    await repo.save(BudgetLimit.forCategory(id, householdId, money, BudgetPeriod.monthly(), categoryId));

    await repo.delete(id);
    const found = await repo.findById(id);

    expect(found).toBeNull();
  });

  it('save() with existing id overwrites the previous state', async () => {
    const id = BudgetLimitId.generate();
    const original = BudgetLimit.forCategory(id, householdId, money, BudgetPeriod.monthly(), categoryId);
    await repo.save(original);

    const updated = original.edit(new Money(8000, Currency.ARS), BudgetPeriod.rolling30Days());
    await repo.save(updated);
    const found = await repo.findById(id);

    expect(found!.money.amount).toBe(8000);
    expect(found!.period.kind).toBe('Rolling30Days');
  });

  it('findByHousehold() returns only BudgetLimits for the given Household', async () => {
    const otherId = HouseholdId.generate();
    await repo.save(BudgetLimit.forCategory(BudgetLimitId.generate(), householdId, money, BudgetPeriod.monthly(), categoryId));
    await repo.save(BudgetLimit.forCategory(BudgetLimitId.generate(), otherId, money, BudgetPeriod.monthly(), categoryId));

    const results = await repo.findByHousehold(householdId);

    expect(results).toHaveLength(1);
    expect(results[0]!.householdId).toBe(householdId);
  });

  it('reconstructs BudgetLimit.forCategory() correctly (categoryId set, groupId null)', async () => {
    const id = BudgetLimitId.generate();
    await repo.save(BudgetLimit.forCategory(id, householdId, money, BudgetPeriod.monthly(), categoryId));

    const found = await repo.findById(id);

    expect(found!.categoryId).toBe(categoryId);
    expect(found!.groupId).toBeUndefined();
  });

  it('reconstructs BudgetLimit.forGroup() correctly (groupId set, categoryId null)', async () => {
    const id = BudgetLimitId.generate();
    await repo.save(BudgetLimit.forGroup(id, householdId, money, BudgetPeriod.monthly(), groupId));

    const found = await repo.findById(id);

    expect(found!.groupId).toBe(groupId);
    expect(found!.categoryId).toBeUndefined();
  });
});
