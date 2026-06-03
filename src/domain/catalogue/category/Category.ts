import { CategoryId } from './CategoryId.js';
import { GroupId } from '../group/GroupId.js';
import { HouseholdId } from '../../identity/household/HouseholdId.js';

export class Category {
  constructor(
    readonly id: CategoryId,
    readonly householdId: HouseholdId,
    readonly groupId: GroupId,
    readonly name: string,
    readonly deletedAt?: Date,
  ) {
    if (!name.trim()) throw new Error('Category name must not be empty');
  }

  get isDeleted(): boolean {
    return this.deletedAt !== undefined;
  }

  rename(newName: string): Category {
    if (this.isDeleted) throw new Error('Cannot rename a deleted Category');
    return new Category(this.id, this.householdId, this.groupId, newName, this.deletedAt);
  }

  moveTo(newGroupId: GroupId): Category {
    if (this.isDeleted) throw new Error('Cannot move a deleted Category');
    return new Category(this.id, this.householdId, newGroupId, this.name, this.deletedAt);
  }

  softDelete(): Category {
    if (this.isDeleted) throw new Error('Category is already deleted');
    return new Category(this.id, this.householdId, this.groupId, this.name, new Date());
  }
}
