export class ExpenseDate {
  private readonly date: Date;

  constructor(date: Date) {
    this.date = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  static fromString(dateStr: string): ExpenseDate {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new ExpenseDate(new Date(year, month - 1, day));
  }

  toLocalDateString(): string {
    const y = this.date.getFullYear();
    const m = String(this.date.getMonth() + 1).padStart(2, '0');
    const d = String(this.date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  equals(other: ExpenseDate): boolean {
    return this.date.getTime() === other.date.getTime();
  }

  toDate(): Date {
    return new Date(this.date);
  }
}
