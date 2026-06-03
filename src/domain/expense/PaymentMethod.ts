import { PaymentInstrumentId } from './payment-instrument/PaymentInstrumentId.js';

export type PaymentMethod =
  | { kind: 'Cash' }
  | { kind: 'CreditCard'; instrumentId: PaymentInstrumentId }
  | { kind: 'BankAccount'; instrumentId: PaymentInstrumentId };
