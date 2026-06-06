import { describe, it, expect } from 'vitest';
import { Currency } from '../../../../src/domain/shared/Currency.js';
import { Money } from '../../../../src/domain/shared/Money.js';
import { DomainError } from '../../../../src/domain/shared/DomainError.js';

const ARS = Currency.ARS;

describe('Money', () => {
  it('constructs with a positive amount and a valid Currency', () => {
    const money = new Money(100, ARS);
    expect(money).toBeDefined();
  });

  it('rejects a zero amount', () => {
    expect(() => new Money(0, ARS)).toThrow(DomainError);
  });

  it('rejects a negative amount', () => {
    expect(() => new Money(-50, ARS)).toThrow(DomainError);
  });

  it('rejects NaN as amount', () => {
    expect(() => new Money(NaN, ARS)).toThrow(DomainError);
  });

  it('two Money instances with the same amount and currency are equal', () => {
    expect(new Money(100, ARS).equals(new Money(100, ARS))).toBe(true);
  });

  it('two Money instances with different amounts are not equal', () => {
    expect(new Money(100, ARS).equals(new Money(200, ARS))).toBe(false);
  });

  it('two Money instances with different currencies are not equal', () => {
    const otherCurrency = { equals: () => false } as unknown as typeof ARS;
    expect(new Money(100, ARS).equals(new Money(100, otherCurrency))).toBe(false);
  });
});
