import { Group } from './Group.js';
import { GroupId } from './GroupId.js';
import { HouseholdId } from '../../identity/household/HouseholdId.js';

export interface GroupRepository {
  findById(id: GroupId): Promise<Group | null>;
  findActiveByHousehold(householdId: HouseholdId): Promise<Group[]>;
  save(group: Group): Promise<void>;
}
