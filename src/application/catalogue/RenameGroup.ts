import { GroupId } from '../../domain/catalogue/group/GroupId.js';
import { GroupRepository } from '../../domain/catalogue/group/GroupRepository.js';
import { HouseholdId } from '../../domain/identity/household/HouseholdId.js';
import { ApplicationError } from '../ApplicationError.js';

export interface RenameGroupInput {
  id: GroupId;
  newName: string;
  householdId: HouseholdId;
}

export class RenameGroup {
  constructor(private readonly groups: GroupRepository) {}

  async execute(input: RenameGroupInput): Promise<void> {
    const group = await this.groups.findById(input.id);
    if (!group || group.householdId !== input.householdId) {
      throw new ApplicationError('Group not found');
    }
    await this.groups.save(group.rename(input.newName));
  }
}
