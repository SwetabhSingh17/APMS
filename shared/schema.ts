import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User roles enum
export enum UserRole {
  ADMIN = "admin",
  COORDINATOR = "coordinator",
  TEACHER = "teacher",
  STUDENT = "student"
}

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").$type<UserRole>().notNull(),
  department: text("department").notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

// Project topics table
export const projectTopics = pgTable("project_topics", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  submittedById: integer("submitted_by_id").notNull().references(() => users.id),
  department: text("department").notNull(),
  estimatedComplexity: text("estimated_complexity").notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  feedback: text("feedback"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProjectTopicSchema = createInsertSchema(projectTopics).omit({
  id: true,
  status: true,
  feedback: true,
  createdAt: true,
});

// Student project selection table
export const studentProjects = pgTable("student_projects", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => users.id),
  topicId: integer("topic_id").notNull().references(() => projectTopics.id),
  status: text("status").notNull().default("in_progress"), // in_progress, completed
  progress: integer("progress").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStudentProjectSchema = createInsertSchema(studentProjects).omit({
  id: true,
  status: true,
  progress: true,
  createdAt: true,
});

// Project milestones table
export const projectMilestones = pgTable("project_milestones", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => studentProjects.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  dueDate: timestamp("due_date").notNull(),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProjectMilestoneSchema = createInsertSchema(projectMilestones).omit({
  id: true,
  completed: true,
  createdAt: true,
});

// Notifications table
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  read: true,
  createdAt: true,
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type ProjectTopic = typeof projectTopics.$inferSelect;
export type InsertProjectTopic = z.infer<typeof insertProjectTopicSchema>;

export type StudentProject = typeof studentProjects.$inferSelect;
export type InsertStudentProject = z.infer<typeof insertStudentProjectSchema>;

export type ProjectMilestone = typeof projectMilestones.$inferSelect;
export type InsertProjectMilestone = z.infer<typeof insertProjectMilestoneSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
