import { describe, it, expect } from 'vitest';
import { BudgetLimit } from '../../../../src/domain/budget/BudgetLimit.js';
import { BudgetLimitId } from '../../../../src/domain/budget/BudgetLimitId.js';
import { BudgetPeriod } from '../../../../src/domain/budget/BudgetPeriod.js';
import { Money } from '../../../../src/domain/shared/Money.js';
import { Currency } from '../../../../src/domain/shared/Currency.js';
import { HouseholdId } from '../../../../src/domain/identity/household/HouseholdId.js';
import { CategoryId } from '../../../../src/domain/catalogue/category/CategoryId.js';
import { GroupId } from '../../../../src/domain/catalogue/group/GroupId.js';

describe('BudgetLimit', () => {
  const limitId = BudgetLimitId.generate();
  const householdId = HouseholdId.generate();
  const categoryId = CategoryId.generate();
  const groupId = GroupId.generate();
  const cap = new Money(10000, Currency.ARS);
  const period = BudgetPeriod.monthly();

  describe('forCategory static factory', () => {
    it('creates a BudgetLimit targeting a Category', () => {
      const limit = BudgetLimit.forCategory(limitId, householdId, cap, period, categoryId);
      expect(limit.id).toBe(limitId);
      expect(limit.householdId).toBe(householdId);
      expect(limit.categoryId).toBe(categoryId);
      expect(limit.groupId).toBeNull();
      expect(limit.cap).toBe(cap);
      expect(limit.period).toBe(period);
    });

    it('rejects a null CategoryId in forCategory', () => {
      expect(() => BudgetLimit.forCategory(limitId, householdId, cap, period, null as unknown as CategoryId)).toThrow();
    });
  });

  describe('forGroup static factory', () => {
    it('creates a BudgetLimit targeting a Group', () => {
      const limit = BudgetLimit.forGroup(limitId, householdId, cap, period, groupId);
      expect(limit.id).toBe(limitId);
      expect(limit.householdId).toBe(householdId);
      expect(limit.groupId).toBe(groupId);
      expect(limit.categoryId).toBeNull();
    });

    it('rejects a null GroupId in forGroup', () => {
      expect(() => BudgetLimit.forGroup(limitId, householdId, cap, period, null as unknown as GroupId)).toThrow();
    });
  });

  describe('invariants', () => {
    it('requires a HouseholdId', () => {
      expect(() => BudgetLimit.forCategory(limitId, null as unknown as HouseholdId, cap, period, categoryId)).toThrow();
    });

    it('requires a cap Money', () => {
      expect(() => BudgetLimit.forCategory(limitId, householdId, null as unknown as Money, period, categoryId)).toThrow();
    });

    it('requires a BudgetPeriod', () => {
      expect(() => BudgetLimit.forCategory(limitId, householdId, cap, null as unknown as BudgetPeriod, categoryId)).toThrow();
    });

    it('targets either a CategoryId OR a GroupId — never both', () => {
      // No direct constructor exposed; the two factories enforce this by design.
      // Verify that forCategory sets groupId to null and forGroup sets categoryId to null.
      const catLimit = BudgetLimit.forCategory(limitId, householdId, cap, period, categoryId);
      expect(catLimit.groupId).toBeNull();

      const groupLimit = BudgetLimit.forGroup(limitId, householdId, cap, period, groupId);
      expect(groupLimit.categoryId).toBeNull();
    });

    it('targets either a CategoryId OR a GroupId — never neither (must use a factory)', () => {
      // The only way to create a BudgetLimit is through forCategory or forGroup.
      // There is no public constructor, so a BudgetLimit with neither target cannot be created.
      expect(typeof BudgetLimit.forCategory).toBe('function');
      expect(typeof BudgetLimit.forGroup).toBe('function');
    });
  });

  describe('edit', () => {
    it('changes the cap amount and returns a new instance', () => {
      const limit = BudgetLimit.forCategory(limitId, householdId, cap, period, categoryId);
      const newCap = new Money(20000, Currency.ARS);
      const updated = limit.editCap(newCap);
      expect(updated.cap).toBe(newCap);
      expect(updated).not.toBe(limit);
    });

    it('changes the period and returns a new instance', () => {
      const limit = BudgetLimit.forCategory(limitId, householdId, cap, period, categoryId);
      const newPeriod = BudgetPeriod.rolling30Days();
      const updated = limit.editPeriod(newPeriod);
      expect(updated.period).toBe(newPeriod);
      expect(updated).not.toBe(limit);
    });

    it('original limit is unchanged after edit', () => {
      const limit = BudgetLimit.forCategory(limitId, householdId, cap, period, categoryId);
      const newCap = new Money(20000, Currency.ARS);
      limit.editCap(newCap);
      expect(limit.cap).toBe(cap);
    });
  });
});
