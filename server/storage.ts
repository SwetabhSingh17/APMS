import {
  users,
  type User,
  type InsertUser,
  projectTopics,
  type ProjectTopic,
  type InsertProjectTopic,
  studentProjects,
  type StudentProject,
  type InsertStudentProject,
  projectMilestones,
  type ProjectMilestone,
  type InsertProjectMilestone,
  notifications,
  type Notification,
  type InsertNotification,
  UserRole,
  studentGroups,
  type StudentGroup,
  type InsertStudentGroup,
  projectAssessments,
  type ProjectAssessment,
  type InsertProjectAssessment,
  CollaborationType
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { hashPassword } from "./auth";

const MemoryStore = createMemoryStore(session);
const sessionStore = new MemoryStore({
  checkPeriod: 86400000 // prune expired entries every 24h
});

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEnrollmentNumber(enrollmentNumber: string): Promise<User | null>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  getUserProfile(id: number): Promise<User | undefined>;
  updateUserProfile(id: number, data: Partial<InsertUser>): Promise<User | undefined>;

  // Project topic operations
  getProjectTopic(id: number): Promise<ProjectTopic | null>;
  getTopicsByTeacher(teacherId: number): Promise<ProjectTopic[]>;
  getPendingTopics(): Promise<ProjectTopic[]>;
  getApprovedTopics(): Promise<ProjectTopic[]>;
  getRejectedTopics(): Promise<ProjectTopic[]>;
  createProjectTopic(data: InsertProjectTopic): Promise<ProjectTopic>;
  approveProjectTopic(id: number, feedback?: string): Promise<ProjectTopic | undefined>;
  rejectProjectTopic(id: number, feedback: string): Promise<ProjectTopic | undefined>;
  updateProjectTopic(id: number, data: InsertProjectTopic): Promise<ProjectTopic>;

  // Student project operations
  getStudentProject(id: number): Promise<StudentProject | undefined>;
  getStudentProjects(studentId: number): Promise<(StudentProject & { topic: ProjectTopic | null })[]>;
  createStudentProject(project: InsertStudentProject): Promise<StudentProject>;
  updateStudentProject(id: number, data: Partial<InsertStudentProject>): Promise<StudentProject | undefined>;

  // Student Group operations
  createStudentGroup(group: InsertStudentGroup): Promise<StudentGroup>;
  getStudentGroup(id: number): Promise<StudentGroup | undefined>;
  getStudentGroupByMemberId(userId: number): Promise<StudentGroup | undefined>;
  getStudentGroupMembers(groupId: number): Promise<User[]>;
  addStudentToGroup(userId: number, groupId: number): Promise<boolean>;
  removeStudentFromGroup(userId: number, groupId: number): Promise<boolean>;
  deleteStudentGroup(id: number): Promise<boolean>;

  // Notification operations
  getUserNotifications(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<Notification | undefined>;

  // Project Assessment operations
  createProjectAssessment(assessment: InsertProjectAssessment): Promise<ProjectAssessment>;
  getProjectAssessment(projectId: number, assessorId: number): Promise<ProjectAssessment | undefined>;
  updateProjectAssessment(id: number, data: InsertProjectAssessment): Promise<ProjectAssessment>;
  getProjectAssessments(projectId: number): Promise<ProjectAssessment[]>;

  // Search and report operations
  searchProjects(criteria: {
    projectName?: string;
    facultyName?: string;
    studentName?: string;
    enrollmentNumber?: string;
    department?: string;
    status?: string;
  }): Promise<(StudentProject & { topic: ProjectTopic, student: User })[]>;

  // Statistics
  getDepartmentStats(): Promise<Record<string, { progress: number, studentCount: number, projectCount: number }>>;

  // Session store
  sessionStore: session.Store;

  // New methods
  getAllProjects(): Promise<(StudentProject & { topic: ProjectTopic; student: User })[]>;
  getAvailableStudentGroups(): Promise<(StudentGroup & { members: User[]; faculty?: User })[]>;
  getProjectMilestones(projectId: number): Promise<ProjectMilestone[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private projectTopics: Map<number, ProjectTopic>;
  private studentProjects: Map<number, StudentProject>;
  private projectMilestones: Map<number, ProjectMilestone>;
  private notifications: Map<number, Notification>;
  private studentGroups: Map<number, StudentGroup>;
  private studentGroupMembers: Map<string, number>; // userId-groupId mapping
  private projectAssessments: Map<number, ProjectAssessment>;
  sessionStore: session.Store;

  currentUserId: number;
  currentTopicId: number;
  currentProjectId: number;
  currentMilestoneId: number;
  currentNotificationId: number;
  currentStudentGroupId: number;
  currentAssessmentId: number;

  constructor() {
    this.users = new Map();
    this.projectTopics = new Map();
    this.studentProjects = new Map();
    this.projectMilestones = new Map();
    this.notifications = new Map();
    this.studentGroups = new Map();
    this.studentGroupMembers = new Map();
    this.projectAssessments = new Map();

    this.currentUserId = 1;
    this.currentTopicId = 1;
    this.currentProjectId = 1;
    this.currentMilestoneId = 1;
    this.currentNotificationId = 1;
    this.currentStudentGroupId = 1;
    this.currentAssessmentId = 1;

    this.sessionStore = sessionStore;

    // Initialize with default admin user
    this.initializeDefaultUser();

    // Add test topics
    this.initializeTestTopics();
  }

  private async initializeDefaultUser() {
    try {
      const hashedPassword = await hashPassword("admin123");
      const id = this.currentUserId++;
      const user: User = {
        id,
        username: "admin",
        password: hashedPassword,
        firstName: "Admin",
        lastName: "User",
        email: "admin@example.com",
        role: UserRole.ADMIN,
        department: "Administration",
        enrollmentNumber: null,
        groupId: null
      };
      this.users.set(id, user);

      // Add a test teacher user
      const teacherId = 25; // This matches the ID used in test topics
      const teacherPassword = await hashPassword("teacher123");
      const teacher: User = {
        id: teacherId,
        username: "teacher",
        password: teacherPassword,
        firstName: "John",
        lastName: "Smith",
        email: "teacher@example.com",
        role: UserRole.TEACHER,
        department: "Computer Science",
        enrollmentNumber: null,
        groupId: null
      };
      this.users.set(teacherId, teacher);
      this.currentUserId = Math.max(this.currentUserId, teacherId + 1);

    } catch (error) {
      console.error("Failed to create default admin user:", error);
    }
  }

  private async initializeTestTopics() {
    try {
      // Get the test teacher
      const teacher = await this.getUser(25);
      if (!teacher) {
        console.error("Test teacher not found");
        return;
      }

      // Add a pending topic
      const pendingTopic: ProjectTopic = {
        id: this.currentTopicId++,
        title: "Test Pending Topic",
        description: "This is a test pending topic",
        submittedById: teacher.id,
        technology: "React, Node.js",
        department: "Computer Science",
        estimatedComplexity: "Medium",
        status: "pending",
        feedback: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        submittedBy: {
          id: teacher.id,
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          department: teacher.department
        }
      };
      this.projectTopics.set(pendingTopic.id, pendingTopic);

      // Add an approved topic
      const approvedTopic: ProjectTopic = {
        id: this.currentTopicId++,
        title: "Test Approved Topic",
        description: "This is a test approved topic",
        submittedById: teacher.id,
        technology: "Python, Django",
        department: "Computer Science",
        estimatedComplexity: "Medium",
        status: "approved",
        feedback: "Good topic, approved",
        createdAt: new Date(),
        updatedAt: new Date(),
        submittedBy: {
          id: teacher.id,
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          department: teacher.department
        }
      };
      this.projectTopics.set(approvedTopic.id, approvedTopic);

      // Add a rejected topic
      const rejectedTopic: ProjectTopic = {
        id: this.currentTopicId++,
        title: "Test Rejected Topic",
        description: "This is a test rejected topic",
        submittedById: teacher.id,
        technology: "Java, Spring",
        department: "Computer Science",
        estimatedComplexity: "Medium",
        status: "rejected",
        feedback: "Topic needs more clarity",
        createdAt: new Date(),
        updatedAt: new Date(),
        submittedBy: {
          id: teacher.id,
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          department: teacher.department
        }
      };
      this.projectTopics.set(rejectedTopic.id, rejectedTopic);
    } catch (error) {
      console.error("Failed to initialize test topics:", error);
    }
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEnrollmentNumber(enrollmentNumber: string): Promise<User | null> {
    return Array.from(this.users.values()).find(
      (user) => user.enrollmentNumber === enrollmentNumber,
    ) || null;
  }

  async createUser(user: InsertUser): Promise<User> {
    const hashedPassword = await hashPassword(user.password);
    const role = UserRole[user.role.toUpperCase() as keyof typeof UserRole];
    if (!role) {
      throw new Error(`Invalid user role: ${user.role}`);
    }

    const newUser = {
      id: this.currentUserId++,
      username: user.username,
      password: hashedPassword,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role,
      department: user.department,
      enrollmentNumber: user.enrollmentNumber || null,
      groupId: user.groupId || null
    } satisfies User;
    this.users.set(newUser.id, newUser);
    return newUser;
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;

    const updatedUser: User = {
      ...user,
      ...data,
      role: data.role ? (UserRole[data.role.toUpperCase() as keyof typeof UserRole] || user.role) : user.role,
      enrollmentNumber: data.enrollmentNumber || user.enrollmentNumber,
      groupId: data.groupId || user.groupId
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUserProfile(id: number): Promise<User | undefined> {
    return this.getUser(id);
  }

  async updateUserProfile(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;

    const updatedUser: User = {
      ...user,
      ...data,
      role: data.role ? (UserRole[data.role.toUpperCase() as keyof typeof UserRole] || user.role) : user.role
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Project topic operations
  async getProjectTopic(id: number): Promise<ProjectTopic | null> {
    const topic = this.projectTopics.get(id);
    if (!topic) return null;

    // Enrich with submitter info
    const submitter = await this.getUser(topic.submittedById);
    if (submitter) {
      return {
        ...topic,
        submittedBy: {
          id: submitter.id,
          firstName: submitter.firstName,
          lastName: submitter.lastName,
          department: submitter.department
        }
      };
    }

    return topic;
  }

  async getTopicsByTeacher(teacherId: number): Promise<ProjectTopic[]> {
    const topics = Array.from(this.projectTopics.values()).filter(
      (topic) => topic.submittedById === teacherId
    );

    // Enrich with submitter info
    return Promise.all(topics.map(async (topic) => {
      const submitter = await this.getUser(topic.submittedById);
      if (submitter) {
        return {
          ...topic,
          submittedBy: {
            id: submitter.id,
            firstName: submitter.firstName,
            lastName: submitter.lastName,
            department: submitter.department
          }
        };
      }
      return topic;
    }));
  }

  async getPendingTopics(): Promise<ProjectTopic[]> {
    const topics = Array.from(this.projectTopics.values()).filter(
      (topic) => topic.status === "pending"
    );

    // Enrich with submitter info
    return Promise.all(topics.map(async (topic) => {
      const submitter = await this.getUser(topic.submittedById);
      if (submitter) {
        return {
          ...topic,
          submittedBy: {
            id: submitter.id,
            firstName: submitter.firstName,
            lastName: submitter.lastName,
            department: submitter.department
          }
        };
      }
      return topic;
    }));
  }

  async getApprovedTopics(): Promise<ProjectTopic[]> {
    const topics = Array.from(this.projectTopics.values()).filter(
      (topic) => topic.status === "approved"
    );

    // Enrich with submitter info
    return Promise.all(topics.map(async (topic) => {
      const submitter = await this.getUser(topic.submittedById);
      if (submitter) {
        return {
          ...topic,
          submittedBy: {
            id: submitter.id,
            firstName: submitter.firstName,
            lastName: submitter.lastName,
            department: submitter.department
          }
        };
      }
      return topic;
    }));
  }

  async getRejectedTopics(): Promise<ProjectTopic[]> {
    const topics = Array.from(this.projectTopics.values()).filter(
      (topic) => topic.status === "rejected"
    );

    // Enrich with submitter info
    return Promise.all(topics.map(async (topic) => {
      const submitter = await this.getUser(topic.submittedById);
      if (submitter) {
        return {
          ...topic,
          submittedBy: {
            id: submitter.id,
            firstName: submitter.firstName,
            lastName: submitter.lastName,
            department: submitter.department
          }
        };
      }
      return topic;
    }));
  }

  async createProjectTopic(data: InsertProjectTopic): Promise<ProjectTopic> {
    // Get the submitter info
    const submitter = await this.getUser(data.submittedById);
    if (!submitter) {
      throw new Error(`User with id ${data.submittedById} not found`);
    }

    const newTopic: ProjectTopic = {
      ...data,
      id: this.currentTopicId++,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'pending',
      feedback: null,
      submittedBy: {
        id: submitter.id,
        firstName: submitter.firstName,
        lastName: submitter.lastName,
        department: submitter.department
      }
    };
    this.projectTopics.set(newTopic.id, newTopic);
    return newTopic;
  }

  async approveProjectTopic(id: number, feedback?: string): Promise<ProjectTopic | undefined> {
    const topic = await this.getProjectTopic(id);
    if (!topic) return undefined;

    // Get the submitter info
    const submitter = await this.getUser(topic.submittedById);
    if (!submitter) {
      throw new Error(`User with id ${topic.submittedById} not found`);
    }

    const updatedTopic: ProjectTopic = {
      ...topic,
      status: "approved",
      feedback: feedback || topic.feedback,
      submittedBy: {
        id: submitter.id,
        firstName: submitter.firstName,
        lastName: submitter.lastName,
        department: submitter.department
      }
    };

    this.projectTopics.set(id, updatedTopic);
    return updatedTopic;
  }

  async rejectProjectTopic(id: number, feedback: string): Promise<ProjectTopic | undefined> {
    const topic = await this.getProjectTopic(id);
    if (!topic) return undefined;

    // Get the submitter info
    const submitter = await this.getUser(topic.submittedById);
    if (!submitter) {
      throw new Error(`User with id ${topic.submittedById} not found`);
    }

    const updatedTopic: ProjectTopic = {
      ...topic,
      status: "rejected",
      feedback,
      submittedBy: {
        id: submitter.id,
        firstName: submitter.firstName,
        lastName: submitter.lastName,
        department: submitter.department
      }
    };

    this.projectTopics.set(id, updatedTopic);
    return updatedTopic;
  }

  async updateProjectTopic(id: number, data: InsertProjectTopic): Promise<ProjectTopic> {
    const topic = await this.getProjectTopic(id);
    if (!topic) {
      throw new Error(`Topic with id ${id} not found`);
    }

    const updatedTopic: ProjectTopic = {
      ...topic,
      ...data,
      updatedAt: new Date()
    };

    this.projectTopics.set(id, updatedTopic);
    return updatedTopic;
  }

  // Student project operations
  async getStudentProject(id: number): Promise<StudentProject | undefined> {
    return this.studentProjects.get(id);
  }

  async getStudentProjects(studentId: number): Promise<(StudentProject & { topic: ProjectTopic | null })[]> {
    const projects = Array.from(this.studentProjects.values()).filter(
      (project) => project.studentId === studentId
    );

    return Promise.all(
      projects.map(async (project) => {
        const topic = await this.getProjectTopic(project.topicId);
        return { ...project, topic: topic || null };
      })
    );
  }

  async createStudentProject(project: InsertStudentProject): Promise<StudentProject> {
    // Validate that the topic exists and is approved
    const topic = await this.getProjectTopic(project.topicId);
    if (!topic) {
      throw new Error('Topic not found');
    }
    if (topic.status !== 'approved') {
      throw new Error('Topic is not approved');
    }

    // Check if student already has a project with this topic
    const existingProjects = await this.getStudentProjects(project.studentId);
    if (existingProjects.some(p => p.topicId === project.topicId)) {
      throw new Error('Student already has a project with this topic');
    }

    const newProject: StudentProject = {
      ...project,
      id: this.currentProjectId++,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'in_progress',
      progress: project.progress || 0
    };
    this.studentProjects.set(newProject.id, newProject);
    return newProject;
  }

  async updateStudentProject(id: number, data: Partial<InsertStudentProject>): Promise<StudentProject | undefined> {
    const project = await this.getStudentProject(id);
    if (!project) return undefined;

    const updatedProject: StudentProject = { ...project, ...data };
    this.studentProjects.set(id, updatedProject);

    return updatedProject;
  }

  // Project milestone operations
  async getProjectMilestones(projectId: number): Promise<ProjectMilestone[]> {
    return Array.from(this.projectMilestones.values())
      .filter(milestone => milestone.projectId === projectId)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  async createProjectMilestone(milestone: InsertProjectMilestone): Promise<ProjectMilestone> {
    const newMilestone: ProjectMilestone = {
      ...milestone,
      id: this.currentMilestoneId++,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'pending',
      completedAt: null
    };
    this.projectMilestones.set(newMilestone.id, newMilestone);
    return newMilestone;
  }

  async completeProjectMilestone(id: number): Promise<ProjectMilestone | undefined> {
    const milestone = this.projectMilestones.get(id);
    if (!milestone) return undefined;

    const updatedMilestone: ProjectMilestone = {
      ...milestone,
      status: 'completed',
      completedAt: new Date()
    };
    this.projectMilestones.set(id, updatedMilestone);

    return updatedMilestone;
  }

  // Notification operations
  async getUserNotifications(userId: number): Promise<Notification[]> {
    return Array.from(this.notifications.values()).filter(
      (notification) => notification.userId === userId
    );
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const newNotification: Notification = {
      ...notification,
      id: this.currentNotificationId++,
      createdAt: new Date(),
      isRead: false
    };
    this.notifications.set(newNotification.id, newNotification);
    return newNotification;
  }

  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const notification = this.notifications.get(id);
    if (!notification) return undefined;

    const updatedNotification: Notification = { ...notification, isRead: true };
    this.notifications.set(id, updatedNotification);

    return updatedNotification;
  }

  // Student Group operations
  async createStudentGroup(group: InsertStudentGroup): Promise<StudentGroup> {
    const collaborationType = CollaborationType[group.collaborationType.toUpperCase() as keyof typeof CollaborationType];
    if (!collaborationType) {
      throw new Error(`Invalid collaboration type: ${group.collaborationType}`);
    }

    const newGroup: StudentGroup = {
      id: this.currentStudentGroupId++,
      name: group.name,
      description: group.description || null,
      collaborationType,
      facultyId: group.facultyId || null,
      createdAt: new Date(),
      maxSize: group.maxSize || 5
    };
    this.studentGroups.set(newGroup.id, newGroup);
    return newGroup;
  }

  async getStudentGroup(id: number): Promise<StudentGroup | undefined> {
    const group = this.studentGroups.get(id);
    if (!group) return undefined;

    return group;
  }

  async getStudentGroupByMemberId(userId: number): Promise<StudentGroup | undefined> {
    // Check if user is in any group
    const groupId = Array.from(this.studentGroupMembers.entries())
      .find(([key, id]) => {
        const [memberId] = key.split('-');
        return parseInt(memberId) === userId;
      })?.[1];

    if (!groupId) return undefined;

    return this.getStudentGroup(groupId);
  }

  async getStudentGroupMembers(groupId: number): Promise<User[]> {
    // Get all member IDs for this group
    const memberIds = Array.from(this.studentGroupMembers.entries())
      .filter(([key, id]) => id === groupId)
      .map(([key]) => {
        const [memberId] = key.split('-');
        return parseInt(memberId);
      });

    // Get user objects for each member
    const members = await Promise.all(
      memberIds.map(id => this.getUser(id))
    );

    return members.filter(Boolean) as User[];
  }

  async addStudentToGroup(userId: number, groupId: number): Promise<boolean> {
    // Check if group exists
    const group = await this.studentGroups.get(groupId);
    if (!group) return false;

    // Check if user exists
    const user = await this.getUser(userId);
    if (!user) return false;

    // Check if group is full
    const members = await this.getStudentGroupMembers(groupId);
    if (members.length >= group.maxSize) return false;

    // Add user to group
    const key = `${userId}-${groupId}`;
    this.studentGroupMembers.set(key, groupId);

    // Update user with groupId
    this.users.set(userId, { ...user, groupId });

    return true;
  }

  async removeStudentFromGroup(userId: number, groupId: number): Promise<boolean> {
    // Check if user exists in group
    const key = `${userId}-${groupId}`;
    if (!this.studentGroupMembers.has(key)) return false;

    // Remove user from group
    this.studentGroupMembers.delete(key);

    // Update user to remove groupId
    const user = await this.getUser(userId);
    if (user) {
      this.users.set(userId, { ...user, groupId: null });
    }

    return true;
  }

  async deleteStudentGroup(id: number): Promise<boolean> {
    // Check if group exists
    if (!this.studentGroups.has(id)) return false;

    // Remove all members from group
    const memberKeys = Array.from(this.studentGroupMembers.entries())
      .filter(([_, groupId]) => groupId === id)
      .map(([key]) => key);

    for (const key of memberKeys) {
      this.studentGroupMembers.delete(key);

      // Update user to remove groupId
      const [userId] = key.split('-');
      const user = await this.getUser(parseInt(userId));
      if (user) {
        this.users.set(user.id, { ...user, groupId: null });
      }
    }

    // Delete group
    return this.studentGroups.delete(id);
  }

  // Project Assessment operations
  async createProjectAssessment(assessment: InsertProjectAssessment): Promise<ProjectAssessment> {
    const newAssessment: ProjectAssessment = {
      ...assessment,
      id: this.currentAssessmentId++,
      createdAt: new Date(),
      feedback: assessment.feedback || null,
      assessmentDate: assessment.assessmentDate || new Date()
    };
    this.projectAssessments.set(newAssessment.id, newAssessment);
    return newAssessment;
  }

  async getProjectAssessment(projectId: number, assessorId: number): Promise<ProjectAssessment | undefined> {
    return Array.from(this.projectAssessments.values()).find(
      (assessment) => assessment.projectId === projectId && assessment.assessorId === assessorId
    );
  }

  async updateProjectAssessment(id: number, data: InsertProjectAssessment): Promise<ProjectAssessment> {
    const assessment = await this.getProjectAssessment(data.projectId, data.assessorId);
    if (!assessment) {
      throw new Error(`Assessment with id ${id} not found`);
    }

    const updatedAssessment: ProjectAssessment = {
      ...assessment,
      ...data,
      id,
      createdAt: new Date(),
      feedback: data.feedback || null,
      assessmentDate: data.assessmentDate || new Date()
    };
    this.projectAssessments.set(id, updatedAssessment);
    return updatedAssessment;
  }

  async getProjectAssessments(projectId: number): Promise<ProjectAssessment[]> {
    return Array.from(this.projectAssessments.values()).filter(
      (assessment) => assessment.projectId === projectId
    );
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
    // Get all projects with topic and student info
    const projects = await this.getAllProjects();

    // Filter based on criteria
    return projects.filter(project => {
      // Project name filter
      if (criteria.projectName && !project.topic.title.toLowerCase().includes(criteria.projectName.toLowerCase())) {
        return false;
      }

      // Faculty name filter
      if (criteria.facultyName) {
        const facultyFullName = `${project.topic.submittedBy?.firstName} ${project.topic.submittedBy?.lastName}`.toLowerCase();
        if (!facultyFullName.includes(criteria.facultyName.toLowerCase())) {
          return false;
        }
      }

      // Student name filter
      if (criteria.studentName) {
        const studentFullName = `${project.student.firstName} ${project.student.lastName}`.toLowerCase();
        if (!studentFullName.includes(criteria.studentName.toLowerCase())) {
          return false;
        }
      }

      // Enrollment number filter
      if (criteria.enrollmentNumber && project.student.enrollmentNumber !== criteria.enrollmentNumber) {
        return false;
      }

      // Department filter
      if (criteria.department && project.student.department !== criteria.department) {
        return false;
      }

      // Status filter
      if (criteria.status && project.status !== criteria.status) {
        return false;
      }

      return true;
    });
  }

  // Statistics
  async getDepartmentStats(): Promise<Record<string, { progress: number, studentCount: number, projectCount: number }>> {
    const projects = await this.getAllProjects();
    const users = await this.getAllUsers();

    // Group by department
    const departmentMap = new Map<string, { progress: number, studentCount: number, projectCount: number }>();

    users.forEach(user => {
      if (!user.department) return;

      if (!departmentMap.has(user.department)) {
        departmentMap.set(user.department, {
          progress: 0,
          studentCount: 0,
          projectCount: 0
        });
      }

      if (user.role === UserRole.STUDENT) {
        const stats = departmentMap.get(user.department)!;
        stats.studentCount++;
      }
    });

    projects.forEach(project => {
      const department = project.student.department;
      if (!department) return;

      const stats = departmentMap.get(department)!;
      stats.projectCount++;
      stats.progress += project.progress;
    });

    // Calculate averages and convert to plain object
    const result: Record<string, { progress: number, studentCount: number, projectCount: number }> = {};

    departmentMap.forEach((stats, department) => {
      result[department] = {
        progress: stats.projectCount > 0 ? Math.round(stats.progress / stats.projectCount) : 0,
        studentCount: stats.studentCount,
        projectCount: stats.projectCount
      };
    });

    return result;
  }

  async getTopicsBySubmitter(submittedBy: { id: number }): Promise<ProjectTopic[]> {
    return Array.from(this.projectTopics.values()).filter(
      (topic) => topic.submittedBy?.id === submittedBy.id
    );
  }

  async updateTopicStatus(topicId: number, status: string, feedback: string | null = null): Promise<ProjectTopic> {
    const topic = await this.getProjectTopic(topicId);
    if (!topic) {
      throw new Error(`Topic with id ${topicId} not found`);
    }

    const updatedTopic: ProjectTopic = {
      ...topic,
      status,
      feedback,
      updatedAt: new Date()
    };

    this.projectTopics.set(topicId, updatedTopic);
    return updatedTopic;
  }

  async createMilestone(milestone: InsertProjectMilestone): Promise<ProjectMilestone> {
    const newMilestone: ProjectMilestone = {
      ...milestone,
      id: this.currentMilestoneId++,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'pending',
      completedAt: null
    };
    this.projectMilestones.set(newMilestone.id, newMilestone);
    return newMilestone;
  }

  async getAllProjects(): Promise<(StudentProject & { topic: ProjectTopic; student: User })[]> {
    const projects = Array.from(this.studentProjects.values());

    return Promise.all(
      projects.map(async (project) => {
        const topic = await this.getProjectTopic(project.topicId);
        const student = await this.getUser(project.studentId);

        if (!topic || !student) {
          throw new Error(`Missing topic or student for project ${project.id}`);
        }

        return {
          ...project,
          topic,
          student
        };
      })
    );
  }

  async getAvailableStudentGroups(): Promise<(StudentGroup & { members: User[]; faculty?: User })[]> {
    const groups = Array.from(this.studentGroups.values());

    // Get groups with available slots and enrich with member info
    return Promise.all(
      groups.map(async (group) => {
        const members = await this.getStudentGroupMembers(group.id);
        let faculty = undefined;

        if (group.collaborationType === CollaborationType.FACULTY_COLLABORATION && group.facultyId) {
          faculty = await this.getUser(group.facultyId);
        }

        return { ...group, members, faculty };
      })
    ).then(groups =>
      // Filter groups that have space for more members
      groups.filter(group => group.members.length < group.maxSize)
    );
  }
  async getAllTopics(): Promise<ProjectTopic[]> {
    const topics = Array.from(this.projectTopics.values());

    // Enrich with submitter info
    return Promise.all(topics.map(async (topic) => {
      const submitter = await this.getUser(topic.submittedById);
      if (submitter) {
        return {
          ...topic,
          submittedBy: {
            id: submitter.id,
            firstName: submitter.firstName,
            lastName: submitter.lastName,
            department: submitter.department
          }
        };
      }
      return topic;
    }));
  }

  async getUsersByRole(role: UserRole): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.role === role);
  }

  async getGroup(id: number): Promise<StudentGroup | undefined> {
    return this.getStudentGroup(id);
  }

  async getUserGroup(userId: number): Promise<StudentGroup | undefined> {
    return this.getStudentGroupByMemberId(userId);
  }

  async deleteProjectTopic(id: number): Promise<boolean> {
    return this.projectTopics.delete(id);
  }
}

export const storage = new MemStorage();
