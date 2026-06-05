import { ExpenseDate } from '../expense/ExpenseDate.js';
import { DomainError } from '../shared/DomainError.js';

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const result = new Date(year, month - 1, day);
  if (isNaN(result.getTime())) throw new DomainError(`Invalid date: ${dateStr}`);
  return result;
}

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
    if (endDate <= startDate) throw new DomainError('Custom period end date must be after start date');
    return new BudgetPeriod({ kind: 'Custom', startDate, endDate });
  }

  static from(raw: { kind: string; startDate?: string; endDate?: string }): BudgetPeriod {
    if (raw.kind === 'Monthly') return BudgetPeriod.monthly();
    if (raw.kind === 'Rolling30Days') return BudgetPeriod.rolling30Days();
    if (raw.kind === 'Custom') {
      if (!raw.startDate || !raw.endDate) {
        throw new DomainError('Custom period requires startDate and endDate');
      }
      return BudgetPeriod.custom(parseLocalDate(raw.startDate), parseLocalDate(raw.endDate));
    }
    throw new DomainError(`Invalid period kind: ${raw.kind}`);
  }

  get kind(): PeriodVariant['kind'] {
    return this.variant.kind;
  }

  getDateRange(asOf: Date): { from: ExpenseDate; to: ExpenseDate } {
    if (this.variant.kind === 'Monthly') {
      const from = new Date(asOf.getFullYear(), asOf.getMonth(), 1);
      const to = new Date(asOf.getFullYear(), asOf.getMonth() + 1, 0);
      return { from: new ExpenseDate(from), to: new ExpenseDate(to) };
    }
    if (this.variant.kind === 'Rolling30Days') {
      const to = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
      const from = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 30);
      return { from: new ExpenseDate(from), to: new ExpenseDate(to) };
    }
    return {
      from: new ExpenseDate(this.variant.startDate),
      to: new ExpenseDate(this.variant.endDate),
    };
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
