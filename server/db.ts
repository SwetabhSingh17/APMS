import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from '@shared/schema';
import pg from 'pg';
const { Pool } = pg;

// Get database configuration from environment variables
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'integral_project_hub',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
};

// Construct database URL
const databaseUrl = `postgres://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;

// Initialize postgres client for Drizzle
const client = postgres(databaseUrl);
export const db = drizzle(client, { schema });

// Initialize pg Pool for session store
export const pool = new Pool(dbConfig);

// Run migrations
export async function runMigrations() {
  try {
    await migrate(db, { migrationsFolder: './migrations' });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  }
}