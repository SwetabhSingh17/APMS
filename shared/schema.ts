/**
 * Shared Database Schema — Integral Project Hub
 *
 * Central definition file for all Drizzle ORM table schemas, Zod validation
 * schemas, and inferred TypeScript types. This module is imported by both the
 * server (for queries) and the client (for type safety and validation).
 *
 * Tables:
 *  - users               — All system users (admin, coordinator, teacher, student)
 *  - studentGroups        — Student project groups with faculty mentors
 *  - studentGroupMembers  — Group membership with invite status tracking
 *  - projectTopics        — Teacher-submitted project topics (pending → approved/rejected)
 *  - studentProjects      — Student ↔ Topic assignments with progress tracking
 *  - projectAssessments   — Faculty evaluations (score + feedback)
 *  - projectMilestones    — Milestone tracking per project
 *  - notifications        — User notification queue
 *  - sessions             — Express session storage
 */
import { pgTable, text, serial, integer, boolean, timestamp, varchar, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Student groups table
export const studentGroups = pgTable("student_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  facultyId: integer("faculty_id"),
  createdById: integer("created_by_id"),
  maxSize: integer("max_size").notNull().default(5),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertStudentGroupSchema = createInsertSchema(studentGroups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull(),
  enrollmentNumber: text("enrollment_number"),
  groupId: integer("group_id").references(() => studentGroups.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Project topics table
export const projectTopics = pgTable("project_topics", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  submittedById: integer("submitted_by_id").references(() => users.id).notNull(),
  technology: text("technology").notNull(),
  projectType: text("project_type").notNull(),
  estimatedComplexity: text("estimated_complexity").notNull().default("Medium"),
  status: text("status").notNull().default("pending"),
  feedback: text("feedback"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProjectTopicSchema = createInsertSchema(projectTopics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  feedback: true,
  status: true,
  estimatedComplexity: true,
});

// Student projects table
export const studentProjects = pgTable("student_projects", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").references(() => users.id).notNull(),
  topicId: integer("topic_id").references(() => projectTopics.id).notNull(),
  progress: integer("progress").notNull().default(0),
  status: text("status").notNull().default("in_progress"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertStudentProjectSchema = createInsertSchema(studentProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  progress: true,
  status: true,
});

// Project assessments table
export const projectAssessments = pgTable("project_assessments", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => studentProjects.id),
  facultyId: integer("faculty_id").references(() => users.id),
  score: integer("score").notNull(),
  feedback: text("feedback"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProjectAssessmentSchema = createInsertSchema(projectAssessments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Notifications table
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  isRead: true,
  createdAt: true,
  updatedAt: true,
});

// Project milestones table
export const projectMilestones = pgTable("project_milestones", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => studentProjects.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: text("status").notNull().default("pending"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProjectMilestoneSchema = createInsertSchema(projectMilestones).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Sessions table
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  data: text("data").notNull(),
  expires: timestamp("expires").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Student group members table
export const studentGroupMembers = pgTable("student_group_members", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  groupId: integer("group_id").notNull().references(() => studentGroups.id),
  status: text("status").notNull().default("pending"), // 'pending' | 'accepted'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type StudentGroupMember = typeof studentGroupMembers.$inferSelect;
export type InsertStudentGroupMember = z.infer<typeof insertStudentGroupMemberSchema>;

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStudentGroupMemberSchema = createInsertSchema(studentGroupMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type ProjectTopic = typeof projectTopics.$inferSelect & {
  submittedBy?: {
    id: number;
    firstName: string;
    lastName: string;
  };
};
export type InsertProjectTopic = z.infer<typeof insertProjectTopicSchema>;

export type StudentProject = typeof studentProjects.$inferSelect & {
  topic?: ProjectTopic;
  student?: User;
  teacher?: User;
};
export type InsertStudentProject = z.infer<typeof insertStudentProjectSchema>;

export type ProjectMilestone = typeof projectMilestones.$inferSelect;
export type InsertProjectMilestone = z.infer<typeof insertProjectMilestoneSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type StudentGroup = typeof studentGroups.$inferSelect;
export type InsertStudentGroup = z.infer<typeof insertStudentGroupSchema>;

export type ProjectAssessment = typeof projectAssessments.$inferSelect;
export type InsertProjectAssessment = z.infer<typeof insertProjectAssessmentSchema>;

export enum UserRole {
  ADMIN = "admin",
  COORDINATOR = "coordinator",
  TEACHER = "teacher",
  STUDENT = "student",
}

export enum CollaborationType {
  INDIVIDUAL = "individual",
  GROUP = "group",
}
