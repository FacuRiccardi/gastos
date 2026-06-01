declare const __budgetLimitId: unique symbol;
export type BudgetLimitId = string & { [__budgetLimitId]: true };

export const BudgetLimitId = {
  generate(): BudgetLimitId {
    return crypto.randomUUID() as BudgetLimitId;
  },
  from(value: string): BudgetLimitId {
    return value as BudgetLimitId;
  },
};
