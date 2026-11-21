import path from 'node:path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

async function runMigrations(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set; cannot run migrations.');
  }

  const pool = new Pool({ connectionString });
  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
    console.log('Migrations applied successfully.');
  } finally {
    await pool.end();
  }
}

runMigrations()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('Migration failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
