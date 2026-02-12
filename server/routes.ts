/**
 * REST API Routes — Integral Project Hub
 *
 * Registers all HTTP endpoints on the Express app. Routes are organized by domain:
 *  - /auth/*              — Login, logout, registration
 *  - /api/profile         — User profile read/update
 *  - /api/topics/*        — Project topic CRUD, approval workflow
 *  - /api/projects/*      — Student project selection, listing, teacher view
 *  - /api/student-groups/* — Group creation, invites, membership management
 *  - /api/users           — User listing (admin/coordinator)
 *  - /api/admin/*         — System management (export, import, reset, Excel)
 *  - /api/stats           — Dashboard statistics
 *  - /api/departments/*   — Department-level analytics
 *
 * Access control is enforced via `requireRole()` middleware from auth.ts.
 * All routes interact with the database through the IStorage interface.
 */
import type { Express } from "express";
import { createServer, type Server } from "http";
import type { IStorage } from "./storage/interface";
import { setupAuth, hashPassword, comparePasswords } from "./auth";
import { UserRole, CollaborationType, insertProjectTopicSchema, insertStudentGroupSchema, insertProjectAssessmentSchema, User, ProjectTopic, StudentProject as Project } from "@shared/schema";
import { z } from "zod";
import passport from "passport";
import { Request, Response } from "express";

function isAuthenticatedRequest(req: Request): req is Request & { user: User } {
  return req.isAuthenticated() && req.user !== undefined;
}

export async function registerRoutes(app: Express, storage: IStorage): Promise<Server> {
  // Set up authentication routes and middleware
  const { requireRole } = setupAuth(app, storage);

  // Authentication routes
  app.post("/auth/login", passport.authenticate("local"), (req: Request, res: Response) => {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ message: "Authentication failed" });
    }
    res.json({ message: "Login successful", user: req.user });
  });

  app.post("/auth/logout", (req: Request, res: Response) => {
    req.logout(() => {
      res.json({ message: "Logout successful" });
    });
  });

  app.post("/auth/register", async (req: Request, res: Response) => {
    try {
      const { username, password, role, enrollmentNumber, firstName, lastName, email, department } = req.body;

      if (!username || !password || !role || !enrollmentNumber || !firstName || !lastName || !email || !department) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        role,
        enrollmentNumber,
        firstName,
        lastName,
        email,
        department
      });

      res.status(201).json({ message: "Registration successful", user });
    } catch (error) {
      if (error instanceof Error && error.message.includes("duplicate key")) {
        return res.status(400).json({ message: "Username or enrollment number already exists" });
      }
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Get statistics for dashboard
  app.get("/api/stats", async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      const topics = await storage.getAllTopics();
      const users = await storage.getAllUsers();
      const departmentStats = await storage.getDepartmentStats();

      const totalStudents = users.filter(u => u.role === UserRole.STUDENT).length;
      const totalProjects = projects.length;

      const stats = {
        totalProjects,
        approvedTopics: topics.filter(t => t.status === 'approved').length,
        pendingTopics: topics.filter(t => t.status === 'pending').length,
        unassignedStudents: users.filter(u =>
          u.role === UserRole.STUDENT &&
          !projects.some(p => p.student.id === u.id)
        ).length,
        averageProgress: projects.length > 0
          ? Math.round(projects.reduce((sum, p) => sum + (p.progress || 0), 0) / projects.length)
          : 0,
        departmentStats,
        projectPhases: {
          topicSelection: totalStudents > 0 ? Math.round((totalProjects / totalStudents) * 100) : 0,
          research: projects.length > 0 ? Math.round((projects.filter(p => p.progress >= 25).length / projects.length) * 100) : 0,
          implementation: projects.length > 0 ? Math.round((projects.filter(p => p.progress >= 50).length / projects.length) * 100) : 0,
          testing: projects.length > 0 ? Math.round((projects.filter(p => p.progress >= 80).length / projects.length) * 100) : 0
        }
      };

      res.json(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });

  // Get user profile
  app.get("/api/profile", async (req: Request, res: Response) => {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const profile = await storage.getUserProfile(req.user.id);
      res.json(profile);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  // Update user profile
  app.put("/api/profile", async (req: Request, res: Response) => {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const { firstName, lastName, email, department } = req.body;
      const updatedProfile = await storage.updateUserProfile(req.user.id, {
        firstName,
        lastName,
        email,
        department
      });
      res.json(updatedProfile);
    } catch (error) {
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Get recent activities
  app.get("/api/activities", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Mock activities for now
    const activities = [
      {
        id: 1,
        type: "topic_submitted",
        message: "Dr. Raj Kumar submitted a new project topic",
        timestamp: "Today, 10:45 AM"
      },
      {
        id: 2,
        type: "topic_selected",
        message: "Student Aarav Singh selected a project topic",
        timestamp: "Today, 9:30 AM"
      },
      {
        id: 3,
        type: "deadline",
        message: "Deadline reminder: Topic submission closes tomorrow",
        timestamp: "Yesterday, 3:15 PM"
      },
      {
        id: 4,
        type: "warning",
        message: "15 students still have not selected a topic",
        timestamp: "Yesterday, 2:00 PM"
      }
    ];

    res.json(activities);
  });

  // Project Topics API Routes
  // Get all pending topics
  app.get("/api/topics/pending", requireRole([UserRole.COORDINATOR, UserRole.ADMIN]), async (req, res) => {
    try {
      const topics = await storage.getPendingTopics();
      console.log('Pending topics with submitter info:', topics);
      res.json(topics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pending topics" });
    }
  });

  // Get all approved topics (with categorization for students)
  app.get("/api/topics/approved", async (req, res) => {
    try {
      const topics = await storage.getApprovedTopics();
      console.log('Approved topics with submitter info:', topics);

      // If the user is a student, categorize topics
      if (isAuthenticatedRequest(req) && req.user?.role === UserRole.STUDENT) {
        const studentId = req.user.id;

        // Check if student has selected a topic (has a project)
        const studentProjects = await storage.getStudentProjects(studentId);
        const hasSelectedTopic = studentProjects.length > 0;
        const myTopicId = hasSelectedTopic ? studentProjects[0].topicId : null;

        // Get all projects to identify taken topics
        const allProjects = await storage.getAllProjects();
        const takenTopicIds = allProjects
          .filter(p => p.topicId !== myTopicId) // Exclude student's own topic
          .map(p => p.topicId);

        // Categorize topics
        const myTopic = myTopicId ? topics.find(t => t.id === myTopicId) : null;
        const availableTopics = topics.filter(
          t => !takenTopicIds.includes(t.id) && t.id !== myTopicId
        );
        const takenTopics = topics.filter(
          t => takenTopicIds.includes(t.id)
        );

        return res.json({
          hasSelectedTopic,
          myTopic: myTopic || undefined,
          availableTopics,
          takenTopics
        });
      }

      // For non-students, return all approved topics as before
      res.json(topics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch approved topics" });
    }
  });

  // Get all rejected topics
  app.get("/api/topics/rejected", requireRole([UserRole.COORDINATOR, UserRole.ADMIN]), async (req, res) => {
    try {
      const topics = await storage.getRejectedTopics();
      console.log('Rejected topics with submitter info:', topics);
      res.json(topics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch rejected topics" });
    }
  });

  // Get topics submitted by current teacher
  app.get("/api/topics/my", requireRole([UserRole.TEACHER]), async (req: Request, res: Response) => {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      console.log("Fetching topics for teacher:", req.user.id);
      const topics = await storage.getTopicsByTeacher(req.user.id);
      console.log("Found topics:", topics);
      res.json(topics);
    } catch (error) {
      console.error("Error fetching topics:", error);
      res.status(500).json({ message: "Failed to fetch your topics" });
    }
  });

  // Submit new topic
  app.post("/api/topics", requireRole([UserRole.TEACHER]), async (req: Request, res: Response) => {
    console.log("POST /api/topics called");

    if (!isAuthenticatedRequest(req)) {
      console.log("Unauthorized request");
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      console.log("Received topic data:", req.body);

      // Validate required fields
      const { title, description, technology, projectType } = req.body;

      if (!title || !technology || !projectType) {
        return res.status(400).json({
          message: "Missing required fields: title, technology, and projectType are required"
        });
      }

      // Prepare topic data with user ID
      const topicData = {
        title,
        description,
        technology,
        projectType,
        submittedById: req.user.id,
      };

      console.log("Prepared topic data:", topicData);

      try {
        const validatedData = insertProjectTopicSchema.parse(topicData);
        console.log("Validated topic data:", validatedData);

        const topic = await storage.createProjectTopic(validatedData);
        console.log("Topic created:", topic);

        res.status(201).json(topic);
      } catch (validationError) {
        console.error("Validation error:", validationError);
        if (validationError instanceof z.ZodError) {
          console.error("Zod validation errors:", validationError.errors);
          return res.status(400).json({ message: "Invalid topic data", errors: validationError.errors });
        }
        throw validationError;
      }
    } catch (error) {
      console.error("Error creating topic:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid topic data", errors: error.errors });
      }
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to create topic" });
    }
  });

  // Update topic
  app.put("/api/topics/:id", requireRole([UserRole.TEACHER]), async (req: Request, res: Response) => {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const topicId = parseInt(req.params.id);
      const existingTopic = await storage.getProjectTopic(topicId);

      if (!existingTopic) {
        return res.status(404).json({ message: "Topic not found" });
      }

      if (existingTopic.submittedById !== req.user.id) {
        return res.status(403).json({ message: "You can only edit your own topics" });
      }

      if (existingTopic.status !== 'pending') {
        return res.status(403).json({ message: "You can only edit pending topics" });
      }

      const validatedData = insertProjectTopicSchema.parse({
        ...req.body,
        submittedById: req.user.id
      });

      const updatedTopic = await storage.updateProjectTopic(topicId, validatedData);
      res.json(updatedTopic);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid topic data", errors: error.errors });
      }
      console.error("Error updating topic:", error);
      res.status(500).json({ message: "Failed to update topic" });
    }
  });

  // Approve topic
  app.post("/api/topics/:id/approve", requireRole([UserRole.COORDINATOR, UserRole.ADMIN]), async (req, res) => {
    try {
      const topicId = parseInt(req.params.id);
      const { feedback } = req.body;

      const topic = await storage.approveProjectTopic(topicId, feedback);
      if (!topic) {
        return res.status(404).json({ message: "Topic not found" });
      }

      res.json(topic);
    } catch (error) {
      res.status(500).json({ message: "Failed to approve topic" });
    }
  });

  // Reject topic
  app.post("/api/topics/:id/reject", requireRole([UserRole.COORDINATOR, UserRole.ADMIN]), async (req, res) => {
    try {
      const topicId = parseInt(req.params.id);
      const { feedback } = req.body;

      const topic = await storage.rejectProjectTopic(topicId, feedback);
      if (!topic) {
        return res.status(404).json({ message: "Topic not found" });
      }

      res.json(topic);
    } catch (error) {
      res.status(500).json({ message: "Failed to reject topic" });
    }
  });

  app.patch("/api/admin/users/:id", requireRole([UserRole.ADMIN, UserRole.COORDINATOR]), async (req, res, next) => {
    try {
      const userId = parseInt(req.params.id);
      const updateData = { ...req.body };

      // If password is being updated, hash it first
      if (updateData.password) {
        updateData.password = await hashPassword(updateData.password);
      }

      const user = await storage.updateUser(userId, updateData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...userWithoutPassword } = user;
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      next(error);
    }
  });

  // Student Projects API Routes
  // Get projects for current student
  app.get("/api/projects/my", requireRole([UserRole.STUDENT]), async (req: Request, res: Response) => {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const projects = await storage.getStudentProjects(req.user.id);
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch your projects" });
    }
  });

  // Student selects a topic
  app.post("/api/projects", requireRole([UserRole.STUDENT]), async (req: Request, res: Response) => {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const { topicId } = req.body;
      const user = req.user!;

      if (!topicId) {
        return res.status(400).json({ message: "Topic ID is required" });
      }

      // Check if user is in a group
      const userGroup = await storage.getUserGroup(user.id);

      // Check if topic exists and is approved
      const topic = await storage.getProjectTopic(topicId);
      if (!topic) {
        return res.status(404).json({ message: "Topic not found" });
      }
      if (topic.status !== 'approved') {
        return res.status(400).json({ message: "Selected topic is not approved" });
      }

      // Check if topic is already allotted
      const isAllotted = await storage.isTopicAllotted(topicId);
      if (isAllotted) {
        return res.status(400).json({ message: "This topic has already been selected by another student/group" });
      }

      if (userGroup) {
        // Enforce Group Creator Authority
        // Note: We need to check if schema generated types include createdById. 
        // If createdById is missing in types (due to partial update), we might need to cast or fix schema.ts first.
        // Assuming it is present as per previous steps.

        if (userGroup.createdById !== user.id) {
          return res.status(403).json({ message: "Only the group creator can select a project topic." });
        }

        // Get all ACCEPTED members
        const groupMembers = await storage.getAcceptedGroupMembers(userGroup.id);

        // Check if ANY member already has a project
        for (const member of groupMembers) {
          const existingProjects = await storage.getStudentProjects(member.id);
          if (existingProjects.length > 0) {
            return res.status(400).json({ message: `Group member ${member.firstName} ${member.lastName} already has a project assigned.` });
          }
        }

        // Bulk Create Projects
        const projects = await Promise.all(groupMembers.map(member =>
          storage.createStudentProject({
            studentId: member.id,
            topicId
          })
        ));

        // Return the first project (as they are all the same topic)
        return res.status(201).json(projects[0]);

      } else {
        // Individual assignment fallback
        const existingProjects = await storage.getStudentProjects(user.id);
        if (existingProjects.length > 0) {
          return res.status(400).json({ message: "You already have a project" });
        }

        const project = await storage.createStudentProject({
          studentId: user.id,
          topicId
        });

        return res.status(201).json(project);
      }
    } catch (error) {
      console.error("Error creating project:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to select topic";
      res.status(500).json({ message: errorMessage });
    }
  });

  // Get all projects (for coordinators, admins, and teachers)
  app.get("/api/projects", requireRole([UserRole.COORDINATOR, UserRole.ADMIN, UserRole.TEACHER]), async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      console.log('Projects from storage:', projects);
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // Get projects for teacher
  app.get("/api/projects/teacher", requireRole([UserRole.TEACHER]), async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const allProjects = await storage.getAllProjects();
      console.log('All projects:', allProjects);

      const teacherProjects = allProjects.filter(project => {
        console.log('Checking project:', {
          projectId: project.id,
          topicSubmittedById: project.topic?.submittedById,
          teacherId: req.user?.id,
          topicTitle: project.topic?.title
        });
        return project.topic?.submittedById === req.user.id;
      });

      console.log('Filtered teacher projects:', teacherProjects.map(p => ({
        id: p.id,
        student: p.student.firstName + ' ' + p.student.lastName,
        topic: p.topic?.title,
        progress: p.progress
      })));

      res.json(teacherProjects);
    } catch (error) {
      console.error('Error fetching teacher projects:', error);
      res.status(500).json({ message: "Failed to fetch teacher projects" });
    }
  });

  // Department statistics
  app.get("/api/departments/stats", requireRole([UserRole.COORDINATOR, UserRole.ADMIN]), async (req, res) => {
    try {
      const stats = await storage.getDepartmentStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch department statistics" });
    }
  });

  // User Management API Routes (admin only)
  app.get("/api/users", requireRole([UserRole.ADMIN, UserRole.COORDINATOR]), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Remove passwords from response
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Export Database Data
  app.post("/api/admin/export", requireRole([UserRole.ADMIN]), async (req, res) => {
    try {
      const data = await storage.exportData();

      // Set headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=database-export.json');

      res.json(data);
    } catch (error) {
      console.error("Export failed:", error);
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  // Reset Database
  app.post("/api/admin/reset", requireRole([UserRole.ADMIN]), async (req, res) => {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const success = await storage.resetDatabase();

      if (success) {
        // Log out the user since their account (or session) might be affected/reset
        req.logout(() => {
          res.json({ message: "Database reset successfully. Please log in with default credentials." });
        });
      } else {
        res.status(500).json({ message: "Failed to reset database" });
      }
    } catch (error) {
      console.error("Reset failed:", error);
      res.status(500).json({ message: "An error occurred while resetting database" });
    }
  });

  // Import/Restore Database
  app.post("/api/admin/import", requireRole([UserRole.ADMIN]), async (req, res) => {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const importData = req.body;

      // Validate that we have data
      if (!importData || typeof importData !== 'object') {
        return res.status(400).json({ message: "Invalid import data" });
      }

      // Validate required structure
      if (!importData.users && !importData.projectTopics && !importData.studentProjects) {
        return res.status(400).json({
          message: "Invalid import format: missing required data tables"
        });
      }

      await storage.importData(importData);
      res.json({ message: "Database restored successfully" });
    } catch (error) {
      console.error("Import failed:", error);
      res.status(500).json({ message: "Failed to import database" });
    }
  });

  // Generate Excel Report
  app.post("/api/admin/export-excel", requireRole([UserRole.ADMIN]), async (req, res) => {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const reportData = await storage.generateExcelReport();
      res.json({ data: reportData });
    } catch (error) {
      console.error("Excel export failed:", error);
      res.status(500).json({ message: "Failed to generate Excel report" });
    }
  });

  // Notification Preferences
  app.patch("/api/user/notifications", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      // In a real application, we would store these preferences
      // For now, just return success
      res.json({ message: "Notification preferences updated" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update notification preferences" });
    }
  });

  // Student Groups API Routes
  // Create a new student group
  app.post("/api/student-groups", requireRole([UserRole.STUDENT]), async (req: Request, res: Response) => {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const { name, description, facultyId, enrollmentNumbers } = req.body;

      // Validate that the user is not already in a group
      const existingGroup = await storage.getUserGroup(req.user.id);
      if (existingGroup) {
        return res.status(400).json({ message: "You are already in a group" });
      }

      // Validate faculty exists
      const faculty = await storage.getUser(facultyId);
      if (!faculty || faculty.role !== UserRole.TEACHER) {
        return res.status(400).json({ message: "Invalid faculty mentor" });
      }

      // Validate all enrollment numbers exist and are students
      const students = await Promise.all(
        enrollmentNumbers.map(async (enrollmentNumber: string) => {
          const student = await storage.getUserByEnrollmentNumber(enrollmentNumber);
          if (!student || student.role !== UserRole.STUDENT) {
            throw new Error(`Invalid student enrollment number: ${enrollmentNumber}`);
          }
          return student;
        })
      );

      // Check if any student is already in a group
      for (const student of students) {
        const studentGroup = await storage.getUserGroup(student.id);
        if (studentGroup) {
          return res.status(400).json({
            message: `Student ${student.firstName} ${student.lastName} is already in a group`
          });
        }
      }

      // Create the group with invites
      const group = await storage.createStudentGroup({
        name,
        description,
        facultyId,
        maxSize: 5,
      }, req.user.id, enrollmentNumbers);

      // Invited members are now handled by createStudentGroup


      res.status(201).json(group);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  // Accept group invite
  app.post("/api/groups/invite/:groupId/accept", requireRole([UserRole.STUDENT]), async (req: Request, res: Response) => {
    const groupId = parseInt(req.params.groupId);
    const success = await storage.acceptGroupInvite(req.user!.id, groupId);
    if (success) {
      res.sendStatus(200);
    } else {
      res.status(400).json({ message: "Failed to accept invite" });
    }
  });

  // Reject group invite
  app.post("/api/groups/invite/:groupId/reject", requireRole([UserRole.STUDENT]), async (req: Request, res: Response) => {
    const groupId = parseInt(req.params.groupId);
    const success = await storage.rejectGroupInvite(req.user!.id, groupId);
    if (success) {
      res.sendStatus(200);
    } else {
      res.status(400).json({ message: "Failed to reject invite" });
    }
  });

  // Get current user's group
  app.get("/api/student-groups/my-group", requireRole([UserRole.STUDENT]), async (req: Request, res: Response) => {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const membership = await storage.getUserGroupMembership(req.user.id);
      if (!membership) {
        return res.status(404).json({ message: "You are not in a group" });
      }

      const { group, status } = membership;

      // Get group members and faculty details
      const members = await storage.getStudentGroupMembers(group.id);
      const faculty = await storage.getUser(group.facultyId);

      // Return the complete group data with members and faculty
      res.json({
        ...group,
        myStatus: status,
        members: members.map(member => ({
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
          department: member.department,
          enrollmentNumber: member.enrollmentNumber,
          role: member.role
        })),
        faculty: faculty ? {
          id: faculty.id,
          firstName: faculty.firstName,
          lastName: faculty.lastName,
          email: faculty.email,
          department: faculty.department,
          role: faculty.role
        } : null
      });
    } catch (error) {
      console.error("Error fetching group:", error);
      res.status(500).json({ message: "Failed to fetch group" });
    }
  });

  // Leave a group
  app.post("/api/student-groups/:groupId/leave", requireRole([UserRole.STUDENT]), async (req: Request, res: Response) => {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const groupId = parseInt(req.params.groupId);
      const group = await storage.getGroup(groupId);

      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Check if user is in the group
      const userGroup = await storage.getUserGroup(req.user.id);
      if (!userGroup || userGroup.id !== groupId) {
        return res.status(400).json({ message: "You are not a member of this group" });
      }

      // Remove user from group
      await storage.removeStudentFromGroup(req.user.id, groupId);

      res.json({ message: "Successfully left the group" });
    } catch (error) {
      console.error("Error leaving group:", error);
      res.status(500).json({ message: "Failed to leave group" });
    }
  });

  // Get all teachers
  app.get("/api/teachers", async (req: Request, res: Response) => {
    try {
      const teachers = await storage.getUsersByRole(UserRole.TEACHER);
      res.json(teachers);
    } catch (error) {
      console.error("Error fetching teachers:", error);
      res.status(500).json({ message: "Failed to fetch teachers" });
    }
  });

  // Project Assessment routes

  // Create or update assessment
  app.post("/api/projects/:id/assess", requireRole([UserRole.TEACHER, UserRole.COORDINATOR]), async (req: Request, res: Response) => {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const projectId = parseInt(req.params.id);

      // Validate input data
      const validatedData = insertProjectAssessmentSchema.parse({
        ...req.body,
        projectId,
        facultyId: req.user.id
      });

      // Check if project exists
      const project = await storage.getStudentProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if assessment already exists
      const existingAssessment = await storage.getProjectAssessment(projectId, req.user.id);

      let assessment;
      if (existingAssessment) {
        // Update existing assessment
        assessment = await storage.updateProjectAssessment(existingAssessment.id, validatedData);
      } else {
        // Create new assessment
        assessment = await storage.createProjectAssessment(validatedData);
      }

      res.status(201).json(assessment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid assessment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to save assessment" });
    }
  });

  // Get project assessments
  app.get("/api/projects/:id/assessments", async (req: Request, res: Response) => {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const projectId = parseInt(req.params.id);

      // Check if project exists
      const project = await storage.getStudentProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if user is authorized to view assessments
      const isAuthorized =
        req.user.role === UserRole.ADMIN ||
        req.user.role === UserRole.COORDINATOR ||
        (req.user.role === UserRole.TEACHER && req.user.id === project.topicId) ||
        (req.user.role === UserRole.STUDENT && req.user.id === project.studentId);

      if (!isAuthorized) {
        return res.status(403).json({ message: "You are not authorized to view these assessments" });
      }

      const assessments = await storage.getProjectAssessments(projectId);
      res.json(assessments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assessments" });
    }
  });

  // Search and generate reports
  app.get("/api/reports/search", requireRole([UserRole.COORDINATOR, UserRole.ADMIN]), async (req, res) => {
    try {
      const {
        projectName,
        facultyName,
        studentName,
        enrollmentNumber,
        department,
        status
      } = req.query;

      const projects = await storage.searchProjects({
        projectName: projectName as string,
        facultyName: facultyName as string,
        studentName: studentName as string,
        enrollmentNumber: enrollmentNumber as string,
        department: department as string,
        status: status as string
      });

      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to search projects" });
    }
  });

  // Generate a detailed project report for a specific project
  app.get("/api/reports/projects/:id", requireRole([UserRole.COORDINATOR, UserRole.ADMIN, UserRole.TEACHER]), async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);

      // Get project details
      const project = await storage.getStudentProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Get topic details
      const topic = await storage.getProjectTopic(project.topicId);

      // Get student details
      const student = await storage.getUser(project.studentId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Get faculty details
      const faculty = topic ? await storage.getUser(topic.submittedById) : null;

      // Get milestones
      const milestones = await storage.getProjectMilestones(projectId);

      // Get assessments
      const assessments = await storage.getProjectAssessments(projectId);

      // Sanitize sensitive information
      const { password: studentPassword, ...studentData } = student;
      const { password: facultyPassword, ...facultyData } = faculty || {};

      // Compile report
      const report = {
        project,
        topic,
        student: studentData,
        faculty: facultyData,
        milestones,
        assessments,
        generatedAt: new Date(),
      };

      res.json(report);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate project report" });
    }
  });

  // Update project progress
  app.put('/api/projects/:id/progress', async (req, res) => {
    const projectId = parseInt(req.params.id);
    const { progress } = req.body;
    const userId = req.user?.id;

    console.log('Progress update request:', {
      projectId,
      progress,
      userId,
      body: req.body
    });

    if (!userId) {
      console.log('No user ID found in request');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (typeof progress !== 'number' || progress < 0 || progress > 100) {
      console.log('Invalid progress value:', progress);
      return res.status(400).json({ error: 'Invalid progress value' });
    }

    try {
      const project = await storage.getStudentProject(projectId);
      console.log('Found project:', project);

      if (!project) {
        console.log('Project not found:', projectId);
        return res.status(404).json({ error: 'Project not found' });
      }

      const updatedProject = await storage.updateStudentProject(projectId, {
        progress
      } as any);
      console.log('Updated project:', updatedProject);

      res.json(updatedProject);
    } catch (error) {
      console.error('Error updating progress:', error);
      res.status(500).json({ error: 'Failed to update progress' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
