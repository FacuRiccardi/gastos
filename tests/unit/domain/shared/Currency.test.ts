import { describe, it, expect } from 'vitest';
import { Currency } from '../../../../src/domain/shared/Currency.js';

describe('Currency', () => {
  describe('valid construction', () => {
    it('accepts ARS as a valid currency', () => {
      const currency = Currency.ARS;
      expect(currency).toBeDefined();
    });

    it('ARS is the only supported currency in initial build', () => {
      expect(Object.values(Currency)).toContain('ARS');
      expect(Object.values(Currency)).toHaveLength(1);
    });
  });

  describe('value equality', () => {
    it('two ARS currencies are equal', () => {
      expect(Currency.ARS).toBe(Currency.ARS);
    });
  });
});
