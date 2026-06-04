import { GroupId } from '../../domain/catalogue/group/GroupId.js';
import { GroupRepository } from '../../domain/catalogue/group/GroupRepository.js';
import { ApplicationError } from '../ApplicationError.js';

export interface RenameGroupInput {
  id: GroupId;
  newName: string;
}

export class RenameGroup {
  constructor(private readonly groups: GroupRepository) {}

  async execute(input: RenameGroupInput): Promise<void> {
    const group = await this.groups.findById(input.id);
    if (!group) throw new ApplicationError('Group not found');

    await this.groups.save(group.rename(input.newName));
  }
}
