export class InstallmentPlan {
  constructor(readonly count: number) {
    if (count <= 0 || !Number.isInteger(count)) {
      throw new Error('InstallmentPlan count must be a positive integer');
    }
  }

  equals(other: InstallmentPlan): boolean {
    return this.count === other.count;
  }
}
