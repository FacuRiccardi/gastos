import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { groups } from '../db/schema/catalogue.js';
import { Group } from '../../domain/catalogue/group/Group.js';
import type { GroupRepository } from '../../domain/catalogue/group/GroupRepository.js';
import { GroupId } from '../../domain/catalogue/group/GroupId.js';
import { HouseholdId } from '../../domain/identity/household/HouseholdId.js';

export class DrizzleGroupRepository implements GroupRepository {
  constructor(private readonly db: Db) {}

  async findById(id: GroupId): Promise<Group | null> {
    const rows = await this.db.select().from(groups).where(eq(groups.id, id));
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findActiveByHousehold(householdId: HouseholdId): Promise<Group[]> {
    const rows = await this.db
      .select()
      .from(groups)
      .where(and(eq(groups.householdId, householdId), isNull(groups.deletedAt)));
    return rows.map((r) => this.toDomain(r));
  }

  async save(group: Group): Promise<void> {
    const row = this.toRow(group);
    const now = new Date();
    await this.db
      .insert(groups)
      .values({ ...row, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: groups.id,
        set: { name: row.name, deletedAt: row.deletedAt, updatedAt: now },
      });
  }

  private toDomain(row: typeof groups.$inferSelect): Group {
    return new Group(
      GroupId.from(row.id),
      HouseholdId.from(row.householdId),
      row.name,
      row.deletedAt ?? undefined,
    );
  }

  private toRow(group: Group): typeof groups.$inferInsert {
    return {
      id: group.id,
      householdId: group.householdId,
      name: group.name,
      deletedAt: group.deletedAt ?? null,
    };
  }
}
