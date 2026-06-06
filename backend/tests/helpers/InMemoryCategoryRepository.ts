import { Category } from '../../src/domain/catalogue/category/Category.js';
import { CategoryId } from '../../src/domain/catalogue/category/CategoryId.js';
import { GroupId } from '../../src/domain/catalogue/group/GroupId.js';
import { CategoryRepository } from '../../src/domain/catalogue/category/CategoryRepository.js';

export class InMemoryCategoryRepository implements CategoryRepository {
  private store = new Map<string, Category>();

  async findById(id: CategoryId): Promise<Category | null> {
    return this.store.get(id) ?? null;
  }

  async findActiveByGroup(groupId: GroupId): Promise<Category[]> {
    return [...this.store.values()].filter(
      (c) => c.groupId === groupId && !c.isDeleted,
    );
  }

  async findAllByGroup(groupId: GroupId): Promise<Category[]> {
    return [...this.store.values()].filter((c) => c.groupId === groupId);
  }

  async save(category: Category): Promise<void> {
    this.store.set(category.id, category);
  }
}
