import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

// Parse command line arguments
const args = process.argv.slice(2);
const schemaOnly = args.includes('--schema-only');
const outputPath = args.find(arg => arg.startsWith('--output='))?.split('=')[1];

// Get database configuration from environment variables
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || '5432',
  database: process.env.DB_NAME || 'integral_project_hub',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
};

async function createBackup() {
  try {
    console.log('🔄 Creating database backup...');
    console.log(`   Database: ${dbConfig.database}`);
    console.log(`   Mode: ${schemaOnly ? 'Schema Only' : 'Full Backup (Schema + Data)'}`);

    // Create backups directory if it doesn't exist
    const backupsDir = path.join(process.cwd(), 'database', 'backups');
    await fs.mkdir(backupsDir, { recursive: true });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').split('.')[0];
    const filename = outputPath || `backup_${schemaOnly ? 'schema_' : ''}${timestamp}.sql`;
    const filepath = path.join(backupsDir, filename);

    // Build pg_dump command
    const pgDumpCmd = [
      'pg_dump',
      '-h', dbConfig.host,
      '-p', dbConfig.port,
      '-U', dbConfig.user,
      '-d', dbConfig.database,
      schemaOnly ? '--schema-only' : '',
      '--no-owner',
      '--no-acl',
      '-f', filepath
    ].filter(Boolean).join(' ');

    // Set password as environment variable
    const env = { ...process.env, PGPASSWORD: dbConfig.password };

    // Execute pg_dump
    await execAsync(pgDumpCmd, { env });

    // Get file size
    const stats = await fs.stat(filepath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);

    console.log('✅ Backup created successfully!');
    console.log(`   File: ${filepath}`);
    console.log(`   Size: ${fileSizeKB} KB`);
    
    return filepath;
  } catch (error: any) {
    console.error('❌ Backup failed:', error.message);
    if (error.stderr) {
      console.error('   Details:', error.stderr);
    }
    process.exit(1);
  }
}

// Show usage information
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Database Backup Utility

Usage:
  npm run db:backup [options]

Options:
  --schema-only          Create schema-only backup (no data)
  --output=<filename>    Specify custom output filename
  --help, -h            Show this help message

Examples:
  npm run db:backup
  npm run db:backup -- --schema-only
  npm run db:backup -- --output=my_backup.sql

Environment Variables:
  DB_HOST      Database host (default: localhost)
  DB_PORT      Database port (default: 5432)
  DB_NAME      Database name (default: integral_project_hub)
  DB_USER      Database user (default: postgres)
  DB_PASSWORD  Database password
  `);
  process.exit(0);
}

createBackup();
