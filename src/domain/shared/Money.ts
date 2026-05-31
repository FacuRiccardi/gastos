import { Currency } from './Currency.js';

export class Money {
  readonly amount: number;
  readonly currency: Currency;

  constructor(amount: number, currency: Currency) {
    if (amount <= 0) throw new Error('Money amount must be positive');
    this.amount = amount;
    this.currency = currency;
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  add(other: Money): Money {
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    return new Money(this.amount - other.amount, this.currency);
  }
}
