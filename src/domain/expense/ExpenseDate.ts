export class ExpenseDate {
  private readonly date: Date;

  constructor(date: Date) {
    this.date = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  equals(other: ExpenseDate): boolean {
    return this.date.getTime() === other.date.getTime();
  }

  toDate(): Date {
    return new Date(this.date);
  }
}
