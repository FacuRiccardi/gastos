import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, clearTables } from '../../helpers/testDb.js';
import { DrizzlePaymentInstrumentRepository } from '../../../../src/infrastructure/expense/DrizzlePaymentInstrumentRepository.js';
import { PaymentInstrument } from '../../../../src/domain/expense/payment-instrument/PaymentInstrument.js';
import { PaymentInstrumentId } from '../../../../src/domain/expense/payment-instrument/PaymentInstrumentId.js';
import { PaymentInstrumentType } from '../../../../src/domain/expense/payment-instrument/PaymentInstrumentType.js';
import { UserId } from '../../../../src/domain/identity/user/UserId.js';

describe('DrizzlePaymentInstrumentRepository', () => {
  let repo: DrizzlePaymentInstrumentRepository;
  const userId = UserId.generate();

  beforeEach(async () => {
    await clearTables();
    repo = new DrizzlePaymentInstrumentRepository(testDb);
  });

  it('saves and retrieves an active PaymentInstrument with all fields intact', async () => {
    const id = PaymentInstrumentId.generate();
    const instrument = new PaymentInstrument(id, userId, PaymentInstrumentType.CreditCard, 'Visa');

    await repo.save(instrument);
    const found = await repo.findById(id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(id);
    expect(found!.userId).toBe(userId);
    expect(found!.type).toBe(PaymentInstrumentType.CreditCard);
    expect(found!.name).toBe('Visa');
    expect(found!.deletedAt).toBeUndefined();
  });

  it('returns null for an unknown PaymentInstrumentId', async () => {
    const found = await repo.findById(PaymentInstrumentId.generate());
    expect(found).toBeNull();
  });

  it('save() with existing id overwrites the previous state', async () => {
    const id = PaymentInstrumentId.generate();
    const instrument = new PaymentInstrument(id, userId, PaymentInstrumentType.BankAccount, 'Old Name');
    await repo.save(instrument);

    await repo.save(instrument.rename('New Name'));
    const found = await repo.findById(id);

    expect(found!.name).toBe('New Name');
  });

  it('findActiveByUser() excludes soft-deleted instruments', async () => {
    const activeId = PaymentInstrumentId.generate();
    const deletedId = PaymentInstrumentId.generate();
    await repo.save(new PaymentInstrument(activeId, userId, PaymentInstrumentType.CreditCard, 'Active'));
    await repo.save(new PaymentInstrument(deletedId, userId, PaymentInstrumentType.BankAccount, 'Deleted').softDelete());

    const results = await repo.findActiveByUser(userId);

    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe(activeId);
  });

  it('findActiveByUser() returns only instruments belonging to the given User', async () => {
    const otherId = UserId.generate();
    await repo.save(new PaymentInstrument(PaymentInstrumentId.generate(), userId, PaymentInstrumentType.CreditCard, 'Mine'));
    await repo.save(new PaymentInstrument(PaymentInstrumentId.generate(), otherId, PaymentInstrumentType.CreditCard, 'Theirs'));

    const results = await repo.findActiveByUser(userId);

    expect(results).toHaveLength(1);
    expect(results[0]!.userId).toBe(userId);
  });

  it('findById() resolves a soft-deleted PaymentInstrument', async () => {
    const id = PaymentInstrumentId.generate();
    await repo.save(new PaymentInstrument(id, userId, PaymentInstrumentType.CreditCard, 'Gone').softDelete());

    const found = await repo.findById(id);

    expect(found).not.toBeNull();
    expect(found!.isDeleted).toBe(true);
  });

  it('save() persists a soft-deleted PaymentInstrument (deleted_at is stored)', async () => {
    const id = PaymentInstrumentId.generate();
    const instrument = new PaymentInstrument(id, userId, PaymentInstrumentType.BankAccount, 'Savings');
    await repo.save(instrument);

    await repo.save(instrument.softDelete());
    const found = await repo.findById(id);

    expect(found!.isDeleted).toBe(true);
    expect(found!.deletedAt).toBeInstanceOf(Date);
  });

  it('reconstructs the PaymentInstrumentType enum correctly for both variants', async () => {
    const ccId = PaymentInstrumentId.generate();
    const baId = PaymentInstrumentId.generate();
    await repo.save(new PaymentInstrument(ccId, userId, PaymentInstrumentType.CreditCard, 'CC'));
    await repo.save(new PaymentInstrument(baId, userId, PaymentInstrumentType.BankAccount, 'BA'));

    const cc = await repo.findById(ccId);
    const ba = await repo.findById(baId);

    expect(cc!.type).toBe(PaymentInstrumentType.CreditCard);
    expect(ba!.type).toBe(PaymentInstrumentType.BankAccount);
  });
});
