import { HouseholdId } from './HouseholdId.js';
import { UserId } from '../user/UserId.js';

export class Household {
  constructor(
    readonly id: HouseholdId,
    readonly name: string,
    readonly members: ReadonlyArray<UserId>,
  ) {
    if (!name.trim()) throw new Error('Household name must not be empty');
    if (members.length === 0) throw new Error('Household must have at least one member');
  }

  rename(newName: string): Household {
    return new Household(this.id, newName, this.members);
  }

  addMember(userId: UserId): Household {
    if (this.members.includes(userId)) throw new Error('User is already a member of this Household');
    return new Household(this.id, this.name, [...this.members, userId]);
  }
}
