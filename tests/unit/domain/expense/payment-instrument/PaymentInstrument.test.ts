import { describe, it, expect } from 'vitest';
import { PaymentInstrument } from '../../../../../src/domain/expense/payment-instrument/PaymentInstrument.js';
import { PaymentInstrumentId } from '../../../../../src/domain/expense/payment-instrument/PaymentInstrumentId.js';
import { PaymentInstrumentType } from '../../../../../src/domain/expense/payment-instrument/PaymentInstrumentType.js';
import { UserId } from '../../../../../src/domain/identity/user/UserId.js';

describe('PaymentInstrument', () => {
  const instrumentId = PaymentInstrumentId.generate();
  const userId = UserId.generate();

  describe('valid construction', () => {
    it('creates a CreditCard instrument', () => {
      const instrument = new PaymentInstrument(instrumentId, 'My Visa', PaymentInstrumentType.CreditCard, userId);
      expect(instrument.id).toBe(instrumentId);
      expect(instrument.name).toBe('My Visa');
      expect(instrument.type).toBe(PaymentInstrumentType.CreditCard);
      expect(instrument.userId).toBe(userId);
    });

    it('creates a BankAccount instrument', () => {
      const instrument = new PaymentInstrument(instrumentId, 'My Bank', PaymentInstrumentType.BankAccount, userId);
      expect(instrument.type).toBe(PaymentInstrumentType.BankAccount);
    });

    it('is not deleted on construction', () => {
      const instrument = new PaymentInstrument(instrumentId, 'My Visa', PaymentInstrumentType.CreditCard, userId);
      expect(instrument.isDeleted).toBe(false);
    });
  });

  describe('invariants', () => {
    it('requires a PaymentInstrumentId', () => {
      expect(() => new PaymentInstrument(null as unknown as PaymentInstrumentId, 'My Visa', PaymentInstrumentType.CreditCard, userId)).toThrow();
    });

    it('requires a non-empty name', () => {
      expect(() => new PaymentInstrument(instrumentId, '', PaymentInstrumentType.CreditCard, userId)).toThrow();
    });

    it('requires a UserId', () => {
      expect(() => new PaymentInstrument(instrumentId, 'My Visa', PaymentInstrumentType.CreditCard, null as unknown as UserId)).toThrow();
    });

    it('belongs to exactly one User', () => {
      const instrument = new PaymentInstrument(instrumentId, 'My Visa', PaymentInstrumentType.CreditCard, userId);
      expect(instrument.userId).toBe(userId);
    });
  });

  describe('rename', () => {
    it('renames the instrument and returns a new instance', () => {
      const instrument = new PaymentInstrument(instrumentId, 'My Visa', PaymentInstrumentType.CreditCard, userId);
      const renamed = instrument.rename('Personal Visa');
      expect(renamed.name).toBe('Personal Visa');
      expect(renamed).not.toBe(instrument);
    });

    it('rejects an empty name on rename', () => {
      const instrument = new PaymentInstrument(instrumentId, 'My Visa', PaymentInstrumentType.CreditCard, userId);
      expect(() => instrument.rename('')).toThrow();
    });
  });

  describe('softDelete', () => {
    it('marks the instrument as deleted', () => {
      const instrument = new PaymentInstrument(instrumentId, 'My Visa', PaymentInstrumentType.CreditCard, userId);
      const deleted = instrument.softDelete();
      expect(deleted.isDeleted).toBe(true);
    });

    it('returns a new instance on soft delete', () => {
      const instrument = new PaymentInstrument(instrumentId, 'My Visa', PaymentInstrumentType.CreditCard, userId);
      const deleted = instrument.softDelete();
      expect(deleted).not.toBe(instrument);
    });

    it('original instrument remains not deleted after softDelete', () => {
      const instrument = new PaymentInstrument(instrumentId, 'My Visa', PaymentInstrumentType.CreditCard, userId);
      instrument.softDelete();
      expect(instrument.isDeleted).toBe(false);
    });

    it('a soft-deleted instrument retains its type for existing expense resolution', () => {
      const instrument = new PaymentInstrument(instrumentId, 'My Visa', PaymentInstrumentType.CreditCard, userId);
      const deleted = instrument.softDelete();
      expect(deleted.type).toBe(PaymentInstrumentType.CreditCard);
    });
  });
});
