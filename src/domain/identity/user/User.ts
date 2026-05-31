import { UserId } from './UserId.js';
import { HouseholdId } from '../household/HouseholdId.js';

export class User {
  readonly id: UserId;
  readonly name: string;
  readonly householdId: HouseholdId | null;

  constructor(id: UserId, name: string, householdId: HouseholdId | null = null) {
    if (!id) throw new Error('UserId is required');
    if (!name || name.trim() === '') throw new Error('User name is required');
    this.id = id;
    this.name = name;
    this.householdId = householdId ?? null;
  }

  belongsToHousehold(): boolean {
    return this.householdId !== null;
  }

  joinHousehold(householdId: HouseholdId): User {
    if (this.householdId !== null) throw new Error('User already belongs to a Household');
    return new User(this.id, this.name, householdId);
  }
}
