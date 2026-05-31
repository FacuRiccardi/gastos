declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type CategoryId = Brand<string, 'CategoryId'>;

export const CategoryId = {
  generate(): CategoryId {
    return crypto.randomUUID() as CategoryId;
  },
  from(value: string): CategoryId {
    return value as CategoryId;
  },
};
