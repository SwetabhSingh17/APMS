import {
  User, ProjectTopic, StudentProject, StudentGroup, ProjectMilestone, ProjectAssessment, Notification, UserRole,
  InsertUser, InsertProjectTopic, InsertStudentProject, InsertStudentGroup, InsertProjectAssessment, InsertNotification
} from "@shared/schema";
import { Store } from "express-session";

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
  getAllTopics(): Promise<ProjectTopic[]>;
  createProjectTopic(data: InsertProjectTopic): Promise<ProjectTopic>;
  approveProjectTopic(id: number, feedback?: string): Promise<ProjectTopic | undefined>;
  rejectProjectTopic(id: number, feedback: string): Promise<ProjectTopic | undefined>;
  updateProjectTopic(id: number, data: InsertProjectTopic): Promise<ProjectTopic>;
  deleteProjectTopic(id: number): Promise<boolean>;

  // Student project operations
  getStudentProject(id: number): Promise<StudentProject | undefined>;
  getStudentProjects(studentId: number): Promise<(StudentProject & { topic: ProjectTopic | null })[]>;
  createStudentProject(project: InsertStudentProject): Promise<StudentProject>;
  updateStudentProject(id: number, data: Partial<InsertStudentProject>): Promise<StudentProject | undefined>;
  getAllProjects(): Promise<(StudentProject & { topic: ProjectTopic; student: User })[]>;
  isTopicAllotted(topicId: number): Promise<boolean>;

  // Student Group operations
  createStudentGroup(group: InsertStudentGroup, creatorId: number, invitedEnrollmentNumbers: string[]): Promise<StudentGroup>;
  getGroup(id: number): Promise<StudentGroup | undefined>;
  getUserGroup(userId: number): Promise<StudentGroup | undefined>;
  getStudentGroupMembers(groupId: number): Promise<User[]>;
  getAcceptedGroupMembers(groupId: number): Promise<User[]>;
  // Returns group and status for a specific user
  getUserGroupMembership(userId: number): Promise<{ group: StudentGroup, status: string } | undefined>;
  addStudentToGroup(userId: number, groupId: number): Promise<boolean>;
  removeStudentFromGroup(userId: number, groupId: number): Promise<boolean>;
  getUsersByRole(role: UserRole): Promise<User[]>;
  acceptGroupInvite(userId: number, groupId: number): Promise<boolean>;
  rejectGroupInvite(userId: number, groupId: number): Promise<boolean>;

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

  // Project milestones
  getProjectMilestones(projectId: number): Promise<ProjectMilestone[]>;

  // Session store
  sessionStore: Store;

  // Admin operations
  exportData(): Promise<any>;
  importData(data: any): Promise<boolean>;
  generateExcelReport(): Promise<any[]>;
  resetDatabase(): Promise<boolean>;
}