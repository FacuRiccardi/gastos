import { describe, it, expect } from 'vitest';
import { BudgetPeriod } from '../../../../src/domain/budget/BudgetPeriod.js';

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
    ).toThrow();
  });

  it('two Monthly periods are equal', () => {
    expect(BudgetPeriod.monthly().equals(BudgetPeriod.monthly())).toBe(true);
  });

  it('a Monthly period and a Rolling30Days period are not equal', () => {
    expect(BudgetPeriod.monthly().equals(BudgetPeriod.rolling30Days())).toBe(false);
  });
});
