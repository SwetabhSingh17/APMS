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

  // Student Group operations
  createStudentGroup(group: InsertStudentGroup): Promise<StudentGroup>;
  getStudentGroup(id: number): Promise<StudentGroup | undefined>;
  getStudentGroupByMemberId(userId: number): Promise<StudentGroup | undefined>;
  getAvailableStudentGroups(): Promise<StudentGroup[]>;
  getStudentGroupMembers(groupId: number): Promise<User[]>;
  addStudentToGroup(userId: number, groupId: number): Promise<boolean>;
  removeStudentFromGroup(userId: number, groupId: number): Promise<boolean>;
  deleteStudentGroup(id: number): Promise<boolean>;

  // Project Assessment operations
  createProjectAssessment(assessment: InsertProjectAssessment): Promise<ProjectAssessment>;
  getProjectAssessment(projectId: number, assessorId: number): Promise<ProjectAssessment | undefined>;
  getProjectAssessments(projectId: number): Promise<(ProjectAssessment & { assessor: User })[]>;
  updateProjectAssessment(id: number, data: Partial<InsertProjectAssessment>): Promise<ProjectAssessment>;

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
  private studentGroups: Map<number, StudentGroup>;
  private studentGroupMembers: Map<string, number>; // userId-groupId mapping
  private projectAssessments: Map<number, ProjectAssessment>;
  sessionStore: session.SessionStore;
  
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
        department: "Administration",
        enrollmentNumber: null,
        groupId: null
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

  // Student Group operations
  async createStudentGroup(group: InsertStudentGroup): Promise<StudentGroup> {
    const id = this.currentStudentGroupId++;
    const now = new Date();
    
    // Set default max size (3-5 members)
    const maxSize = group.maxSize || 5;
    
    const newGroup: StudentGroup = {
      ...group,
      id,
      maxSize,
      createdAt: now
    };
    
    this.studentGroups.set(id, newGroup);
    return newGroup;
  }
  
  async getStudentGroup(id: number): Promise<StudentGroup | undefined> {
    const group = this.studentGroups.get(id);
    if (!group) return undefined;
    
    // Enrich with members and faculty info
    const members = await this.getStudentGroupMembers(id);
    let faculty = undefined;
    
    if (group.collaborationType === CollaborationType.FACULTY_COLLABORATION && group.facultyId) {
      faculty = await this.getUser(group.facultyId);
    }
    
    return { ...group, members, faculty };
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
  
  async getAvailableStudentGroups(): Promise<StudentGroup[]> {
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
    const id = this.currentAssessmentId++;
    const now = new Date();
    
    const newAssessment: ProjectAssessment = {
      ...assessment,
      id,
      createdAt: now
    };
    
    this.projectAssessments.set(id, newAssessment);
    return newAssessment;
  }
  
  async getProjectAssessment(projectId: number, assessorId: number): Promise<ProjectAssessment | undefined> {
    return Array.from(this.projectAssessments.values()).find(
      (assessment) => assessment.projectId === projectId && assessment.assessorId === assessorId
    );
  }
  
  async getProjectAssessments(projectId: number): Promise<(ProjectAssessment & { assessor: User })[]> {
    const assessments = Array.from(this.projectAssessments.values()).filter(
      (assessment) => assessment.projectId === projectId
    );
    
    // Enrich with assessor info
    return Promise.all(assessments.map(async (assessment) => {
      const assessor = await this.getUser(assessment.assessorId);
      return { ...assessment, assessor: assessor! };
    }));
  }
  
  async updateProjectAssessment(id: number, data: Partial<InsertProjectAssessment>): Promise<ProjectAssessment> {
    const assessment = this.projectAssessments.get(id);
    if (!assessment) {
      throw new Error("Assessment not found");
    }
    
    const updatedAssessment = { ...assessment, ...data };
    this.projectAssessments.set(id, updatedAssessment);
    
    return updatedAssessment;
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
  async getDepartmentStats(): Promise<any> {
    // Calculate real-time statistics based on actual data
    const projects = await this.getAllProjects();
    const users = await this.getAllUsers();
    
    // Group by department
    const departments = new Set(users.map(user => user.department));
    const stats: Record<string, { progress: number, studentCount: number, projectCount: number }> = {};
    
    for (const department of departments) {
      // Skip empty department
      if (!department) continue;
      
      const departmentStudents = users.filter(user => 
        user.role === UserRole.STUDENT && user.department === department
      );
      
      const departmentProjects = projects.filter(project => 
        project.student.department === department
      );
      
      // Calculate average progress
      const avgProgress = departmentProjects.length > 0
        ? departmentProjects.reduce((sum, project) => sum + project.progress, 0) / departmentProjects.length
        : 0;
      
      stats[department] = {
        progress: Math.round(avgProgress),
        studentCount: departmentStudents.length,
        projectCount: departmentProjects.length
      };
    }
    
    return stats;
  }
}

export const storage = new MemStorage();
