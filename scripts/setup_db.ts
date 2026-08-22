import { execSync } from 'child_process';
import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';
import { DBStorage } from '../server/db-storage.js';

async function setupDatabase() {
    console.log("🚀 Starting database setup...");

    try {
        console.log("🧹 Wiping existing database schema...");
        // Drop public schema and recreate it. This instantly removes all tables and data cleanly.
        await db.execute(sql`DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;`);
        console.log("✅ Database wiped successfully.");
    } catch (error: any) {
        console.error("⚠️ Failed to wipe database schema. It might be a permissions issue or the schema might not exist.");
        console.error("Details:", error.message);
        // We don't exit here, because if schema drop fails, maybe we can still push.
    }

    try {
        console.log("📦 Pushing schema to database...");
        // Use drizzle-kit to push the schema
        execSync('npx drizzle-kit push', { stdio: 'inherit' });
        console.log("✅ Schema pushed successfully.");
    } catch (error: any) {
        console.error("❌ Failed to push schema. Ensure your DATABASE_URL in .env is correct.");
        console.error("Details:", error.message);
        process.exit(1);
    }

    try {
        console.log("👤 Initializing default admin user...");
        const storage = new DBStorage();
        await storage.initializeDefaultUser();
        console.log("✅ Default admin user initialized.");
    } catch (error: any) {
        console.error("❌ Failed to initialize default admin user.");
        console.error("Details:", error.message);
        process.exit(1);
    }

    console.log("🎉 Database setup complete! You can now start the server.");
    process.exit(0);
}

setupDatabase().catch((err) => {
    console.error("❌ Unexpected error during setup:", err);
    process.exit(1);
});
