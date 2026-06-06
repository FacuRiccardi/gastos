declare const __expenseId: unique symbol;
export type ExpenseId = string & { [__expenseId]: true };

export const ExpenseId = {
  generate(): ExpenseId {
    return crypto.randomUUID() as ExpenseId;
  },
  from(value: string): ExpenseId {
    return value as ExpenseId;
  },
};
