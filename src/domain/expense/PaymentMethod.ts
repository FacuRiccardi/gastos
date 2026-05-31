import { PaymentInstrumentId } from './payment-instrument/PaymentInstrumentId.js';

export type PaymentMethodKind = 'Cash' | 'BankAccount' | 'CreditCard';

export interface CashPayment {
  readonly kind: 'Cash';
}

export interface BankAccountPayment {
  readonly kind: 'BankAccount';
  readonly instrumentId: PaymentInstrumentId;
}

export interface CreditCardPayment {
  readonly kind: 'CreditCard';
  readonly instrumentId: PaymentInstrumentId;
}

export type PaymentMethod = CashPayment | BankAccountPayment | CreditCardPayment;

export const PaymentMethod = {
  cash(): CashPayment {
    return { kind: 'Cash' };
  },
  bankAccount(instrumentId: PaymentInstrumentId): BankAccountPayment {
    return { kind: 'BankAccount', instrumentId };
  },
  creditCard(instrumentId: PaymentInstrumentId): CreditCardPayment {
    return { kind: 'CreditCard', instrumentId };
  },
};
