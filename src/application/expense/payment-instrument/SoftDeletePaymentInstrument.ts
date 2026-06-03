import { PaymentInstrumentId } from '../../../domain/expense/payment-instrument/PaymentInstrumentId.js';
import { PaymentInstrumentRepository } from '../../../domain/expense/payment-instrument/PaymentInstrumentRepository.js';

export interface SoftDeletePaymentInstrumentInput {
  id: PaymentInstrumentId;
}

export class SoftDeletePaymentInstrument {
  constructor(private readonly instruments: PaymentInstrumentRepository) {}

  async execute(input: SoftDeletePaymentInstrumentInput): Promise<void> {
    const instrument = await this.instruments.findById(input.id);
    if (!instrument) throw new Error('PaymentInstrument not found');

    await this.instruments.save(instrument.softDelete());
  }
}
