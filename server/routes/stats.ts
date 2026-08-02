import { Router, Request, Response } from "express";
import { DBStorage } from "../db-storage";
import { UserRole } from "@shared/schema";
import { requireRole } from "../auth";
import { isAuthenticatedRequest } from "./utils";

export function registerStatsRoutes(router: Router, storage: DBStorage) {
    // Get statistics for dashboard
    router.get("/api/stats", async (req: Request, res: Response) => {
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

    // Department statistics
    router.get("/api/departments/stats", requireRole([UserRole.COORDINATOR, UserRole.ADMIN]), async (req: Request, res: Response) => {
        try {
            const stats = await storage.getDepartmentStats();
            res.json(stats);
        } catch (error) {
            res.status(500).json({ message: "Failed to fetch department statistics" });
        }
    });

    // Get recent activities
    router.get("/api/activities", (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
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
}
