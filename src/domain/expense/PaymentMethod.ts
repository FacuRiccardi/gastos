import { PaymentInstrumentId } from './payment-instrument/PaymentInstrumentId.js';
import { DomainError } from '../shared/DomainError.js';

export type PaymentMethod =
  | { kind: 'Cash' }
  | { kind: 'CreditCard'; instrumentId: PaymentInstrumentId }
  | { kind: 'BankAccount'; instrumentId: PaymentInstrumentId };

export namespace PaymentMethod {
  export function from(raw: { kind: string; instrumentId?: string }): PaymentMethod {
    if (raw.kind === 'Cash') return { kind: 'Cash' };
    if (raw.kind === 'CreditCard' || raw.kind === 'BankAccount') {
      if (!raw.instrumentId) throw new DomainError(`${raw.kind} requires an instrumentId`);
      return { kind: raw.kind, instrumentId: PaymentInstrumentId.from(raw.instrumentId) };
    }
    throw new DomainError(`Invalid payment method kind: ${raw.kind}`);
  }
}
