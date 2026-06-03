import { GroupId } from '../../domain/catalogue/group/GroupId.js';
import { GroupRepository } from '../../domain/catalogue/group/GroupRepository.js';

export interface SoftDeleteGroupInput {
  id: GroupId;
}

export class SoftDeleteGroup {
  constructor(private readonly groups: GroupRepository) {}

  async execute(input: SoftDeleteGroupInput): Promise<void> {
    const group = await this.groups.findById(input.id);
    if (!group) throw new Error('Group not found');

    await this.groups.save(group.softDelete());
  }
}
