import { CategoryId } from '../../domain/catalogue/category/CategoryId.js';
import { CategoryRepository } from '../../domain/catalogue/category/CategoryRepository.js';
import { GroupId } from '../../domain/catalogue/group/GroupId.js';
import { GroupRepository } from '../../domain/catalogue/group/GroupRepository.js';

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
    if (!category) throw new Error('Category not found');

    const targetGroup = await this.groups.findById(input.targetGroupId);
    if (!targetGroup) throw new Error('Target group not found');

    await this.categories.save(category.moveTo(input.targetGroupId));
  }
}
