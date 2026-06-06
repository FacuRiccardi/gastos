declare const __groupId: unique symbol;
export type GroupId = string & { [__groupId]: true };

export const GroupId = {
  generate(): GroupId {
    return crypto.randomUUID() as GroupId;
  },
  from(value: string): GroupId {
    return value as GroupId;
  },
};
