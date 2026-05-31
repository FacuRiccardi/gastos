import { GroupId } from './GroupId.js';
import { HouseholdId } from '../../identity/household/HouseholdId.js';

export class Group {
  readonly id: GroupId;
  readonly name: string;
  readonly householdId: HouseholdId;
  readonly isDeleted: boolean;

  constructor(id: GroupId, name: string, householdId: HouseholdId, isDeleted = false) {
    if (!id) throw new Error('GroupId is required');
    if (!name || name.trim() === '') throw new Error('Group name is required');
    if (!householdId) throw new Error('HouseholdId is required');
    this.id = id;
    this.name = name;
    this.householdId = householdId;
    this.isDeleted = isDeleted;
  }

  rename(name: string): Group {
    if (!name || name.trim() === '') throw new Error('Group name is required');
    return new Group(this.id, name, this.householdId, this.isDeleted);
  }

  softDelete(): Group {
    return new Group(this.id, this.name, this.householdId, true);
  }
}
