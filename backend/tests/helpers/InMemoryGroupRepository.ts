import { Group } from '../../src/domain/catalogue/group/Group.js';
import { GroupId } from '../../src/domain/catalogue/group/GroupId.js';
import { HouseholdId } from '../../src/domain/identity/household/HouseholdId.js';
import { GroupRepository } from '../../src/domain/catalogue/group/GroupRepository.js';

export class InMemoryGroupRepository implements GroupRepository {
  private store = new Map<string, Group>();

  async findById(id: GroupId): Promise<Group | null> {
    return this.store.get(id) ?? null;
  }

  async findActiveByHousehold(householdId: HouseholdId): Promise<Group[]> {
    return [...this.store.values()].filter(
      (g) => g.householdId === householdId && !g.isDeleted,
    );
  }

  async save(group: Group): Promise<void> {
    this.store.set(group.id, group);
  }
}
