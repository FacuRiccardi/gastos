import { describe, it, expect } from 'vitest';
import { PaymentMethod } from '../../../../src/domain/expense/PaymentMethod.js';
import { DomainError } from '../../../../src/domain/shared/DomainError.js';

describe('PaymentMethod.from()', () => {
  it('parses Cash with no instrumentId', () => {
    const result = PaymentMethod.from({ kind: 'Cash' });
    expect(result).toEqual({ kind: 'Cash' });
  });

  it('parses CreditCard with an instrumentId string', () => {
    const result = PaymentMethod.from({ kind: 'CreditCard', instrumentId: 'abc-123' });
    expect(result.kind).toBe('CreditCard');
    if (result.kind !== 'CreditCard') throw new Error();
    expect(result.instrumentId.toString()).toBe('abc-123');
  });

  it('parses BankAccount with an instrumentId string', () => {
    const result = PaymentMethod.from({ kind: 'BankAccount', instrumentId: 'def-456' });
    expect(result.kind).toBe('BankAccount');
    if (result.kind !== 'BankAccount') throw new Error();
    expect(result.instrumentId.toString()).toBe('def-456');
  });

  it('throws DomainError for an unknown kind', () => {
    expect(() => PaymentMethod.from({ kind: 'Barter' })).toThrow(DomainError);
  });

  it('throws DomainError for CreditCard without instrumentId', () => {
    expect(() => PaymentMethod.from({ kind: 'CreditCard' })).toThrow(DomainError);
  });

  it('throws DomainError for BankAccount without instrumentId', () => {
    expect(() => PaymentMethod.from({ kind: 'BankAccount' })).toThrow(DomainError);
  });
});
