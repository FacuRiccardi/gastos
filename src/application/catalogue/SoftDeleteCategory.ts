import { CategoryId } from '../../domain/catalogue/category/CategoryId.js';
import { CategoryRepository } from '../../domain/catalogue/category/CategoryRepository.js';

export interface SoftDeleteCategoryInput {
  id: CategoryId;
}

export class SoftDeleteCategory {
  constructor(private readonly categories: CategoryRepository) {}

  async execute(input: SoftDeleteCategoryInput): Promise<void> {
    const category = await this.categories.findById(input.id);
    if (!category) throw new Error('Category not found');

    await this.categories.save(category.softDelete());
  }
}
