import { PaymentInstrumentId } from '../../../domain/expense/payment-instrument/PaymentInstrumentId.js';
import { PaymentInstrument } from '../../../domain/expense/payment-instrument/PaymentInstrument.js';
import { PaymentInstrumentType } from '../../../domain/expense/payment-instrument/PaymentInstrumentType.js';
import { PaymentInstrumentRepository } from '../../../domain/expense/payment-instrument/PaymentInstrumentRepository.js';
import { UserId } from '../../../domain/identity/user/UserId.js';

export interface CreatePaymentInstrumentInput {
  userId: UserId;
  type: PaymentInstrumentType;
  name: string;
}

export type CreatePaymentInstrumentOutput = { id: PaymentInstrumentId };

export class CreatePaymentInstrument {
  constructor(private readonly instruments: PaymentInstrumentRepository) {}

  async execute(input: CreatePaymentInstrumentInput): Promise<CreatePaymentInstrumentOutput> {
    const id = PaymentInstrumentId.generate();
    const instrument = new PaymentInstrument(id, input.userId, input.type, input.name);
    await this.instruments.save(instrument);
    return { id };
  }
}
