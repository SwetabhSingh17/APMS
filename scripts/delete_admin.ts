import 'dotenv/config';
import { db } from "../server/db.js";
import { users } from "../shared/schema.js";
import { eq, or } from "drizzle-orm";

async function run() {
    console.log("Deleting admin user...");
    await db.delete(users).where(or(eq(users.username, 'admin'), eq(users.email, 'admin@example.com')));
    console.log("Admin deleted.");
    process.exit(0);
}

run().catch(console.error);
