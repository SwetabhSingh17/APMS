import { Router, Request, Response } from "express";
import { DBStorage } from "../db-storage";
import { UserRole, insertProjectTopicSchema } from "@shared/schema";
import { notifyUser } from "../websocket";
import { requireRole } from "../auth";
import { isAuthenticatedRequest } from "./utils";
import { z } from "zod";

export function registerTopicRoutes(router: Router, storage: DBStorage) {
    // Get all pending topics
    router.get("/api/topics/pending", requireRole([UserRole.COORDINATOR, UserRole.ADMIN]), async (req: Request, res: Response) => {
        try {
            const topics = await storage.getPendingTopics();
            const courseFilter = req.query.course as string | undefined;
            const filtered = courseFilter ? topics.filter(t => (t as any).course === courseFilter) : topics;
            res.json(filtered);
        } catch (error) {
            res.status(500).json({ message: "Failed to fetch pending topics" });
        }
    });

    // Get all approved topics (with categorization for students)
    router.get("/api/topics/approved", async (req: Request, res: Response) => {
        try {
            // Set Cache-Control for read-heavy endpoint
            res.setHeader('Cache-Control', 'public, max-age=60');

            const courseFilter = req.query.course as string | undefined;

            // If the user is a student, auto-filter by their course
            if (isAuthenticatedRequest(req) && req.user?.role === UserRole.STUDENT) {
                let topics = await storage.getApprovedTopics();
                const studentId = req.user.id;
                const studentCourse = (req.user as any).course;

                // Only show topics matching the student's course
                if (studentCourse) {
                    topics = topics.filter(t => (t as any).course === studentCourse);
                }

                // Check if student has selected a topic (has a project)
                const studentProjects = await storage.getStudentProjects(studentId);
                const hasSelectedTopic = studentProjects.length > 0;
                const myTopicId = hasSelectedTopic ? studentProjects[0].topicId : null;

                // Get all projects to identify taken topics
                const allProjects = await storage.getAllProjects();
                const takenTopicIds = allProjects
                    .filter(p => p.topicId !== myTopicId)
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
            } else {
                // Admin or other roles - Paginate response
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 50;
                const paginatedTopics = await storage.getPaginatedApprovedTopics(page, limit, courseFilter);
                res.json(paginatedTopics);
            }
        } catch (error) {
            res.status(500).json({ message: "Failed to fetch approved topics" });
        }
    });

    // Get all rejected topics
    router.get("/api/topics/rejected", requireRole([UserRole.COORDINATOR, UserRole.ADMIN]), async (req: Request, res: Response) => {
        try {
            const topics = await storage.getRejectedTopics();
            const courseFilter = req.query.course as string | undefined;
            const filtered = courseFilter ? topics.filter(t => (t as any).course === courseFilter) : topics;
            res.json(filtered);
        } catch (error) {
            res.status(500).json({ message: "Failed to fetch rejected topics" });
        }
    });

    // Get topics submitted by current supervisor
    router.get("/api/topics/my", requireRole([UserRole.SUPERVISOR]), async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            console.log("Fetching topics for supervisor:", req.user.id);
            const topics = await storage.getTopicsBySupervisor(req.user.id);
            const courseFilter = req.query.course as string | undefined;
            const filtered = courseFilter ? topics.filter(t => (t as any).course === courseFilter) : topics;
            console.log("Found topics:", filtered);
            res.json(filtered);
        } catch (error) {
            console.error("Error fetching topics:", error);
            res.status(500).json({ message: "Failed to fetch your topics" });
        }
    });

    // Get topics suggested by students for supervisor approval (MCA)
    router.get("/api/topics/supervisor-pending", requireRole([UserRole.SUPERVISOR]), async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            console.log("Fetching student-suggested topics for supervisor:", req.user.id);
            const topics = await storage.getTopicsForSupervisorApproval(req.user.id);
            res.json(topics);
        } catch (error) {
            console.error("Error fetching supervisor-pending topics:", error);
            res.status(500).json({ message: "Failed to fetch pending topics" });
        }
    });

    // Supervisor Endorse/Reject a topic
    router.patch("/api/topics/:id/supervisor-action", requireRole([UserRole.SUPERVISOR]), async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            const topicId = parseInt(req.params.id);
            const { action, feedback } = req.body; // action: 'endorse' | 'reject'

            if (!['endorse', 'reject'].includes(action)) {
                return res.status(400).json({ message: "Invalid action" });
            }

            const topic = await storage.getProjectTopic(topicId);
            if (!topic) {
                return res.status(404).json({ message: "Topic not found" });
            }
            if (topic.status !== "pending_supervisor") {
                return res.status(400).json({ message: "Topic is not pending supervisor approval" });
            }

            // Verify the supervisor is indeed assigned to the submitter's group
            const submitter = await storage.getUser(topic.submittedById);
            if (!submitter || !submitter.groupId) {
                return res.status(400).json({ message: "Submitter group not found" });
            }
            const group = await storage.getGroup(submitter.groupId);
            if (!group || group.supervisorId !== req.user.id) {
                return res.status(403).json({ message: "Not authorized to endorse this topic" });
            }

            const newStatus = action === 'endorse' ? 'pending' : 'rejected';
            
            const updatedTopic = await storage.updateProjectTopicStatus(topicId, newStatus, feedback || topic.feedback);

            // Notify the student
            notifyUser(submitter.id, {
                title: `Topic ${action === 'endorse' ? 'Endorsed' : 'Rejected'}`,
                message: `Your topic suggestion "${topic.title}" has been ${action === 'endorse' ? 'endorsed and sent to Coordinator' : 'rejected'}.`
            } as any);

            // If endorsed, notify coordinators (We fetch coordinators)
            if (action === 'endorse') {
               const allUsers = await storage.getAllUsers();
               const coordinatorsAndAdmins = allUsers.filter(u => u.role === UserRole.COORDINATOR || u.role === UserRole.ADMIN);
               for (const admin of coordinatorsAndAdmins) {
                   notifyUser(admin.id, {
                       title: "New Topic Endorsed",
                       message: `Supervisor ${req.user.firstName} ${req.user.lastName} has endorsed a new MCA topic: "${topic.title}".`
                   } as any);
               }
            }

            res.json(updatedTopic);
        } catch (error) {
            console.error("Error processing supervisor action:", error);
            res.status(500).json({ message: "Failed to process action" });
        }
    });

    // Get topics suggested by the current MCA student
    router.get("/api/topics/my-suggestions", requireRole([UserRole.STUDENT]), async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        try {
            // Note: student suggestions have `submittedById` set to the student
            const topics = await storage.getTopicsBySupervisor(req.user.id);
            res.json(topics);
        } catch (error) {
            console.error("Error fetching my suggestions:", error);
            res.status(500).json({ message: "Failed to fetch your suggestions" });
        }
    });

    // Student suggests a new topic (MCA only)
    router.post("/api/topics/suggest", requireRole([UserRole.STUDENT]), async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            // Check if user is MCA
            if ((req.user as any).course !== "MCA") {
                return res.status(403).json({ message: "Only MCA students can suggest topics" });
            }
            
            if (!req.user.groupId) {
                return res.status(400).json({ message: "You are not in a project team" });
            }

            // Check if student has a supervisor assigned
            const studentGroup = await storage.getGroup(req.user.groupId);
            if (!studentGroup) {
                return res.status(400).json({ message: "Project team not found" });
            }
            if (!studentGroup.supervisorId) {
                return res.status(400).json({ message: "Your team does not have a supervisor assigned yet" });
            }

            const { title, description, technology, projectType } = req.body;

            if (!title || !technology || !projectType) {
                return res.status(400).json({
                    message: "Missing required fields: title, technology, and projectType are required"
                });
            }

            // Note: status is set to pending_supervisor and course is MCA
            const topicData = {
                title,
                description,
                technology,
                projectType,
                course: "MCA",
                submittedById: req.user.id,
                status: "pending_supervisor"
            };

            const validatedData = insertProjectTopicSchema.parse(topicData);
            const topic = await storage.createProjectTopic({
                ...validatedData,
                status: "pending_supervisor"
            } as any);

            // Notify the assigned supervisor
            notifyUser(studentGroup.supervisorId, {
                title: "New Topic Suggestion",
                message: `An MCA team has suggested a new topic: "${title}". Please review it in your dashboard.`
            } as any);

            res.status(201).json(topic);
        } catch (error) {
            console.error("Error suggesting topic:", error);
            if (error instanceof z.ZodError) {
                return res.status(400).json({ message: "Invalid topic data", errors: error.errors });
            }
            res.status(500).json({ message: "Failed to suggest topic" });
        }
    });

    // Submit new topic
    router.post("/api/topics", requireRole([UserRole.SUPERVISOR]), async (req: Request, res: Response) => {
        console.log("POST /api/topics called");

        if (!isAuthenticatedRequest(req)) {
            console.log("Unauthorized request");
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            console.log("Received topic data:", req.body);

            // Validate required fields
            const { title, description, technology, projectType, course } = req.body;

            if (!title || !technology || !projectType || !course) {
                return res.status(400).json({
                    message: "Missing required fields: title, technology, projectType, and course are required"
                });
            }

            if (!["BCA", "MCA"].includes(course)) {
                return res.status(400).json({
                    message: "Course must be either BCA or MCA"
                });
            }

            // Prepare topic data with user ID
            const topicData = {
                title,
                description,
                technology,
                projectType,
                course,
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
    router.put("/api/topics/:id", requireRole([UserRole.SUPERVISOR]), async (req: Request, res: Response) => {
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

            // Auto-assign project for MCA students
            if (topic.course === 'MCA') {
                const submitter = await storage.getUser(topic.submittedById);
                // If it was submitted by a student, it means they suggested it for their team
                if (submitter && submitter.role === UserRole.STUDENT) {
                    try {
                        await storage.createStudentProject({
                            studentId: submitter.id,
                            topicId: topic.id
                        });
                        
                        notifyUser(submitter.id, {
                            title: "Topic Finalized",
                            message: `Your topic "${topic.title}" has been approved and your project is now active.`
                        } as any);
                    } catch (err) {
                        console.error("Failed to auto-assign project for MCA team:", err);
                        // Even if auto-assign fails (e.g. duplicate project), topic is still approved
                    }
                }
            }

            res.json(topic);
        } catch (error) {
            console.error("Error approving topic:", error);
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
