import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { users, householdMembers } from '../db/schema/identity.js';
import { User } from '../../domain/identity/user/User.js';
import type { UserRepository } from '../../domain/identity/user/UserRepository.js';
import { UserId } from '../../domain/identity/user/UserId.js';
import { HouseholdId } from '../../domain/identity/household/HouseholdId.js';

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Db) {}

  async findById(id: UserId): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.id, id));
    if (rows.length === 0) return null;

    const memberRows = await this.db
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.userId, id));

    const householdId = memberRows[0]
      ? HouseholdId.from(memberRows[0].householdId)
      : undefined;

    return new User(UserId.from(rows[0]!.id), rows[0]!.name, householdId);
  }

  async save(user: User): Promise<void> {
    const now = new Date();
    await this.db
      .insert(users)
      .values({ id: user.id, name: user.name, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: users.id, set: { name: user.name, updatedAt: now } });
  }
}
