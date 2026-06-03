import { describe, it, expect } from 'vitest';
import { Balance } from '../../../../src/domain/shared/Balance.js';
import { Currency } from '../../../../src/domain/shared/Currency.js';

describe('Balance', () => {
  it('constructs with a positive amount', () => {
    const b = new Balance(500, Currency.ARS);
    expect(b.amount).toBe(500);
  });

  it('constructs with zero', () => {
    const b = new Balance(0, Currency.ARS);
    expect(b.amount).toBe(0);
  });

  it('constructs with a negative amount', () => {
    const b = new Balance(-200, Currency.ARS);
    expect(b.amount).toBe(-200);
  });

  it('rejects non-finite values', () => {
    expect(() => new Balance(Infinity, Currency.ARS)).toThrow();
    expect(() => new Balance(NaN, Currency.ARS)).toThrow();
  });

  it('isOverBudget returns true when amount is negative', () => {
    expect(new Balance(-1, Currency.ARS).isOverBudget()).toBe(true);
  });

  it('isOverBudget returns false when amount is zero or positive', () => {
    expect(new Balance(0, Currency.ARS).isOverBudget()).toBe(false);
    expect(new Balance(100, Currency.ARS).isOverBudget()).toBe(false);
  });

  it('equals returns true for same amount and currency', () => {
    expect(new Balance(100, Currency.ARS).equals(new Balance(100, Currency.ARS))).toBe(true);
  });

  it('equals returns false for different amount', () => {
    expect(new Balance(100, Currency.ARS).equals(new Balance(200, Currency.ARS))).toBe(false);
  });
});
