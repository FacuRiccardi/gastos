export class InstallmentPlan {
  readonly count: number;

  constructor(count: number) {
    if (!Number.isInteger(count) || count <= 0) throw new Error('InstallmentPlan count must be a positive integer');
    this.count = count;
  }

  equals(other: InstallmentPlan): boolean {
    return this.count === other.count;
  }
}
