import { UserId } from './UserId.js';
import { HouseholdId } from '../household/HouseholdId.js';
import { DomainError } from '../../shared/DomainError.js';

export class User {
  constructor(
    readonly id: UserId,
    readonly name: string,
    readonly householdId?: HouseholdId,
  ) {
    if (!name.trim()) throw new DomainError('User name must not be empty');
  }

  joinHousehold(householdId: HouseholdId): User {
    if (this.householdId !== undefined) {
      throw new DomainError('User already belongs to a Household');
    }
    return new User(this.id, this.name, householdId);
  }
}
