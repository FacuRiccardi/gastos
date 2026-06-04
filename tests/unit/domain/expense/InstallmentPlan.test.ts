import { describe, it, expect } from 'vitest';
import { InstallmentPlan } from '../../../../src/domain/expense/InstallmentPlan.js';
import { DomainError } from '../../../../src/domain/shared/DomainError.js';

describe('InstallmentPlan', () => {
  it('constructs with a valid positive integer count', () => {
    const plan = new InstallmentPlan(3);
    expect(plan).toBeDefined();
  });

  it('rejects a zero count', () => {
    expect(() => new InstallmentPlan(0)).toThrow(DomainError);
  });

  it('rejects a negative count', () => {
    expect(() => new InstallmentPlan(-1)).toThrow(DomainError);
  });

  it('rejects a fractional count', () => {
    expect(() => new InstallmentPlan(1.5)).toThrow(DomainError);
  });

  it('two InstallmentPlans with the same count are equal', () => {
    expect(new InstallmentPlan(3).equals(new InstallmentPlan(3))).toBe(true);
  });

  it('two InstallmentPlans with different counts are not equal', () => {
    expect(new InstallmentPlan(3).equals(new InstallmentPlan(6))).toBe(false);
  });
});
