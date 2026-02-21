import { Router, Request, Response } from "express";
import { DBStorage } from "../db-storage";
import { UserRole, insertProjectTopicSchema } from "@shared/schema";
import { requireRole } from "../auth";
import { isAuthenticatedRequest } from "./utils";
import { z } from "zod";

export function registerTopicRoutes(router: Router, storage: DBStorage) {
    // Get all pending topics
    router.get("/api/topics/pending", requireRole([UserRole.COORDINATOR, UserRole.ADMIN]), async (req: Request, res: Response) => {
        try {
            const topics = await storage.getPendingTopics();
            console.log('Pending topics with submitter info:', topics);
            res.json(topics);
        } catch (error) {
            res.status(500).json({ message: "Failed to fetch pending topics" });
        }
    });

    // Get all approved topics (with categorization for students)
    router.get("/api/topics/approved", async (req: Request, res: Response) => {
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
    router.get("/api/topics/rejected", requireRole([UserRole.COORDINATOR, UserRole.ADMIN]), async (req: Request, res: Response) => {
        try {
            const topics = await storage.getRejectedTopics();
            console.log('Rejected topics with submitter info:', topics);
            res.json(topics);
        } catch (error) {
            res.status(500).json({ message: "Failed to fetch rejected topics" });
        }
    });

    // Get topics submitted by current teacher
    router.get("/api/topics/my", requireRole([UserRole.TEACHER]), async (req: Request, res: Response) => {
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
    router.post("/api/topics", requireRole([UserRole.TEACHER]), async (req: Request, res: Response) => {
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
    router.put("/api/topics/:id", requireRole([UserRole.TEACHER]), async (req: Request, res: Response) => {
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
    router.post("/api/topics/:id/approve", requireRole([UserRole.COORDINATOR, UserRole.ADMIN]), async (req: Request, res: Response) => {
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
    router.post("/api/topics/:id/reject", requireRole([UserRole.COORDINATOR, UserRole.ADMIN]), async (req: Request, res: Response) => {
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
}
