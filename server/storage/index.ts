import { sql } from "@vercel/postgres";
import { User, ProjectTopic, StudentProject, StudentGroup, ProjectMilestone, ProjectAssessment, Notification, UserRole } from "@shared/schema";
import { IStorage, InsertUser, InsertProjectTopic, InsertStudentProject, InsertStudentGroup, InsertProjectAssessment, InsertNotification } from "./interface";
import { db } from "../db";
import { users, projectTopics, studentProjects, studentGroups, projectAssessments, notifications } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export class Storage implements IStorage {
  private sessions: Map<string, { data: any; expires: number }> = new Map();

  sessionStore = {
    get: async (sid: string) => {
      const session = this.sessions.get(sid);
      if (!session) return null;
      if (session.expires < Date.now()) {
        this.sessions.delete(sid);
        return null;
      }
      return session.data;
    },
    set: async (sid: string, session: any) => {
      this.sessions.set(sid, {
        data: session,
        expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      });
    },
    destroy: async (sid: string) => {
      this.sessions.delete(sid);
    },
  };

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async getUserByEnrollmentNumber(enrollmentNumber: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.enrollmentNumber, enrollmentNumber));
    return result[0] || null;
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return result[0];
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.length > 0;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUserProfile(id: number): Promise<User | undefined> {
    return await this.getUser(id);
  }

  async updateUserProfile(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    return await this.updateUser(id, data);
  }

  // Project topic operations
  async getProjectTopic(id: number): Promise<ProjectTopic | null> {
    const result = await db.select()
      .from(projectTopics)
      .where(eq(projectTopics.id, id))
      .leftJoin(users, eq(projectTopics.submittedById, users.id))
      .execute();

    if (result.length === 0) return null;

    const topic = result[0].project_topics;
    const submitter = result[0].users;

    return {
      ...topic,
      submittedBy: submitter ? {
        id: submitter.id,
        firstName: submitter.firstName,
        lastName: submitter.lastName,
        department: submitter.department
      } : undefined
    };
  }

  async getTopicsByTeacher(teacherId: number): Promise<ProjectTopic[]> {
    const result = await db.select()
      .from(projectTopics)
      .where(eq(projectTopics.submittedById, teacherId))
      .leftJoin(users, eq(projectTopics.submittedById, users.id))
      .execute();

    return result.map(row => ({
      ...row.project_topics,
      submittedBy: row.users ? {
        id: row.users.id,
        firstName: row.users.firstName,
        lastName: row.users.lastName,
        department: row.users.department
      } : undefined
    }));
  }

  async getPendingTopics(): Promise<ProjectTopic[]> {
    const result = await db.select()
      .from(projectTopics)
      .where(eq(projectTopics.status, "pending"))
      .leftJoin(users, eq(projectTopics.submittedById, users.id))
      .execute();

    return result.map(row => ({
      ...row.project_topics,
      submittedBy: row.users ? {
        id: row.users.id,
        firstName: row.users.firstName,
        lastName: row.users.lastName,
        department: row.users.department
      } : undefined
    }));
  }

  async getApprovedTopics(): Promise<ProjectTopic[]> {
    const result = await db.select()
      .from(projectTopics)
      .where(eq(projectTopics.status, "approved"))
      .leftJoin(users, eq(projectTopics.submittedById, users.id))
      .execute();

    return result.map(row => ({
      ...row.project_topics,
      submittedBy: row.users ? {
        id: row.users.id,
        firstName: row.users.firstName,
        lastName: row.users.lastName,
        department: row.users.department
      } : undefined
    }));
  }

  async getRejectedTopics(): Promise<ProjectTopic[]> {
    const result = await db.select()
      .from(projectTopics)
      .where(eq(projectTopics.status, "rejected"))
      .leftJoin(users, eq(projectTopics.submittedById, users.id))
      .execute();

    return result.map(row => ({
      ...row.project_topics,
      submittedBy: row.users ? {
        id: row.users.id,
        firstName: row.users.firstName,
        lastName: row.users.lastName,
        department: row.users.department
      } : undefined
    }));
  }

  async getAllTopics(): Promise<ProjectTopic[]> {
    const result = await sql<ProjectTopic>`SELECT * FROM projectTopics`;
    return result.rows;
  }

  async createProjectTopic(topic: InsertProjectTopic): Promise<ProjectTopic> {
    const result = await db.insert(projectTopics)
      .values({
        ...topic,
        status: "pending",
        feedback: null
      })
      .returning();

    const submitter = await this.getUser(topic.submittedById);
    return {
      ...result[0],
      submittedBy: submitter ? {
        id: submitter.id,
        firstName: submitter.firstName,
        lastName: submitter.lastName,
        department: submitter.department
      } : undefined
    };
  }

  async approveProjectTopic(id: number, feedback?: string): Promise<ProjectTopic | undefined> {
    const result = await db.update(projectTopics)
      .set({ status: "approved", feedback })
      .where(eq(projectTopics.id, id))
      .returning();
    return result[0];
  }

  async rejectProjectTopic(id: number, feedback: string): Promise<ProjectTopic | undefined> {
    const result = await db.update(projectTopics)
      .set({ status: "rejected", feedback })
      .where(eq(projectTopics.id, id))
      .returning();
    return result[0];
  }

  async updateProjectTopic(id: number, data: InsertProjectTopic): Promise<ProjectTopic> {
    const result = await db.update(projectTopics)
      .set(data)
      .where(eq(projectTopics.id, id))
      .returning();
    return result[0];
  }

  async deleteProjectTopic(id: number): Promise<boolean> {
    const result = await sql`DELETE FROM projectTopics WHERE id = ${id}`;
    return result.rowCount > 0;
  }

  // Student project operations
  async getStudentProject(id: number): Promise<StudentProject | undefined> {
    const result = await db.select().from(studentProjects).where(eq(studentProjects.id, id));
    return result[0];
  }

  async getStudentProjects(studentId: number): Promise<StudentProject[]> {
    const result = await db.select()
      .from(studentProjects)
      .where(eq(studentProjects.studentId, studentId))
      .leftJoin(projectTopics, eq(studentProjects.topicId, projectTopics.id))
      .leftJoin(users, eq(projectTopics.submittedById, users.id))
      .execute();

    return Promise.all(result.map(async row => {
      const project = row.student_projects;
      const topic = row.project_topics;
      const teacher = row.users;

      const student = await this.getUser(project.studentId);
      if (!student) throw new Error(`Student not found: ${project.studentId}`);

      return {
        ...project,
        topic: topic ? {
          ...topic,
          submittedBy: teacher ? {
            id: teacher.id,
            firstName: teacher.firstName,
            lastName: teacher.lastName,
            department: teacher.department
          } : undefined
        } : undefined,
        student,
        teacher: teacher || undefined
      };
    }));
  }

  async createStudentProject(project: InsertStudentProject): Promise<StudentProject> {
    const result = await db.insert(studentProjects)
      .values({
        ...project,
        progress: 0,
        status: "in_progress"
      })
      .returning();

    const [topic, student] = await Promise.all([
      this.getProjectTopic(project.topicId),
      this.getUser(project.studentId)
    ]);

    if (!student) throw new Error(`Student not found: ${project.studentId}`);

    return {
      ...result[0],
      topic,
      student,
      teacher: topic?.submittedBy
    };
  }

  async updateStudentProject(id: number, data: Partial<InsertStudentProject>): Promise<StudentProject | undefined> {
    const result = await db.update(studentProjects)
      .set(data)
      .where(eq(studentProjects.id, id))
      .returning();
    return result[0];
  }

  async getAllProjects(): Promise<(StudentProject & { topic: ProjectTopic; student: User; teacher?: User })[]> {
    const projects = await db.select()
      .from(studentProjects)
      .leftJoin(projectTopics, eq(studentProjects.topicId, projectTopics.id))
      .leftJoin(users, eq(studentProjects.studentId, users.id));

    return Promise.all(
      projects.map(async (row) => {
        const project = row.student_projects;
        const topic = row.project_topics;
        const student = row.users;

        if (!topic || !student) {
          throw new Error(`Missing topic or student for project ${project.id}`);
        }

        const teacher = await this.getUser(topic.submittedById);

        return {
          ...project,
          topic: {
            ...topic,
            submittedBy: teacher ? {
              id: teacher.id,
              firstName: teacher.firstName,
              lastName: teacher.lastName,
              department: teacher.department
            } : undefined
          },
          student,
          teacher
        };
      })
    );
  }

  // Student Group operations
  async createStudentGroup(group: InsertStudentGroup): Promise<StudentGroup> {
    const result = await db.insert(studentGroups).values(group).returning();
    return result[0];
  }

  async getGroup(id: number): Promise<StudentGroup | undefined> {
    const result = await sql<StudentGroup>`SELECT * FROM studentGroups WHERE id = ${id}`;
    return result.rows[0];
  }

  async getUserGroup(userId: number): Promise<StudentGroup | undefined> {
    const result = await sql<StudentGroup>`
      SELECT sg.*
      FROM studentGroups sg
      JOIN users u ON u.groupId = sg.id
      WHERE u.id = ${userId}
    `;
    return result.rows[0];
  }

  async getGroupMembers(groupId: number): Promise<User[]> {
    const result = await sql<User>`SELECT * FROM users WHERE groupId = ${groupId}`;
    return result.rows;
  }

  async addStudentToGroup(userId: number, groupId: number): Promise<boolean> {
    const result = await db.update(users)
      .set({ groupId })
      .where(eq(users.id, userId));
    return result.length > 0;
  }

  async removeStudentFromGroup(userId: number, groupId: number): Promise<boolean> {
    const result = await sql`
      UPDATE users
      SET groupId = NULL
      WHERE id = ${userId} AND groupId = ${groupId}
    `;
    return result.rowCount > 0;
  }

  async getUsersByRole(role: UserRole): Promise<User[]> {
    const result = await sql<User>`SELECT * FROM users WHERE role = ${role}`;
    return result.rows;
  }

  // Notification operations
  async getUserNotifications(userId: number): Promise<Notification[]> {
    const result = await sql<Notification>`SELECT * FROM notifications WHERE userId = ${userId}`;
    return result.rows;
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(notification).returning();
    return result[0];
  }

  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const result = await sql<Notification>`
      UPDATE notifications
      SET isRead = true
      WHERE id = ${id}
      RETURNING *
    `;
    return result.rows[0];
  }

  // Project Assessment operations
  async createProjectAssessment(assessment: InsertProjectAssessment): Promise<ProjectAssessment> {
    const result = await db.insert(projectAssessments).values(assessment).returning();
    return result[0];
  }

  async getProjectAssessment(projectId: number, assessorId: number): Promise<ProjectAssessment | undefined> {
    const result = await sql<ProjectAssessment>`
      SELECT * FROM projectAssessments
      WHERE projectId = ${projectId} AND assessorId = ${assessorId}
    `;
    return result.rows[0];
  }

  async updateProjectAssessment(id: number, data: InsertProjectAssessment): Promise<ProjectAssessment> {
    const result = await sql<ProjectAssessment>`
      UPDATE projectAssessments
      SET ${sql(data)}
      WHERE id = ${id}
      RETURNING *
    `;
    return result.rows[0];
  }

  async getProjectAssessments(projectId: number): Promise<ProjectAssessment[]> {
    const result = await sql<ProjectAssessment>`SELECT * FROM projectAssessments WHERE projectId = ${projectId}`;
    return result.rows;
  }

  // Search and report operations
  async searchProjects(criteria: {
    projectName?: string;
    facultyName?: string;
    studentName?: string;
    enrollmentNumber?: string;
    department?: string;
    status?: string;
  }): Promise<(StudentProject & { topic: ProjectTopic; student: User })[]> {
    let query = sql`
      SELECT sp.*, pt.*, u.*
      FROM studentProjects sp
      JOIN projectTopics pt ON sp.topicId = pt.id
      JOIN users u ON sp.studentId = u.id
      WHERE 1=1
    `;

    if (criteria.projectName) {
      query = sql`${query} AND pt.title ILIKE ${`%${criteria.projectName}%`}`;
    }
    if (criteria.facultyName) {
      query = sql`${query} AND pt.submittedById IN (SELECT id FROM users WHERE CONCAT(firstName, ' ', lastName) ILIKE ${`%${criteria.facultyName}%`})`;
    }
    if (criteria.studentName) {
      query = sql`${query} AND CONCAT(u.firstName, ' ', u.lastName) ILIKE ${`%${criteria.studentName}%`}`;
    }
    if (criteria.enrollmentNumber) {
      query = sql`${query} AND u.enrollmentNumber = ${criteria.enrollmentNumber}`;
    }
    if (criteria.department) {
      query = sql`${query} AND u.department = ${criteria.department}`;
    }
    if (criteria.status) {
      query = sql`${query} AND sp.status = ${criteria.status}`;
    }

    const result = await sql<(StudentProject & { topic: ProjectTopic; student: User })>`${query}`;
    return result.rows;
  }

  // Statistics
  async getDepartmentStats(): Promise<Record<string, { progress: number; studentCount: number; projectCount: number }>> {
    const result = await sql`
      SELECT 
        u.department,
        AVG(sp.progress) as progress,
        COUNT(DISTINCT u.id) as studentCount,
        COUNT(DISTINCT sp.id) as projectCount
      FROM users u
      LEFT JOIN studentProjects sp ON u.id = sp.studentId
      WHERE u.role = 'student'
      GROUP BY u.department
    `;

    return result.rows.reduce((acc, row) => {
      acc[row.department] = {
        progress: Number(row.progress) || 0,
        studentCount: Number(row.studentcount),
        projectCount: Number(row.projectcount)
      };
      return acc;
    }, {} as Record<string, { progress: number; studentCount: number; projectCount: number }>);
  }

  // Project milestones
  async getProjectMilestones(projectId: number): Promise<ProjectMilestone[]> {
    const result = await sql<ProjectMilestone>`SELECT * FROM projectMilestones WHERE projectId = ${projectId}`;
    return result.rows;
  }

  async clearExpiredSessions(): Promise<void> {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (session.expires < now) {
        this.sessions.delete(id);
      }
    }
  }
} 