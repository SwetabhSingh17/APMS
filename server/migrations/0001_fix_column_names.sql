-- Rename timestamp columns to snake_case
ALTER TABLE users RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE users RENAME COLUMN "updatedAt" TO "updated_at";

ALTER TABLE student_groups RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE student_groups RENAME COLUMN "updatedAt" TO "updated_at";

ALTER TABLE project_topics RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE project_topics RENAME COLUMN "updatedAt" TO "updated_at";

ALTER TABLE student_projects RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE student_projects RENAME COLUMN "updatedAt" TO "updated_at";

ALTER TABLE project_assessments RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE project_assessments RENAME COLUMN "updatedAt" TO "updated_at";

ALTER TABLE notifications RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE notifications RENAME COLUMN "updatedAt" TO "updated_at";

-- Add missing updated_at columns if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'users' AND column_name = 'updated_at') THEN
        ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT NOW() NOT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'student_groups' AND column_name = 'updated_at') THEN
        ALTER TABLE student_groups ADD COLUMN updated_at TIMESTAMP DEFAULT NOW() NOT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'project_topics' AND column_name = 'updated_at') THEN
        ALTER TABLE project_topics ADD COLUMN updated_at TIMESTAMP DEFAULT NOW() NOT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'student_projects' AND column_name = 'updated_at') THEN
        ALTER TABLE student_projects ADD COLUMN updated_at TIMESTAMP DEFAULT NOW() NOT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'project_assessments' AND column_name = 'updated_at') THEN
        ALTER TABLE project_assessments ADD COLUMN updated_at TIMESTAMP DEFAULT NOW() NOT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'notifications' AND column_name = 'updated_at') THEN
        ALTER TABLE notifications ADD COLUMN updated_at TIMESTAMP DEFAULT NOW() NOT NULL;
    END IF;
END $$; 