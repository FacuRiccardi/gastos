export class ExpenseDate {
  private readonly date: Date;

  constructor(date: Date) {
    this.date = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  static fromString(dateStr: string): ExpenseDate {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new ExpenseDate(new Date(year, month - 1, day));
  }

  equals(other: ExpenseDate): boolean {
    return this.date.getTime() === other.date.getTime();
  }

  toDate(): Date {
    return new Date(this.date);
  }
}
