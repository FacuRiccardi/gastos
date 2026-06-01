import { describe, it, expect } from 'vitest';
import { Currency } from '../../../../src/domain/shared/Currency.js';

describe('Currency', () => {
  it('constructs from a supported currency code', () => {
    const ars = Currency.from('ARS');
    expect(ars).toBeDefined();
  });

  it('throws for an unsupported currency code', () => {
    expect(() => Currency.from('USD')).toThrow();
  });

  it('two Currency values with the same code are equal', () => {
    expect(Currency.from('ARS').equals(Currency.from('ARS'))).toBe(true);
  });
});
