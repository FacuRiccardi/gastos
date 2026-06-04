import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { categories } from '../db/schema/catalogue.js';
import { Category } from '../../domain/catalogue/category/Category.js';
import type { CategoryRepository } from '../../domain/catalogue/category/CategoryRepository.js';
import { CategoryId } from '../../domain/catalogue/category/CategoryId.js';
import { GroupId } from '../../domain/catalogue/group/GroupId.js';
import { HouseholdId } from '../../domain/identity/household/HouseholdId.js';

export class DrizzleCategoryRepository implements CategoryRepository {
  constructor(private readonly db: Db) {}

  async findById(id: CategoryId): Promise<Category | null> {
    const rows = await this.db.select().from(categories).where(eq(categories.id, id));
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findActiveByGroup(groupId: GroupId): Promise<Category[]> {
    const rows = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.groupId, groupId), isNull(categories.deletedAt)));
    return rows.map((r) => this.toDomain(r));
  }

  async findAllByGroup(groupId: GroupId): Promise<Category[]> {
    const rows = await this.db
      .select()
      .from(categories)
      .where(eq(categories.groupId, groupId));
    return rows.map((r) => this.toDomain(r));
  }

  async save(category: Category): Promise<void> {
    const row = this.toRow(category);
    const now = new Date();
    await this.db
      .insert(categories)
      .values({ ...row, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: categories.id,
        set: { name: row.name, groupId: row.groupId, deletedAt: row.deletedAt, updatedAt: now },
      });
  }

  private toDomain(row: typeof categories.$inferSelect): Category {
    return new Category(
      CategoryId.from(row.id),
      HouseholdId.from(row.householdId),
      GroupId.from(row.groupId),
      row.name,
      row.deletedAt ?? undefined,
    );
  }

  private toRow(category: Category): typeof categories.$inferInsert {
    return {
      id: category.id,
      householdId: category.householdId,
      groupId: category.groupId,
      name: category.name,
      deletedAt: category.deletedAt ?? null,
    };
  }
}
