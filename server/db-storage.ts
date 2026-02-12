import { IStorage } from "./storage/interface";
import {
  User, ProjectTopic, StudentProject, StudentGroup, ProjectMilestone, ProjectAssessment, Notification, UserRole,
  InsertUser, InsertProjectTopic, InsertStudentProject, InsertStudentGroup, InsertProjectAssessment, InsertNotification,
  users, projectTopics, studentProjects, studentGroups, projectAssessments, notifications, projectMilestones, studentGroupMembers
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, inArray, not, ne, aliasedTable, SQL } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import session from "express-session";
import { pool } from "./db";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

// Use the exact type that IStorage expects.
const PostgresSessionStore = connectPg(session);

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export class DBStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
    this.initializeDefaultUser();
  }

  private async initializeDefaultUser() {
    try {
      const existingAdmin = await db.select().from(users)
        .where(eq(users.username, 'admin'));

      if (existingAdmin.length === 0) {
        const hashedPassword = await hashPassword("Admin@123");
        await db.insert(users).values({
          username: "admin",
          password: hashedPassword,
          firstName: "Admin",
          lastName: "User",
          email: "admin@example.com",
          role: UserRole.ADMIN,
          enrollmentNumber: null,
          groupId: null
        } as unknown as InsertUser);
      }
    } catch (error) {
      console.error("Failed to create default admin user:", error);
    }
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user as User | undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user as User | undefined;
  }

  async getUserByEnrollmentNumber(enrollmentNumber: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.enrollmentNumber, enrollmentNumber));
    return (user as User) || null;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user as User;
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user as User | undefined;
  }

  async deleteUser(id: number): Promise<boolean> {
    const [deleted] = await db.delete(users).where(eq(users.id, id)).returning();
    return !!deleted;
  }

  async getAllUsers(): Promise<User[]> {
    return (await db.select().from(users)) as User[];
  }

  async getUserProfile(id: number): Promise<User | undefined> {
    return this.getUser(id);
  }

  async updateUserProfile(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    return this.updateUser(id, data);
  }


  // Project topic operations
  async getProjectTopic(id: number): Promise<ProjectTopic | null> {
    const [topic] = await db.select().from(projectTopics).where(eq(projectTopics.id, id));
    if (!topic) return null;

    // Fetch submittedBy details
    const [submitter] = await db.select().from(users).where(eq(users.id, topic.submittedById));
    return { ...(topic as ProjectTopic), submittedBy: submitter as any };
  }

  async getTopicsByTeacher(teacherId: number): Promise<ProjectTopic[]> {
    return (await db.select().from(projectTopics).where(eq(projectTopics.submittedById, teacherId))) as ProjectTopic[];
  }

  async getPendingTopics(): Promise<ProjectTopic[]> {
    const topics = await db.select().from(projectTopics).where(eq(projectTopics.status, "pending"));
    const topicsWithSubmitter = await Promise.all(topics.map(async (topic) => {
      const [submitter] = await db.select().from(users).where(eq(users.id, topic.submittedById));
      return { ...(topic as ProjectTopic), submittedBy: submitter as any };
    }));
    return topicsWithSubmitter;
  }

  async getApprovedTopics(): Promise<ProjectTopic[]> {
    const topics = await db.select().from(projectTopics).where(eq(projectTopics.status, "approved"));

    const allottedTopicIds = (await db.select({ topicId: studentProjects.topicId }).from(studentProjects)).map(p => p.topicId);

    const topicsWithExtra = await Promise.all(topics.map(async (topic) => {
      const [submitter] = await db.select().from(users).where(eq(users.id, topic.submittedById));
      // We cast to any to attach isAllotted which is used by frontend but not in strict ProjectTopic schema
      return { ...(topic as ProjectTopic), submittedBy: submitter as any, isAllotted: allottedTopicIds.includes(topic.id) } as any as ProjectTopic;
    }));

    return topicsWithExtra;
  }

  async getRejectedTopics(): Promise<ProjectTopic[]> {
    return (await db.select().from(projectTopics).where(eq(projectTopics.status, "rejected"))) as ProjectTopic[];
  }

  async getAllTopics(): Promise<ProjectTopic[]> {
    return (await db.select().from(projectTopics)) as ProjectTopic[];
  }

  async createProjectTopic(topic: InsertProjectTopic): Promise<ProjectTopic> {
    const [newTopic] = await db.insert(projectTopics).values(topic).returning();
    return newTopic as ProjectTopic;
  }

  async approveProjectTopic(id: number, feedback?: string): Promise<ProjectTopic | undefined> {
    const [topic] = await db.update(projectTopics)
      .set({ status: "approved", feedback })
      .where(eq(projectTopics.id, id))
      .returning();
    return topic as ProjectTopic | undefined;
  }

  async rejectProjectTopic(id: number, feedback: string): Promise<ProjectTopic | undefined> {
    const [topic] = await db.update(projectTopics)
      .set({ status: "rejected", feedback })
      .where(eq(projectTopics.id, id))
      .returning();
    return topic as ProjectTopic | undefined;
  }

  async updateProjectTopic(id: number, data: InsertProjectTopic): Promise<ProjectTopic> {
    const [topic] = await db.update(projectTopics).set(data).where(eq(projectTopics.id, id)).returning();
    return topic as ProjectTopic;
  }

  async deleteProjectTopic(id: number): Promise<boolean> {
    const [deleted] = await db.delete(projectTopics).where(eq(projectTopics.id, id)).returning();
    return !!deleted;
  }


  // Student project operations
  async getStudentProject(id: number): Promise<StudentProject | undefined> {
    const [project] = await db.select().from(studentProjects).where(eq(studentProjects.id, id));
    return project as StudentProject | undefined;
  }

  async getStudentProjects(studentId: number): Promise<(StudentProject & { topic: ProjectTopic | null })[]> {
    const projects = await db.select().from(studentProjects).where(eq(studentProjects.studentId, studentId));

    const detailedProjects = await Promise.all(projects.map(async (p) => {
      const [topic] = await db.select().from(projectTopics).where(eq(projectTopics.id, p.topicId));
      if (topic) {
        const [submitter] = await db.select().from(users).where(eq(users.id, topic.submittedById));
        (topic as any).submittedBy = submitter;
      }
      return { ...(p as StudentProject), topic: (topic as ProjectTopic) || null };
    }));
    return detailedProjects;
  }

  async createStudentProject(project: InsertStudentProject): Promise<StudentProject> {
    // Note: progress is not in InsertStudentProject, it defaults to 0 in DB.
    const [newProject] = await db.insert(studentProjects).values(project).returning();
    return newProject as StudentProject;
  }

  async updateStudentProject(id: number, data: Partial<InsertStudentProject>): Promise<StudentProject | undefined> {
    const [project] = await db.update(studentProjects).set(data).where(eq(studentProjects.id, id)).returning();
    return project as StudentProject | undefined;
  }

  async getAllProjects(): Promise<(StudentProject & { topic: ProjectTopic; student: User })[]> {
    const projects = await db.select().from(studentProjects);

    const detailed = await Promise.all(projects.map(async (p) => {
      const [topic] = await db.select().from(projectTopics).where(eq(projectTopics.id, p.topicId));
      const [student] = await db.select().from(users).where(eq(users.id, p.studentId));
      // Provide default submitter if missing (should not happen if data integrity held)
      let submitter: User | undefined;
      if (topic) {
        [submitter] = await db.select().from(users).where(eq(users.id, topic.submittedById));
      }

      return {
        ...(p as StudentProject),
        student: student as User,
        topic: { ...(topic as ProjectTopic), submittedBy: submitter }
      };
    }));

    return detailed as (StudentProject & { topic: ProjectTopic; student: User })[];
  }

  async isTopicAllotted(topicId: number): Promise<boolean> {
    const [project] = await db.select().from(studentProjects).where(eq(studentProjects.topicId, topicId)).limit(1);
    return !!project;
  }


  // Student Group operations
  async createStudentGroup(group: InsertStudentGroup, creatorId: number, invitedEnrollmentNumbers: string[]): Promise<StudentGroup> {
    const [newGroup] = await db.insert(studentGroups).values({
      ...group,
      createdById: creatorId
    }).returning();

    // Add creator as accepted member
    await db.insert(studentGroupMembers).values({
      userId: creatorId,
      groupId: newGroup.id,
      status: 'accepted'
    });

    // Update creator's groupId in users table
    await db.update(users).set({ groupId: newGroup.id }).where(eq(users.id, creatorId));

    // Handle invites
    if (invitedEnrollmentNumbers.length > 0) {
      const invitedUsers = await db.select().from(users).where(inArray(users.enrollmentNumber, invitedEnrollmentNumbers));

      for (const invitedUser of invitedUsers) {
        if (invitedUser.id !== creatorId) {
          // Add as pending member
          await db.insert(studentGroupMembers).values({
            userId: invitedUser.id,
            groupId: newGroup.id,
            status: 'pending'
          });
          // Update user's groupId
          await db.update(users).set({ groupId: newGroup.id }).where(eq(users.id, invitedUser.id));

          // Create notification
          await this.createNotification({
            userId: invitedUser.id,
            title: "Group Invitation",
            message: `You have been invited to join group "${newGroup.name}".`
          });
        }
      }
    }

    return newGroup as StudentGroup;
  }

  async getGroup(id: number): Promise<StudentGroup | undefined> {
    const [group] = await db.select().from(studentGroups).where(eq(studentGroups.id, id));
    return group as StudentGroup | undefined;
  }

  async getUserGroup(userId: number): Promise<StudentGroup | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || !user.groupId) return undefined;

    return this.getGroup(user.groupId);
  }

  async getStudentGroupMembers(groupId: number): Promise<User[]> {
    const members = await db.select({ user: users })
      .from(studentGroupMembers)
      .innerJoin(users, eq(studentGroupMembers.userId, users.id))
      .where(eq(studentGroupMembers.groupId, groupId));

    return members.map(m => m.user as User);
  }

  async getAcceptedGroupMembers(groupId: number): Promise<User[]> {
    const members = await db.select({ user: users })
      .from(studentGroupMembers)
      .innerJoin(users, eq(studentGroupMembers.userId, users.id))
      .where(and(
        eq(studentGroupMembers.groupId, groupId),
        eq(studentGroupMembers.status, 'accepted')
      ));
    return members.map(m => m.user as User);
  }

  async getUserGroupMembership(userId: number): Promise<{ group: StudentGroup, status: string } | undefined> {
    const [membership] = await db.select()
      .from(studentGroupMembers)
      .where(eq(studentGroupMembers.userId, userId));

    if (!membership) return undefined;

    const group = await this.getGroup(membership.groupId);
    if (!group) return undefined;

    return { group: group as StudentGroup, status: membership.status };
  }

  async addStudentToGroup(userId: number, groupId: number): Promise<boolean> {
    await db.insert(studentGroupMembers).values({
      userId,
      groupId,
      status: 'accepted'
    });
    await db.update(users).set({ groupId }).where(eq(users.id, userId));
    return true;
  }

  async removeStudentFromGroup(userId: number, groupId: number): Promise<boolean> {
    await db.delete(studentGroupMembers)
      .where(and(eq(studentGroupMembers.userId, userId), eq(studentGroupMembers.groupId, groupId)));
    await db.update(users).set({ groupId: null }).where(eq(users.id, userId));
    return true;
  }

  async acceptGroupInvite(userId: number, groupId: number): Promise<boolean> {
    await db.update(studentGroupMembers)
      .set({ status: 'accepted' })
      .where(and(eq(studentGroupMembers.userId, userId), eq(studentGroupMembers.groupId, groupId)));
    return true;
  }

  async rejectGroupInvite(userId: number, groupId: number): Promise<boolean> {
    await this.removeStudentFromGroup(userId, groupId);
    return true;
  }

  async getUsersByRole(role: UserRole): Promise<User[]> {
    return (await db.select().from(users).where(eq(users.role, role))) as User[];
  }


  // Notification operations
  async getUserNotifications(userId: number): Promise<Notification[]> {
    return (await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt))) as Notification[];
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [n] = await db.insert(notifications).values(notification).returning();
    return n as Notification;
  }

  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const [n] = await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id)).returning();
    return n as Notification;
  }


  // Project Assessment operations
  async createProjectAssessment(assessment: InsertProjectAssessment): Promise<ProjectAssessment> {
    const [pa] = await db.insert(projectAssessments).values(assessment).returning();
    return pa as ProjectAssessment;
  }

  async getProjectAssessment(projectId: number, facultyId: number): Promise<ProjectAssessment | undefined> {
    const [pa] = await db.select().from(projectAssessments)
      .where(and(eq(projectAssessments.projectId, projectId), eq(projectAssessments.facultyId, facultyId)));
    return pa as ProjectAssessment | undefined;
  }

  async updateProjectAssessment(id: number, data: InsertProjectAssessment): Promise<ProjectAssessment> {
    const [pa] = await db.update(projectAssessments)
      .set(data)
      .where(eq(projectAssessments.id, id))
      .returning();
    return pa as ProjectAssessment;
  }

  async getProjectAssessments(projectId: number): Promise<ProjectAssessment[]> {
    return (await db.select().from(projectAssessments).where(eq(projectAssessments.projectId, projectId))) as ProjectAssessment[];
  }


  // Search and report operations
  async searchProjects(criteria: {
    projectName?: string;
    facultyName?: string;
    studentName?: string;
    enrollmentNumber?: string;
    department?: string;
    status?: string;
  }): Promise<(StudentProject & { topic: ProjectTopic, student: User })[]> {
    const allProjects = await this.getAllProjects();

    return allProjects.filter(p => {
      if (criteria.projectName && !p.topic.title.toLowerCase().includes(criteria.projectName.toLowerCase())) return false;
      if (criteria.studentName && !(p.student.firstName + ' ' + p.student.lastName).toLowerCase().includes(criteria.studentName.toLowerCase())) return false;
      if (criteria.enrollmentNumber && p.student.enrollmentNumber && !p.student.enrollmentNumber.includes(criteria.enrollmentNumber)) return false;
      // if (criteria.department && p.student.department !== criteria.department) return false;
      if (criteria.status && p.status !== criteria.status) return false;
      return true;
    });
  }

  // Statistics
  async getDepartmentStats(): Promise<Record<string, { progress: number, studentCount: number, projectCount: number }>> {
    const projects = await this.getAllProjects();
    const stats: Record<string, { progress: number, studentCount: number, projectCount: number }> = {};

    for (const p of projects) {
      const dept = 'General';
      if (!stats[dept]) stats[dept] = { progress: 0, studentCount: 0, projectCount: 0 };

      stats[dept].projectCount++;
      stats[dept].progress += p.progress || 0;
      stats[dept].studentCount++; // Approximate
    }

    for (const dept in stats) {
      stats[dept].progress = Math.round(stats[dept].progress / (stats[dept].projectCount || 1));
    }
    return stats;
  }

  async getProjectMilestones(projectId: number): Promise<ProjectMilestone[]> {
    return (await db.select().from(projectMilestones).where(eq(projectMilestones.projectId, projectId))) as ProjectMilestone[];
  }

  // Admin operations
  async exportData(): Promise<any> {
    const usersData = await db.select().from(users);
    const topicsData = await db.select().from(projectTopics);
    const projectsData = await db.select().from(studentProjects);
    const groupsData = await db.select().from(studentGroups);
    const groupMembersData = await db.select().from(studentGroupMembers);

    return {
      users: usersData,
      projectTopics: topicsData,
      studentProjects: projectsData,
      studentGroups: groupsData,
      studentGroupMembers: groupMembersData,
      timestamp: new Date().toISOString()
    };
  }

  async resetDatabase(): Promise<boolean> {
    await db.delete(projectAssessments);
    await db.delete(projectMilestones);
    await db.delete(studentProjects);
    await db.delete(studentGroupMembers);

    // Break circular dependency: Users -> Groups -> Users
    await db.update(users).set({ groupId: null });

    await db.delete(studentGroups);
    await db.delete(projectTopics);
    await db.delete(notifications);

    // Clear sessions to prevent stale cookies
    try {
      await db.execute(sql`TRUNCATE TABLE "session"`);
    } catch (e) {
      // Ignore if session table doesn't exist or is named differently
      console.log("Session truncation failed (non-critical):", e);
    }

    // Delete non-admin users
    await db.delete(users).where(ne(users.role, UserRole.ADMIN));

    // Reset Admin password to default
    const defaultPasswordHash = await hashPassword("Admin@123");
    await db.update(users)
      .set({ password: defaultPasswordHash })
      .where(eq(users.role, UserRole.ADMIN));

    return true;
  }

  async importData(data: any): Promise<boolean> {
    try {
      // First, clear existing data (except admin user)
      await this.resetDatabase();

      // Import users (skip admin since it exists)
      if (data.users && Array.isArray(data.users)) {
        for (const user of data.users) {
          if (user.role !== UserRole.ADMIN) {
            try {
              await db.insert(users).values(user).onConflictDoNothing();
            } catch (err) {
              console.error("Failed to insert user:", user.id, err);
            }
          }
        }
      }

      // Import student groups
      if (data.studentGroups && Array.isArray(data.studentGroups)) {
        for (const group of data.studentGroups) {
          try {
            await db.insert(studentGroups).values(group).onConflictDoNothing();
          } catch (err) {
            console.error("Failed to insert group:", group.id, err);
          }
        }
      }

      // Import student group members
      if (data.studentGroupMembers && Array.isArray(data.studentGroupMembers)) {
        for (const member of data.studentGroupMembers) {
          try {
            await db.insert(studentGroupMembers).values(member).onConflictDoNothing();
          } catch (err) {
            console.error("Failed to insert group member:", err);
          }
        }
      }

      // Import project topics
      if (data.projectTopics && Array.isArray(data.projectTopics)) {
        for (const topic of data.projectTopics) {
          try {
            await db.insert(projectTopics).values(topic).onConflictDoNothing();
          } catch (err) {
            console.error("Failed to insert topic:", topic.id, err);
          }
        }
      }

      // Import student projects
      if (data.studentProjects && Array.isArray(data.studentProjects)) {
        for (const project of data.studentProjects) {
          try {
            await db.insert(studentProjects).values(project).onConflictDoNothing();
          } catch (err) {
            console.error("Failed to insert project:", project.id, err);
          }
        }
      }

      return true;
    } catch (error) {
      console.error("Import failed:", error);
      throw error;
    }
  }

  async generateExcelReport(): Promise<any[]> {
    const projects = await this.getAllProjects();

    const reportData = await Promise.all(projects.map(async (project) => {
      // Get assessments for this project
      const assessments = await this.getProjectAssessments(project.id);

      // Get group information
      let groupInfo = "Individual";
      if (project.student.groupId) {
        const group = await this.getGroup(project.student.groupId);
        const members = await this.getAcceptedGroupMembers(project.student.groupId);
        groupInfo = `${group?.name || 'N/A'} (${members.length} members)`;
      }

      // Calculate average marks
      const totalMarks = assessments.reduce((sum, a) => sum + (a.score || 0), 0);
      const avgMarks = assessments.length > 0 ? (totalMarks / assessments.length).toFixed(2) : 'N/A';

      // Get faculty who assessed
      const facultyNames = assessments.length > 0
        ? await Promise.all(assessments.map(async (a) => {
          if (!a.facultyId) return 'Not Assigned';
          const faculty = await this.getUser(a.facultyId);
          return `${faculty?.firstName} ${faculty?.lastName}`;
        }))
        : ['Not Assigned'];

      return {
        'Student Name': `${project.student.firstName} ${project.student.lastName}`,
        'Enrollment Number': project.student.enrollmentNumber || 'N/A',
        'Email': project.student.email,
        'Group Details': groupInfo,
        'Project Title': project.topic.title,
        'Project Type': project.topic.projectType || 'N/A',
        'Technology': project.topic.technology,
        'Progress (%)': project.progress,
        'Status': project.status || 'In Progress',
        'Average Marks': avgMarks,
        'Faculty Assigned': facultyNames.join(', '),
        'Submission Status': project.progress >= 100 ? 'Completed' : project.progress >= 75 ? 'On Track' : 'At Risk',
      };
    }));

    return reportData;
  }
}


export const storage = new DBStorage();