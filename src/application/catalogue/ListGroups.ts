import { Group } from '../../domain/catalogue/group/Group.js';
import { GroupRepository } from '../../domain/catalogue/group/GroupRepository.js';
import { HouseholdId } from '../../domain/identity/household/HouseholdId.js';

export interface ListGroupsInput {
  householdId: HouseholdId;
}

export type ListGroupsOutput = { groups: Group[] };

export class ListGroups {
  constructor(private readonly groups: GroupRepository) {}

  async execute(input: ListGroupsInput): Promise<ListGroupsOutput> {
    const groups = await this.groups.findActiveByHousehold(input.householdId);
    return { groups };
  }
}
