import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { db } from '../server/db.js';
import { users } from '../shared/schema.js';
import { eq } from 'drizzle-orm';
import { scrypt, randomBytes } from 'crypto';
import { promisify as utilPromisify } from 'util';

const execAsync = promisify(exec);

// Parse command line arguments
const args = process.argv.slice(2);
const backupFile = args.find(arg => !arg.startsWith('--'));
const skipMigrations = args.includes('--skip-migrations');
const initAdminOnly = args.includes('--init-admin-only');

// Get database configuration from environment variables
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || '5432',
    database: process.env.DB_NAME || 'integral_project_hub',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
};

const scryptAsync = utilPromisify(scrypt);

// Hash password function (copied from db-storage.ts to avoid circular dependency)
async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString('hex')}.${salt}`;
}

async function initializeAdminUser() {
    try {
        console.log('🔧 Initializing admin user...');

        // Check if admin exists
        const existingAdmin = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);

        if (existingAdmin.length === 0) {
            // Create admin user
            const adminPassword = await hashPassword('Admin@123');
            await db.insert(users).values({
                username: 'admin',
                password: adminPassword,
                firstName: 'Admin',
                lastName: 'User',
                email: 'admin@example.com',
                role: 'admin',
            });
            console.log('   ✅ Admin user created');
            console.log('   Username: admin');
            console.log('   Password: Admin@123');
        } else {
            console.log('   ℹ️  Admin user already exists');
        }
    } catch (error: any) {
        console.error('   ⚠️  Failed to initialize admin user:', error.message);
        throw error;
    }
}

async function restoreDatabase(filepath: string) {
    try {
        console.log('🔄 Restoring database from backup...');
        console.log(`   Database: ${dbConfig.database}`);
        console.log(`   Backup file: ${filepath}`);

        // Verify backup file exists
        try {
            await fs.access(filepath);
        } catch {
            throw new Error(`Backup file not found: ${filepath}`);
        }

        // Build psql command to restore
        const psqlCmd = [
            'psql',
            '-h', dbConfig.host,
            '-p', dbConfig.port,
            '-U', dbConfig.user,
            '-d', dbConfig.database,
            '-f', filepath,
            '-v', 'ON_ERROR_STOP=1'
        ].join(' ');

        // Set password as environment variable
        const env = { ...process.env, PGPASSWORD: dbConfig.password };

        // Execute psql restore
        const { stdout, stderr } = await execAsync(psqlCmd, { env });

        if (stderr && !stderr.includes('NOTICE')) {
            console.log('   Warnings:', stderr);
        }

        console.log('✅ Database restored successfully!');

        return true;
    } catch (error: any) {
        console.error('❌ Restore failed:', error.message);
        if (error.stderr) {
            console.error('   Details:', error.stderr);
        }
        throw error;
    }
}

async function runMigrations() {
    try {
        console.log('🔄 Running database migrations...');

        const migrateCmd = 'npm run db:migrate';
        const { stdout } = await execAsync(migrateCmd);

        console.log(stdout);
        console.log('✅ Migrations completed!');
    } catch (error: any) {
        console.error('⚠️  Migration warning:', error.message);
        // Don't fail the entire restore if migrations have issues
        // (they might already be applied from the backup)
    }
}

async function run() {
    try {
        // If --init-admin-only flag, just initialize admin and exit
        if (initAdminOnly) {
            await initializeAdminUser();
            process.exit(0);
        }

        // Validate backup file argument
        if (!backupFile) {
            console.error('❌ Error: Backup file path required');
            console.log('\nUsage:');
            console.log('  npm run db:restore <backup-file>');
            console.log('\nExample:');
            console.log('  npm run db:restore database/backups/backup_2025-12-12_18-00-00.sql');
            process.exit(1);
        }

        // Resolve backup file path
        const filepath = path.isAbsolute(backupFile)
            ? backupFile
            : path.join(process.cwd(), backupFile);

        // Restore database
        await restoreDatabase(filepath);

        // Initialize admin user if it doesn't exist
        await initializeAdminUser();

        // Run migrations unless skipped
        if (!skipMigrations) {
            await runMigrations();
        }

        console.log('\n🎉 Database restore complete!');
        console.log('   You can now start the server and log in with:');
        console.log('   Username: admin');
        console.log('   Password: Admin@123');

        process.exit(0);
    } catch (error: any) {
        console.error('\n💥 Restore process failed:', error.message);
        process.exit(1);
    }
}

// Show usage information
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Database Restore Utility

Usage:
  npm run db:restore <backup-file> [options]

Options:
  --skip-migrations     Skip running migrations after restore
  --init-admin-only    Only initialize admin user (no restore)
  --help, -h           Show this help message

Examples:
  npm run db:restore database/backups/backup_2025-12-12_18-00-00.sql
  npm run db:restore database/backups/initial_backup.sql
  npm run db:restore -- database/backups/backup.sql --skip-migrations
  npm run db:restore -- --init-admin-only

Environment Variables:
  DB_HOST      Database host (default: localhost)
  DB_PORT      Database port (default: 5432)
  DB_NAME      Database name (default: integral_project_hub)
  DB_USER      Database user (default: postgres)
  DB_PASSWORD  Database password
  `);
    process.exit(0);
}

run();
