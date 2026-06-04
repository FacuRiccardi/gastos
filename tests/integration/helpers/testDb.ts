import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

function getTestDb() {
  const connectionString = process.env['TEST_DATABASE_URL'];
  if (!connectionString) throw new Error('TEST_DATABASE_URL environment variable is not set');
  const client = postgres(connectionString);
  return drizzle(client);
}

export const testDb = getTestDb();
export type TestDb = typeof testDb;

export async function clearTables(): Promise<void> {
  await testDb.execute(
    sql`TRUNCATE TABLE
      household_members,
      households,
      users,
      groups,
      categories,
      payment_instruments,
      expenses,
      budget_limits
    RESTART IDENTITY CASCADE`,
  );
}
