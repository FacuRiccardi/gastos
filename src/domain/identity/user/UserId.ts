declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type UserId = Brand<string, 'UserId'>;

export const UserId = {
  generate(): UserId {
    return crypto.randomUUID() as UserId;
  },
  from(value: string): UserId {
    return value as UserId;
  },
};
