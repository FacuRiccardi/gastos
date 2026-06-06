declare const __householdId: unique symbol;
export type HouseholdId = string & { [__householdId]: true };

export const HouseholdId = {
  generate(): HouseholdId {
    return crypto.randomUUID() as HouseholdId;
  },
  from(value: string): HouseholdId {
    return value as HouseholdId;
  },
};
