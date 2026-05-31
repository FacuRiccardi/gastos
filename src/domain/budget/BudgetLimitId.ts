declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type BudgetLimitId = Brand<string, 'BudgetLimitId'>;

export const BudgetLimitId = {
  generate(): BudgetLimitId {
    return crypto.randomUUID() as BudgetLimitId;
  },
  from(value: string): BudgetLimitId {
    return value as BudgetLimitId;
  },
};
