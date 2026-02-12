CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"data" text NOT NULL,
	"expires" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_group_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"group_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_enrollment_number_unique";--> statement-breakpoint
ALTER TABLE "project_assessments" DROP CONSTRAINT "project_assessments_assessor_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "project_assessments" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "project_milestones" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "project_topics" ALTER COLUMN "description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "project_topics" ALTER COLUMN "estimated_complexity" SET DEFAULT 'Medium';--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "title" text NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "is_read" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "project_assessments" ADD COLUMN "faculty_id" integer;--> statement-breakpoint
ALTER TABLE "project_assessments" ADD COLUMN "score" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "project_assessments" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "project_milestones" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_milestones" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "project_milestones" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "project_topics" ADD COLUMN "technology" text NOT NULL;--> statement-breakpoint
ALTER TABLE "project_topics" ADD COLUMN "project_type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "project_topics" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "student_groups" ADD COLUMN "created_by_id" integer;--> statement-breakpoint
ALTER TABLE "student_groups" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "student_projects" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "student_group_members" ADD CONSTRAINT "student_group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_group_members" ADD CONSTRAINT "student_group_members_group_id_student_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."student_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assessments" ADD CONSTRAINT "project_assessments_faculty_id_users_id_fk" FOREIGN KEY ("faculty_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_groups" ADD CONSTRAINT "student_groups_faculty_id_users_id_fk" FOREIGN KEY ("faculty_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_groups" ADD CONSTRAINT "student_groups_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "read";--> statement-breakpoint
ALTER TABLE "project_assessments" DROP COLUMN "assessor_id";--> statement-breakpoint
ALTER TABLE "project_assessments" DROP COLUMN "marks";--> statement-breakpoint
ALTER TABLE "project_assessments" DROP COLUMN "assessment_date";--> statement-breakpoint
ALTER TABLE "project_milestones" DROP COLUMN "completed";--> statement-breakpoint
ALTER TABLE "project_topics" DROP COLUMN "department";--> statement-breakpoint
ALTER TABLE "student_groups" DROP COLUMN "collaboration_type";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "department";