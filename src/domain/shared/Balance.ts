import { Currency } from './Currency.js';
import { DomainError } from './DomainError.js';

export class Balance {
  constructor(
    readonly amount: number,
    readonly currency: Currency,
  ) {
    if (!Number.isFinite(amount)) throw new DomainError('Balance amount must be finite');
  }

  isOverBudget(): boolean {
    return this.amount < 0;
  }

  equals(other: Balance): boolean {
    return this.amount === other.amount && this.currency.equals(other.currency);
  }
}
