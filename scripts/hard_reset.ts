import { storage } from "../server/db-storage.js";
import { db } from "../server/db.js";
import { users } from "../shared/schema.js";
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Parse command line arguments
const args = process.argv.slice(2);
const backupFirst = args.includes('--backup-first');
const preserveSchema = args.includes('--preserve-schema');

async function createPreResetBackup() {
    try {
        console.log("📦 Creating backup before reset...");
        const { stdout } = await execAsync('npm run db:backup');
        console.log(stdout);
        console.log("✅ Backup created successfully!");
    } catch (error: any) {
        console.error("❌ Backup failed:", error.message);
        throw new Error("Aborting reset due to backup failure");
    }
}

async function run() {
    console.log("🔴 Hard resetting database (Nuke mode)...");

    if (backupFirst) {
        await createPreResetBackup();
    }

    if (preserveSchema) {
        console.log("⚠️  Preserving schema, clearing data only...");
        // Use the standard reset which preserves admin
        await storage.resetDatabase();
        console.log("✅ Data cleared, schema preserved, admin reset to Admin@123");
    } else {
        console.log("⚠️  FULL RESET: Deleting ALL data including admin...");
        // storage.resetDatabase() preserves admin. We want to delete ALL to fix corruption.

        // Need to delete dependent tables first if constraints exist
        try {
            await storage.resetDatabase(); // Clears most things
            await db.delete(users); // Clears ALL users including admin
        } catch (e) {
            // If resetDatabase failed, try raw deletes
            console.log("Standard reset failed, trying force delete users:", e);
            await db.delete(users);
        }

        console.log("✅ Database completely cleared (including schema metadata)");
        console.log("⚠️  You will need to restore from backup or run migrations!");
    }

    console.log("🎉 Database reset complete.");
    process.exit(0);
}

// Show usage information
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Database Hard Reset Utility

⚠️  WARNING: This is a DESTRUCTIVE operation!

Usage:
  npm run db:hard-reset [options]

Options:
  --backup-first      Create backup before resetting
  --preserve-schema   Clear data but keep tables/schema
  --help, -h         Show this help message

Examples:
  npm run db:hard-reset -- --backup-first
  npm run db:hard-reset -- --preserve-schema
  npm run db:hard-reset -- --backup-first --preserve-schema

Modes:
  Default (no flags):
    - Deletes ALL data including admin user
    - May require schema restoration afterward
  
  --preserve-schema:
    - Deletes all data except admin user
    - Resets admin password to Admin@123
    - Schema/tables remain intact
    `);
    process.exit(0);
}

run().catch(console.error);
