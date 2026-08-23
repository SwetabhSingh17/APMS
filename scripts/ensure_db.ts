/**
 * Production-safe database bootstrap.
 *
 * Safe to run on EVERY server start (fresh install OR update):
 *  - Verifies PostgreSQL is reachable (with actionable diagnostics).
 *  - If core tables are missing  -> pushes the schema and seeds the default
 *    admin (admin / Admin@123). NON-destructive: never wipes existing data.
 *  - If the schema already exists -> syncs any pending schema changes
 *    (same as `npm run db:push`), keeping updates one-click safe.
 *
 * Exit codes: 0 = ready, 1 = setup failure, 2 = configuration/connection error.
 */
import 'dotenv/config';
import { execSync } from 'child_process';
import { sql } from 'drizzle-orm';
import { db, getMissingCoreTables, getResolvedDatabaseUrl } from '../server/db.js';
import { DBStorage } from '../server/db-storage.js';

/**
 * Runs drizzle-kit push against the EXACT database the runtime server
 * resolved. Injecting DATABASE_URL prevents drizzle-kit's own .env loading
 * from pointing the child process at a different database.
 */
function pushSchema() {
  execSync('npx drizzle-kit push --force', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: getResolvedDatabaseUrl() },
  });
}

async function main() {
  // drizzle-kit (used below) resolves its connection exactly like the runtime
  // (DATABASE_URL first, then DB_* — see drizzle.config.ts), so both always
  // target the same database.
  if (!process.env.DATABASE_URL && !process.env.DB_HOST && !process.env.DB_NAME && !process.env.DB_USER) {
    console.error('❌ Database is not configured.');
    console.error('   Open the .env file in the project root and set DATABASE_URL to your');
    console.error('   PostgreSQL connection string, e.g.:');
    console.error('     DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/integral_project_hub');
    process.exit(2);
  }

  console.log('🔍 Checking database connection...');
  try {
    await db.execute(sql`SELECT 1`);
  } catch (error: any) {
    console.error('❌ Could not connect to PostgreSQL.');
    console.error('   Checklist:');
    console.error('   1. Is the PostgreSQL Windows service running? (services.msc → postgresql-x64)');
    console.error('   2. Are DATABASE_URL / DB_* values in .env correct (user, password, database name)?');
    console.error('   3. Does the database exist? Create it with: CREATE DATABASE integral_project_hub;');
    if (process.env.NODE_ENV !== 'production') {
      console.error('   Details:', error?.message || error);
    }
    process.exit(2);
  }
  console.log('✅ Connected to PostgreSQL.');

  const missing = await getMissingCoreTables();

  if (missing.length > 0) {
    console.log(`📦 Schema incomplete (${missing.length} table(s) missing) — creating schema...`);
    try {
      pushSchema();
    } catch (error: any) {
      console.error('❌ Failed to push schema. Details:', error.message);
      process.exit(1);
    }

    console.log('👤 Seeding default admin account...');
    const ok = await new DBStorage().initializeDefaultUser();
    if (!ok) {
      console.error('❌ Failed to seed default admin user.');
      process.exit(1);
    }
    console.log('✅ Database ready. Default login: admin / Admin@123 (change it after first login).');
  } else {
    console.log('✅ Schema present — syncing any pending schema changes...');
    try {
      pushSchema();
      console.log('✅ Database is up to date.');
    } catch (error: any) {
      console.error('❌ Schema sync failed. Details:', error.message);
      process.exit(1);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Unexpected error during database preparation:', err);
  process.exit(1);
});
