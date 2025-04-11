import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { UserRole, CollaborationType, insertProjectTopicSchema, insertStudentGroupSchema, insertProjectAssessmentSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes and middleware
  const { requireRole } = setupAuth(app);

  // Get statistics for dashboard
  app.get("/api/stats", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Mock stats for now
    const stats = {
      totalProjects: 48,
      approvedTopics: 32,
      pendingTopics: 7,
      unassignedStudents: 15
    };

    res.json(stats);
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
      res.json(topics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pending topics" });
    }
  });

  // Get all approved topics
  app.get("/api/topics/approved", async (req, res) => {
    try {
      const topics = await storage.getApprovedTopics();
      res.json(topics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch approved topics" });
    }
  });

  // Get all rejected topics
  app.get("/api/topics/rejected", requireRole([UserRole.COORDINATOR, UserRole.ADMIN]), async (req, res) => {
    try {
      const topics = await storage.getRejectedTopics();
      res.json(topics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch rejected topics" });
    }
  });

  // Get topics submitted by current teacher
  app.get("/api/topics/my", requireRole([UserRole.TEACHER]), async (req, res) => {
    try {
      const topics = await storage.getTopicsByTeacher(req.user.id);
      res.json(topics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch your topics" });
    }
  });

  // Submit new topic
  app.post("/api/topics", requireRole([UserRole.TEACHER]), async (req, res) => {
    try {
      const validatedData = insertProjectTopicSchema.parse({
        ...req.body,
        submittedById: req.user.id
      });
      
      const topic = await storage.createProjectTopic(validatedData);
      res.status(201).json(topic);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid topic data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create topic" });
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

  // Student Projects API Routes
  // Get projects for current student
  app.get("/api/projects/my", requireRole([UserRole.STUDENT]), async (req, res) => {
    try {
      const projects = await storage.getStudentProjects(req.user.id);
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch your projects" });
    }
  });

  // Student selects a topic
  app.post("/api/projects", requireRole([UserRole.STUDENT]), async (req, res) => {
    try {
      const { topicId } = req.body;
      if (!topicId) {
        return res.status(400).json({ message: "Topic ID is required" });
      }
      
      // Check if student already has a project
      const existingProjects = await storage.getStudentProjects(req.user.id);
      if (existingProjects.length > 0) {
        return res.status(400).json({ message: "You already have a project" });
      }
      
      const project = await storage.createStudentProject({
        studentId: req.user.id,
        topicId
      });
      
      res.status(201).json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to select topic" });
    }
  });

  // Get all projects (for coordinators and admins)
  app.get("/api/projects", requireRole([UserRole.COORDINATOR, UserRole.ADMIN]), async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projects" });
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
  app.get("/api/users", requireRole([UserRole.ADMIN]), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Remove passwords from response
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
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

  // Student Group API Routes
  
  // Create a new student group
  app.post("/api/student-groups", requireRole([UserRole.STUDENT]), async (req, res) => {
    try {
      // Validate input data
      const validatedData = insertStudentGroupSchema.parse({
        ...req.body,
        creatorId: req.user.id
      });
      
      // Check if student is already in a group
      const userGroup = await storage.getStudentGroupByMemberId(req.user.id);
      if (userGroup) {
        return res.status(400).json({ message: "You are already a member of a group" });
      }

      // Create the group
      const group = await storage.createStudentGroup(validatedData);

      // Add the creator to the group
      await storage.addStudentToGroup(req.user.id, group.id);

      res.status(201).json(group);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid group data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create student group" });
    }
  });

  // Get user's group
  app.get("/api/student-groups/my-group", requireRole([UserRole.STUDENT]), async (req, res) => {
    try {
      const group = await storage.getStudentGroupByMemberId(req.user.id);
      if (!group) {
        return res.status(404).json({ message: "You are not a member of any group" });
      }
      res.json(group);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch your group" });
    }
  });

  // Get available groups to join
  app.get("/api/student-groups/available", requireRole([UserRole.STUDENT]), async (req, res) => {
    try {
      const groups = await storage.getAvailableStudentGroups();
      res.json(groups);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch available groups" });
    }
  });

  // Join a group
  app.post("/api/student-groups/:id/join", requireRole([UserRole.STUDENT]), async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      
      // Check if student is already in a group
      const userGroup = await storage.getStudentGroupByMemberId(req.user.id);
      if (userGroup) {
        return res.status(400).json({ message: "You are already a member of a group" });
      }
      
      // Check if group exists and has space
      const group = await storage.getStudentGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      const groupMembers = await storage.getStudentGroupMembers(groupId);
      if (groupMembers.length >= group.maxSize) {
        return res.status(400).json({ message: "This group is already full" });
      }
      
      // Add student to group
      await storage.addStudentToGroup(req.user.id, groupId);
      
      // Get updated group
      const updatedGroup = await storage.getStudentGroup(groupId);
      res.json(updatedGroup);
    } catch (error) {
      res.status(500).json({ message: "Failed to join group" });
    }
  });

  // Leave a group
  app.post("/api/student-groups/:id/leave", requireRole([UserRole.STUDENT]), async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      
      // Check if student is in this group
      const userGroup = await storage.getStudentGroupByMemberId(req.user.id);
      if (!userGroup || userGroup.id !== groupId) {
        return res.status(400).json({ message: "You are not a member of this group" });
      }
      
      // Remove student from group
      await storage.removeStudentFromGroup(req.user.id, groupId);
      
      // Check if group is now empty and delete if necessary
      const groupMembers = await storage.getStudentGroupMembers(groupId);
      if (groupMembers.length === 0) {
        await storage.deleteStudentGroup(groupId);
      }
      
      res.json({ message: "Successfully left the group" });
    } catch (error) {
      res.status(500).json({ message: "Failed to leave group" });
    }
  });

  // Get list of teachers for student groups
  app.get("/api/teachers", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const teachers = users.filter(user => user.role === UserRole.TEACHER);
      
      // Remove passwords from response
      const sanitizedTeachers = teachers.map(({ password, ...teacher }) => teacher);
      
      res.json(sanitizedTeachers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch teachers" });
    }
  });

  // Project Assessment routes
  
  // Create or update assessment
  app.post("/api/projects/:id/assess", requireRole([UserRole.TEACHER, UserRole.COORDINATOR]), async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      
      // Validate input data
      const validatedData = insertProjectAssessmentSchema.parse({
        ...req.body,
        projectId,
        assessorId: req.user.id
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
  app.get("/api/projects/:id/assessments", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
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
        (req.user.role === UserRole.TEACHER && req.user.id === project.submittedById) ||
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
      const { password: _, ...studentData } = student;
      const facultyData = faculty ? { password: _, ...faculty } : null;
      
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

  const httpServer = createServer(app);
  return httpServer;
}
