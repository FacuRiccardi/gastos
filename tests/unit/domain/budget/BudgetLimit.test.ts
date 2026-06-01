import { describe, it, expect } from 'vitest';
import { BudgetLimit } from '../../../../src/domain/budget/BudgetLimit.js';
import { BudgetLimitId } from '../../../../src/domain/budget/BudgetLimitId.js';
import { BudgetPeriod } from '../../../../src/domain/budget/BudgetPeriod.js';
import { Money } from '../../../../src/domain/shared/Money.js';
import { Currency } from '../../../../src/domain/shared/Currency.js';
import { HouseholdId } from '../../../../src/domain/identity/household/HouseholdId.js';
import { CategoryId } from '../../../../src/domain/catalogue/category/CategoryId.js';
import { GroupId } from '../../../../src/domain/catalogue/group/GroupId.js';

const id = BudgetLimitId.generate();
const householdId = HouseholdId.generate();
const money = new Money(10000, Currency.ARS);
const period = BudgetPeriod.monthly();
const categoryId = CategoryId.generate();
const groupId = GroupId.generate();

describe('BudgetLimit', () => {
  it('forCategory() creates a limit with categoryId set and groupId absent', () => {
    const limit = BudgetLimit.forCategory(id, householdId, money, period, categoryId);
    expect(limit.categoryId).toBe(categoryId);
    expect(limit.groupId).toBeUndefined();
  });

  it('forGroup() creates a limit with groupId set and categoryId absent', () => {
    const limit = BudgetLimit.forGroup(id, householdId, money, period, groupId);
    expect(limit.groupId).toBe(groupId);
    expect(limit.categoryId).toBeUndefined();
  });

  it('edit() returns a new BudgetLimit with the updated Money', () => {
    const limit = BudgetLimit.forCategory(id, householdId, money, period, categoryId);
    const newMoney = new Money(20000, Currency.ARS);
    const edited = limit.edit(newMoney, period);
    expect(edited.money).toBe(newMoney);
  });

  it('edit() returns a new BudgetLimit with the updated BudgetPeriod', () => {
    const limit = BudgetLimit.forCategory(id, householdId, money, period, categoryId);
    const newPeriod = BudgetPeriod.rolling30Days();
    const edited = limit.edit(money, newPeriod);
    expect(edited.period).toBe(newPeriod);
  });

  it('edit() leaves the original unchanged', () => {
    const limit = BudgetLimit.forCategory(id, householdId, money, period, categoryId);
    limit.edit(new Money(20000, Currency.ARS), BudgetPeriod.rolling30Days());
    expect(limit.money).toBe(money);
    expect(limit.period).toBe(period);
  });
});
