export type BudgetPeriodType = 'Monthly' | 'Rolling30Days' | 'Custom';

export class BudgetPeriod {
  readonly type: BudgetPeriodType;
  private readonly start: Date | null;
  private readonly end: Date | null;

  private constructor(type: BudgetPeriodType, start: Date | null = null, end: Date | null = null) {
    this.type = type;
    this.start = start;
    this.end = end;
  }

  static monthly(): BudgetPeriod {
    return new BudgetPeriod('Monthly');
  }

  static rolling30Days(): BudgetPeriod {
    return new BudgetPeriod('Rolling30Days');
  }

  static custom(start: Date, end: Date): BudgetPeriod {
    if (start >= end) throw new Error('Custom BudgetPeriod start must be before end');
    return new BudgetPeriod('Custom', start, end);
  }

  getStartDate(referenceDate?: Date): Date {
    if (this.type === 'Custom') return this.start!;
    const ref = referenceDate ?? new Date();
    if (this.type === 'Monthly') {
      return new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
    }
    // Rolling30Days
    const d = new Date(ref);
    d.setUTCDate(d.getUTCDate() - 30);
    return d;
  }

  getEndDate(referenceDate?: Date): Date {
    if (this.type === 'Custom') return this.end!;
    const ref = referenceDate ?? new Date();
    if (this.type === 'Monthly') {
      return new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0));
    }
    return ref;
  }

  equals(other: BudgetPeriod): boolean {
    if (this.type !== other.type) return false;
    if (this.type === 'Custom') {
      return this.start!.getTime() === other.start!.getTime() &&
        this.end!.getTime() === other.end!.getTime();
    }
    return true;
  }
}
