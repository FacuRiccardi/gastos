import { Category } from '../../domain/catalogue/category/Category.js';
import { CategoryRepository } from '../../domain/catalogue/category/CategoryRepository.js';
import { GroupId } from '../../domain/catalogue/group/GroupId.js';

export interface ListCategoriesInput {
  groupId: GroupId;
}

export type ListCategoriesOutput = { categories: Category[] };

export class ListCategories {
  constructor(private readonly categories: CategoryRepository) {}

  async execute(input: ListCategoriesInput): Promise<ListCategoriesOutput> {
    const categories = await this.categories.findActiveByGroup(input.groupId);
    return { categories };
  }
}
