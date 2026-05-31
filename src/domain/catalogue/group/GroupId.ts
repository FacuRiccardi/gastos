declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type GroupId = Brand<string, 'GroupId'>;

export const GroupId = {
  generate(): GroupId {
    return crypto.randomUUID() as GroupId;
  },
  from(value: string): GroupId {
    return value as GroupId;
  },
};
