import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { households, householdMembers } from '../db/schema/identity.js';
import { Household } from '../../domain/identity/household/Household.js';
import type { HouseholdRepository } from '../../domain/identity/household/HouseholdRepository.js';
import { HouseholdId } from '../../domain/identity/household/HouseholdId.js';
import { UserId } from '../../domain/identity/user/UserId.js';

export class DrizzleHouseholdRepository implements HouseholdRepository {
  constructor(private readonly db: Db) {}

  async findById(id: HouseholdId): Promise<Household | null> {
    const rows = await this.db.select().from(households).where(eq(households.id, id));
    if (rows.length === 0) return null;

    const memberRows = await this.db
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.householdId, id));

    return this.toDomain(rows[0]!, memberRows.map((r) => r.userId));
  }

  async save(household: Household): Promise<void> {
    const row = this.toRow(household);
    const now = new Date();

    await this.db.transaction(async (tx) => {
      await tx
        .insert(households)
        .values({ ...row, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({ target: households.id, set: { name: row.name, updatedAt: now } });

      await tx.delete(householdMembers).where(eq(householdMembers.householdId, household.id));
      if (household.members.length > 0) {
        await tx.insert(householdMembers).values(
          household.members.map((userId) => ({
            householdId: household.id,
            userId,
            createdAt: now,
          })),
        );
      }
    });
  }

  private toDomain(
    row: typeof households.$inferSelect,
    memberIds: string[],
  ): Household {
    return new Household(
      HouseholdId.from(row.id),
      row.name,
      memberIds.map((id) => UserId.from(id)),
    );
  }

  private toRow(household: Household): typeof households.$inferInsert {
    return { id: household.id, name: household.name };
  }
}
