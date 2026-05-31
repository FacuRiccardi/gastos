import { describe, it, expect } from 'vitest';
import { BudgetPeriod } from '../../../../src/domain/budget/BudgetPeriod.js';

describe('BudgetPeriod', () => {
  describe('Monthly', () => {
    it('creates a Monthly period', () => {
      const period = BudgetPeriod.monthly();
      expect(period.type).toBe('Monthly');
    });

    it('returns a defined start date based on current month', () => {
      const period = BudgetPeriod.monthly();
      const start = period.getStartDate(new Date('2024-03-15'));
      expect(start).toEqual(new Date('2024-03-01'));
    });

    it('returns a defined end date at end of current month', () => {
      const period = BudgetPeriod.monthly();
      const end = period.getEndDate(new Date('2024-03-15'));
      expect(end).toEqual(new Date('2024-03-31'));
    });
  });

  describe('Rolling30Days', () => {
    it('creates a Rolling30Days period', () => {
      const period = BudgetPeriod.rolling30Days();
      expect(period.type).toBe('Rolling30Days');
    });

    it('start date is 30 days before the reference date', () => {
      const period = BudgetPeriod.rolling30Days();
      const refDate = new Date('2024-03-15');
      const start = period.getStartDate(refDate);
      expect(start).toEqual(new Date('2024-02-14'));
    });
  });

  describe('Custom', () => {
    it('creates a Custom period with explicit date range', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-03-31');
      const period = BudgetPeriod.custom(start, end);
      expect(period.type).toBe('Custom');
      expect(period.getStartDate()).toEqual(start);
      expect(period.getEndDate()).toEqual(end);
    });

    it('rejects a Custom period where start is after end', () => {
      const start = new Date('2024-03-31');
      const end = new Date('2024-01-01');
      expect(() => BudgetPeriod.custom(start, end)).toThrow();
    });

    it('rejects a Custom period where start equals end', () => {
      const date = new Date('2024-03-15');
      expect(() => BudgetPeriod.custom(date, date)).toThrow();
    });
  });

  describe('value equality', () => {
    it('two Monthly periods are equal', () => {
      const a = BudgetPeriod.monthly();
      const b = BudgetPeriod.monthly();
      expect(a.equals(b)).toBe(true);
    });

    it('Monthly and Rolling30Days are not equal', () => {
      const a = BudgetPeriod.monthly();
      const b = BudgetPeriod.rolling30Days();
      expect(a.equals(b)).toBe(false);
    });

    it('two Custom periods with same range are equal', () => {
      const a = BudgetPeriod.custom(new Date('2024-01-01'), new Date('2024-03-31'));
      const b = BudgetPeriod.custom(new Date('2024-01-01'), new Date('2024-03-31'));
      expect(a.equals(b)).toBe(true);
    });

    it('two Custom periods with different ranges are not equal', () => {
      const a = BudgetPeriod.custom(new Date('2024-01-01'), new Date('2024-03-31'));
      const b = BudgetPeriod.custom(new Date('2024-02-01'), new Date('2024-03-31'));
      expect(a.equals(b)).toBe(false);
    });
  });
});
