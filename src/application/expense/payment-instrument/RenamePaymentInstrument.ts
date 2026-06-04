import { PaymentInstrumentId } from '../../../domain/expense/payment-instrument/PaymentInstrumentId.js';
import { PaymentInstrumentRepository } from '../../../domain/expense/payment-instrument/PaymentInstrumentRepository.js';
import { ApplicationError } from '../../ApplicationError.js';

export interface RenamePaymentInstrumentInput {
  id: PaymentInstrumentId;
  newName: string;
}

export class RenamePaymentInstrument {
  constructor(private readonly instruments: PaymentInstrumentRepository) {}

  async execute(input: RenamePaymentInstrumentInput): Promise<void> {
    const instrument = await this.instruments.findById(input.id);
    if (!instrument) throw new ApplicationError('PaymentInstrument not found');

    await this.instruments.save(instrument.rename(input.newName));
  }
}
