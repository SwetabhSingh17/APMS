import { Router, Request, Response } from "express";
import { DBStorage } from "../db-storage";
import { UserRole, insertProjectAssessmentSchema } from "@shared/schema";
import { requireRole } from "../auth";
import { isAuthenticatedRequest } from "./utils";
import { z } from "zod";

export function registerProjectRoutes(router: Router, storage: DBStorage) {
    // Get projects for current student
    router.get("/api/projects/my", requireRole([UserRole.STUDENT]), async (req: Request, res: Response) => {
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
    router.post("/api/projects", requireRole([UserRole.STUDENT]), async (req: Request, res: Response) => {
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
                // Note: Check schema if createdById is available
                if ('createdById' in userGroup && userGroup.createdById !== user.id) {
                    return res.status(403).json({ message: "Only the group creator can select a project topic." });
                } else if (!('createdById' in userGroup)) {
                    // Fallback if not present in type
                    console.warn("Group createdById missing in type definition");
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
    router.get("/api/projects", requireRole([UserRole.COORDINATOR, UserRole.ADMIN, UserRole.TEACHER]), async (req: Request, res: Response) => {
        try {
            const projects = await storage.getAllProjects();
            console.log('Projects from storage:', projects);
            res.json(projects);
        } catch (error) {
            res.status(500).json({ message: "Failed to fetch projects" });
        }
    });

    // Get projects for teacher
    router.get("/api/projects/teacher", requireRole([UserRole.TEACHER]), async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            const allProjects = await storage.getAllProjects();
            console.log('All projects:', allProjects);

            const teacherProjects = allProjects.filter(project => {
                return project.topic?.submittedById === req.user.id;
            });

            res.json(teacherProjects);
        } catch (error) {
            console.error('Error fetching teacher projects:', error);
            res.status(500).json({ message: "Failed to fetch teacher projects" });
        }
    });

    // Create or update assessment
    router.post("/api/projects/:id/assess", requireRole([UserRole.TEACHER, UserRole.COORDINATOR]), async (req: Request, res: Response) => {
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
    router.get("/api/projects/:id/assessments", async (req: Request, res: Response) => {
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

            // Fetch topic to check submittedBy
            const topic = await storage.getProjectTopic(project.topicId);

            // Check if user is authorized to view assessments
            const isAuthorized =
                req.user.role === UserRole.ADMIN ||
                req.user.role === UserRole.COORDINATOR ||
                (req.user.role === UserRole.TEACHER && topic && req.user.id === topic.submittedById) ||
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
    router.get("/api/reports/search", requireRole([UserRole.COORDINATOR, UserRole.ADMIN]), async (req: Request, res: Response) => {
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
    router.get("/api/reports/projects/:id", requireRole([UserRole.COORDINATOR, UserRole.ADMIN, UserRole.TEACHER]), async (req: Request, res: Response) => {
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
    router.put('/api/projects/:id/progress', async (req: Request, res: Response) => {
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
}
