import { CategoryId } from '../../domain/catalogue/category/CategoryId.js';
import { Category } from '../../domain/catalogue/category/Category.js';
import { CategoryRepository } from '../../domain/catalogue/category/CategoryRepository.js';
import { GroupId } from '../../domain/catalogue/group/GroupId.js';
import { GroupRepository } from '../../domain/catalogue/group/GroupRepository.js';
import { HouseholdId } from '../../domain/identity/household/HouseholdId.js';
import { ApplicationError } from '../ApplicationError.js';

export interface CreateCategoryInput {
  householdId: HouseholdId;
  groupId: GroupId;
  name: string;
}

export type CreateCategoryOutput = { id: CategoryId };

export class CreateCategory {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly groups: GroupRepository,
  ) {}

  async execute(input: CreateCategoryInput): Promise<CreateCategoryOutput> {
    const group = await this.groups.findById(input.groupId);
    if (!group) throw new ApplicationError('Group not found');

    const id = CategoryId.generate();
    const category = new Category(id, input.householdId, input.groupId, input.name);
    await this.categories.save(category);
    return { id };
  }
}
