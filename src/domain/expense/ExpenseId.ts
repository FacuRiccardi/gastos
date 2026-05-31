declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type ExpenseId = Brand<string, 'ExpenseId'>;

export const ExpenseId = {
  generate(): ExpenseId {
    return crypto.randomUUID() as ExpenseId;
  },
  from(value: string): ExpenseId {
    return value as ExpenseId;
  },
};
