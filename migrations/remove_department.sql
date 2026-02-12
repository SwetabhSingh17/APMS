-- Migration: Remove department column from users table and add projectType/score columns
ALTER TABLE users DROP COLUMN IF EXISTS department;
ALTER TABLE project_topics ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'General';
ALTER TABLE project_assessments ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0;
