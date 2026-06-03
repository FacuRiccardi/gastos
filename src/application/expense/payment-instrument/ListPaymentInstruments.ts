import { PaymentInstrument } from '../../../domain/expense/payment-instrument/PaymentInstrument.js';
import { PaymentInstrumentRepository } from '../../../domain/expense/payment-instrument/PaymentInstrumentRepository.js';
import { UserId } from '../../../domain/identity/user/UserId.js';

export interface ListPaymentInstrumentsInput {
  userId: UserId;
}

export type ListPaymentInstrumentsOutput = { instruments: PaymentInstrument[] };

export class ListPaymentInstruments {
  constructor(private readonly instruments: PaymentInstrumentRepository) {}

  async execute(input: ListPaymentInstrumentsInput): Promise<ListPaymentInstrumentsOutput> {
    const instruments = await this.instruments.findActiveByUser(input.userId);
    return { instruments };
  }
}
