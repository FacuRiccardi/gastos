import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { InfrastructureError } from '../InfrastructureError.js';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) throw new InfrastructureError('DATABASE_URL environment variable is not set');

const client = postgres(connectionString);
export const db = drizzle(client);
export type Db = typeof db;
