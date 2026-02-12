const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Database configuration
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'integral_project_hub',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

// Create a new pool instance
const pool = new Pool(config);

// Function to run migrations
async function runMigrations() {
  const client = await pool.connect();
  try {
    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get all migration files
    const migrationsDir = path.join(process.cwd(), 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    // Get executed migrations
    const { rows: executedMigrations } = await client.query(
      'SELECT name FROM migrations'
    );
    const executedMigrationNames = new Set(executedMigrations.map(m => m.name));

    // Run pending migrations
    for (const file of files) {
      if (!executedMigrationNames.has(file)) {
        const migrationPath = path.join(migrationsDir, file);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        await client.query('BEGIN');
        try {
          await client.query(migrationSQL);
          await client.query(
            'INSERT INTO migrations (name) VALUES ($1)',
            [file]
          );
          await client.query('COMMIT');
          console.log(`Successfully executed migration: ${file}`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }
    }
  } finally {
    client.release();
  }
}

// Export the pool and migration function
module.exports = {
  pool,
  runMigrations,
  config
}; 