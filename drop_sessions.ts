import { db } from './server/db';
import { sql } from 'drizzle-orm';
async function main() {
  await db.execute(sql`DROP TABLE IF EXISTS "sessions" CASCADE;`);
  console.log("Done");
  process.exit(0);
}
main();
