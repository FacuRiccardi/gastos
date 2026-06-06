import { DomainError } from '../shared/DomainError.js';

export class InstallmentPlan {
  constructor(readonly count: number) {
    if (count <= 0 || !Number.isInteger(count)) {
      throw new DomainError('InstallmentPlan count must be a positive integer');
    }
  }

  equals(other: InstallmentPlan): boolean {
    return this.count === other.count;
  }
}
