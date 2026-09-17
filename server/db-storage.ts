// Storage implementation
import {
  User, ProjectTopic, StudentProject, StudentGroup, ProjectMilestone, ProjectAssessment, Notification, UserRole,
  InsertUser, InsertProjectTopic, InsertStudentProject, InsertStudentGroup, InsertProjectAssessment, InsertNotification,
  users, projectTopics, studentProjects, studentGroups, projectAssessments, notifications, projectMilestones, studentGroupMembers,
  IStudentOnboardingRow, IOnboardingResult, IOnboardingProgress,
  ISupervisorOnboardingRow, ISupervisorOnboardingResult,
  ITopicOnboardingRow, ITopicOnboardingResult, ITopicOnboardingSuccessRecord, ITopicOnboardingFailureRecord
} from "@shared/schema";
import { db } from "./db";
import { notifyUser, disconnectAllClients } from "./websocket";
import { eq, and, or, asc, desc, sql, inArray, not, ne, aliasedTable, SQL, like, isNotNull } from "drizzle-orm";
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

export class DBStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
    this.sessionStore.on('error', (err: any) => {
      console.error('Session store error:', err?.message || err);
    });
    // Removed synchronous initialization to prevent crashes if DB tables are missing.
    // It will be called explicitly during server startup.
  }

  public async initializeDefaultUser(): Promise<boolean> {
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
        console.log("✅ Default admin user successfully created.");
      }
      return true;
    } catch (error: any) {
      if (error?.code === '42P01') {
        console.error("⚠️ Schema 'users' does not exist. Please run 'npm run db:setup' to prepare your database.");
      } else {
        console.error("❌ Failed to create default admin user:", error.message || error);
      }
      return false;
    }
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user as User | undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(and(eq(users.username, username), eq(users.isDeleted, false)));
    return user as User | undefined;
  }

  async getUserByEnrollmentNumber(enrollmentNumber: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(and(eq(users.enrollmentNumber, enrollmentNumber), eq(users.isDeleted, false)));
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
    const [deleted] = await db.update(users).set({ isDeleted: true }).where(eq(users.id, id)).returning();
    return !!deleted;
  }

  async getAllUsers(course?: string): Promise<User[]> {
    if (course) {
      const normalizedCourse = course.trim().toUpperCase();
      return (await db.select().from(users).where(
        and(
          eq(users.isDeleted, false),
          or(
            eq(sql`UPPER(${users.course})`, normalizedCourse),
            eq(users.role, UserRole.ADMIN),
            eq(users.role, UserRole.SUPERVISOR),
            eq(users.role, UserRole.COORDINATOR)
          )
        )
      ).orderBy(asc(users.id))) as User[];
    }
    return (await db.select().from(users).where(eq(users.isDeleted, false)).orderBy(asc(users.id))) as User[];
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

  async getTopicsBySupervisor(supervisorId: number): Promise<ProjectTopic[]> {
    return (await db.select().from(projectTopics).where(eq(projectTopics.submittedById, supervisorId))) as ProjectTopic[];
  }

  async getTopicsForSupervisorApproval(supervisorId: number): Promise<ProjectTopic[]> {
    const rows = await db.select({
      topic: projectTopics,
      submitter: users,
      group: studentGroups
    })
    .from(projectTopics)
    .innerJoin(users, eq(projectTopics.submittedById, users.id))
    .innerJoin(studentGroups, eq(users.groupId, studentGroups.id))
    .where(and(
       eq(projectTopics.status, "pending_supervisor"), 
       eq(projectTopics.isDeleted, false),
       eq(studentGroups.supervisorId, supervisorId)
    ));

    return rows.map(r => ({
      ...r.topic,
      submittedBy: r.submitter as any,
      groupName: r.group.name
    })) as ProjectTopic[];
  }

  async getPendingTopics(): Promise<ProjectTopic[]> {
    const rows = await db.select({
      topic: projectTopics,
      submitter: users,
    })
    .from(projectTopics)
    .innerJoin(users, eq(projectTopics.submittedById, users.id))
    .where(and(eq(projectTopics.status, "pending"), eq(projectTopics.isDeleted, false)));

    return rows.map(r => ({
      ...r.topic,
      submittedBy: r.submitter as any
    }));
  }

  async getApprovedTopics(): Promise<ProjectTopic[]> {
    const rows = await db.select({
      topic: projectTopics,
      submitter: users,
    })
    .from(projectTopics)
    .innerJoin(users, eq(projectTopics.submittedById, users.id))
    .where(and(eq(projectTopics.status, "approved"), eq(projectTopics.isDeleted, false)));

    const allottedTopicIds = (await db.select({ topicId: studentProjects.topicId }).from(studentProjects)).map(p => p.topicId);

    return rows.map(r => ({
      ...r.topic,
      submittedBy: r.submitter as any,
      isAllotted: allottedTopicIds.includes(r.topic.id)
    } as any as ProjectTopic));
  }

  async getRejectedTopics(): Promise<ProjectTopic[]> {
    return (await db.select().from(projectTopics).where(and(eq(projectTopics.status, "rejected"), eq(projectTopics.isDeleted, false)))) as ProjectTopic[];
  }

  async getAllTopics(): Promise<ProjectTopic[]> {
    return (await db.select().from(projectTopics).where(eq(projectTopics.isDeleted, false))) as ProjectTopic[];
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

    if (topic) {
      // Notify the supervisor who submitted it
      await this.createNotification({
        userId: topic.submittedById,
        title: "Topic Approved",
        message: `Your topic "${topic.title}" has been approved.`
      });

      // Notify all admins
      const admins = await this.getUsersByRole("admin" as any);
      for (const admin of admins) {
        await this.createNotification({
          userId: admin.id,
          title: "Topic Approved by Coordinator/Admin",
          message: `Topic "${topic.title}" was approved.`
        });
      }
    }

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

  async updateProjectTopicStatus(id: number, status: string, feedback?: string): Promise<ProjectTopic> {
    const [topic] = await db.update(projectTopics)
      .set({ status, feedback })
      .where(eq(projectTopics.id, id))
      .returning();
    return topic as ProjectTopic;
  }

  async deleteProjectTopic(id: number): Promise<boolean> {
    const [deleted] = await db.update(projectTopics).set({ isDeleted: true }).where(eq(projectTopics.id, id)).returning();
    return !!deleted;
  }


  // Student project operations
  async getStudentProject(id: number): Promise<StudentProject | undefined> {
    const [project] = await db.select().from(studentProjects).where(eq(studentProjects.id, id));
    return project as StudentProject | undefined;
  }

  async getStudentProjects(studentId: number): Promise<(StudentProject & { topic: ProjectTopic | null })[]> {
    const rows = await db.select({
      project: studentProjects,
      topic: projectTopics,
      submitter: users
    })
    .from(studentProjects)
    .leftJoin(projectTopics, eq(studentProjects.topicId, projectTopics.id))
    .leftJoin(users, eq(projectTopics.submittedById, users.id))
    .where(eq(studentProjects.studentId, studentId));

    return rows.map(r => {
      let topic = null;
      if (r.topic) {
        topic = {
          ...r.topic,
          submittedBy: r.submitter || undefined
        } as ProjectTopic;
      }
      return {
        ...r.project,
        topic
      } as StudentProject & { topic: ProjectTopic | null };
    });
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

  async getAllProjects(course?: string): Promise<(StudentProject & { topic: ProjectTopic; student: User; supervisor?: User })[]> {
    const rows = await db.select({
      project: studentProjects,
      topic: projectTopics,
      student: users
    })
    .from(studentProjects)
    .innerJoin(projectTopics, eq(studentProjects.topicId, projectTopics.id))
    .innerJoin(users, eq(studentProjects.studentId, users.id))
    .where(course ? eq(projectTopics.course, course) : undefined);

    const submitterIds = Array.from(new Set(rows.map(r => r.topic.submittedById).filter(id => id != null) as number[]));

    const studentUserIds = rows.map(r => r.student.id);
    let groupSupervisorMap = new Map<number, number | null>();
    if (studentUserIds.length > 0) {
      const memberships = await db.select({
        studentId: studentGroupMembers.userId,
        supervisorId: studentGroups.supervisorId
      })
      .from(studentGroupMembers)
      .innerJoin(studentGroups, eq(studentGroupMembers.groupId, studentGroups.id))
      .where(and(
        inArray(studentGroupMembers.userId, studentUserIds),
        eq(studentGroupMembers.status, "accepted")
      ));
      memberships.forEach(m => groupSupervisorMap.set(m.studentId, m.supervisorId));
    }

    const groupSupervisorIds = Array.from(new Set(Array.from(groupSupervisorMap.values()).filter(id => id != null) as number[]));
    const allFacultyIds = Array.from(new Set([...submitterIds, ...groupSupervisorIds]));

    let allFaculty: User[] = [];
    if (allFacultyIds.length > 0) {
      allFaculty = await db.select().from(users).where(inArray(users.id, allFacultyIds));
    }
    const facultyMap = new Map(allFaculty.map(s => [s.id, s]));

    return rows.map(r => {
      const groupSupId = groupSupervisorMap.get(r.student.id);
      const supervisor = (groupSupId ? facultyMap.get(groupSupId) : undefined) ||
                         (r.topic.submittedById ? facultyMap.get(r.topic.submittedById) : undefined);
      return {
        ...(r.project as StudentProject),
        student: r.student as User,
        supervisor,
        topic: {
          ...(r.topic as ProjectTopic),
          submittedBy: r.topic.submittedById ? facultyMap.get(r.topic.submittedById) : undefined
        }
      };
    });
  }

  async isTopicAllotted(topicId: number): Promise<boolean> {
    const [project] = await db.select().from(studentProjects).where(eq(studentProjects.topicId, topicId)).limit(1);
    return !!project;
  }

  /**
   * Fetches all topics submitted by a supervisor, enriched with team details
   * for topics that have been picked by students.
   * Returns each topic with its allotment status and the team that picked it.
   */
  async getSupervisorTopicsWithTeams(supervisorId: number): Promise<{
    id: number;
    topic: ProjectTopic;
    isPicked: boolean;
    team?: {
      groupId: number;
      groupName: string;
      projectTeamId: string | null;
      course: string | null;
      members: { id: number; firstName: string; lastName: string; enrollmentNumber: string | null; email: string }[];
      progress: number;
    };
  }[]> {
    // Step 1: Fetch all topics submitted by this supervisor
    const supervisorTopics = await db.select()
      .from(projectTopics)
      .where(and(
        eq(projectTopics.submittedById, supervisorId),
        eq(projectTopics.isDeleted, false)
      ))
      .orderBy(desc(projectTopics.createdAt));

    if (supervisorTopics.length === 0) return [];

    const topicIds = supervisorTopics.map(t => t.id);

    // Step 2: Find all student_projects linked to these topics
    const projectRows = await db.select({
      project: studentProjects,
      studentId: studentProjects.studentId,
      topicId: studentProjects.topicId,
    })
    .from(studentProjects)
    .where(inArray(studentProjects.topicId, topicIds));

    // Step 3: Group projects by topicId and collect student IDs
    const topicProjectMap = new Map<number, { studentIds: number[]; progress: number }>();
    for (const row of projectRows) {
      const existing = topicProjectMap.get(row.topicId);
      if (existing) {
        existing.studentIds.push(row.studentId);
        // Average progress across team members
        existing.progress = Math.round((existing.progress + row.project.progress) / 2);
      } else {
        topicProjectMap.set(row.topicId, {
          studentIds: [row.studentId],
          progress: row.project.progress,
        });
      }
    }

    // Step 4: For picked topics, resolve the team (group) via student_group_members
    const allStudentIds = Array.from(new Set(projectRows.map(r => r.studentId)));

    // Map each student to their group
    let studentGroupMap = new Map<number, number>();
    if (allStudentIds.length > 0) {
      const memberships = await db.select({
        studentId: studentGroupMembers.userId,
        groupId: studentGroupMembers.groupId,
      })
      .from(studentGroupMembers)
      .where(and(
        inArray(studentGroupMembers.userId, allStudentIds),
        eq(studentGroupMembers.status, "accepted")
      ));
      memberships.forEach(m => studentGroupMap.set(m.studentId, m.groupId));
    }

    // Step 5: Fetch all relevant groups
    const groupIds = Array.from(new Set(Array.from(studentGroupMap.values())));
    let groupMap = new Map<number, { group: StudentGroup; members: User[] }>();
    if (groupIds.length > 0) {
      const groups = await db.select().from(studentGroups).where(inArray(studentGroups.id, groupIds));

      // Fetch all members for these groups
      const allMembers = await db.select({
        groupId: studentGroupMembers.groupId,
        user: users,
      })
      .from(studentGroupMembers)
      .innerJoin(users, eq(studentGroupMembers.userId, users.id))
      .where(and(
        inArray(studentGroupMembers.groupId, groupIds),
        eq(studentGroupMembers.status, "accepted")
      ));

      for (const g of groups) {
        const members = allMembers
          .filter(m => m.groupId === g.id)
          .map(m => m.user as User);
        groupMap.set(g.id, { group: g as StudentGroup, members });
      }
    }

    // Step 6: Assemble the result
    return supervisorTopics.map(topic => {
      const projectData = topicProjectMap.get(topic.id);
      const isPicked = !!projectData;

      if (!isPicked) {
        return { id: topic.id, topic: topic as ProjectTopic, isPicked: false };
      }

      // Find the group for this topic's students
      const firstStudentId = projectData.studentIds[0];
      const groupId = studentGroupMap.get(firstStudentId);
      const groupData = groupId ? groupMap.get(groupId) : undefined;

      return {
        id: topic.id,
        topic: topic as ProjectTopic,
        isPicked: true,
        team: groupData ? {
          groupId: groupData.group.id,
          groupName: groupData.group.name,
          projectTeamId: groupData.group.projectTeamId,
          course: groupData.group.course,
          members: groupData.members.map(m => ({
            id: m.id,
            firstName: m.firstName,
            lastName: m.lastName,
            enrollmentNumber: m.enrollmentNumber,
            email: m.email,
          })),
          progress: projectData.progress,
        } : {
          // Fallback: individual student without a group
          groupId: 0,
          groupName: "Individual Assignment",
          projectTeamId: null,
          course: null,
          members: [],
          progress: projectData.progress,
        },
      };
    });
  }


  // Student Group operations
  async createStudentGroup(group: InsertStudentGroup, creatorId: number, invitedEnrollmentNumbers: string[], autoAccept: boolean = false): Promise<StudentGroup> {
    const [newGroup] = await db.insert(studentGroups).values({
      ...group,
      createdById: creatorId
    }).returning();

    const creator = await this.getUser(creatorId);
    const isStudent = creator?.role === UserRole.STUDENT;

    // Add creator as accepted member only if they are a student
    if (isStudent) {
      await db.insert(studentGroupMembers).values({
        userId: creatorId,
        groupId: newGroup.id,
        status: 'accepted'
      });

      // Update creator's groupId in users table
      await db.update(users).set({ groupId: newGroup.id }).where(eq(users.id, creatorId));
    }

    // Handle invites
    if (invitedEnrollmentNumbers.length > 0) {
      const invitedUsers = await db.select().from(users).where(inArray(users.enrollmentNumber, invitedEnrollmentNumbers));

      for (const invitedUser of invitedUsers) {
        if (invitedUser.id !== creatorId) {
          // Add as pending or accepted member
          await db.insert(studentGroupMembers).values({
            userId: invitedUser.id,
            groupId: newGroup.id,
            status: autoAccept ? 'accepted' : 'pending'
          });
          // Update user's groupId
          await db.update(users).set({ groupId: newGroup.id }).where(eq(users.id, invitedUser.id));

          // Create notification
          await this.createNotification({
            userId: invitedUser.id,
            title: autoAccept ? "Added to Project Team" : "Project Team Invitation",
            message: autoAccept 
              ? `You have been added to the project team "${newGroup.name}".`
              : `You have been invited to join project team "${newGroup.name}".`
          });
        }
      }
    }

    // Notify the assigned supervisor
    if (newGroup.supervisorId) {
      await this.createNotification({
        userId: newGroup.supervisorId,
        title: "Assigned to New Group",
        message: `You have been assigned as the supervisor for the group "${newGroup.name}".`
      });
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

  async updateStudentGroupMembers(groupId: number, newEnrollmentNumbers: string[]): Promise<void> {
    const group = await this.getGroup(groupId);
    if (!group) throw new Error("Group not found");

    // Fetch current members
    const currentMembers = await this.getStudentGroupMembers(groupId);
    const currentEnrollmentNumbers = currentMembers.map((m: any) => m.enrollmentNumber);

    // Identify added and removed students
    const addedEnrollmentNumbers = newEnrollmentNumbers.filter(en => !currentEnrollmentNumbers.includes(en));
    const removedEnrollmentNumbers = currentEnrollmentNumbers.filter((en: string) => !newEnrollmentNumbers.includes(en));

    if (removedEnrollmentNumbers.length > 0) {
      const removedUsers = await db.select().from(users).where(inArray(users.enrollmentNumber, removedEnrollmentNumbers));
      for (const removedUser of removedUsers) {
        await this.removeStudentFromGroup(removedUser.id, groupId);
        await this.createNotification({
          userId: removedUser.id,
          title: "Removed from Project Team",
          message: `You have been removed from the project team "${group.name}".`
        });
      }
    }

    if (addedEnrollmentNumbers.length > 0) {
      const addedUsers = await db.select().from(users).where(inArray(users.enrollmentNumber, addedEnrollmentNumbers));
      for (const addedUser of addedUsers) {
        await db.insert(studentGroupMembers).values({
          userId: addedUser.id,
          groupId: groupId,
          status: 'accepted'
        });
        await db.update(users).set({ groupId: groupId }).where(eq(users.id, addedUser.id));
        await this.createNotification({
          userId: addedUser.id,
          title: "Added to Project Team",
          message: `You have been added to the project team "${group.name}".`
        });
      }
    }
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
    return (await db.select().from(users).where(and(eq(users.role, role), eq(users.isDeleted, false)))) as User[];
  }

  async getAllStudentGroups(): Promise<any[]> {
    const groups = await db.select().from(studentGroups);
    const result = await Promise.all(groups.map(async (group) => {
      const members = await this.getStudentGroupMembers(group.id);
      let supervisor = group.supervisorId ? await this.getUser(group.supervisorId) : null;
      let project: { id: number; topicId: number; status: string; topicCode?: string | null; topicTitle?: string } | null = null;

      // Check if group members have an assigned project
      if (members.length > 0) {
        for (const m of members) {
          const mProjects = await this.getStudentProjects(m.id);
          if (mProjects.length > 0 && mProjects[0].topicId) {
            const topic = await this.getProjectTopic(mProjects[0].topicId);
            project = {
              id: mProjects[0].id,
              topicId: mProjects[0].topicId,
              status: mProjects[0].status,
              topicCode: topic?.topicCode,
              topicTitle: topic?.title,
            };

            // Fallback resolution: If group.supervisorId is null, resolve supervisor from topic
            if (!supervisor && topic && topic.submittedById) {
              supervisor = await this.getUser(topic.submittedById);
              // Self-heal the database record
              await this.updateStudentGroupSupervisor(group.id, topic.submittedById);
            }
            break;
          }
        }
      }

      return {
        ...group,
        project,
        members: members.map(m => ({
          id: m.id,
          firstName: m.firstName,
          lastName: m.lastName,
          email: m.email,
          enrollmentNumber: m.enrollmentNumber,
          role: m.role,
          course: m.course,
        })),
        supervisor: supervisor ? {
          id: supervisor.id,
          prefix: supervisor.prefix,
          firstName: supervisor.firstName,
          lastName: supervisor.lastName,
          email: supervisor.email,
          role: supervisor.role,
          department: supervisor.department,
          designation: supervisor.designation,
        } : null,
      };
    }));
    return result;
  }

  async updateStudentGroupSupervisor(groupId: number, supervisorId: number): Promise<StudentGroup | undefined> {
    const [updated] = await db.update(studentGroups)
      .set({ supervisorId, updatedAt: new Date() })
      .where(eq(studentGroups.id, groupId))
      .returning();
    return updated as StudentGroup | undefined;
  }

  // Notification operations
  async getUserNotifications(userId: number): Promise<Notification[]> {
    return (await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt))) as Notification[];
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [n] = await db.insert(notifications).values(notification).returning();
    const createdNotification = n as Notification;
    // Broadcast via WebSocket
    if (createdNotification.userId) {
      notifyUser(createdNotification.userId, createdNotification);
    }
    return createdNotification;
  }

  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const [n] = await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id)).returning();
    return n as Notification;
  }

  /**
   * Marks a notification as read ONLY if it belongs to the given user.
   * Returns the updated row, or undefined when the notification does not
   * exist or belongs to someone else (prevents cross-user IDOR).
   */
  async markNotificationAsReadForUser(id: number, userId: number): Promise<Notification | undefined> {
    const [n] = await db.update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return n as Notification | undefined;
  }

  async markAllNotificationsAsRead(userId: number): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
  }

  async deleteAllNotificationsForUser(userId: number): Promise<void> {
    await db.delete(notifications).where(eq(notifications.userId, userId));
  }


  // Project Assessment operations
  async createProjectAssessment(assessment: InsertProjectAssessment): Promise<ProjectAssessment> {
    const [pa] = await db.insert(projectAssessments).values(assessment).returning();
    return pa as ProjectAssessment;
  }

  async getProjectAssessment(projectId: number, supervisorId: number): Promise<ProjectAssessment | undefined> {
    const [assessment] = await db.select().from(projectAssessments)
      .where(and(eq(projectAssessments.projectId, projectId), eq(projectAssessments.supervisorId, supervisorId)));
    return assessment as ProjectAssessment | undefined;
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
    supervisorName?: string;
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

  /**
   * Wipes all application data and restores the exact fresh-install state
   * (identical to `npm run db:setup`): empty tables, sequences restarted at 1,
   * sessions cleared, and the default admin (admin / Admin@123) recreated.
   *
   * TRUNCATE ... RESTART IDENTITY resets every serial sequence so new records
   * start from id=1, exactly like a fresh install. It also guarantees that a
   * subsequent backup Import cannot collide with stale high-water-mark IDs.
   */
  async resetDatabase(options?: { preserveSessions?: boolean }): Promise<boolean> {
    const preserveSessions = options?.preserveSessions === true;

    // Drop every live socket first: after IDs restart from 1, stale pre-reset
    // connections must not receive notifications addressed to recycled user IDs.
    disconnectAllClients();

    try {
      // TRUNCATE is transactional DDL in PostgreSQL — all-or-nothing.
      await db.transaction(async (tx) => {
        const dataTables = `"project_assessments", "project_milestones", "student_projects", "student_group_members", "student_groups", "project_topics", "notifications", "users"`;
        if (!preserveSessions) {
          await tx.execute(sql.raw(`TRUNCATE TABLE ${dataTables}, "session" RESTART IDENTITY CASCADE`));
        } else {
          await tx.execute(sql.raw(`TRUNCATE TABLE ${dataTables} RESTART IDENTITY CASCADE`));
        }
      });
    } catch (error) {
      console.error("Database truncate failed:", error);
      return false;
    }

    // Recreate the default admin through the canonical seeding path
    // (same one used by scripts/setup_db.ts on a fresh install).
    return this.initializeDefaultUser();
  }

  async importData(data: any): Promise<boolean> {
    try {
      // First, clear existing data (except admin user).
      // preserveSessions keeps the importing admin logged in.
      await this.resetDatabase({ preserveSessions: true });

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

      // PostgreSQL does NOT advance serial sequences when rows are inserted
      // with explicit ids. Re-sync every sequence past the imported MAX(id)
      // so newly created records can never collide with imported ones.
      await this.syncSequences();

      return true;
    } catch (error) {
      console.error("Import failed:", error);
      throw error;
    }
  }

  /**
   * Aligns each table's id sequence to MAX(id) + 1. Safe on empty tables.
   */
  private async syncSequences(): Promise<void> {
    const tables = [
      "users",
      "student_groups",
      "student_group_members",
      "project_topics",
      "student_projects",
      "project_assessments",
      "project_milestones",
      "notifications"
    ];
    for (const table of tables) {
      try {
        await db.execute(sql.raw(
          `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`
        ));
      } catch (err) {
        // Non-fatal: sequence helpers only exist for serial columns
        console.warn(`Sequence sync skipped for ${table}:`, err);
      }
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

      // Get supervisor who assessed
      const supervisorNames = assessments.length > 0
        ? await Promise.all(assessments.map(async a => {
          if (!a.supervisorId) return 'Not Assigned';
          const supervisor = await this.getUser(a.supervisorId);
          return `${supervisor?.firstName} ${supervisor?.lastName}`;
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
        'Supervisor Assigned': supervisorNames.join(', '),
        'Submission Status': project.progress >= 100 ? 'Completed' : project.progress >= 75 ? 'On Track' : 'At Risk',
      };
    }));

    return reportData;
  }

  // --- Paginated Methods ---

  async getPaginatedUsers(page: number, limit: number, course?: string): Promise<import('@shared/schema').PaginatedResponse<User>> {
    const conditions = [eq(users.isDeleted, false)];
    if (course) {
      const normalizedCourse = course.trim().toUpperCase();
      conditions.push(or(
        eq(sql`UPPER(${users.course})`, normalizedCourse),
        eq(users.role, UserRole.ADMIN),
        eq(users.role, UserRole.SUPERVISOR),
        eq(users.role, UserRole.COORDINATOR)
      )!);
    }
    
    const countQuery = await db.select({ count: sql<number>`count(*)` }).from(users).where(and(...conditions));
    const total = Number(countQuery[0].count);
    
    const data = await db.select().from(users).where(and(...conditions)).orderBy(asc(users.id)).limit(limit).offset((page - 1) * limit) as User[];
    
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getPaginatedTopics(page: number, limit: number, course?: string): Promise<import('@shared/schema').PaginatedResponse<ProjectTopic>> {
    const conditions = [eq(projectTopics.isDeleted, false)];
    if (course) conditions.push(eq(projectTopics.course, course));
    
    const countQuery = await db.select({ count: sql<number>`count(*)` }).from(projectTopics).where(and(...conditions));
    const total = Number(countQuery[0].count);
    
    const data = await db.select().from(projectTopics).where(and(...conditions)).limit(limit).offset((page - 1) * limit) as ProjectTopic[];
    
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getPaginatedApprovedTopics(page: number, limit: number, course?: string): Promise<import('@shared/schema').PaginatedResponse<ProjectTopic>> {
    const conditions = [eq(projectTopics.status, "approved"), eq(projectTopics.isDeleted, false)];
    if (course) conditions.push(eq(projectTopics.course, course));
    
    const countQuery = await db.select({ count: sql<number>`count(*)` }).from(projectTopics).where(and(...conditions));
    const total = Number(countQuery[0].count);
    
    const rows = await db.select({
      topic: projectTopics,
      submitter: users,
    })
    .from(projectTopics)
    .innerJoin(users, eq(projectTopics.submittedById, users.id))
    .where(and(...conditions))
    .limit(limit).offset((page - 1) * limit);

    const allottedTopicIds = (await db.select({ topicId: studentProjects.topicId }).from(studentProjects)).map(p => p.topicId);

    const data = rows.map(r => ({
      ...r.topic,
      submittedBy: r.submitter as any,
      isAllotted: allottedTopicIds.includes(r.topic.id)
    } as any as ProjectTopic));
    
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getPaginatedProjects(page: number, limit: number, course?: string): Promise<import('@shared/schema').PaginatedResponse<StudentProject & { topic: ProjectTopic; student: User; supervisor?: User }>> {
    const countQuery = await db.select({ count: sql<number>`count(*)` })
      .from(studentProjects)
      .innerJoin(projectTopics, eq(studentProjects.topicId, projectTopics.id))
      .where(course ? eq(projectTopics.course, course) : undefined);
      
    const total = Number(countQuery[0].count);

    const rows = await db.select({
      project: studentProjects,
      topic: projectTopics,
      student: users
    })
    .from(studentProjects)
    .innerJoin(projectTopics, eq(studentProjects.topicId, projectTopics.id))
    .innerJoin(users, eq(studentProjects.studentId, users.id))
    .where(course ? eq(projectTopics.course, course) : undefined)
    .limit(limit).offset((page - 1) * limit);

    const submitterIds = Array.from(new Set(rows.map(r => r.topic.submittedById).filter(id => id != null) as number[]));

    const studentUserIds = rows.map(r => r.student.id);
    let groupSupervisorMap = new Map<number, number | null>();
    if (studentUserIds.length > 0) {
      const memberships = await db.select({
        studentId: studentGroupMembers.userId,
        supervisorId: studentGroups.supervisorId
      })
      .from(studentGroupMembers)
      .innerJoin(studentGroups, eq(studentGroupMembers.groupId, studentGroups.id))
      .where(and(
        inArray(studentGroupMembers.userId, studentUserIds),
        eq(studentGroupMembers.status, "accepted")
      ));
      memberships.forEach(m => groupSupervisorMap.set(m.studentId, m.supervisorId));
    }

    const groupSupervisorIds = Array.from(new Set(Array.from(groupSupervisorMap.values()).filter(id => id != null) as number[]));
    const allFacultyIds = Array.from(new Set([...submitterIds, ...groupSupervisorIds]));

    let allFaculty: User[] = [];
    if (allFacultyIds.length > 0) {
      allFaculty = await db.select().from(users).where(inArray(users.id, allFacultyIds));
    }
    const facultyMap = new Map(allFaculty.map(s => [s.id, s]));

    const data = rows.map(r => {
      const groupSupId = groupSupervisorMap.get(r.student.id);
      const supervisor = (groupSupId ? facultyMap.get(groupSupId) : undefined) ||
                         (r.topic.submittedById ? facultyMap.get(r.topic.submittedById) : undefined);
      return {
        ...(r.project as StudentProject),
        student: r.student as User,
        supervisor,
        topic: {
          ...(r.topic as ProjectTopic),
          submittedBy: r.topic.submittedById ? facultyMap.get(r.topic.submittedById) : undefined
        }
      };
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // Method to update the force password reset flag
  // Required to remove the first-login security block once the student changes their password
  async setUserForcePasswordReset(userId: number, forceReset: boolean): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ forcePasswordReset: forceReset, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated as User | undefined;
  }

  // Bulk provisioning of student accounts and automated formation of project teams
  // Guarantees strict course data isolation and enforces first-login mandatory password change
  // Supports real-time progress callbacks for streaming telemetry to the frontend
  async bulkOnboardStudentsAndTeams(
    studentRows: IStudentOnboardingRow[],
    course: "BCA" | "MCA",
    creatorId: number,
    onProgress?: (progress: IOnboardingProgress) => void
  ): Promise<IOnboardingResult> {
    const result: IOnboardingResult = {
      success: true,
      message: "",
      course,
      totalSheetsParsed: 0,
      totalStudentsProcessed: 0,
      totalTeamsCreated: 0,
      sheetNames: [],
      teams: [],
      errors: [],
    };

    if (studentRows.length === 0) {
      result.message = "No valid student rows were found in the uploaded workbook.";
      onProgress?.({
        stage: "error",
        percent: 100,
        message: result.message,
      });
      return result;
    }

    // Step 1: Identify unique worksheet names processed
    const sheetsSet = new Set<string>();
    studentRows.forEach(row => {
      if (row.sheetName) sheetsSet.add(row.sheetName);
    });
    result.sheetNames = Array.from(sheetsSet);
    result.totalSheetsParsed = result.sheetNames.length;

    onProgress?.({
      stage: "parsing",
      percent: 20,
      message: `Extracted ${studentRows.length} student records from ${result.totalSheetsParsed} worksheets.`,
      current: 0,
      total: studentRows.length,
      detail: `Sheets: ${result.sheetNames.join(", ")}`
    });

    // Step 2: Preload existing users to optimize lookup time from O(N) database calls to O(1) in-memory
    const existingUsersList = await db.select().from(users);
    const existingByEnrollment = new Map<string, User>();
    const existingByUsername = new Map<string, User>();
    const existingEmails = new Set<string>();

    for (const u of existingUsersList) {
      if (u.enrollmentNumber) existingByEnrollment.set(u.enrollmentNumber.trim(), u as User);
      if (u.username) existingByUsername.set(u.username.trim(), u as User);
      if (u.email) existingEmails.add(u.email.trim().toLowerCase());
    }

    // Process students in concurrent batches of 15 for optimal performance and steady progress updates
    const studentMap = new Map<string, User>();
    const validRows = studentRows.filter(r => String(r.enrollmentNumber || "").trim().length > 0);
    const totalStudents = validRows.length;
    const BATCH_SIZE = 15;
    let processedSoFar = 0;

    for (let i = 0; i < totalStudents; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (row) => {
        const cleanEnrollment = String(row.enrollmentNumber).trim();

        const rawName = (row.studentName || "").trim();
        const nameParts = rawName.split(/\s+/).filter(Boolean);
        const firstName = nameParts[0] || `Student`;
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : ".";

        let rawEmail = (row.emailId || "").trim().toLowerCase();

        try {
          const existingStudent = existingByEnrollment.get(cleanEnrollment) || existingByUsername.get(cleanEnrollment);

          if (existingStudent) {
            let finalEmail = existingStudent.email;
            if (rawEmail && rawEmail.includes("@") && rawEmail !== existingStudent.email.toLowerCase()) {
              if (!existingEmails.has(rawEmail)) {
                finalEmail = rawEmail;
                existingEmails.add(rawEmail);
              }
            }

            const [updatedStudent] = await db.update(users)
              .set({
                course,
                firstName: firstName || existingStudent.firstName,
                lastName: lastName !== "." ? lastName : existingStudent.lastName,
                email: finalEmail,
                updatedAt: new Date()
              })
              .where(eq(users.id, existingStudent.id))
              .returning();

            studentMap.set(cleanEnrollment, updatedStudent as User);
            existingByEnrollment.set(cleanEnrollment, updatedStudent as User);
          } else {
            let newEmail = (rawEmail && rawEmail.includes("@") && !existingEmails.has(rawEmail))
              ? rawEmail
              : `${cleanEnrollment.toLowerCase()}@student.iul.ac.in`;

            if (existingEmails.has(newEmail)) {
              newEmail = `${cleanEnrollment.toLowerCase()}.${cleanEnrollment.slice(-4)}@student.iul.ac.in`;
            }
            existingEmails.add(newEmail);

            const initialHashedPassword = await hashPassword(cleanEnrollment);

            const [newStudent] = await db.insert(users).values({
              username: cleanEnrollment,
              password: initialHashedPassword,
              firstName,
              lastName,
              email: newEmail,
              role: UserRole.STUDENT,
              enrollmentNumber: cleanEnrollment,
              course,
              forcePasswordReset: true,
              isDeleted: false,
            }).returning();

            studentMap.set(cleanEnrollment, newStudent as User);
            existingByEnrollment.set(cleanEnrollment, newStudent as User);
            existingByUsername.set(cleanEnrollment, newStudent as User);
          }
        } catch (userErr: any) {
          result.errors?.push(`Error provisioning student ${cleanEnrollment}: ${userErr.message}`);
        }
      }));

      processedSoFar += batch.length;
      result.totalStudentsProcessed = studentMap.size;

      onProgress?.({
        stage: "provisioning",
        percent: 20 + Math.round((processedSoFar / totalStudents) * 55),
        message: `Provisioning student credentials (${processedSoFar} of ${totalStudents})...`,
        current: processedSoFar,
        total: totalStudents,
        detail: `Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${processedSoFar}/${totalStudents} students verified`
      });
    }

    // Step 3: Group students by their parsed ProjectTeam ID
    const teamGroupsMap = new Map<string, string[]>();
    for (const row of studentRows) {
      const cleanEnrollment = String(row.enrollmentNumber).trim();
      const teamId = (row.projectTeamId || "").trim();
      if (!cleanEnrollment || !teamId) continue;

      if (!teamGroupsMap.has(teamId)) {
        teamGroupsMap.set(teamId, []);
      }
      const list = teamGroupsMap.get(teamId)!;
      if (!list.includes(cleanEnrollment)) {
        list.push(cleanEnrollment);
      }
    }

    const maxGroupSize = course === "BCA" ? 5 : 2;
    const totalTeams = teamGroupsMap.size;
    let teamsCreatedCount = 0;

    // Preload existing student groups for this course
    const existingGroupsList = await db.select().from(studentGroups)
      .where(eq(studentGroups.course, course));
    const existingGroupsMap = new Map<string, StudentGroup>();
    for (const g of existingGroupsList) {
      if (g.projectTeamId) existingGroupsMap.set(g.projectTeamId.trim(), g as StudentGroup);
    }

    for (const [teamId, enrollmentNumbers] of Array.from(teamGroupsMap.entries())) {
      try {
        const existingGroup = existingGroupsMap.get(teamId);
        let currentGroupId: number;

        if (existingGroup) {
          currentGroupId = existingGroup.id;
        } else {
          const [createdGroup] = await db.insert(studentGroups).values({
            name: `Project Team ${teamId}`,
            description: `Auto-provisioned project team for ${course} program (${teamId})`,
            course,
            projectTeamId: teamId,
            maxSize: maxGroupSize,
            createdById: creatorId,
          }).returning();

          currentGroupId = createdGroup.id;
          existingGroupsMap.set(teamId, createdGroup as StudentGroup);
          result.totalTeamsCreated++;
        }

        // Set each student's groupId in users table and ensure accepted membership
        for (const enroll of enrollmentNumbers) {
          const student = studentMap.get(enroll);
          if (!student) continue;

          await db.update(users)
            .set({ groupId: currentGroupId, updatedAt: new Date() })
            .where(eq(users.id, student.id));

          const [existingMember] = await db.select().from(studentGroupMembers)
            .where(and(
              eq(studentGroupMembers.userId, student.id),
              eq(studentGroupMembers.groupId, currentGroupId)
            ));

          if (!existingMember) {
            await db.insert(studentGroupMembers).values({
              userId: student.id,
              groupId: currentGroupId,
              status: 'accepted'
            });
          } else if (existingMember.status !== 'accepted') {
            await db.update(studentGroupMembers)
              .set({ status: 'accepted', updatedAt: new Date() })
              .where(eq(studentGroupMembers.id, existingMember.id));
          }
        }

        result.teams.push({
          teamId,
          studentCount: enrollmentNumbers.length,
          enrollmentNumbers,
        });

        teamsCreatedCount++;
        if (teamsCreatedCount % 5 === 0 || teamsCreatedCount === totalTeams) {
          onProgress?.({
            stage: "teams",
            percent: 75 + Math.round((teamsCreatedCount / totalTeams) * 20),
            message: `Forming project teams (${teamsCreatedCount} of ${totalTeams})...`,
            current: teamsCreatedCount,
            total: totalTeams,
            detail: `Team ${teamId}: assigned ${enrollmentNumbers.length} student(s)`
          });
        }
      } catch (teamErr: any) {
        result.errors?.push(`Error creating team ${teamId}: ${teamErr.message}`);
      }
    }

    onProgress?.({
      stage: "finalizing",
      percent: 98,
      message: "Finalizing and preparing summary metrics...",
      current: totalTeams,
      total: totalTeams
    });

    result.message = `Bulk onboarding completed successfully. ${result.totalStudentsProcessed} students provisioned across ${result.teams.length} teams for ${course}.`;

    onProgress?.({
      stage: "completed",
      percent: 100,
      message: result.message,
      result
    });

    return result;
  }

  // Bulk provisioning and updating of supervisor faculty accounts
  // Username: EmpID (e.g. F00157)
  // Initial Password: EmpID (e.g. F00157), hashed with scrypt
  // Role: UserRole.SUPERVISOR
  // forcePasswordReset: true
  // Preserves designation, prefix, mobile, department, email
  async bulkOnboardSupervisors(
    supervisorRows: ISupervisorOnboardingRow[]
  ): Promise<ISupervisorOnboardingResult> {
    const result: ISupervisorOnboardingResult = {
      success: true,
      message: "",
      totalSupervisorsProcessed: 0,
      totalSupervisorsCreated: 0,
      totalSupervisorsUpdated: 0,
      supervisors: [],
      errors: [],
    };

    if (supervisorRows.length === 0) {
      result.message = "No valid supervisor records were found in the uploaded file.";
      return result;
    }

    // Preload existing users to perform fast O(1) in-memory lookups
    const existingUsersList = await db.select().from(users);
    const existingByEmpId = new Map<string, User>();
    const existingByUsername = new Map<string, User>();
    const existingByEmail = new Map<string, User>();

    for (const u of existingUsersList) {
      if (u.empId) existingByEmpId.set(u.empId.trim().toUpperCase(), u as User);
      if (u.username) existingByUsername.set(u.username.trim().toUpperCase(), u as User);
      if (u.email) existingByEmail.set(u.email.trim().toLowerCase(), u as User);
    }

    const BATCH_SIZE = 10;
    for (let i = 0; i < supervisorRows.length; i += BATCH_SIZE) {
      const batch = supervisorRows.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (row) => {
          const cleanEmpId = String(row.empId).trim();
          const cleanEmpIdUpper = cleanEmpId.toUpperCase();
          const rawName = (row.name || "").trim();
          const prefix = row.prefix || undefined;
          const firstName = row.firstName || rawName || "Supervisor";
          const lastName = row.lastName || "";
          const designation = (row.designation || "Supervisor").trim();
          const mobile = row.mobile ? String(row.mobile).trim() : undefined;
          const department = (row.department || "Department of Computer Application").trim();
          let email = (row.email || `${cleanEmpId.toLowerCase()}@iul.ac.in`).trim().toLowerCase();

          try {
            // Check if supervisor already exists by empId or username
            const existingSupervisor = existingByEmpId.get(cleanEmpIdUpper) || existingByUsername.get(cleanEmpIdUpper);

            if (existingSupervisor) {
              // Ensure email does not collide with another user
              const emailOwner = existingByEmail.get(email);
              if (emailOwner && emailOwner.id !== existingSupervisor.id) {
                email = `${cleanEmpId.toLowerCase()}@iul.ac.in`;
              }

              const [updated] = await db.update(users)
                .set({
                  empId: cleanEmpId,
                  prefix: prefix !== undefined ? prefix : existingSupervisor.prefix,
                  firstName: firstName || existingSupervisor.firstName,
                  lastName: lastName !== undefined ? lastName : existingSupervisor.lastName,
                  designation,
                  mobile: mobile !== undefined ? mobile : existingSupervisor.mobile,
                  department,
                  email,
                  role: UserRole.SUPERVISOR,
                  updatedAt: new Date(),
                })
                .where(eq(users.id, existingSupervisor.id))
                .returning();

              result.totalSupervisorsUpdated++;
              result.totalSupervisorsProcessed++;
              result.supervisors.push({
                empId: cleanEmpId,
                name: `${prefix ? prefix + " " : ""}${firstName} ${lastName}`.trim(),
                designation,
                email,
                username: updated.username,
                isNew: false,
              });
            } else {
              // Check if email collides with another user
              if (existingByEmail.has(email)) {
                email = `${cleanEmpId.toLowerCase()}@iul.ac.in`;
              }

              const initialPasswordHash = await hashPassword(cleanEmpId);

              const [created] = await db.insert(users).values({
                username: cleanEmpId,
                password: initialPasswordHash,
                empId: cleanEmpId,
                prefix,
                firstName,
                lastName,
                designation,
                mobile,
                department,
                email,
                role: UserRole.SUPERVISOR,
                forcePasswordReset: true, // Mandatory first login password change
              }).returning();

              existingByEmpId.set(cleanEmpIdUpper, created as User);
              existingByUsername.set(cleanEmpIdUpper, created as User);
              existingByEmail.set(email, created as User);

              result.totalSupervisorsCreated++;
              result.totalSupervisorsProcessed++;
              result.supervisors.push({
                empId: cleanEmpId,
                name: `${prefix ? prefix + " " : ""}${firstName} ${lastName}`.trim(),
                designation,
                email,
                username: created.username,
                isNew: true,
              });
            }
          } catch (err: any) {
            result.errors?.push(`Failed to onboard supervisor ${cleanEmpId} (${rawName}): ${err.message}`);
          }
        })
      );
    }

    result.message = `Bulk supervisor onboarding completed. ${result.totalSupervisorsCreated} created, ${result.totalSupervisorsUpdated} updated out of ${result.totalSupervisorsProcessed} processed.`;
    return result;
  }

  // Bulk upload, cross-check, and assign sequential PUGID26xxx IDs to project topics
  async bulkUploadProjectTopics(
    course: string,
    rows: ITopicOnboardingRow[],
    options?: { autoApprove?: boolean }
  ): Promise<ITopicOnboardingResult> {
    const result: ITopicOnboardingResult = {
      success: true,
      message: "",
      totalRows: rows.length,
      matchedSupervisors: 0,
      unmatchedSupervisors: 0,
      totalTopicsCreated: 0,
      successRecords: [],
      failureRecords: [],
    };

    if (rows.length === 0) {
      result.message = "No topic rows to process.";
      return result;
    }

    // Preload all supervisors
    const supervisorsList = (await db
      .select()
      .from(users)
      .where(and(eq(users.role, UserRole.SUPERVISOR), eq(users.isDeleted, false)))) as User[];

    const supervisorsByEmail = new Map<string, User>();
    for (const s of supervisorsList) {
      if (s.email) {
        supervisorsByEmail.set(s.email.trim().toLowerCase(), s);
      }
    }

    // Helper to tokenize name for cross-checking
    const normalizeTokens = (name: string): string[] => {
      const variants: Record<string, string> = {
        mohd: "mohammad",
        "mohd.": "mohammad",
        mohammad: "mohammad",
        mohammed: "mohammad",
        muhammad: "mohammad",
        md: "mohammad",
        "md.": "mohammad",
        akhter: "akhtar",
        akhtar: "akhtar",
      };

      return name
        .toLowerCase()
        .replace(/^(dr\.?|mr\.?|mrs\.?|ms\.?|prof\.?)\s+/i, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 1 && !["dr", "mr", "mrs", "ms", "prof"].includes(t))
        .map((t) => variants[t] || t);
    };

    // Calculate current maximum sequence for PUGID26xxx
    const existingTopicsWithCodes = await db
      .select({ topicCode: projectTopics.topicCode })
      .from(projectTopics)
      .where(and(isNotNull(projectTopics.topicCode), like(projectTopics.topicCode, "PUGID26%")));

    let maxSequence = 0;
    for (const t of existingTopicsWithCodes) {
      if (t.topicCode) {
        const match = t.topicCode.match(/^PUGID26(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSequence) {
            maxSequence = num;
          }
        }
      }
    }

    let nextSequence = maxSequence + 1;
    let firstGeneratedCode: string | undefined;
    let lastGeneratedCode: string | undefined;

    // Process rows sequentially to guarantee deterministic, ordered PUGID assignment
    for (const row of rows) {
      const cleanEmail = String(row.facultyEmail || "").trim().toLowerCase();
      const rawName = String(row.facultyName || "").trim();

      // 1. Cross-check email against supervisors in database
      const supervisor = supervisorsByEmail.get(cleanEmail);
      if (!supervisor) {
        result.unmatchedSupervisors++;
        result.failureRecords.push({
          rowNumber: row.rowNumber,
          facultyName: rawName,
          facultyEmail: cleanEmail,
          reason: "Upload Failed: Supervisor email not found in database",
        });
        continue;
      }

      // 2. Cross-check faculty name compatibility
      const dbFullName = `${supervisor.prefix ? supervisor.prefix + " " : ""}${supervisor.firstName} ${supervisor.lastName || ""}`.trim();
      const excelTokens = normalizeTokens(rawName);
      const dbTokens = normalizeTokens(dbFullName);

      // Verify token overlap (at least one substantial token matches)
      const hasTokenMatch = excelTokens.some((token) => dbTokens.includes(token));
      if (excelTokens.length > 0 && dbTokens.length > 0 && !hasTokenMatch) {
        result.unmatchedSupervisors++;
        result.failureRecords.push({
          rowNumber: row.rowNumber,
          facultyName: rawName,
          facultyEmail: cleanEmail,
          reason: `Upload Failed: Supervisor name '${rawName}' does not match database record '${dbFullName}' for email '${cleanEmail}'`,
        });
        continue;
      }

      // 3. Supervisor verified! Proceed to insert topics with sequential PUGID26xxx
      const rowTopicCodes: string[] = [];
      const rowTopicTitles: string[] = [];

      for (const t of row.topics) {
        const seqStr = String(nextSequence++).padStart(3, "0");
        const topicCode = `PUGID26${seqStr}`;

        if (!firstGeneratedCode) firstGeneratedCode = topicCode;
        lastGeneratedCode = topicCode;

        try {
          const [inserted] = await db
            .insert(projectTopics)
            .values({
              topicCode,
              title: t.title,
              description: t.description,
              technology: t.technology || "General / Web Development",
              projectType: t.projectType || "Web Application",
              course: course.toUpperCase(),
              submittedById: supervisor.id,
              status: options?.autoApprove !== false ? "approved" : "pending",
              estimatedComplexity: "Medium",
            })
            .returning();

          rowTopicCodes.push(topicCode);
          rowTopicTitles.push(inserted.title);
          result.totalTopicsCreated++;
        } catch (err: any) {
          result.failureRecords.push({
            rowNumber: row.rowNumber,
            facultyName: rawName,
            facultyEmail: cleanEmail,
            reason: `Database error inserting topic '${t.title}': ${err.message}`,
          });
        }
      }

      result.matchedSupervisors++;
      result.successRecords.push({
        rowNumber: row.rowNumber,
        facultyName: rawName,
        facultyEmail: cleanEmail,
        supervisorId: supervisor.id,
        empId: supervisor.empId || null,
        topicCodes: rowTopicCodes,
        topicTitles: rowTopicTitles,
      });
    }

    if (firstGeneratedCode && lastGeneratedCode) {
      result.generatedIdRange = {
        start: firstGeneratedCode,
        end: lastGeneratedCode,
      };
    }

    result.message = `Bulk topic onboarding completed. ${result.totalTopicsCreated} topics provisioned across ${result.matchedSupervisors} verified supervisors. ${result.unmatchedSupervisors} faculty records skipped.`;
    return result;
  }
}

export const storage = new DBStorage();