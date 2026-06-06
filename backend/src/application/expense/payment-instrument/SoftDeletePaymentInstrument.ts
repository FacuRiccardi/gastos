import { PaymentInstrumentId } from '../../../domain/expense/payment-instrument/PaymentInstrumentId.js';
import { PaymentInstrumentRepository } from '../../../domain/expense/payment-instrument/PaymentInstrumentRepository.js';
import { UserId } from '../../../domain/identity/user/UserId.js';
import { ApplicationError } from '../../ApplicationError.js';

export interface SoftDeletePaymentInstrumentInput {
  id: PaymentInstrumentId;
  userId: UserId;
}

export class SoftDeletePaymentInstrument {
  constructor(private readonly instruments: PaymentInstrumentRepository) {}

  async execute(input: SoftDeletePaymentInstrumentInput): Promise<void> {
    const instrument = await this.instruments.findById(input.id);
    if (!instrument || instrument.userId !== input.userId) {
      throw new ApplicationError('PaymentInstrument not found');
    }
    await this.instruments.save(instrument.softDelete());
  }
}
