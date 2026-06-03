declare const __userId: unique symbol;
export type UserId = string & { [__userId]: true };

export const UserId = {
  generate(): UserId {
    return crypto.randomUUID() as UserId;
  },
  from(value: string): UserId {
    return value as UserId;
  },
};
