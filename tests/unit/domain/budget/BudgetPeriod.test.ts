import { describe, it, expect } from 'vitest';
import { BudgetPeriod } from '../../../../src/domain/budget/BudgetPeriod.js';
import { ExpenseDate } from '../../../../src/domain/expense/ExpenseDate.js';
import { DomainError } from '../../../../src/domain/shared/DomainError.js';

describe('BudgetPeriod', () => {
  it('BudgetPeriod.monthly() constructs a Monthly period', () => {
    const period = BudgetPeriod.monthly();
    expect(period).toBeDefined();
  });

  it('BudgetPeriod.rolling30Days() constructs a Rolling30Days period', () => {
    const period = BudgetPeriod.rolling30Days();
    expect(period).toBeDefined();
  });

  it('BudgetPeriod.custom() constructs a Custom period with valid dates', () => {
    const period = BudgetPeriod.custom(new Date('2025-01-01'), new Date('2025-01-31'));
    expect(period).toBeDefined();
  });

  it('Custom period rejects an end date before the start date', () => {
    expect(() =>
      BudgetPeriod.custom(new Date('2025-01-31'), new Date('2025-01-01')),
    ).toThrow(DomainError);
  });

  it('two Monthly periods are equal', () => {
    expect(BudgetPeriod.monthly().equals(BudgetPeriod.monthly())).toBe(true);
  });

  it('a Monthly period and a Rolling30Days period are not equal', () => {
    expect(BudgetPeriod.monthly().equals(BudgetPeriod.rolling30Days())).toBe(false);
  });

  describe('getDateRange', () => {
    const asOf = new Date(2024, 2, 15); // March 15 2024, local

    it('Monthly returns first and last day of the current month', () => {
      const { from, to } = BudgetPeriod.monthly().getDateRange(asOf);
      expect(from.toDate()).toEqual(new ExpenseDate(new Date(2024, 2, 1)).toDate());
      expect(to.toDate()).toEqual(new ExpenseDate(new Date(2024, 2, 31)).toDate());
    });

    it('Rolling30Days returns from 30 days ago to asOf', () => {
      const { from, to } = BudgetPeriod.rolling30Days().getDateRange(asOf);
      expect(from.toDate()).toEqual(new ExpenseDate(new Date(2024, 1, 14)).toDate());
      expect(to.toDate()).toEqual(new ExpenseDate(asOf).toDate());
    });

    it('Custom returns the configured start and end dates', () => {
      const start = new Date(2024, 0, 1);
      const end = new Date(2024, 0, 31);
      const { from, to } = BudgetPeriod.custom(start, end).getDateRange(asOf);
      expect(from.toDate()).toEqual(new ExpenseDate(start).toDate());
      expect(to.toDate()).toEqual(new ExpenseDate(end).toDate());
    });
  });
});
