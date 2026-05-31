import { describe, it, expect } from 'vitest';
import { InstallmentPlan } from '../../../../src/domain/expense/InstallmentPlan.js';

describe('InstallmentPlan', () => {
  describe('valid construction', () => {
    it('creates an InstallmentPlan with 1 installment', () => {
      const plan = new InstallmentPlan(1);
      expect(plan.count).toBe(1);
    });

    it('creates an InstallmentPlan with multiple installments', () => {
      const plan = new InstallmentPlan(12);
      expect(plan.count).toBe(12);
    });
  });

  describe('invariants', () => {
    it('rejects zero installments', () => {
      expect(() => new InstallmentPlan(0)).toThrow();
    });

    it('rejects negative installments', () => {
      expect(() => new InstallmentPlan(-1)).toThrow();
    });

    it('rejects fractional installments', () => {
      expect(() => new InstallmentPlan(1.5)).toThrow();
    });
  });

  describe('value equality', () => {
    it('two InstallmentPlans with same count are equal', () => {
      const a = new InstallmentPlan(3);
      const b = new InstallmentPlan(3);
      expect(a.equals(b)).toBe(true);
    });

    it('two InstallmentPlans with different counts are not equal', () => {
      const a = new InstallmentPlan(3);
      const b = new InstallmentPlan(6);
      expect(a.equals(b)).toBe(false);
    });
  });
});
