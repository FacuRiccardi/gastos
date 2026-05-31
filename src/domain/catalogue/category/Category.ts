import { CategoryId } from './CategoryId.js';
import { GroupId } from '../group/GroupId.js';
import { HouseholdId } from '../../identity/household/HouseholdId.js';

export class Category {
  readonly id: CategoryId;
  readonly name: string;
  readonly groupId: GroupId;
  readonly householdId: HouseholdId;
  readonly isDeleted: boolean;

  constructor(id: CategoryId, name: string, groupId: GroupId, householdId: HouseholdId, isDeleted = false) {
    if (!id) throw new Error('CategoryId is required');
    if (!name || name.trim() === '') throw new Error('Category name is required');
    if (!groupId) throw new Error('GroupId is required');
    if (!householdId) throw new Error('HouseholdId is required');
    this.id = id;
    this.name = name;
    this.groupId = groupId;
    this.householdId = householdId;
    this.isDeleted = isDeleted;
  }

  rename(name: string): Category {
    if (!name || name.trim() === '') throw new Error('Category name is required');
    return new Category(this.id, name, this.groupId, this.householdId, this.isDeleted);
  }

  moveToGroup(groupId: GroupId): Category {
    return new Category(this.id, this.name, groupId, this.householdId, this.isDeleted);
  }

  softDelete(): Category {
    return new Category(this.id, this.name, this.groupId, this.householdId, true);
  }
}
