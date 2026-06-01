import { Category } from './Category.js';
import { CategoryId } from './CategoryId.js';
import { GroupId } from '../group/GroupId.js';

export interface CategoryRepository {
  findById(id: CategoryId): Promise<Category | null>;
  findActiveByGroup(groupId: GroupId): Promise<Category[]>;
  save(category: Category): Promise<void>;
}
