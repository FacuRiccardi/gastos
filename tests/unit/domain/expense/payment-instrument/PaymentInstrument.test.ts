import { describe, it, expect } from 'vitest';
import { PaymentInstrument } from '../../../../../src/domain/expense/payment-instrument/PaymentInstrument.js';
import { PaymentInstrumentId } from '../../../../../src/domain/expense/payment-instrument/PaymentInstrumentId.js';
import { PaymentInstrumentType } from '../../../../../src/domain/expense/payment-instrument/PaymentInstrumentType.js';
import { UserId } from '../../../../../src/domain/identity/user/UserId.js';

const id = PaymentInstrumentId.generate();
const userId = UserId.generate();

describe('PaymentInstrument', () => {
  it('constructs with a valid id, userId, CreditCard type, and name', () => {
    const instrument = new PaymentInstrument(id, userId, PaymentInstrumentType.CreditCard, 'My Visa');
    expect(instrument).toBeDefined();
  });

  it('constructs with a valid id, userId, BankAccount type, and name', () => {
    const instrument = new PaymentInstrument(id, userId, PaymentInstrumentType.BankAccount, 'Checking');
    expect(instrument).toBeDefined();
  });

  it('rejects an empty name on construction', () => {
    expect(() => new PaymentInstrument(id, userId, PaymentInstrumentType.CreditCard, '')).toThrow();
  });

  it('rename() returns a new PaymentInstrument with the updated name', () => {
    const instrument = new PaymentInstrument(id, userId, PaymentInstrumentType.CreditCard, 'My Visa');
    const renamed = instrument.rename('Platinum Visa');
    expect(renamed.name).toBe('Platinum Visa');
  });

  it('rename() with an empty string throws', () => {
    const instrument = new PaymentInstrument(id, userId, PaymentInstrumentType.CreditCard, 'My Visa');
    expect(() => instrument.rename('')).toThrow();
  });

  it('rename() leaves the original unchanged', () => {
    const instrument = new PaymentInstrument(id, userId, PaymentInstrumentType.CreditCard, 'My Visa');
    instrument.rename('Platinum Visa');
    expect(instrument.name).toBe('My Visa');
  });

  it('softDelete() returns a new PaymentInstrument marked as deleted', () => {
    const instrument = new PaymentInstrument(id, userId, PaymentInstrumentType.CreditCard, 'My Visa');
    const deleted = instrument.softDelete();
    expect(deleted.isDeleted).toBe(true);
  });

  it('softDelete() leaves the original unchanged', () => {
    const instrument = new PaymentInstrument(id, userId, PaymentInstrumentType.CreditCard, 'My Visa');
    instrument.softDelete();
    expect(instrument.isDeleted).toBe(false);
  });

  it('isDeleted is false for a non-deleted instrument', () => {
    const instrument = new PaymentInstrument(id, userId, PaymentInstrumentType.CreditCard, 'My Visa');
    expect(instrument.isDeleted).toBe(false);
  });

  it('isDeleted is true after soft delete', () => {
    const instrument = new PaymentInstrument(id, userId, PaymentInstrumentType.CreditCard, 'My Visa');
    expect(instrument.softDelete().isDeleted).toBe(true);
  });

  it('rename() throws on a deleted instrument', () => {
    const deleted = new PaymentInstrument(id, userId, PaymentInstrumentType.CreditCard, 'My Visa').softDelete();
    expect(() => deleted.rename('New Name')).toThrow();
  });

  it('softDelete() throws on an already deleted instrument', () => {
    const deleted = new PaymentInstrument(id, userId, PaymentInstrumentType.CreditCard, 'My Visa').softDelete();
    expect(() => deleted.softDelete()).toThrow();
  });
});
