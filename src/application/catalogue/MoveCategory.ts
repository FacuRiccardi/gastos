import { CategoryId } from '../../domain/catalogue/category/CategoryId.js';
import { CategoryRepository } from '../../domain/catalogue/category/CategoryRepository.js';
import { GroupId } from '../../domain/catalogue/group/GroupId.js';
import { GroupRepository } from '../../domain/catalogue/group/GroupRepository.js';
import { ApplicationError } from '../ApplicationError.js';

export interface MoveCategoryInput {
  id: CategoryId;
  targetGroupId: GroupId;
}

export class MoveCategory {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly groups: GroupRepository,
  ) {}

  async execute(input: MoveCategoryInput): Promise<void> {
    const category = await this.categories.findById(input.id);
    if (!category) throw new ApplicationError('Category not found');

    const targetGroup = await this.groups.findById(input.targetGroupId);
    if (!targetGroup) throw new ApplicationError('Target group not found');
    if (targetGroup.isDeleted) throw new ApplicationError('Target group is deleted');
    if (targetGroup.householdId !== category.householdId) throw new ApplicationError('Cannot move category across households');

    await this.categories.save(category.moveTo(input.targetGroupId));
  }
}
