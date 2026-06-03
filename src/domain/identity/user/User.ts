import { UserId } from './UserId.js';
import { HouseholdId } from '../household/HouseholdId.js';

export class User {
  constructor(
    readonly id: UserId,
    readonly name: string,
    readonly householdId?: HouseholdId,
  ) {
    if (!name.trim()) throw new Error('User name must not be empty');
  }

  joinHousehold(householdId: HouseholdId): User {
    if (this.householdId !== undefined) {
      throw new Error('User already belongs to a Household');
    }
    return new User(this.id, this.name, householdId);
  }
}
