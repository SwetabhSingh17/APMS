CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"assessor_id" integer NOT NULL,
	"marks" integer NOT NULL,
	"feedback" text,
	"assessment_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"due_date" timestamp NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"submitted_by_id" integer NOT NULL,
	"department" text NOT NULL,
	"estimated_complexity" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"feedback" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"collaboration_type" text NOT NULL,
	"faculty_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"max_size" integer DEFAULT 5 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"topic_id" integer NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"department" text NOT NULL,
	"enrollment_number" text,
	"group_id" integer,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assessments" ADD CONSTRAINT "project_assessments_project_id_student_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."student_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assessments" ADD CONSTRAINT "project_assessments_assessor_id_users_id_fk" FOREIGN KEY ("assessor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_id_student_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."student_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_topics" ADD CONSTRAINT "project_topics_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_projects" ADD CONSTRAINT "student_projects_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_projects" ADD CONSTRAINT "student_projects_topic_id_project_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."project_topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_group_id_student_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."student_groups"("id") ON DELETE no action ON UPDATE no action;