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
  UserRole
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { hashPassword } from "./auth";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getAllUsers(): Promise<User[]>;

  // Project topic operations
  getProjectTopic(id: number): Promise<ProjectTopic | undefined>;
  getTopicsByTeacher(teacherId: number): Promise<ProjectTopic[]>;
  getPendingTopics(): Promise<ProjectTopic[]>;
  getApprovedTopics(): Promise<ProjectTopic[]>;
  getRejectedTopics(): Promise<ProjectTopic[]>;
  createProjectTopic(topic: InsertProjectTopic): Promise<ProjectTopic>;
  approveProjectTopic(id: number, feedback?: string): Promise<ProjectTopic | undefined>;
  rejectProjectTopic(id: number, feedback: string): Promise<ProjectTopic | undefined>;

  // Student project operations
  getStudentProject(id: number): Promise<StudentProject | undefined>;
  getStudentProjects(studentId: number): Promise<(StudentProject & { topic: ProjectTopic })[]>;
  getAllProjects(): Promise<(StudentProject & { topic: ProjectTopic, student: User })[]>;
  createStudentProject(project: InsertStudentProject): Promise<StudentProject>;
  updateProjectProgress(id: number, progress: number): Promise<StudentProject | undefined>;

  // Project milestone operations
  getProjectMilestones(projectId: number): Promise<ProjectMilestone[]>;
  createProjectMilestone(milestone: InsertProjectMilestone): Promise<ProjectMilestone>;
  completeProjectMilestone(id: number): Promise<ProjectMilestone | undefined>;

  // Notification operations
  getUserNotifications(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<Notification | undefined>;

  // Statistics
  getDepartmentStats(): Promise<any>;

  // Session store
  sessionStore: session.SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private projectTopics: Map<number, ProjectTopic>;
  private studentProjects: Map<number, StudentProject>;
  private projectMilestones: Map<number, ProjectMilestone>;
  private notifications: Map<number, Notification>;
  sessionStore: session.SessionStore;
  
  currentUserId: number;
  currentTopicId: number;
  currentProjectId: number;
  currentMilestoneId: number;
  currentNotificationId: number;

  constructor() {
    this.users = new Map();
    this.projectTopics = new Map();
    this.studentProjects = new Map();
    this.projectMilestones = new Map();
    this.notifications = new Map();
    
    this.currentUserId = 1;
    this.currentTopicId = 1;
    this.currentProjectId = 1;
    this.currentMilestoneId = 1;
    this.currentNotificationId = 1;
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // 24 hours
    });
    
    // Initialize with default admin user
    this.initializeDefaultUser();
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
        department: "Administration"
      };
      this.users.set(id, user);
    } catch (error) {
      console.error("Failed to create default admin user:", error);
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

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    
    // If the user is being created through the API, the password will already be hashed
    // This is for direct storage calls like the default admin user
    let password = insertUser.password;
    if (password && !password.includes('.')) {
      password = await hashPassword(password);
    }
    
    const user: User = { ...insertUser, id, password };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...data };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  // Project topic operations
  async getProjectTopic(id: number): Promise<ProjectTopic | undefined> {
    return this.projectTopics.get(id);
  }

  async getTopicsByTeacher(teacherId: number): Promise<ProjectTopic[]> {
    return Array.from(this.projectTopics.values()).filter(
      (topic) => topic.submittedById === teacherId
    );
  }

  async getPendingTopics(): Promise<ProjectTopic[]> {
    const topics = Array.from(this.projectTopics.values()).filter(
      (topic) => topic.status === "pending"
    );
    
    // Enrich with submitter info
    return Promise.all(topics.map(async (topic) => {
      const submittedBy = await this.getUser(topic.submittedById);
      return { ...topic, submittedBy };
    }));
  }

  async getApprovedTopics(): Promise<ProjectTopic[]> {
    const topics = Array.from(this.projectTopics.values()).filter(
      (topic) => topic.status === "approved"
    );
    
    // Enrich with submitter info
    return Promise.all(topics.map(async (topic) => {
      const submittedBy = await this.getUser(topic.submittedById);
      return { ...topic, submittedBy };
    }));
  }

  async getRejectedTopics(): Promise<ProjectTopic[]> {
    const topics = Array.from(this.projectTopics.values()).filter(
      (topic) => topic.status === "rejected"
    );
    
    // Enrich with submitter info
    return Promise.all(topics.map(async (topic) => {
      const submittedBy = await this.getUser(topic.submittedById);
      return { ...topic, submittedBy };
    }));
  }

  async createProjectTopic(topic: InsertProjectTopic): Promise<ProjectTopic> {
    const id = this.currentTopicId++;
    const now = new Date();
    const newTopic: ProjectTopic = { 
      ...topic, 
      id, 
      status: "pending", 
      feedback: null,
      createdAt: now 
    };
    
    this.projectTopics.set(id, newTopic);
    return newTopic;
  }

  async approveProjectTopic(id: number, feedback?: string): Promise<ProjectTopic | undefined> {
    const topic = await this.getProjectTopic(id);
    if (!topic) return undefined;
    
    const updatedTopic: ProjectTopic = { 
      ...topic, 
      status: "approved", 
      feedback: feedback || topic.feedback
    };
    
    this.projectTopics.set(id, updatedTopic);
    return updatedTopic;
  }

  async rejectProjectTopic(id: number, feedback: string): Promise<ProjectTopic | undefined> {
    const topic = await this.getProjectTopic(id);
    if (!topic) return undefined;
    
    const updatedTopic: ProjectTopic = { 
      ...topic, 
      status: "rejected", 
      feedback 
    };
    
    this.projectTopics.set(id, updatedTopic);
    return updatedTopic;
  }

  // Student project operations
  async getStudentProject(id: number): Promise<StudentProject | undefined> {
    return this.studentProjects.get(id);
  }

  async getStudentProjects(studentId: number): Promise<(StudentProject & { topic: ProjectTopic })[]> {
    const projects = Array.from(this.studentProjects.values()).filter(
      (project) => project.studentId === studentId
    );
    
    // Enrich with topic info
    return Promise.all(projects.map(async (project) => {
      const topic = await this.getProjectTopic(project.topicId);
      return { ...project, topic: topic! };
    }));
  }

  async getAllProjects(): Promise<(StudentProject & { topic: ProjectTopic, student: User })[]> {
    const projects = Array.from(this.studentProjects.values());
    
    // Enrich with topic and student info
    return Promise.all(projects.map(async (project) => {
      const topic = await this.getProjectTopic(project.topicId);
      const student = await this.getUser(project.studentId);
      return { ...project, topic: topic!, student: student! };
    }));
  }

  async createStudentProject(project: InsertStudentProject): Promise<StudentProject> {
    const id = this.currentProjectId++;
    const now = new Date();
    const newProject: StudentProject = { 
      ...project, 
      id, 
      status: "in_progress", 
      progress: 0, 
      createdAt: now 
    };
    
    this.studentProjects.set(id, newProject);
    return newProject;
  }

  async updateProjectProgress(id: number, progress: number): Promise<StudentProject | undefined> {
    const project = await this.getStudentProject(id);
    if (!project) return undefined;
    
    // Calculate new status based on progress
    let status = project.status;
    if (progress >= 100) {
      status = "completed";
    }
    
    const updatedProject: StudentProject = { ...project, progress, status };
    this.studentProjects.set(id, updatedProject);
    
    return updatedProject;
  }

  // Project milestone operations
  async getProjectMilestones(projectId: number): Promise<ProjectMilestone[]> {
    return Array.from(this.projectMilestones.values()).filter(
      (milestone) => milestone.projectId === projectId
    );
  }

  async createProjectMilestone(milestone: InsertProjectMilestone): Promise<ProjectMilestone> {
    const id = this.currentMilestoneId++;
    const now = new Date();
    const newMilestone: ProjectMilestone = { 
      ...milestone, 
      id, 
      completed: false, 
      createdAt: now 
    };
    
    this.projectMilestones.set(id, newMilestone);
    return newMilestone;
  }

  async completeProjectMilestone(id: number): Promise<ProjectMilestone | undefined> {
    const milestone = this.projectMilestones.get(id);
    if (!milestone) return undefined;
    
    const updatedMilestone: ProjectMilestone = { ...milestone, completed: true };
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
    const id = this.currentNotificationId++;
    const now = new Date();
    const newNotification: Notification = { 
      ...notification, 
      id, 
      read: false, 
      createdAt: now 
    };
    
    this.notifications.set(id, newNotification);
    return newNotification;
  }

  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const notification = this.notifications.get(id);
    if (!notification) return undefined;
    
    const updatedNotification: Notification = { ...notification, read: true };
    this.notifications.set(id, updatedNotification);
    
    return updatedNotification;
  }

  // Statistics
  async getDepartmentStats(): Promise<any> {
    // In a real application, this would calculate actual statistics
    // For now, return mock data
    return {
      "Computer Science": {
        progress: 78,
        studentCount: 24,
        projectCount: 18
      },
      "Information Technology": {
        progress: 82,
        studentCount: 20,
        projectCount: 15
      },
      "Electronics Engineering": {
        progress: 65,
        studentCount: 18,
        projectCount: 12
      },
      "Mechanical Engineering": {
        progress: 53,
        studentCount: 15,
        projectCount: 10
      },
      "Civil Engineering": {
        progress: 61,
        studentCount: 16,
        projectCount: 12
      }
    };
  }
}

export const storage = new MemStorage();
