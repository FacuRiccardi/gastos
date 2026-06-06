import { describe, it, expect } from 'vitest';
import { ExpenseDate } from '../../../../src/domain/expense/ExpenseDate.js';

describe('ExpenseDate', () => {
  it('constructs from a valid Date', () => {
    const date = new ExpenseDate(new Date('2025-01-15'));
    expect(date).toBeDefined();
  });

  it('two ExpenseDates representing the same day are equal', () => {
    const a = new ExpenseDate(new Date('2025-01-15T08:00:00'));
    const b = new ExpenseDate(new Date('2025-01-15T22:30:00'));
    expect(a.equals(b)).toBe(true);
  });

  it('two ExpenseDates on different days are not equal', () => {
    const a = new ExpenseDate(new Date('2025-01-15'));
    const b = new ExpenseDate(new Date('2025-01-16'));
    expect(a.equals(b)).toBe(false);
  });

  it('fromString("2026-06-01") stores year=2026 month=5 day=1 as local calendar date', () => {
    const d = ExpenseDate.fromString('2026-06-01');
    const dt = d.toDate();
    expect(dt.getFullYear()).toBe(2026);
    expect(dt.getMonth()).toBe(5);
    expect(dt.getDate()).toBe(1);
  });
});
