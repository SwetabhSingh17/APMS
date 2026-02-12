
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function run() {
    console.log("Patching DB schema...");

    try {
        await db.execute(sql`ALTER TABLE student_groups ADD COLUMN IF NOT EXISTS created_by_id integer REFERENCES users(id)`);
        console.log("Added created_by_id to student_groups");
    } catch (e) { console.log(e); }

    try {
        // Check if existing column exists to rename? No, just add for now.
        await db.execute(sql`ALTER TABLE project_assessments ADD COLUMN IF NOT EXISTS faculty_id integer REFERENCES users(id)`);
        console.log("Added faculty_id to project_assessments");
    } catch (e) { console.log(e); }

    try {
        // This column is causing conflicts (not in schema but in DB with NOT NULL)
        await db.execute(sql`ALTER TABLE student_groups DROP COLUMN IF EXISTS collaboration_type`);
        console.log("Dropped collaboration_type from student_groups");
    } catch (e) { console.log(e); }

    try {
        await db.execute(sql`ALTER TABLE student_group_members ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'`);
        console.log("Added status to student_group_members");
    } catch (e) { console.log(e); }

    process.exit(0);
}

run().catch(console.error);
