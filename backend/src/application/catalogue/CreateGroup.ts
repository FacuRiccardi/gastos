import { GroupId } from '../../domain/catalogue/group/GroupId.js';
import { Group } from '../../domain/catalogue/group/Group.js';
import { GroupRepository } from '../../domain/catalogue/group/GroupRepository.js';
import { HouseholdId } from '../../domain/identity/household/HouseholdId.js';

export interface CreateGroupInput {
  householdId: HouseholdId;
  name: string;
}

export type CreateGroupOutput = { id: GroupId };

export class CreateGroup {
  constructor(private readonly groups: GroupRepository) {}

  async execute(input: CreateGroupInput): Promise<CreateGroupOutput> {
    const id = GroupId.generate();
    const group = new Group(id, input.householdId, input.name);
    await this.groups.save(group);
    return { id };
  }
}
