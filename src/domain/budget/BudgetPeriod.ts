type PeriodVariant =
  | { kind: 'Monthly' }
  | { kind: 'Rolling30Days' }
  | { kind: 'Custom'; startDate: Date; endDate: Date };

export class BudgetPeriod {
  private constructor(private readonly variant: PeriodVariant) {}

  static monthly(): BudgetPeriod {
    return new BudgetPeriod({ kind: 'Monthly' });
  }

  static rolling30Days(): BudgetPeriod {
    return new BudgetPeriod({ kind: 'Rolling30Days' });
  }

  static custom(startDate: Date, endDate: Date): BudgetPeriod {
    if (endDate <= startDate) throw new Error('Custom period end date must be after start date');
    return new BudgetPeriod({ kind: 'Custom', startDate, endDate });
  }

  get kind(): string {
    return this.variant.kind;
  }

  equals(other: BudgetPeriod): boolean {
    if (this.variant.kind !== other.variant.kind) return false;
    if (this.variant.kind === 'Custom' && other.variant.kind === 'Custom') {
      return (
        this.variant.startDate.getTime() === other.variant.startDate.getTime() &&
        this.variant.endDate.getTime() === other.variant.endDate.getTime()
      );
    }
    return true;
  }
}
