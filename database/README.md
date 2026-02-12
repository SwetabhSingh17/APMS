# Database Management Guide

This guide explains how to manage database backups, restores, and resets for the Integral Project Hub.

## 📦 Backup Operations

### Create Full Backup

Create a complete backup of the database including both schema and data:

```bash
npm run db:backup
```

This creates a timestamped SQL file in `database/backups/` directory.
- **Output**: `database/backups/backup_YYYY-MM-DD_HH-MM-SS.sql`
- **Contains**: Complete database schema + all data
- **Use For**: Regular backups before major changes, production snapshots

### Create Schema-Only Backup

Create a backup of just the database structure (no data):

```bash
npm run db:backup:schema-only
```

- **Output**: `database/backups/backup_schema_YYYY-MM-DD_HH-MM-SS.sql`
- **Contains**: Table definitions, constraints, indexes only
- **Use For**: Fresh installations, template databases

### Custom Backup Filename

```bash
npm run db:backup -- --output=my_custom_backup.sql
```

## 🔄 Restore Operations

### Restore from Backup

Restore the database from a backup file:

```bash
npm run db:restore database/backups/backup_2025-12-12_18-00-00.sql
```

**What happens during restore:**
1. Executes the SQL backup file
2. Initializes admin user if it doesn't exist (username: `admin`, password: `Admin@123`)
3. Runs any pending migrations

**Options:**
```bash
# Skip running migrations after restore
npm run db:restore -- database/backups/backup.sql --skip-migrations

# Only initialize admin user (no backup restore)
npm run db:restore -- --init-admin-only
```

### Setting Up a Fresh Database

To set up a completely new database instance:

```bash
# 1. Create the database
createdb integral_project_hub

# 2. Restore from initial schema backup
npm run db:restore database/backups/initial_backup.sql

# 3. Start the server
npm run dev
```

## 🔴 Reset Operations

### Standard Reset (Preserves Schema)

Clear all data while keeping the database structure intact:

```bash
npm run db:hard-reset -- --preserve-schema
```

**What gets cleared:**
- All users except admin
- All projects, topics, groups, notifications
- All assessments and milestones
- All sessions

**What gets preserved:**
- Database schema/tables
- Admin user (password reset to `Admin@123`)

### Full Reset (Nuclear Option)

⚠️ **WARNING**: This completely clears the database including admin!

```bash
npm run db:hard-reset
```

After a full reset, you'll need to restore from backup or run migrations.

### Reset with Automatic Backup

Create a backup before resetting (recommended):

```bash
npm run db:hard-reset -- --backup-first --preserve-schema
```

This ensures you have a recovery point if needed.

## 🛠️ Common Workflows

### Before Major Updates

```bash
# Create a safety backup
npm run db:backup

# Make your changes...

# If something goes wrong, restore:
npm run db:restore database/backups/backup_YYYY-MM-DD_HH-MM-SS.sql
```

### Testing/Development Reset

```bash
# Clear data but keep structure
npm run db:hard-reset -- --preserve-schema

# Or run the seed script to populate test data
tsx scripts/seed_test_data.ts
```

### Production Backup Schedule

```bash
# Daily backup (add to cron/scheduler)
0 2 * * * cd /path/to/project && npm run db:backup
```

## 🔧 Troubleshooting

### "pg_dump: command not found"

Install PostgreSQL client tools:
```bash
# macOS
brew install postgresql@14

# Linux (Ubuntu/Debian)
sudo apt-get install postgresql-client
```

### "FATAL: password authentication failed"

Ensure your `.env` file has correct database credentials:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=integral_project_hub
DB_USER=postgres
DB_PASSWORD=your_password
```

### "relation does not exist" after restore

Run migrations to ensure schema is up-to-date:
```bash
npm run db:migrate
```

### Backup file too large

Use schema-only backup for version control:
```bash
npm run db:backup:schema-only
```

Then seed with minimal test data rather than full production data.

## 📋 Environment Variables

All database scripts use these environment variables (or defaults):

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | Database server hostname |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `integral_project_hub` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | _(empty)_ | Database password |

## 🔒 Security Notes

- **Never commit backups with real data** to version control
- Add `database/backups/*.sql` to `.gitignore` (except `initial_backup.sql`)
- Store production backups in a secure, encrypted location
- Regularly test your backup restoration process
- Keep backups encrypted when storing off-site

## 📝 Backup Retention Strategy

Recommended retention policy:

- **Daily backups**: Keep for 7 days
- **Weekly backups**: Keep for 4 weeks
- **Monthly backups**: Keep for 12 months
- **Schema backups**: Keep indefinitely (small size)

Example cleanup script (add to cron):
```bash
# Delete backups older than 7 days (except schema-only)
find database/backups -name "backup_*.sql" -type f -mtime +7 -delete
```
