import { GroupId } from './GroupId.js';
import { HouseholdId } from '../../identity/household/HouseholdId.js';
import { DomainError } from '../../shared/DomainError.js';

export class Group {
  constructor(
    readonly id: GroupId,
    readonly householdId: HouseholdId,
    readonly name: string,
    readonly deletedAt?: Date,
  ) {
    if (!name.trim()) throw new DomainError('Group name must not be empty');
  }

  get isDeleted(): boolean {
    return this.deletedAt !== undefined;
  }

  rename(newName: string): Group {
    if (this.isDeleted) throw new DomainError('Cannot rename a deleted Group');
    return new Group(this.id, this.householdId, newName, this.deletedAt);
  }

  softDelete(): Group {
    if (this.isDeleted) throw new DomainError('Group is already deleted');
    return new Group(this.id, this.householdId, this.name, new Date());
  }
}
