import { describe, it, expect, beforeEach } from 'vitest';
import { CreatePaymentInstrument } from '../../../../../src/application/expense/payment-instrument/CreatePaymentInstrument.js';
import { RenamePaymentInstrument } from '../../../../../src/application/expense/payment-instrument/RenamePaymentInstrument.js';
import { SoftDeletePaymentInstrument } from '../../../../../src/application/expense/payment-instrument/SoftDeletePaymentInstrument.js';
import { ListPaymentInstruments } from '../../../../../src/application/expense/payment-instrument/ListPaymentInstruments.js';
import { InMemoryPaymentInstrumentRepository } from '../../../../helpers/InMemoryPaymentInstrumentRepository.js';
import { PaymentInstrument } from '../../../../../src/domain/expense/payment-instrument/PaymentInstrument.js';
import { PaymentInstrumentId } from '../../../../../src/domain/expense/payment-instrument/PaymentInstrumentId.js';
import { PaymentInstrumentType } from '../../../../../src/domain/expense/payment-instrument/PaymentInstrumentType.js';
import { UserId } from '../../../../../src/domain/identity/user/UserId.js';

describe('Expense / PaymentInstruments', () => {
  let instruments: InMemoryPaymentInstrumentRepository;
  const userId = UserId.generate();

  beforeEach(() => {
    instruments = new InMemoryPaymentInstrumentRepository();
  });

  describe('CreatePaymentInstrument', () => {
    it('persists a new payment instrument and returns its id', async () => {
      const useCase = new CreatePaymentInstrument(instruments);

      const result = await useCase.execute({
        userId,
        type: PaymentInstrumentType.CreditCard,
        name: 'Visa',
      });

      const saved = await instruments.findById(result.id);
      expect(saved).not.toBeNull();
      expect(saved!.name).toBe('Visa');
      expect(saved!.type).toBe(PaymentInstrumentType.CreditCard);
      expect(saved!.userId).toBe(userId);
    });
  });

  describe('RenamePaymentInstrument', () => {
    it('renames the instrument and persists the updated aggregate', async () => {
      const useCase = new RenamePaymentInstrument(instruments);
      const id = PaymentInstrumentId.generate();
      await instruments.save(new PaymentInstrument(id, userId, PaymentInstrumentType.CreditCard, 'Old'));

      await useCase.execute({ id, newName: 'New', userId });

      const saved = await instruments.findById(id);
      expect(saved!.name).toBe('New');
    });

    it('throws when the instrument does not exist', async () => {
      const useCase = new RenamePaymentInstrument(instruments);

      await expect(
        useCase.execute({ id: PaymentInstrumentId.generate(), newName: 'X', userId }),
      ).rejects.toMatchObject({ type: 'Application', message: 'PaymentInstrument not found' });
    });

    it('throws when the instrument belongs to a different user', async () => {
      const useCase = new RenamePaymentInstrument(instruments);
      const id = PaymentInstrumentId.generate();
      const otherUserId = UserId.generate();
      await instruments.save(new PaymentInstrument(id, otherUserId, PaymentInstrumentType.CreditCard, 'Other Card'));

      await expect(
        useCase.execute({ id, newName: 'New', userId }),
      ).rejects.toMatchObject({ type: 'Application', message: 'PaymentInstrument not found' });
    });
  });

  describe('SoftDeletePaymentInstrument', () => {
    it('marks the instrument as deleted and persists the updated aggregate', async () => {
      const useCase = new SoftDeletePaymentInstrument(instruments);
      const id = PaymentInstrumentId.generate();
      await instruments.save(new PaymentInstrument(id, userId, PaymentInstrumentType.BankAccount, 'Checking'));

      await useCase.execute({ id, userId });

      const saved = await instruments.findById(id);
      expect(saved!.isDeleted).toBe(true);
    });

    it('throws when the instrument does not exist', async () => {
      const useCase = new SoftDeletePaymentInstrument(instruments);

      await expect(
        useCase.execute({ id: PaymentInstrumentId.generate(), userId }),
      ).rejects.toMatchObject({ type: 'Application', message: 'PaymentInstrument not found' });
    });

    it('throws when the instrument belongs to a different user', async () => {
      const useCase = new SoftDeletePaymentInstrument(instruments);
      const id = PaymentInstrumentId.generate();
      const otherUserId = UserId.generate();
      await instruments.save(new PaymentInstrument(id, otherUserId, PaymentInstrumentType.BankAccount, 'Other Account'));

      await expect(
        useCase.execute({ id, userId }),
      ).rejects.toMatchObject({ type: 'Application', message: 'PaymentInstrument not found' });
    });
  });

  describe('ListPaymentInstruments', () => {
    it('returns only active instruments for the given user', async () => {
      const useCase = new ListPaymentInstruments(instruments);
      const activeId = PaymentInstrumentId.generate();
      const deletedId = PaymentInstrumentId.generate();
      await instruments.save(new PaymentInstrument(activeId, userId, PaymentInstrumentType.CreditCard, 'Active'));
      await instruments.save(new PaymentInstrument(deletedId, userId, PaymentInstrumentType.CreditCard, 'Deleted', new Date()));

      const result = await useCase.execute({ userId });

      expect(result.instruments).toHaveLength(1);
      expect(result.instruments[0].id).toBe(activeId);
    });
  });
});
