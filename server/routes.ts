import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { UserRole, insertProjectTopicSchema } from "@shared/schema";
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

  const httpServer = createServer(app);
  return httpServer;
}
