import { PaymentInstrument } from '../../src/domain/expense/payment-instrument/PaymentInstrument.js';
import { PaymentInstrumentId } from '../../src/domain/expense/payment-instrument/PaymentInstrumentId.js';
import { UserId } from '../../src/domain/identity/user/UserId.js';
import { PaymentInstrumentRepository } from '../../src/domain/expense/payment-instrument/PaymentInstrumentRepository.js';

export class InMemoryPaymentInstrumentRepository implements PaymentInstrumentRepository {
  private store = new Map<string, PaymentInstrument>();

  async findById(id: PaymentInstrumentId): Promise<PaymentInstrument | null> {
    return this.store.get(id) ?? null;
  }

  async findActiveByUser(userId: UserId): Promise<PaymentInstrument[]> {
    return [...this.store.values()].filter(
      (i) => i.userId === userId && !i.isDeleted,
    );
  }

  async save(instrument: PaymentInstrument): Promise<void> {
    this.store.set(instrument.id, instrument);
  }
}
