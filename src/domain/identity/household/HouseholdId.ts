declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type HouseholdId = Brand<string, 'HouseholdId'>;

export const HouseholdId = {
  generate(): HouseholdId {
    return crypto.randomUUID() as HouseholdId;
  },
  from(value: string): HouseholdId {
    return value as HouseholdId;
  },
};
