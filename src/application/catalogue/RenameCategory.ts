import { CategoryId } from '../../domain/catalogue/category/CategoryId.js';
import { CategoryRepository } from '../../domain/catalogue/category/CategoryRepository.js';
import { HouseholdId } from '../../domain/identity/household/HouseholdId.js';
import { ApplicationError } from '../ApplicationError.js';

export interface RenameCategoryInput {
  id: CategoryId;
  newName: string;
  householdId: HouseholdId;
}

export class RenameCategory {
  constructor(private readonly categories: CategoryRepository) {}

  async execute(input: RenameCategoryInput): Promise<void> {
    const category = await this.categories.findById(input.id);
    if (!category || category.householdId !== input.householdId) {
      throw new ApplicationError('Category not found');
    }
    await this.categories.save(category.rename(input.newName));
  }
}
