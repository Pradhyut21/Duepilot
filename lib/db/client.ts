import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { getEnv } from '../env';

let pool: Pool | undefined;
let database: NodePgDatabase<typeof schema> | undefined;

/** Lazily creates and memoises the pg connection pool. */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: getEnv().DATABASE_URL });
  }
  return pool;
}

/**
 * Lazily creates and memoises the Drizzle client. Accessed through a function
 * (not a module-level constant) so importing this file never requires env vars.
 */
export function getDb(): NodePgDatabase<typeof schema> {
  if (!database) {
    database = drizzle(getPool(), { schema });
  }
  return database;
}
