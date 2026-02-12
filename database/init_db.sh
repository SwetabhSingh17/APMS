#!/bin/bash

# Database initialization script for Integral Project Hub

# Load environment variables
if [ -f "../.env" ]; then
    export $(cat ../.env | grep -v '^#' | xargs)
fi

# Default values if not set in .env
DB_NAME=${DB_NAME:-integral_project_hub}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-}

# Create database if it doesn't exist
psql -U $DB_USER -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
psql -U $DB_USER -c "CREATE DATABASE $DB_NAME"

# Run migrations
for migration in migrations/*.sql; do
    echo "Running migration: $migration"
    psql -U $DB_USER -d $DB_NAME -f "$migration"
done

echo "Database initialization complete!" 