import { describe, it, expect } from 'vitest';
import { Money } from '../../../../src/domain/shared/Money.js';
import { Currency } from '../../../../src/domain/shared/Currency.js';

describe('Money', () => {
  describe('valid construction', () => {
    it('creates Money with a positive amount and ARS currency', () => {
      const money = new Money(100, Currency.ARS);
      expect(money.amount).toBe(100);
      expect(money.currency).toBe(Currency.ARS);
    });

    it('accepts decimal amounts', () => {
      const money = new Money(99.99, Currency.ARS);
      expect(money.amount).toBe(99.99);
    });
  });

  describe('invariants', () => {
    it('rejects zero amount', () => {
      expect(() => new Money(0, Currency.ARS)).toThrow();
    });

    it('rejects negative amounts', () => {
      expect(() => new Money(-1, Currency.ARS)).toThrow();
    });
  });

  describe('value equality', () => {
    it('two Money instances with same amount and currency are equal', () => {
      const a = new Money(100, Currency.ARS);
      const b = new Money(100, Currency.ARS);
      expect(a.equals(b)).toBe(true);
    });

    it('two Money instances with different amounts are not equal', () => {
      const a = new Money(100, Currency.ARS);
      const b = new Money(200, Currency.ARS);
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('immutability', () => {
    it('add returns a new Money instance', () => {
      const a = new Money(100, Currency.ARS);
      const b = new Money(50, Currency.ARS);
      const result = a.add(b);
      expect(result).not.toBe(a);
      expect(result.amount).toBe(150);
    });

    it('subtract returns a new Money instance', () => {
      const a = new Money(100, Currency.ARS);
      const b = new Money(30, Currency.ARS);
      const result = a.subtract(b);
      expect(result).not.toBe(a);
      expect(result.amount).toBe(70);
    });

    it('original instance is unchanged after add', () => {
      const a = new Money(100, Currency.ARS);
      const b = new Money(50, Currency.ARS);
      a.add(b);
      expect(a.amount).toBe(100);
    });
  });
});
