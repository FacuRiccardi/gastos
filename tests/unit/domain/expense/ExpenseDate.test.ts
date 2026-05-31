import { describe, it, expect } from 'vitest';
import { ExpenseDate } from '../../../../src/domain/expense/ExpenseDate.js';

describe('ExpenseDate', () => {
  describe('valid construction', () => {
    it('creates an ExpenseDate from a Date object', () => {
      const date = new Date('2024-03-15');
      const expenseDate = new ExpenseDate(date);
      expect(expenseDate.value).toEqual(date);
    });

    it('creates an ExpenseDate from an ISO string', () => {
      const expenseDate = ExpenseDate.fromISO('2024-03-15');
      expect(expenseDate).toBeDefined();
    });

    it('represents the purchase date, not the logging date', () => {
      const purchaseDate = new Date('2024-01-01');
      const expenseDate = new ExpenseDate(purchaseDate);
      expect(expenseDate.value).toEqual(purchaseDate);
    });
  });

  describe('invariants', () => {
    it('rejects an invalid date', () => {
      expect(() => new ExpenseDate(new Date('invalid'))).toThrow();
    });

    it('rejects null', () => {
      expect(() => new ExpenseDate(null as unknown as Date)).toThrow();
    });
  });

  describe('value equality', () => {
    it('two ExpenseDates with the same date are equal', () => {
      const a = new ExpenseDate(new Date('2024-03-15'));
      const b = new ExpenseDate(new Date('2024-03-15'));
      expect(a.equals(b)).toBe(true);
    });

    it('two ExpenseDates with different dates are not equal', () => {
      const a = new ExpenseDate(new Date('2024-03-15'));
      const b = new ExpenseDate(new Date('2024-03-16'));
      expect(a.equals(b)).toBe(false);
    });
  });
});
