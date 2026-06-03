declare const __categoryId: unique symbol;
export type CategoryId = string & { [__categoryId]: true };

export const CategoryId = {
  generate(): CategoryId {
    return crypto.randomUUID() as CategoryId;
  },
  from(value: string): CategoryId {
    return value as CategoryId;
  },
};
