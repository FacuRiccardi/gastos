export class ExpenseDate {
  readonly value: Date;

  constructor(date: Date) {
    if (!date) throw new Error('ExpenseDate requires a date');
    if (isNaN(date.getTime())) throw new Error('ExpenseDate requires a valid date');
    this.value = date;
  }

  static fromISO(iso: string): ExpenseDate {
    const date = new Date(iso);
    return new ExpenseDate(date);
  }

  equals(other: ExpenseDate): boolean {
    return this.value.getTime() === other.value.getTime();
  }
}
