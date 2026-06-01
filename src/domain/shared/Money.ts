import { Currency } from './Currency.js';

export class Money {
  constructor(
    readonly amount: number,
    readonly currency: Currency,
  ) {
    if (amount <= 0) throw new Error('Money amount must be positive');
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency.equals(other.currency);
  }
}
