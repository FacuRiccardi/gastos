import { Currency } from './Currency.js';
import { DomainError } from './DomainError.js';

export class Money {
  constructor(
    readonly amount: number,
    readonly currency: Currency,
  ) {
    if (!Number.isFinite(amount) || amount <= 0) throw new DomainError('Money amount must be positive');
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency.equals(other.currency);
  }
}
